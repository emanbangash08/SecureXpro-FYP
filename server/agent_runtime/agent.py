"""
SecureXpro distributed scanning agent.

Run this on a host inside a network you want scanned from the inside.
It logs in to the SecureXpro backend as an `agent`-role user, polls for
scans assigned to it, runs Nmap locally, and uploads the raw XML back
to the server. The server then runs the rest of the pipeline (vuln
correlation, exploit analysis, risk scoring) centrally.

Usage:
    python -m agent_runtime.agent \
        --server-url http://192.168.1.10:8000 \
        --email agent1@example.com \
        --password '<agent-password>'

Environment variables (override CLI flags if both set):
    SXP_SERVER_URL, SXP_AGENT_EMAIL, SXP_AGENT_PASSWORD
"""
import argparse
import asyncio
import os
import shutil
import sys
import time

import httpx


POLL_INTERVAL_SECONDS = 5
HEARTBEAT_INTERVAL_SECONDS = 30
NMAP_TIMEOUT_SECONDS = 1800   # 30 min hard cap per scan
REQUEST_TIMEOUT = 60.0


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ── HTTP helpers ──────────────────────────────────────────────────────────────

async def login(client: httpx.AsyncClient, server: str, email: str, password: str) -> str:
    r = await client.post(
        f"{server}/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if r.status_code != 200:
        raise SystemExit(f"Login failed ({r.status_code}): {r.text}")
    data = r.json()
    user = data.get("user", {})
    if user.get("role") != "agent":
        raise SystemExit(
            f"User role is '{user.get('role')}', not 'agent'. "
            "Ask your admin to set this account's role to 'agent'."
        )
    _log(f"Logged in as {user.get('username')} (role={user.get('role')})")
    return data["access_token"]


async def poll_next_scan(client: httpx.AsyncClient, server: str, token: str) -> dict | None:
    r = await client.get(
        f"{server}/api/v1/agents/me/next-scan",
        headers={"Authorization": f"Bearer {token}"},
    )
    if r.status_code == 204:
        return None
    if r.status_code != 200:
        _log(f"poll error {r.status_code}: {r.text}")
        return None
    return r.json()


async def upload_result(
    client: httpx.AsyncClient, server: str, token: str, scan_id: str, xml: str
) -> None:
    r = await client.post(
        f"{server}/api/v1/agents/me/scan-results/{scan_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"nmap_xml": xml},
    )
    if r.status_code >= 300:
        _log(f"upload failed ({r.status_code}): {r.text}")
        return
    _log(f"uploaded result for scan {scan_id}: {r.json()}")


async def heartbeat(client: httpx.AsyncClient, server: str, token: str) -> None:
    try:
        await client.post(
            f"{server}/api/v1/agents/me/heartbeat",
            headers={"Authorization": f"Bearer {token}"},
        )
    except Exception as e:
        _log(f"heartbeat failed: {e}")


# ── Nmap ──────────────────────────────────────────────────────────────────────

def _build_nmap_args(options: dict) -> list[str]:
    """Mirrors server/app/services/recon_service.py:_build_nmap_flags."""
    intensity = options.get("intensity", "T4")
    if intensity not in ("T3", "T4", "T5"):
        intensity = "T4"

    flags = ["-Pn", "-sV", "--version-intensity", "5", f"-{intensity}"]
    if options.get("os_detection"):
        flags.append("-O")
    if options.get("aggressive"):
        flags.append("-A")
    if options.get("nse_scripts"):
        flags.append("-sC")
    if options.get("traceroute"):
        flags.append("--traceroute")
    if options.get("udp"):
        flags += ["-sU", "-sS"]

    port_range = options.get("port_range", "1-1000")
    flags += ["-p", port_range]
    return flags


async def run_nmap(target: str, options: dict) -> str:
    if shutil.which("nmap") is None:
        raise RuntimeError(
            "nmap not found on PATH. Install Nmap (https://nmap.org/download.html) "
            "and rerun the agent."
        )
    args = _build_nmap_args(options)
    cmd = ["nmap", "-oX", "-", *args, target]
    _log(f"running: {' '.join(cmd)}")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=NMAP_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"nmap exceeded {NMAP_TIMEOUT_SECONDS}s and was killed")

    if proc.returncode != 0:
        raise RuntimeError(f"nmap exit {proc.returncode}: {stderr.decode(errors='ignore')}")
    return stdout.decode(errors="ignore")


# ── Main loop ─────────────────────────────────────────────────────────────────

async def main_loop(server: str, email: str, password: str) -> None:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        token = await login(client, server, email, password)
        last_heartbeat = 0.0

        while True:
            try:
                now = time.time()
                if now - last_heartbeat >= HEARTBEAT_INTERVAL_SECONDS:
                    await heartbeat(client, server, token)
                    last_heartbeat = now

                job = await poll_next_scan(client, server, token)
                if not job:
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    continue

                scan_id = job["scan_id"]
                target = job["target"]
                options = job.get("options") or {}
                _log(f"claimed scan {scan_id} target={target}")

                try:
                    xml = await run_nmap(target, options)
                    await upload_result(client, server, token, scan_id, xml)
                except Exception as e:
                    _log(f"scan {scan_id} failed locally: {e}")
                    # Send an empty XML so the server marks recon empty and moves on.
                    # The vuln/exploit/risk phases will simply have nothing to do.
                    empty = '<?xml version="1.0"?><nmaprun></nmaprun>'
                    await upload_result(client, server, token, scan_id, empty)
            except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError) as net_exc:
                # Backend bounced (restart, crash, network blip). Don't die —
                # back off and try again. If the backend stays down forever
                # the user can Ctrl+C the CLI manually.
                _log(f"backend unreachable: {net_exc.__class__.__name__} — retrying in {POLL_INTERVAL_SECONDS}s")
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
            except Exception as e:
                _log(f"unexpected error: {e.__class__.__name__}: {e} — continuing")
                await asyncio.sleep(POLL_INTERVAL_SECONDS)


# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SecureXpro distributed scanning agent")
    p.add_argument(
        "--server-url",
        default=os.environ.get("SXP_SERVER_URL", "http://localhost:8000"),
        help="Base URL of the SecureXpro server (default: http://localhost:8000)",
    )
    p.add_argument(
        "--email",
        default=os.environ.get("SXP_AGENT_EMAIL"),
        help="Email of an agent-role user (or SXP_AGENT_EMAIL env var)",
    )
    p.add_argument(
        "--password",
        default=os.environ.get("SXP_AGENT_PASSWORD"),
        help="Password (or SXP_AGENT_PASSWORD env var)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if not args.email or not args.password:
        print(
            "ERROR: agent credentials required. Pass --email/--password or set "
            "SXP_AGENT_EMAIL/SXP_AGENT_PASSWORD.",
            file=sys.stderr,
        )
        sys.exit(2)

    server = args.server_url.rstrip("/")
    _log(f"agent starting → server={server}")
    try:
        asyncio.run(main_loop(server, args.email, args.password))
    except KeyboardInterrupt:
        _log("shutting down")


if __name__ == "__main__":
    main()
