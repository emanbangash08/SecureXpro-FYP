# Web Scan Backend Setup — WSL2 + Docker

The web scan pipeline (ZAP + Nikto) runs Docker containers **inside WSL2 Ubuntu**, not Docker Desktop. The Python backend on Windows shells into WSL2 with `wsl -d Ubuntu -- docker …` to launch them.

This guide installs everything from a clean Windows machine. Run each block in PowerShell as Administrator unless noted.

---

## 1. Enable WSL2 and install Ubuntu

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted. When Ubuntu launches the first time, set a UNIX username and password (any value — remember the password, you'll need it for `sudo`).

Verify:

```powershell
wsl --list --verbose
# Should show:  Ubuntu    Running    2
```

If the version shows `1`, force WSL 2:

```powershell
wsl --set-version Ubuntu 2
wsl --set-default-version 2
```

---

## 2. Install Docker Engine inside WSL2 Ubuntu

**Do not use Docker Desktop.** The code in `zap_client.py` / `nikto_client.py` calls Docker directly inside WSL2.

Open Ubuntu (Start menu → "Ubuntu") and run:

```bash
# Update apt and install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker apt repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow your user to run docker without sudo
sudo usermod -aG docker $USER

# Start the daemon
sudo service docker start
```

**Log out of Ubuntu and back in** (close the terminal, open a new one) so the `docker` group takes effect. Verify:

```bash
docker --version
docker run --rm hello-world
```

You should see `Hello from Docker!`. If permission denied, re-open the Ubuntu shell.

---

## 3. Pre-pull the scan images (optional but recommended)

First-run scans pull ~700 MB. Do it once now so scans don't time out:

```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
docker pull sullo/nikto:latest
```

---

## 4. Verify from Windows

Open PowerShell (not Ubuntu) and run:

```powershell
wsl -d Ubuntu -- docker --version
wsl -d Ubuntu -- docker info
```

Both must succeed. If `docker info` shows "Cannot connect to the Docker daemon", run:

```powershell
wsl -d Ubuntu -u root -- service docker start
```

The backend tries this automatically on first scan, but starting it manually once confirms the path works.

---

## 5. Auto-start Docker on WSL2 boot (optional)

WSL2 doesn't run systemd-managed services on launch by default. Two options:

### Option A — enable systemd (Windows 11, WSL 0.67.6+)

In Ubuntu:

```bash
sudo tee -a /etc/wsl.conf <<'EOF'
[boot]
systemd=true
EOF
```

Then from PowerShell:

```powershell
wsl --shutdown
```

Reopen Ubuntu. Docker should now start on every WSL2 launch.

### Option B — passwordless sudo for `service docker start`

```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/service docker start" | sudo tee /etc/sudoers.d/docker-nopasswd
sudo chmod 0440 /etc/sudoers.d/docker-nopasswd
```

The backend uses `wsl -d Ubuntu -u root -- service docker start` (root, no password needed), so this is mainly for convenience.

---

## 6. Test the full path

From PowerShell, run a one-shot ZAP container exactly the way the backend will:

```powershell
wsl -d Ubuntu -- docker run --rm -p 8090:8090 ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon -host 0.0.0.0 -port 8090 -config api.disablekey=true
```

In another PowerShell window:

```powershell
curl http://localhost:8090/JSON/core/view/version/
```

You should get `{"version":"2.x.x"}`. **Ctrl+C** the first window to stop ZAP. Same for Nikto:

```powershell
wsl -d Ubuntu -- docker run --rm sullo/nikto:latest -Version
```

---

## 7. Backend Python dependencies

From the `server/` directory (Windows side):

```powershell
pip install -r requirements.txt
```

No new Python packages are needed for Nikto — it's invoked via `subprocess`/`wsl`, output parsed as JSON.

---

## 8. Run a smoke-test scan

Start Celery worker (PowerShell, from `server/`):

```powershell
celery -A celery_app worker --loglevel=info -Q scans --pool=solo
```

Start the API (separate PowerShell):

```powershell
uvicorn app.main:app --reload
```

Trigger a web scan from the frontend at `/scans/web` and watch the worker logs. You should see phases progress: `web_init → web_headers → web_active → web_zap → web_nikto`.

---

## Troubleshooting

| Symptom                                        | Fix                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `wsl: command not found` (PowerShell)          | Reboot after `wsl --install`                                                                |
| `Cannot connect to the Docker daemon`          | `wsl -d Ubuntu -u root -- service docker start`                                             |
| ZAP container exits immediately                | `wsl -d Ubuntu -- docker logs <container_id>`                                               |
| Backend reports "Docker not available in WSL2" | Distro name mismatch — code expects `Ubuntu` exactly. Run `wsl --list --verbose` to confirm |
| Port 8090 already in use                       | `wsl -d Ubuntu -- docker ps`, then `docker stop <id>`                                       |
| Slow first scan                                | Images pre-pull (Section 3)                                                                 |
