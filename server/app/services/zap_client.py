"""
OWASP ZAP Docker integration — active web vulnerability scanning.

Docker setup: Engine inside WSL2 Ubuntu (not Docker Desktop).
  - All docker commands run via: wsl -d Ubuntu -- docker ...
  - Daemon auto-start attempted via: wsl -d Ubuntu -u root -- service docker start
  - ZAP API accessible at localhost:8090 (WSL2 forwards ports to Windows automatically)

Image used: ghcr.io/zaproxy/zaproxy:stable (auto-pulled on first run)

Flow:
  1. Ensure Docker daemon is running inside WSL2
  2. Start ZAP container in daemon mode (REST API on port 8090)
  3. Spider the target (passive crawl)
  4. Run active scan (injection, XSS, path traversal, etc.)
  5. Collect alerts → WebFinding objects
  6. Stop and remove container

Public API:
  run_zap_scan(target_url, scan_id_suffix) -> list[WebFinding]
  check_docker_available()                 -> bool
"""
import asyncio
import logging
import time
from typing import Optional

import httpx

from app.services.web_service import WebFinding, Severity

logger = logging.getLogger(__name__)

ZAP_IMAGE        = "ghcr.io/zaproxy/zaproxy:stable"
ZAP_PORT         = 8090
ZAP_STARTUP_SECS = 120   # ZAP is a Java app — give it 2 min to initialise
ZAP_SPIDER_SECS  = 180
ZAP_ASCAN_SECS   = 300

_RISK_MAP: dict[int, tuple[Severity, float]] = {
    3: (Severity.HIGH,   7.5),
    2: (Severity.MEDIUM, 5.0),
    1: (Severity.LOW,    3.0),
    0: (Severity.INFO,   0.0),
}

_CWE_OWASP: dict[int, str] = {
    79:   "A03:2021",
    89:   "A03:2021",
    352:  "A01:2021",
    22:   "A01:2021",
    200:  "A02:2021",
    311:  "A02:2021",
    312:  "A02:2021",
    326:  "A02:2021",
    693:  "A05:2021",
    732:  "A01:2021",
    918:  "A10:2021",
    601:  "A01:2021",
    611:  "A05:2021",
    94:   "A03:2021",
    113:  "A03:2021",
    16:   "A05:2021",
    1021: "A04:2021",
    319:  "A02:2021",
    614:  "A02:2021",
    1004: "A02:2021",
}


# ── WSL2 helpers ──────────────────────────────────────────────────────────────

async def _wsl(*args: str, user: str | None = None) -> tuple[int, str, str]:
    """Run a command inside WSL2 Ubuntu."""
    cmd = ["wsl", "-d", "Ubuntu"]
    if user:
        cmd += ["-u", user]
    cmd += ["--"] + list(args)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return proc.returncode, stdout.decode().strip(), stderr.decode().strip()
    except (FileNotFoundError, OSError) as exc:
        return 1, "", str(exc)


async def _docker(*args: str) -> tuple[int, str, str]:
    return await _wsl("docker", *args)


async def _ensure_docker_running() -> bool:
    """Start Docker daemon inside WSL2 if not already running."""
    rc, _, _ = await _docker("info")
    if rc == 0:
        return True

    logger.info("Docker daemon not running — starting via WSL2...")
    rc, _, err = await _wsl("service", "docker", "start", user="root")
    if rc != 0:
        logger.warning("Failed to start Docker daemon in WSL2: %s", err)
        return False

    # Give daemon a few seconds to initialise
    await asyncio.sleep(4)
    rc, _, _ = await _docker("info")
    return rc == 0


# ── WSL2 / ZAP network helpers ────────────────────────────────────────────────

async def _get_wsl2_ip() -> str:
    """
    Return the WSL2 VM's IP address so we can reach Docker-mapped ports
    from Windows. WSL2 auto-forwards to localhost only with mirrored
    networking; in NAT mode (default) we need the actual VM IP.
    """
    rc, out, _ = await _wsl("hostname", "-I")
    if rc == 0 and out:
        ip = out.split()[0].strip()
        logger.info("WSL2 IP: %s", ip)
        return ip
    logger.warning("Could not determine WSL2 IP — falling back to localhost")
    return "localhost"


