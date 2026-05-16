"""
Nikto Docker integration — web server configuration & misconfiguration scanning.

Docker setup: Engine inside WSL2 Ubuntu (mirrors zap_client.py).
  - All docker commands run via: wsl -d Ubuntu -- docker ...
  - Daemon auto-start attempted via: wsl -d Ubuntu -u root -- service docker start

Image used: sullo/nikto:latest (auto-pulled on first run)

Flow:
  1. Ensure Docker daemon is running inside WSL2
  2. Run one-shot Nikto container with -Format json to stdout
  3. Parse JSON output → WebFinding objects
  4. Map Nikto OSVDB / CWE references to OWASP Top 10

Public API:
  run_nikto_scan(target_url, scan_id_suffix) -> list[WebFinding]
"""
import asyncio
import json
import logging
import re
from typing import Optional

from app.services.web_service import WebFinding, Severity

logger = logging.getLogger(__name__)

NIKTO_IMAGE       = "sullo/nikto:latest"
NIKTO_TIMEOUT     = 600   # 10 min hard cap on Nikto runtime
NIKTO_TUNING      = "123bde"  # interesting files, info disclosure, misconfig, default files, server config

# Nikto severity inference — Nikto doesn't ship severity, so we map by category.
# Keys are lowercase substrings of the Nikto message; first match wins.
_SEVERITY_MAP: list[tuple[str, Severity, float, str]] = [
    # (substring, severity, cvss, owasp)
    ("sql injection",            Severity.CRITICAL, 9.8, "A03:2021"),
    ("remote code execution",    Severity.CRITICAL, 9.8, "A03:2021"),
    ("rce",                      Severity.CRITICAL, 9.8, "A03:2021"),
    ("backup",                   Severity.HIGH,     8.6, "A05:2021"),
    ("phpinfo",                  Severity.HIGH,     7.5, "A05:2021"),
    ("cgi",                      Severity.HIGH,     7.5, "A05:2021"),
    ("default account",          Severity.HIGH,     8.1, "A07:2021"),
    ("default credentials",      Severity.HIGH,     8.1, "A07:2021"),
    ("admin",                    Severity.MEDIUM,   6.5, "A05:2021"),
    ("directory indexing",       Severity.MEDIUM,   5.3, "A05:2021"),
    ("directory listing",        Severity.MEDIUM,   5.3, "A05:2021"),
    ("trace",                    Severity.LOW,      4.3, "A05:2021"),
    ("options",                  Severity.LOW,      3.7, "A05:2021"),
    ("outdated",                 Severity.MEDIUM,   6.5, "A06:2021"),
    ("vulnerable",               Severity.HIGH,     7.5, "A06:2021"),
    ("clickjacking",             Severity.MEDIUM,   5.4, "A05:2021"),
    ("x-frame-options",          Severity.MEDIUM,   5.4, "A05:2021"),
    ("strict-transport-security",Severity.MEDIUM,   5.4, "A02:2021"),
    ("content-security-policy",  Severity.MEDIUM,   5.4, "A05:2021"),
    ("x-content-type-options",   Severity.LOW,      3.7, "A05:2021"),
    ("cookie",                   Severity.MEDIUM,   5.4, "A02:2021"),
    ("disclosure",               Severity.LOW,      4.3, "A05:2021"),
    ("information leak",         Severity.LOW,      4.3, "A05:2021"),
    ("robots.txt",               Severity.LOW,      3.1, "A05:2021"),
]


# ── WSL2 helpers ──────────────────────────────────────────────────────────────

async def _wsl(*args: str, user: str | None = None, timeout: int = NIKTO_TIMEOUT) -> tuple[int, str, str]:
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
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return 124, "", f"wsl command timed out after {timeout}s"
        return proc.returncode, stdout.decode(errors="replace").strip(), stderr.decode(errors="replace").strip()
    except (FileNotFoundError, OSError) as exc:
        return 1, "", str(exc)


async def _docker(*args: str, timeout: int = NIKTO_TIMEOUT) -> tuple[int, str, str]:
    return await _wsl("docker", *args, timeout=timeout)


async def _ensure_docker_running() -> bool:
    """Start Docker daemon inside WSL2 if not already running."""
    rc, _, _ = await _docker("info", timeout=15)
    if rc == 0:
        return True

    logger.info("Docker daemon not running — starting via WSL2 (nikto)...")
    rc, _, err = await _wsl("service", "docker", "start", user="root", timeout=20)
    if rc != 0:
        logger.warning("Failed to start Docker daemon for Nikto: %s", err)
        return False

    await asyncio.sleep(4)
    rc, _, _ = await _docker("info", timeout=15)
    return rc == 0


def _nikto_target(target_url: str) -> str:
    """Replace localhost so the Nikto container can reach the Windows host."""
    return (target_url
            .replace("localhost", "host.docker.internal")
            .replace("127.0.0.1", "host.docker.internal"))


# ── Finding mapping ───────────────────────────────────────────────────────────

def _classify(msg: str) -> tuple[Severity, float, str]:
    """Pick severity/CVSS/OWASP from the Nikto message text."""
    low = msg.lower()
    for needle, sev, cvss, owasp in _SEVERITY_MAP:
        if needle in low:
            return sev, cvss, owasp
    # Default — Nikto findings without explicit severity are usually informational misconfig
    return Severity.LOW, 4.3, "A05:2021"


