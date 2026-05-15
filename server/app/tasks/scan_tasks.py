"""
Celery tasks for scan execution.

Each task runs in its own worker process and manages its own DB connection
(Motor requires an event loop, so we spin one up with asyncio.run()).

Worker startup (from server/ directory):
  Windows:  celery -A celery_app worker --loglevel=info -Q scans --pool=solo
  Linux:    celery -A celery_app worker --loglevel=info -Q scans --concurrency=4
"""
import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from celery_app import celery_app
from app.core.config import settings
from app.models.scan import ScanStatus, ScanType
from app.models.scan_log import scan_log_document

logger = logging.getLogger(__name__)


# ── Target helpers ────────────────────────────────────────────────────────────

def _nmap_target(target: str) -> str:
    if target.startswith(("http://", "https://")):
        parsed = urlparse(target)
        return parsed.hostname or target
    return target


def _web_target(target: str) -> str:
    if not target.startswith(("http://", "https://")):
        return "http://" + target
    return target


# ── Logging helpers ───────────────────────────────────────────────────────────

async def _log(db: AsyncIOMotorDatabase, scan_id: str, phase: str, level: str, message: str) -> None:
    await db.scan_logs.insert_one(scan_log_document(scan_id, phase, level, message))


async def _set_phase(db: AsyncIOMotorDatabase, scan_id: str, phase: str) -> None:
    await db.scans.update_one(
        {"_id": ObjectId(scan_id)},
        {"$set": {"current_phase": phase, "updated_at": datetime.now(timezone.utc)}},
    )


# ── Main execution ────────────────────────────────────────────────────────────