def _zap_target(target_url: str) -> str:
    """
    Replace localhost/127.0.0.1 with host.docker.internal so the ZAP
    container (running inside WSL2 Docker) can reach the Windows host.
    """
    return (target_url
            .replace("localhost", "host.docker.internal")
            .replace("127.0.0.1", "host.docker.internal"))


# ── ZAP lifecycle helpers ─────────────────────────────────────────────────────

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


_RISK_STR: dict[str, int] = {
    "informational": 0, "info": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}


def _alert_to_finding(alert: dict, fallback_url: str) -> Optional[WebFinding]:
    # ZAP ≤2.14 uses integer riskcode; ZAP 2.15+ returns string "risk" field
    raw = alert.get("riskcode") or alert.get("risk", -1)
    try:
        risk = int(raw)
    except (ValueError, TypeError):
        risk = _RISK_STR.get(str(raw).lower(), -1)
    if risk < 1:
        return None

    severity, cvss = _RISK_MAP.get(risk, (Severity.LOW, 3.0))
    cwe   = int(alert.get("cweid", 0))
    owasp = _CWE_OWASP.get(cwe, "A05:2021")
    url   = alert.get("url") or fallback_url
    evid  = alert.get("evidence") or alert.get("param") or ""
    refs  = [alert["reference"]] if alert.get("reference") else []

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
    """Check if Docker is usable in WSL2; tries to start daemon if needed."""
    try:
        rc, _, _ = await _wsl("echo", "ok")
        if rc != 0:
            return False
        return await _ensure_docker_running()
    except Exception:
        return False


async def _wsl_keepalive(duration: int = 700) -> asyncio.subprocess.Process:
    """
    Spawn a background WSL2 sleep process so the VM stays alive for the
    full duration of the ZAP scan. Without this, WSL2 shuts down after
    ~60s of inactivity, killing all Docker containers.
    """
    proc = await asyncio.create_subprocess_exec(
        "wsl", "-d", "Ubuntu", "--", "sleep", str(duration),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    return proc


async def run_zap_scan(target_url: str, scan_id_suffix: str = "default") -> list[WebFinding]:
    """
    Run OWASP ZAP spider + active scan via Docker inside WSL2.
    Returns list of WebFinding objects (info-level alerts excluded).
    """
    container  = f"securexzap_{scan_id_suffix}"
    zap_base   = f"http://localhost:{ZAP_PORT}"
    zap_target = _zap_target(target_url)
    findings: list[WebFinding] = []

    # Keep WSL2 VM alive for entire scan (prevents idle shutdown killing containers)
    _keepalive = await _wsl_keepalive(duration=700)

    try:
        # Stop any container already holding ZAP_PORT (from a previous failed run)
        rc, out, _ = await _docker("ps", "-q", "--filter", f"publish={ZAP_PORT}")
        if rc == 0 and out.strip():
            for _cid in out.strip().splitlines():
                logger.info("Releasing port %s held by container %s", ZAP_PORT, _cid.strip())
                await _docker("stop", _cid.strip())

        # Remove stale same-named container silently
        await _docker("rm", "-f", container)

        logger.info("Starting ZAP container %s for %s", container, zap_target)
        rc, _, err = await _docker(
            "run", "-d", "--rm",
            "--name", container,
            "-p", f"{ZAP_PORT}:8090",
            "--add-host=host.docker.internal:host-gateway",
            ZAP_IMAGE,
            "zap.sh", "-daemon",
            "-host", "0.0.0.0",
            "-port", "8090",
            "-config", "api.disablekey=true",
            "-config", "api.addrs.addr.name=.*",
            "-config", "api.addrs.addr.regex=true",
        )
        if rc != 0:
            raise RuntimeError(f"ZAP container failed to start: {err}")

        logger.info("Waiting for ZAP daemon to initialise...")
        if not await _wait_zap_ready(zap_base):
            raise RuntimeError(f"ZAP daemon did not become ready within {ZAP_STARTUP_SECS}s")

        logger.info("ZAP spider: %s", zap_target)
        await _spider(zap_base, zap_target)

        logger.info("ZAP active scan: %s", zap_target)
        await _active_scan(zap_base, zap_target)

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{zap_base}/JSON/core/view/alerts/",
                            params={"baseurl": zap_target})
            alerts = r.json().get("alerts", [])

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
        try:
            _keepalive.terminate()
        except Exception:
            pass

    return findings