def _item_to_finding(item: dict, fallback_url: str) -> Optional[WebFinding]:
    msg = (item.get("msg") or "").strip()
    if not msg:
        return None

    severity, cvss, owasp = _classify(msg)

    url = item.get("url") or item.get("uri") or fallback_url
    if url and not url.startswith("http"):
        # Nikto often returns just the path
        url = fallback_url.rstrip("/") + ("/" + url.lstrip("/") if url else "")

    osvdb = item.get("OSVDB") or item.get("osvdb") or ""
    refs = item.get("references")
    references: list[str] = []
    if isinstance(refs, list):
        references = [str(r) for r in refs if r]
    elif isinstance(refs, str) and refs:
        references = [refs]
    if osvdb and osvdb != "0":
        references.append(f"OSVDB-{osvdb}")

    check_id = f"nikto_{item.get('id', osvdb or 'unknown')}"

    return WebFinding(
        check_id     = check_id,
        title        = msg.split(":")[0][:120] if ":" in msg else msg[:120],
        description  = msg,
        severity     = severity,
        cvss_score   = cvss,
        owasp        = owasp,
        affected_url = url or fallback_url,
        evidence     = (item.get("method") or "GET") + " " + (item.get("uri") or "/"),
        remediation  = "Review the Nikto finding and apply the relevant server-side fix (patch, header, or configuration change).",
        references   = references,
    )


def _parse_nikto_output(stdout: str, fallback_url: str) -> list[WebFinding]:
    """
    Nikto JSON output is an array (or a wrapper object containing 'vulnerabilities').
    Tolerate both shapes plus stray non-JSON banner lines.
    """
    if not stdout:
        return []

    # Strip any leading non-JSON banner lines that Nikto sometimes prints
    text = stdout.strip()
    start = text.find("{")
    arr_start = text.find("[")
    if start == -1 or (arr_start != -1 and arr_start < start):
        start = arr_start
    if start > 0:
        text = text[start:]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Fallback — Nikto stdout occasionally has multiple top-level objects.
        # Extract every "{ ... }" block we can find via a non-greedy regex.
        findings: list[WebFinding] = []
        for blob in re.findall(r"\{[^{}]*\"msg\"[^{}]*\}", text, re.DOTALL):
            try:
                item = json.loads(blob)
            except json.JSONDecodeError:
                continue
            f = _item_to_finding(item, fallback_url)
            if f:
                findings.append(f)
        return findings

    # Unwrap common shapes
    items: list[dict] = []
    if isinstance(data, list):
        items = [d for d in data if isinstance(d, dict)]
    elif isinstance(data, dict):
        if isinstance(data.get("vulnerabilities"), list):
            items = data["vulnerabilities"]
        elif isinstance(data.get("items"), list):
            items = data["items"]
        else:
            # Single host wrapper — collect from nested entries
            for v in data.values():
                if isinstance(v, list):
                    items.extend(d for d in v if isinstance(d, dict))

    findings: list[WebFinding] = []
    seen: set[tuple] = set()
    for item in items:
        key = (item.get("id") or item.get("OSVDB"), item.get("msg"), item.get("uri"))
        if key in seen:
            continue
        seen.add(key)
        f = _item_to_finding(item, fallback_url)
        if f:
            findings.append(f)
    return findings


# ── Public API ────────────────────────────────────────────────────────────────

async def check_docker_available() -> bool:
    """Check if Docker is usable in WSL2; tries to start daemon if needed."""
    try:
        rc, _, _ = await _wsl("echo", "ok", timeout=10)
        if rc != 0:
            return False
        return await _ensure_docker_running()
    except Exception:
        return False


async def run_nikto_scan(target_url: str, scan_id_suffix: str = "default") -> list[WebFinding]:
    """
    Run Nikto via Docker inside WSL2.

    Nikto produces JSON output to stdout when given `-Format json -output -`.
    The container is removed after the scan (--rm).
    """
    container = f"securexnikto_{scan_id_suffix}"
    nikto_target = _nikto_target(target_url)

    # Remove stale container with the same name from a previous failed run
    await _docker("rm", "-f", container, timeout=15)

    logger.info("Starting Nikto container %s for %s", container, nikto_target)

    rc, stdout, stderr = await _docker(
        "run", "--rm",
        "--name", container,
        "--add-host=host.docker.internal:host-gateway",
        NIKTO_IMAGE,
        "-h", nikto_target,
        "-Tuning", NIKTO_TUNING,
        "-maxtime", "8m",       # internal Nikto timeout, slightly under our wsl timeout
        "-ask", "no",
        "-nointeractive",
        "-Format", "json",
        "-output", "-",
    )

    if rc not in (0,):
        # Nikto exits non-zero on certain conditions but may still produce findings;
        # log and keep going if we have any stdout, otherwise raise.
        logger.warning("Nikto exited rc=%s: %s", rc, stderr[:300] if stderr else "(no stderr)")
        if not stdout:
            raise RuntimeError(f"Nikto run failed (rc={rc}): {stderr[:300]}")

    findings = _parse_nikto_output(stdout, target_url)
    logger.info("Nikto scan finished: %d finding(s)", len(findings))
    return findings