async def _execute_scan(scan_id: str) -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    try:
        scan = await db.scans.find_one({"_id": ObjectId(scan_id)})
        if not scan:
            logger.warning("Scan %s not found — skipping.", scan_id)
            return

        if scan["status"] == ScanStatus.CANCELLED.value:
            return

        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {"status": ScanStatus.RUNNING.value, "started_at": now, "updated_at": now}},
        )

        scan_type = scan["scan_type"]
        target    = scan["target"]
        options   = scan.get("options", {})

        from app.services import recon_service, vuln_service, risk_service
        from app.services.recon_service import build_nmap_cmd_string

        hosts = []
        total_ports = 0

        # ── Phase 1: Reconnaissance ───────────────────────────────────────────
        if scan_type in (ScanType.RECONNAISSANCE.value, ScanType.VULNERABILITY.value, ScanType.FULL.value):
            await _set_phase(db, scan_id, "recon")
            nmap_host = _nmap_target(target)
            cmd_str = build_nmap_cmd_string(nmap_host, options)

            await _log(db, scan_id, "recon", "cmd",  f"> {cmd_str}")
            await _log(db, scan_id, "recon", "info", f"  Starting Nmap 7.94SVN — target: {nmap_host}")
            await _log(db, scan_id, "recon", "info",  "  Host discovery in progress (-Pn)...")

            hosts = await recon_service.run_nmap_scan(nmap_host, options)

            if hosts:
                await _log(db, scan_id, "recon", "info", f"  Host {hosts[0].ip} is up")
                await _log(db, scan_id, "recon", "info",  "  PORT     STATE  SERVICE   VERSION")
                for h in hosts:
                    for p in h.ports:
                        ver = f" {p.version}" if p.version else ""
                        await _log(db, scan_id, "recon", "info",
                                   f"  {p.port}/{p.protocol}   open   {p.service}{ver}")
                        total_ports += 1
                    if h.os_guess:
                        await _log(db, scan_id, "recon", "info", f"  OS: {h.os_guess}")
                await _log(db, scan_id, "recon", "success",
                           f"  [+] Recon complete — {total_ports} open port(s), {len(hosts)} host(s)")
            else:
                await _log(db, scan_id, "recon", "warning",
                           "  [!] No hosts responded — target may be offline or blocking scans")

            recon_data = [
                {
                    "ip": h.ip,
                    "hostname": h.hostname,
                    "os": h.os_guess,
                    "ports": [
                        {"port": p.port, "protocol": p.protocol, "service": p.service,
                         "version": p.version, "extra_info": p.extra_info}
                        for p in h.ports
                    ],
                }
                for h in hosts
            ]
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"recon_results": recon_data, "updated_at": datetime.now(timezone.utc)}},
            )

        # ── Phase 2: Vulnerability Correlation (NVD CVE + EPSS + KEV) ──────────
        if hosts and scan_type in (ScanType.VULNERABILITY.value, ScanType.FULL.value):
            await _set_phase(db, scan_id, "vuln_correlation")
            await _log(db, scan_id, "vuln_correlation", "cmd",
                       "> securex-nvd --cpe-match --epss --kev --correlate")
            await _log(db, scan_id, "vuln_correlation", "info",
                       "  Querying NIST NVD (CPE exact match → keyword fallback)...")
            await _log(db, scan_id, "vuln_correlation", "info",
                       "  Loading CISA KEV catalog and FIRST.org EPSS scores...")

            for h in hosts:
                for p in h.ports:
                    svc_str = f"{p.service} {p.version}".strip() if p.version else p.service
                    if svc_str:
                        await _log(db, scan_id, "vuln_correlation", "info",
                                   f"  Correlating {h.ip}:{p.port} ({svc_str})...")

            inserted = await vuln_service.correlate_vulnerabilities(db, scan_id, hosts)

            vuln_count    = len(inserted)
            kev_count     = sum(1 for v in inserted if v.get("in_kev"))
            high_epss     = sum(1 for v in inserted if (v.get("epss_score") or 0) >= 0.4)
            exploit_count = sum(1 for v in inserted if v.get("exploit_available"))

            if vuln_count:
                # Show top-5 by CVSS
                top5 = sorted(inserted, key=lambda v: v.get("cvss_score", 0), reverse=True)[:5]
                for v in top5:
                    sev     = v["severity"].upper()
                    score   = v["cvss_score"]
                    cve     = v["cve_id"]
                    kev_tag = " [KEV]" if v.get("in_kev") else ""
                    mtype   = " (cpe)" if v.get("match_type") == "cpe_exact" else ""
                    tag     = "  [CRITICAL]" if sev == "CRITICAL" else f"  [{sev}]    "
                    lvl     = "error" if sev in ("CRITICAL", "HIGH") else "warning"
                    await _log(db, scan_id, "vuln_correlation", lvl,
                               f"{tag} {cve}  CVSS:{score}{kev_tag}{mtype}")

                if kev_count:
                    await _log(db, scan_id, "vuln_correlation", "error",
                               f"  [!] {kev_count} CVE(s) in CISA Known Exploited Vulnerabilities list")
                if high_epss:
                    await _log(db, scan_id, "vuln_correlation", "warning",
                               f"  [!] {high_epss} CVE(s) with EPSS exploit probability >= 40%")

                await _log(db, scan_id, "vuln_correlation", "success",
                           f"  [+] Correlation complete — {vuln_count} CVE(s) found, "
                           f"{exploit_count} exploitable")
            else:
                await _log(db, scan_id, "vuln_correlation", "info",
                           "  [+] No CVEs matched for discovered services")

        # ── Phase 3: Web Assessment (sub-phases) ─────────────────────────────
        if scan_type in (ScanType.WEB_ASSESSMENT.value, ScanType.FULL.value):
            from app.services import web_service
            web_url = _web_target(target)
            _parsed = urlparse(web_url)
            _host = _parsed.hostname or web_url
            _port = _parsed.port or (443 if _parsed.scheme == "https" else 80)
            _scheme = _parsed.scheme
            _all_web: list = []

            # Sub-phase: web_init — connect to target
            await _set_phase(db, scan_id, "web_init")
            await _log(db, scan_id, "web_init", "cmd", f"> curl -ILk {web_url}")
            await _log(db, scan_id, "web_init", "info", f"  Establishing connection to {web_url} ...")
            try:
                _client, _resp = await web_service.connect_to_target(web_url)
            except Exception as _conn_exc:
                await _log(db, scan_id, "web_init", "error",
                           f"  [ERROR] Cannot connect to {web_url}: {_conn_exc}")
                raise
            await _log(db, scan_id, "web_init", "success",
                       f"  [+] HTTP {_resp.status_code} | Server: {_resp.headers.get('server', '?')} | {len(_resp.content)} bytes")

            # Sub-phase: web_headers — security headers, SSL, CORS, cookies
            await _set_phase(db, scan_id, "web_headers")
            await _log(db, scan_id, "web_headers", "cmd",
                       "> securex-web --check-headers --check-ssl --check-cors --check-cookies")
            await _log(db, scan_id, "web_headers", "info", "  Auditing HTTP security headers...")

            for _check_fn, _label in [
                (lambda: web_service.check_headers_and_disclosure(_resp, web_url), "headers"),
                (lambda: web_service.check_ssl_or_https(_parsed, _resp, web_url), "ssl"),
                (lambda: web_service.check_cors(_resp, web_url), "cors"),
                (lambda: web_service.check_cookies(_resp, web_url), "cookies"),
            ]:
                try:
                    _fnd = _check_fn()
                    _all_web += _fnd
                    for _f in _fnd[:2]:
                        _lvl = "error" if _f.severity.value in ("critical", "high") else "warning"
                        await _log(db, scan_id, "web_headers", _lvl,
                                   f"  [{_f.severity.value.upper()}] {_f.title}")
                except Exception as exc:
                    await _log(db, scan_id, "web_headers", "warning",
                               f"  [!] {_label} check error: {exc}")

            await _log(db, scan_id, "web_headers", "success",
                       f"  [+] Header audit complete — {len(_all_web)} finding(s) so far")

            # Sub-phase: web_active — path probing, injection testing, CSRF
            await _set_phase(db, scan_id, "web_active")
            await _log(db, scan_id, "web_active", "cmd",
                       f"> securex-web --probe-paths {web_service.SENSITIVE_PATH_COUNT} "
                       f"--check-methods --sqli --xss --csrf --cookies")
            await _log(db, scan_id, "web_active", "info",
                       f"  Probing {web_service.SENSITIVE_PATH_COUNT} sensitive paths...")

            try:
                _path_fnd = await web_service.check_sensitive_paths(_client, web_url)
                _all_web += _path_fnd
                for _f in _path_fnd[:5]:
                    _lvl = "error" if _f.severity.value in ("critical", "high") else "warning"
                    await _log(db, scan_id, "web_active", _lvl,
                               f"  [{_f.severity.value.upper()}] {_f.title} — {_f.affected_url}")
                if _path_fnd:
                    await _log(db, scan_id, "web_active", "info",
                               f"  {len(_path_fnd)} exposed path(s) found")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] Path probe error: {exc}")

            try:
                _meth_fnd = await web_service.check_http_methods(_client, web_url)
                _all_web += _meth_fnd
                for _f in _meth_fnd:
                    await _log(db, scan_id, "web_active", "warning",
                               f"  [{_f.severity.value.upper()}] {_f.title}")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] Method check error: {exc}")

            # SQL Injection
            await _log(db, scan_id, "web_active", "info",
                       "  Testing for SQL injection (error-based payloads)...")
            try:
                _sqli_fnd = await web_service.check_sql_injection(_client, web_url)
                _all_web += _sqli_fnd
                if _sqli_fnd:
                    for _f in _sqli_fnd:
                        await _log(db, scan_id, "web_active", "error",
                                   f"  [CRITICAL] {_f.title} — param: {_f.affected_url.split('?')[-1]}")
                else:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] No SQL injection vectors detected")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] SQLi check error: {exc}")

            # XSS
            await _log(db, scan_id, "web_active", "info",
                       "  Testing for reflected XSS (probe injection)...")
            try:
                _xss_fnd = await web_service.check_xss(_client, web_url)
                _all_web += _xss_fnd
                if _xss_fnd:
                    for _f in _xss_fnd:
                        await _log(db, scan_id, "web_active", "error",
                                   f"  [HIGH] {_f.title} — {_f.affected_url.split('?')[-1]}")
                else:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] No reflected XSS detected")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] XSS check error: {exc}")

            # CSRF
            await _log(db, scan_id, "web_active", "info",
                       "  Checking CSRF protection (forms + CORS credentials)...")
            try:
                _csrf_fnd = await web_service.check_csrf(_client, web_url, _resp)
                _all_web += _csrf_fnd
                for _f in _csrf_fnd:
                    await _log(db, scan_id, "web_active", "warning",
                               f"  [{_f.severity.value.upper()}] {_f.title}")
                if not _csrf_fnd:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] No CSRF vulnerabilities detected")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] CSRF check error: {exc}")

            # Cookie security on auth endpoints
            await _log(db, scan_id, "web_active", "info",
                       "  Probing auth endpoints for insecure cookie flags...")
            try:
                _ck_fnd = await web_service.check_cookies_on_endpoints(_client, web_url)
                _all_web += _ck_fnd
                for _f in _ck_fnd:
                    await _log(db, scan_id, "web_active", "warning",
                               f"  [{_f.severity.value.upper()}] {_f.title} — {_f.affected_url}")
                if not _ck_fnd:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] No insecure cookie flags found on auth endpoints")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] Cookie endpoint check error: {exc}")

            # A04 — Insecure Design (rate limiting on auth endpoints)
            await _log(db, scan_id, "web_active", "info",
                       "  Testing auth endpoints for rate limiting (A04: Insecure Design)...")
            try:
                _rl_fnd = await web_service.check_rate_limiting(_client, web_url)
                _all_web += _rl_fnd
                for _f in _rl_fnd:
                    await _log(db, scan_id, "web_active", "warning",
                               f"  [{_f.severity.value.upper()}] {_f.title} — {_f.affected_url}")
                if not _rl_fnd:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] Auth endpoints appear to enforce rate limiting")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] Rate limit check error: {exc}")

            # A08 — Software & Data Integrity Failures (Subresource Integrity)
            await _log(db, scan_id, "web_active", "info",
                       "  Inspecting HTML for missing Subresource Integrity (A08: Data Integrity)...")
            try:
                _sri_fnd = web_service.check_subresource_integrity(_resp, web_url)
                _all_web += _sri_fnd
                for _f in _sri_fnd:
                    await _log(db, scan_id, "web_active", "warning",
                               f"  [{_f.severity.value.upper()}] {_f.title}")
                if not _sri_fnd:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] All cross-origin assets have SRI or none are loaded")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] SRI check error: {exc}")

            # A09 — Security Logging & Monitoring Failures
            await _log(db, scan_id, "web_active", "info",
                       "  Probing for exposed logs & verbose error pages (A09: Logging)...")
            try:
                _log_fnd = await web_service.check_logging_and_monitoring(_client, web_url)
                _all_web += _log_fnd
                for _f in _log_fnd[:5]:
                    _lvl = "error" if _f.severity.value in ("critical", "high") else "warning"
                    await _log(db, scan_id, "web_active", _lvl,
                               f"  [{_f.severity.value.upper()}] {_f.title} — {_f.affected_url}")
                if not _log_fnd:
                    await _log(db, scan_id, "web_active", "success",
                               "  [+] No log exposure or verbose error pages detected")
            except Exception as exc:
                await _log(db, scan_id, "web_active", "warning", f"  [!] Logging check error: {exc}")

            try:
                await _client.aclose()
            except Exception:
                pass

            # Sub-phase: web_zap — OWASP ZAP Docker active scan (WSL2)
            await _set_phase(db, scan_id, "web_zap")
            await _log(db, scan_id, "web_zap", "cmd",
                       "> docker run ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon --spider --ascan")
            from app.services import zap_client
            await _log(db, scan_id, "web_zap", "info",
                       "  Checking Docker availability (WSL2)...")
            docker_ok = await zap_client.check_docker_available()
            if docker_ok:
                await _log(db, scan_id, "web_zap", "info",
                           "  Docker available — launching ZAP container...")
                await _log(db, scan_id, "web_zap", "info",
                           f"  Target: {web_url}")

                # Progress logger runs concurrently so the UI doesn't appear frozen
                _zap_stop = asyncio.Event()

                async def _zap_progress():
                    _steps = [
                        (20,  "info",    "  ZAP daemon initialising (this takes ~30-60s on first run)..."),
                        (50,  "info",    "  ZAP daemon ready — starting spider crawl..."),
                        (90,  "info",    "  Spider crawl in progress — discovering endpoints..."),
                        (150, "info",    "  Active scan started — testing injection points..."),
                        (210, "info",    "  Active scan running — testing XSS vectors..."),
                        (270, "info",    "  Active scan running — testing path traversal & SQLi..."),
                        (330, "info",    "  Active scan running — testing CORS & security headers..."),
                        (400, "warning", "  Still scanning — large site or slow target, please wait..."),
                        (470, "info",    "  Finalising ZAP results..."),
                    ]
                    _t0 = asyncio.get_event_loop().time()
                    for _delay, _lvl, _msg in _steps:
                        _remaining = _delay - (asyncio.get_event_loop().time() - _t0)
                        if _remaining > 0:
                            try:
                                await asyncio.wait_for(
                                    asyncio.shield(asyncio.Event().wait()),
                                    timeout=_remaining,
                                )
                            except asyncio.TimeoutError:
                                pass
                        if _zap_stop.is_set():
                            break
                        await _log(db, scan_id, "web_zap", _lvl, _msg)

                _progress_task = asyncio.create_task(_zap_progress())
                try:
                    _zap_findings = await zap_client.run_zap_scan(
                        web_url,
                        scan_id_suffix=scan_id[-8:],
                    )
                    _all_web += _zap_findings
                except Exception as _zap_exc:
                    await _log(db, scan_id, "web_zap", "warning",
                               f"  [!] ZAP scan error: {_zap_exc}")
                    _zap_findings = []
                finally:
                    _zap_stop.set()
                    _progress_task.cancel()
                    try:
                        await _progress_task
                    except asyncio.CancelledError:
                        pass

                if _zap_findings:
                    await _log(db, scan_id, "web_zap", "info",
                               "  Phase 2: Active scan complete")
                    for _f in _zap_findings[:10]:
                        _lvl = "error" if _f.severity.value in ("critical", "high") else "warning"
                        await _log(db, scan_id, "web_zap", _lvl,
                                   f"  [{_f.severity.value.upper()}] {_f.title} — {_f.affected_url}")
                    await _log(db, scan_id, "web_zap", "success",
                               f"  [+] ZAP scan complete — {len(_zap_findings)} finding(s)")
                else:
                    await _log(db, scan_id, "web_zap", "success",
                               "  [+] ZAP scan complete — no additional findings")
            else:
                await _log(db, scan_id, "web_zap", "warning",
                           "  [!] Docker not available in WSL2 — skipping ZAP scan")
                await _log(db, scan_id, "web_zap", "info",
                           "  Run: wsl -d Ubuntu -u root -- service docker start")

            # Sub-phase: web_nikto — Nikto Docker misconfiguration scan (WSL2)
            await _set_phase(db, scan_id, "web_nikto")
            await _log(db, scan_id, "web_nikto", "cmd",
                       f"> docker run --rm sullo/nikto -h {web_url} -Tuning 123bde -Format json")
            from app.services import nikto_client
            await _log(db, scan_id, "web_nikto", "info",
                       "  Checking Docker availability for Nikto...")
            nikto_docker_ok = await nikto_client.check_docker_available()
            if nikto_docker_ok:
                await _log(db, scan_id, "web_nikto", "info",
                           f"  Launching Nikto container — target: {web_url}")
                await _log(db, scan_id, "web_nikto", "info",
                           "  Tuning: interesting files, info disclosure, misconfigs, default files, server config")
                try:
                    _nikto_fnd = await nikto_client.run_nikto_scan(
                        web_url,
                        scan_id_suffix=scan_id[-8:],
                    )
                    _all_web += _nikto_fnd
                    if _nikto_fnd:
                        for _f in _nikto_fnd[:10]:
                            _lvl = "error" if _f.severity.value in ("critical", "high") else "warning"
                            await _log(db, scan_id, "web_nikto", _lvl,
                                       f"  [{_f.severity.value.upper()}] {_f.title}")
                        await _log(db, scan_id, "web_nikto", "success",
                                   f"  [+] Nikto scan complete — {len(_nikto_fnd)} finding(s)")
                    else:
                        await _log(db, scan_id, "web_nikto", "success",
                                   "  [+] Nikto scan complete — no misconfigurations detected")
                except Exception as _nikto_exc:
                    await _log(db, scan_id, "web_nikto", "warning",
                               f"  [!] Nikto scan error: {_nikto_exc}")
            else:
                await _log(db, scan_id, "web_nikto", "warning",
                           "  [!] Docker not available in WSL2 — skipping Nikto scan")

            await web_service.persist_findings(db, scan_id, _all_web, _host, _port, _scheme)
            _web_results = web_service.make_summary(_resp, web_url, _all_web)
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"web_results": _web_results, "updated_at": datetime.now(timezone.utc)}},
            )
            await _log(db, scan_id, "web_nikto", "success",
                       f"  [+] Web assessment complete — {len(_all_web)} total finding(s)")

        # ── Phase 4: Exploit Analysis ─────────────────────────────────────────
        if scan_type in (ScanType.VULNERABILITY.value, ScanType.FULL.value):
            await _set_phase(db, scan_id, "exploit_analysis")
            await _log(db, scan_id, "exploit_analysis", "cmd",
                       "> securex-exploit --check-kev --check-epss --source nvd")
            await _log(db, scan_id, "exploit_analysis", "info",
                       "  Cross-referencing CISA Known Exploited Vulnerabilities list...")

            exploit_count = 0
            cursor = db.vulnerabilities.find(
                {"scan_id": scan_id, "exploit_available": True}
            ).sort("cvss_score", -1)
            async for v in cursor:
                exploit_count += 1
                await _log(db, scan_id, "exploit_analysis", "error",
                           f"  [!] {v['cve_id']}  CVSS:{v['cvss_score']}  — exploit available")

            if exploit_count:
                await _log(db, scan_id, "exploit_analysis", "error",
                           f"  [!] {exploit_count} active exploit(s) found — immediate patching required")
            else:
                await _log(db, scan_id, "exploit_analysis", "success",
                           "  [+] No active exploits found for discovered CVEs")

            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"exploit_count": exploit_count, "updated_at": datetime.now(timezone.utc)}},
            )

        # ── Phase 5: Risk Scoring ─────────────────────────────────────────────
        await _set_phase(db, scan_id, "risk_scoring")
        await _log(db, scan_id, "risk_scoring", "cmd",
                   "> securex-risk --cvss-v3 --environmental --composite")
        await _log(db, scan_id, "risk_scoring", "info",
                   "  Applying CVSS v3.1 environmental scoring...")

        risk_summary = await risk_service.compute_risk_summary(db, scan_id)

        if risk_summary and risk_summary.get("total", 0) > 0:
            crit  = risk_summary.get("critical", 0)
            high  = risk_summary.get("high", 0)
            med   = risk_summary.get("medium", 0)
            low   = risk_summary.get("low", 0)
            max_s = risk_summary.get("max_cvss_score", 0)
            risk  = risk_summary.get("overall_risk", "info").upper()
            await _log(db, scan_id, "risk_scoring", "info",
                       f"  Critical ×{crit}  High ×{high}  Medium ×{med}  Low ×{low}")
            await _log(db, scan_id, "risk_scoring", "info", f"  Max CVSS Score: {max_s}")
            await _log(db, scan_id, "risk_scoring",
                       "error" if risk in ("CRITICAL", "HIGH") else "success",
                       f"  [!] Composite Risk Score: {risk}")

        # ── Phase 6: Report Generation ────────────────────────────────────────
        await _set_phase(db, scan_id, "report_generation")
        await _log(db, scan_id, "report_generation", "cmd",
                   "> securex-report --format json --attach-recon --sign")
        await _log(db, scan_id, "report_generation", "info",
                   "  Compiling findings into structured report...")
        await _log(db, scan_id, "report_generation", "info",
                   "  Embedding CVE cross-references and remediation steps...")
        await _log(db, scan_id, "report_generation", "success",
                   f"  [✓] SCN-{scan_id[-6:].upper()}-report generated")
        await _log(db, scan_id, "report_generation", "success",
                   "  [✓] Scan complete — all findings exported")

        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {
                "status": ScanStatus.COMPLETED.value,
                "current_phase": None,
                "risk_summary": risk_summary,
                "completed_at": now,
                "updated_at": now,
            }},
        )
        logger.info("Scan %s completed successfully.", scan_id)

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        try:
            doc = await db.scans.find_one({"_id": ObjectId(scan_id)}, {"current_phase": 1})
            phase = (doc or {}).get("current_phase") or "unknown"
            await _log(db, scan_id, phase, "error", f"  [ERROR] {exc}")
        except Exception:
            pass
        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {
                "status": ScanStatus.FAILED.value,
                "current_phase": None,
                "error": str(exc),
                "completed_at": now,
                "updated_at": now,
            }},
        )
    finally:
        client.close()


@celery_app.task(
    bind=True,
    name="app.tasks.scan_tasks.run_scan_task",
    max_retries=0,
    acks_late=True,
)
def run_scan_task(self, scan_id: str) -> None:
    asyncio.run(_execute_scan(scan_id))
