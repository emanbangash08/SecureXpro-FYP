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

        # ── Phase 2: Vulnerability Correlation (NVD CVE) ─────────────────────
        if hosts and scan_type in (ScanType.VULNERABILITY.value, ScanType.FULL.value):
            await _set_phase(db, scan_id, "vuln_correlation")
            await _log(db, scan_id, "vuln_correlation", "cmd",
                       "> securex-nvd --api nist.gov/rest/json/cves/2.0 --correlate")
            await _log(db, scan_id, "vuln_correlation", "info",
                       "  Querying NIST National Vulnerability Database...")

            for h in hosts:
                for p in h.ports:
                    svc_str = f"{p.service} {p.version}".strip() if p.version else p.service
                    if svc_str:
                        await _log(db, scan_id, "vuln_correlation", "info",
                                   f"  Checking {h.ip}:{p.port} ({svc_str})...")

            await vuln_service.correlate_vulnerabilities(db, scan_id, hosts)

            vuln_count = await db.vulnerabilities.count_documents({"scan_id": scan_id})
            if vuln_count:
                cursor = db.vulnerabilities.find({"scan_id": scan_id}).sort("cvss_score", -1).limit(5)
                async for v in cursor:
                    sev   = v["severity"].upper()
                    score = v["cvss_score"]
                    cve   = v["cve_id"]
                    title = v.get("title", "")[:55]
                    tag   = "  [CRITICAL]" if sev == "CRITICAL" else f"  [{sev}]    "
                    lvl   = "error" if sev in ("CRITICAL", "HIGH") else "warning"
                    await _log(db, scan_id, "vuln_correlation", lvl,
                               f"{tag} {cve}  CVSS:{score}  {title}")
                await _log(db, scan_id, "vuln_correlation", "success",
                           f"  [+] Correlation complete — {vuln_count} CVE(s) identified")
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

            # Sub-phase: web_active — path probing and HTTP methods
            await _set_phase(db, scan_id, "web_active")
            await _log(db, scan_id, "web_active", "cmd",
                       f"> securex-web --probe-paths {web_service.SENSITIVE_PATH_COUNT} --check-methods")
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

            try:
                await _client.aclose()
            except Exception:
                pass

            await web_service.persist_findings(db, scan_id, _all_web, _host, _port, _scheme)
            _web_results = web_service.make_summary(_resp, web_url, _all_web)
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"web_results": _web_results, "updated_at": datetime.now(timezone.utc)}},
            )
            await _log(db, scan_id, "web_active", "success",
                       f"  [+] Active probing complete — {len(_all_web)} total finding(s)")

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
