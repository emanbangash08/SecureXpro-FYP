"""
OWASP ZAP Docker integration — active web vulnerability scanning.

Requires: Docker installed and running on the host.
Image used: ghcr.io/zaproxy/zaproxy:stable (auto-pulled on first run)

Flow:
  1. Start ZAP container in daemon mode (REST API on port 8090)
  2. Spider the target (passive crawl)
  3. Run active scan (injection, XSS, path traversal, etc.)
  4. Collect alerts → WebFinding objects
  5. Stop and remove container

Public API:
  run_zap_scan(target_url, scan_id_suffix) -> list[WebFinding]
  check_docker_available()                 -> bool
"""
import asyncio
import logging
import platform
import time
from typing import Optional

import httpx

from app.services.web_service import WebFinding, Severity

logger = logging.getLogger(__name__)

ZAP_IMAGE          = "ghcr.io/zaproxy/zaproxy:stable"
ZAP_PORT           = 8090
ZAP_STARTUP_SECS   = 90    # max wait for daemon to be ready
ZAP_SPIDER_SECS    = 180   # max spider runtime
ZAP_ASCAN_SECS     = 300   # max active scan runtime

# ZAP risk level → (Severity, CVSS base estimate)
_RISK_MAP: dict[int, tuple[Severity, float]] = {
    3: (Severity.HIGH,   7.5),
    2: (Severity.MEDIUM, 5.0),
    1: (Severity.LOW,    3.0),
    0: (Severity.INFO,   0.0),
}

# CWE → OWASP Top 10 2021 for common ZAP plugin findings
_CWE_OWASP: dict[int, str] = {
    79:   "A03:2021",  # XSS
    89:   "A03:2021",  # SQL Injection
    352:  "A01:2021",  # CSRF
    22:   "A01:2021",  # Path Traversal
    200:  "A02:2021",  # Sensitive Data Exposure
    311:  "A02:2021",  # Missing Encryption
    312:  "A02:2021",  # Cleartext Storage
    326:  "A02:2021",  # Weak Encryption
    693:  "A05:2021",  # Protection Mechanism Failure
    732:  "A01:2021",  # Incorrect Permission Assignment
    918:  "A10:2021",  # SSRF
    601:  "A01:2021",  # Open Redirect
    611:  "A05:2021",  # XXE
    94:   "A03:2021",  # Code Injection
    113:  "A03:2021",  # HTTP Response Splitting
    16:   "A05:2021",  # Security Misconfiguration
    1021: "A04:2021",  # Clickjacking
    319:  "A02:2021",  # Cleartext Transmission
    614:  "A02:2021",  # Sensitive Cookie without Secure
    1004: "A02:2021",  # Sensitive Cookie without HttpOnly
}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _docker(*args: str) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        "docker", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


def _zap_target(target_url: str) -> str:
    """Replace localhost with host.docker.internal so ZAP container can reach the host."""
    if platform.system() in ("Windows", "Darwin"):
        return (target_url
                .replace("localhost", "host.docker.internal")
                .replace("127.0.0.1", "host.docker.internal"))
    return target_url


async def _wait_zap_ready(base: str) -> bool:
    deadline = time.monotonic() + ZAP_STARTUP_SECS
    async with httpx.AsyncClient(timeout=5) as c:
        while time.monotonic() < deadline:
            try:
                r = await c.get(f"{base}/JSON/core/view/version/")
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(3)
    return False


async def _spider(base: str, url: str) -> None:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{base}/JSON/spider/action/scan/",
                        params={"url": url, "recurse": "true"})
        scan_id = r.json().get("scan", "0")
        deadline = time.monotonic() + ZAP_SPIDER_SECS
        while time.monotonic() < deadline:
            r = await c.get(f"{base}/JSON/spider/view/status/",
                            params={"scanId": scan_id})
            if int(r.json().get("status", 0)) >= 100:
                break
            await asyncio.sleep(5)


async def _active_scan(base: str, url: str) -> None:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{base}/JSON/ascan/action/scan/",
                        params={"url": url, "recurse": "true"})
        scan_id = r.json().get("scan", "0")
        deadline = time.monotonic() + ZAP_ASCAN_SECS
        while time.monotonic() < deadline:
            r = await c.get(f"{base}/JSON/ascan/view/status/",
                            params={"scanId": scan_id})
            if int(r.json().get("status", 0)) >= 100:
                break
            await asyncio.sleep(10)


def _alert_to_finding(alert: dict, fallback_url: str) -> Optional[WebFinding]:
    risk = int(alert.get("risk", -1))
    if risk < 1:  # skip informational
        return None

    severity, cvss = _RISK_MAP.get(risk, (Severity.LOW, 3.0))
    cwe    = int(alert.get("cweid", 0))
    owasp  = _CWE_OWASP.get(cwe, "A05:2021")
    url    = alert.get("url") or fallback_url
    evid   = alert.get("evidence") or alert.get("param") or ""
    refs   = [alert["reference"]] if alert.get("reference") else []

    return WebFinding(
        check_id    = f"zap_{alert.get('pluginid', 'unknown')}",
        title       = alert.get("alert", "ZAP Finding"),
        description = alert.get("description", ""),
        severity    = severity,
        cvss_score  = cvss,
        owasp       = owasp,
        affected_url= url,
        evidence    = evid[:500],
        remediation = alert.get("solution", "See ZAP alert for details."),
        references  = refs,
    )


# ── Public API ────────────────────────────────────────────────────────────────

async def check_docker_available() -> bool:
    rc, _, _ = await _docker("--version")
    return rc == 0


async def run_zap_scan(target_url: str, scan_id_suffix: str = "default") -> list[WebFinding]:
    """
    Run OWASP ZAP spider + active scan in a Docker container.
    Returns list of WebFinding objects (info-level alerts excluded).
    """
    container  = f"securexzap_{scan_id_suffix}"
    zap_base   = f"http://localhost:{ZAP_PORT}"
    zap_target = _zap_target(target_url)
    findings: list[WebFinding] = []

    # Remove stale container silently
    await _docker("rm", "-f", container)

    logger.info("Starting ZAP container %s for %s", container, zap_target)
    rc, _, err = await _docker(
        "run", "-d", "--rm",
        "--name", container,
        "-p", f"{ZAP_PORT}:8090",
        "--add-host", "host.docker.internal:host-gateway",
        ZAP_IMAGE,
        "zap.sh", "-daemon",
        "-host", "0.0.0.0",
        "-port", "8090",
        "-config", "api.disablekey=true",
    )
    if rc != 0:
        raise RuntimeError(f"ZAP container failed to start: {err}")

    try:
        logger.info("Waiting for ZAP daemon to initialise...")
        if not await _wait_zap_ready(zap_base):
            raise RuntimeError("ZAP daemon did not become ready within 90 s")

        logger.info("ZAP spider: %s", zap_target)
        await _spider(zap_base, zap_target)

        logger.info("ZAP active scan: %s", zap_target)
        await _active_scan(zap_base, zap_target)

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{zap_base}/JSON/core/view/alerts/",
                            params={"baseurl": zap_target})
            alerts = r.json().get("alerts", [])

        # Deduplicate by (pluginid, url, param)
        seen: set[tuple] = set()
        for alert in alerts:
            key = (alert.get("pluginid"), alert.get("url"), alert.get("param"))
            if key in seen:
                continue
            seen.add(key)
            f = _alert_to_finding(alert, target_url)
            if f:
                findings.append(f)

        logger.info("ZAP scan finished: %d finding(s)", len(findings))

    finally:
        logger.info("Stopping ZAP container %s", container)
        await _docker("stop", container)

    return findings
