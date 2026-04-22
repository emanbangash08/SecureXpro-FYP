# SecureXpro — Backend Memory (server/)

> Last updated: 2026-04-22  
> Stack: FastAPI + Motor (async MongoDB) + Celery + Redis  
> Run directory for all backend commands: `server/`

---

## Infrastructure

| Service | URL | Notes |
|---|---|---|
| FastAPI | `http://localhost:8000` | `uvicorn app.main:app --reload` |
| MongoDB | `mongodb://localhost:27017` | DB name: `securexpro` |
| Redis | `redis://localhost:6379/0` | Celery broker + result backend |
| Celery | queue: `scans` | Windows: `celery -A celery_app worker --loglevel=info -Q scans --pool=solo` |

### Start commands (run from `server/`)
```bash
# FastAPI
uvicorn app.main:app --reload --port 8000

# Celery worker (Windows)
celery -A celery_app worker --loglevel=info -Q scans --pool=solo
```

---

## Project Structure

```
server/
├── celery_app.py              # Celery factory — broker/backend = Redis, queue = scans
├── requirements.txt           # fastapi, motor, celery[redis], httpx, python-jose, bcrypt, nmap...
├── app/
│   ├── main.py                # FastAPI app, lifespan (connect_db, create_indexes)
│   ├── core/
│   │   ├── config.py          # Settings (pydantic-settings, reads .env)
│   │   ├── database.py        # Motor client, get_db(), create_indexes()
│   │   └── security.py        # JWT encode/decode, bcrypt hash/verify
│   ├── api/
│   │   ├── deps.py            # get_current_user() — Bearer JWT dependency
│   │   └── v1/
│   │       ├── router.py      # Mounts all endpoint routers under /api/v1
│   │       └── endpoints/
│   │           ├── auth.py           # /auth/*
│   │           ├── scans.py          # /scans/*
│   │           ├── vulnerabilities.py# /vulnerabilities/*
│   │           ├── dashboard.py      # /dashboard/*
│   │           └── reports.py        # /reports/*
│   ├── models/                # Raw MongoDB document factories (dicts)
│   │   ├── user.py            # user_document(), UserRole, UserStatus
│   │   ├── scan.py            # scan_document(), ScanStatus, ScanType
│   │   └── vulnerability.py   # vulnerability_document(), Severity
│   ├── schemas/               # Pydantic I/O models
│   │   ├── user.py            # UserCreate, UserLogin, UserOut, TokenResponse, ...
│   │   ├── scan.py            # ScanCreate, ScanOptions, ScanOut, ScanListOut
│   │   └── vulnerability.py   # VulnerabilityOut (includes owasp, evidence, affected_url)
│   ├── services/
│   │   ├── auth_service.py    # register, login, refresh, forgot/reset password
│   │   ├── scan_service.py    # create, get, list, delete, cancel, retry
│   │   ├── recon_service.py   # nmap wrapper → HostResult / PortInfo dataclasses
│   │   ├── vuln_service.py    # NVD CVE lookup, correlate_vulnerabilities()
│   │   ├── web_service.py     # OWASP HTTP checks via httpx
│   │   └── risk_service.py    # compute_risk_summary() — aggregates all vulns
│   └── tasks/
│       └── scan_tasks.py      # Celery task — asyncio.run(_execute_scan())
```

---

## Module 1 — Authentication (`/api/v1/auth`)

**File:** `app/api/v1/endpoints/auth.py`  
**Service:** `app/services/auth_service.py`  
**Security:** `app/core/security.py`

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create user; returns `UserOut` |
| POST | `/auth/login` | No | Email + password → `TokenResponse` (access + refresh) |
| POST | `/auth/refresh` | No | Refresh token → new `TokenResponse` |
| GET | `/auth/me` | Bearer JWT | Returns current `UserOut` |
| POST | `/auth/forgot-password` | No | Returns a reset token (dev: returned in response, not emailed) |
| POST | `/auth/reset-password` | No | Token + new password → resets password |

### Token system
- Access token: HS256 JWT, expires in 60 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh token: HS256 JWT, expires in 7 days (`REFRESH_TOKEN_EXPIRE_DAYS`)
- Secret: `SECRET_KEY` in config / `.env`

### User model (MongoDB `users` collection)
```
username, email, hashed_password (bcrypt), full_name,
role (admin|agent), status (active|inactive|banned),
created_at, updated_at, last_login,
reset_token, reset_token_expires
```

### Auth dependency
`get_current_user()` in `app/api/deps.py` — extracts Bearer token from `Authorization` header, decodes JWT, fetches user from DB. Used as `Depends(get_current_user)` on all protected routes.

---

## Module 2 — Scan Management (`/api/v1/scans`)

**File:** `app/api/v1/endpoints/scans.py`  
**Service:** `app/services/scan_service.py`  
**Task:** `app/tasks/scan_tasks.py`

### Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/scans/` | Create scan → queues Celery task, returns `ScanOut` |
| GET | `/scans/` | List user's scans (paginated, filterable by type/status) |
| GET | `/scans/{id}` | Get single scan with all results |
| POST | `/scans/{id}/cancel` | Revoke Celery task + mark CANCELLED |
| POST | `/scans/{id}/retry` | Reset fields + re-dispatch task (failed/cancelled only) |
| DELETE | `/scans/{id}` | Delete scan + its vulnerabilities + reports |

### Scan types (ScanType enum)
| Value | Phases run |
|---|---|
| `reconnaissance` | Phase 1: nmap only |
| `vulnerability` | Phase 1: nmap + Phase 2: CVE correlation |
| `web_assessment` | Phase 3: OWASP web checks only |
| `full` | All three phases |

### Scan lifecycle (ScanStatus enum)
`pending` → `running` → `completed` | `failed` | `cancelled`

### Concurrency guard
Max 3 active scans per user (`MAX_CONCURRENT_SCANS_PER_USER`). Checked in `_check_concurrency()` using MongoDB count on `{status: {$in: [pending, running]}}`. Returns HTTP 429 if at limit.

### Scan document (MongoDB `scans` collection)
```
user_id, target, scan_type, status, options,
task_id (Celery task ID, sparse index),
recon_results (array of hosts),
vuln_results (dict, reserved),
web_results (dict — web assessment summary),
risk_summary (dict — aggregated severity counts),
error (string, set on failure),
started_at, completed_at, created_at, updated_at
```

### ScanOptions (what the frontend sends)
```python
port_range: str = "1-1000"   # e.g. "1-100", "1-65535", "80,443,8080"
os_detection: bool = False    # nmap -O (requires admin/root)
aggressive: bool = False      # nmap -A
udp: bool = False             # nmap -sU -sS
check_sensitive_paths: bool = True  # probe /.env, /.git, /admin, etc.
check_ssl: bool = True        # SSL cert expiry / HTTPS enforcement
```

---

## Module 3 — Celery Task Pipeline (`app/tasks/scan_tasks.py`)

The Celery task `run_scan_task` wraps `asyncio.run(_execute_scan(scan_id))` — each task creates its own `AsyncIOMotorClient` because Motor needs its own event loop per process.

### Execution flow

```
_execute_scan(scan_id)
├── Fetch scan doc from DB
├── Mark status = RUNNING
│
├── Phase 1 — Reconnaissance (if type in: reconnaissance, vulnerability, full)
│   ├── _nmap_target(target)  → strips URL to bare hostname/IP for nmap
│   ├── recon_service.run_nmap_scan(host, options)
│   └── Save recon_results to DB
│
├── Phase 2 — CVE Correlation (if type in: vulnerability, full AND hosts found)
│   └── vuln_service.correlate_vulnerabilities(db, scan_id, hosts)
│       └── For each open port: NVD API lookup → insert vulnerability docs
│
├── Phase 3 — Web Assessment (if type in: web_assessment, full)
│   ├── _web_target(target)  → ensures full URL (adds http:// if missing)
│   ├── web_service.run_web_assessment(db, scan_id, url, options)
│   └── Save web_results (summary dict) to DB
│
├── risk_service.compute_risk_summary(db, scan_id)
│   └── Aggregates vulnerability counts by severity
│
└── Mark status = COMPLETED (or FAILED on exception)
```

### Helper functions in scan_tasks.py
- `_nmap_target(target)` — if target starts with `http://` or `https://`, extracts hostname via `urlparse`. Needed for Full scans where target is a URL.
- `_web_target(target)` — if target is bare hostname/IP, prepends `http://`. Needed for Full scans where target might be a plain IP.

---

## Module 4 — Reconnaissance Service (`app/services/recon_service.py`)

Wraps nmap via `asyncio.create_subprocess_exec`. Parses nmap XML output (`-oX -`).

### Key detail: `-Pn` flag always set
Without `-Pn`, nmap pings first. Most routers/hosts block ICMP, so nmap marks them as down and returns 0 results. `-Pn` skips discovery and always scans.

### nmap flags built from options
```
Always:  -Pn -sV --version-intensity 5 -p {port_range}
+OS:     -O
+Aggr:   -A
+UDP:    -sU -sS
```

### Return types
- `HostResult`: `ip, hostname, os_guess, ports: list[PortInfo]`
- `PortInfo`: `port, protocol, state, service, version, extra_info`

---

## Module 5 — Vulnerability Service (`app/services/vuln_service.py`)

Queries NIST NVD API v2.0 (`https://services.nvd.nist.gov/rest/json/cves/2.0`).

### Key details
- Searches even without version string (removed `not port.version` guard)
- Uses `_SERVICE_KEYWORD_MAP` to translate nmap service names to better NVD search terms:
  - `msrpc` → `"Microsoft Windows RPC remote code execution"`
  - `microsoft-ds` → `"Windows SMB Server Message Block"`
  - `netbios-ssn` → `"Windows NetBIOS SMB"` etc.
- Each CVE match → inserted as vulnerability document in `db.vulnerabilities`
- Errors logged as `logger.warning`, scan continues even if NVD is unreachable

---

## Module 6 — Web Assessment Service (`app/services/web_service.py`)

No external tools — uses `httpx` only. Each finding maps to OWASP Top 10 2021.

### Checks performed
1. **Security headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
2. **Server disclosure** — `Server` header reveals software version
3. **CORS wildcard** — `Access-Control-Allow-Origin: *`
4. **Cookie flags** — missing Secure, HttpOnly, SameSite attributes
5. **Sensitive path probing** (24 paths) — `.env`, `.git/HEAD`, `/admin/`, `/phpmyadmin/`, `/actuator/env`, etc.
6. **HTTP TRACE method** — enabled TRACE → XST vulnerability
7. **SSL checks** (HTTPS only) — cert validity, expiry < 30 days, self-signed
8. **HTTPS enforcement** — site served over HTTP without redirect

### Storage
Each finding is stored as a vulnerability document with extra fields:
- `owasp` — OWASP category (e.g., `"A02:2021"`)
- `evidence` — what was observed
- `affected_url` — specific URL that triggered the finding

Web summary stored in `scan.web_results`:
```json
{
  "url": "http://...",
  "final_url": "http://...",
  "status_code": 200,
  "server": "uvicorn",
  "https": false,
  "total_findings": 7,
  "checks_performed": ["headers", "server_disclosure", "cors", "cookies", "sensitive_paths", "http_methods", "https_redirect"]
}
```

### httpx timeout config
`httpx.Timeout(connect=10, read=20, write=10, pool=5)` — per-path probes use `timeout=5`.

---

## Module 7 — Vulnerabilities API (`/api/v1/vulnerabilities`)

| Method | Path | Description |
|---|---|---|
| GET | `/vulnerabilities/scan/{scan_id}` | List vulns for a scan (paginated, filterable by severity) |
| GET | `/vulnerabilities/{id}` | Get single vulnerability |

### VulnerabilityOut schema fields
```
id, scan_id, cve_id, title, description, severity, cvss_score,
affected_host, affected_service, affected_port,
exploit_available, remediation, references,
owasp (nullable — set for web findings),
evidence (nullable — set for web findings),
affected_url (nullable — set for web findings),
created_at
```

The `owasp` field distinguishes web findings from CVE findings on the frontend.

---

## Database Indexes (MongoDB)

```
users:           email (unique), username (unique)
scans:           user_id, created_at, [status+user_id], task_id (sparse)
vulnerabilities: scan_id, cve_id, [severity+scan_id]
exploits:        vulnerability_id
reports:         scan_id, user_id
audit_logs:      user_id, created_at
```

---

## Config / Settings (`app/core/config.py`)

All overridable via `.env` file in `server/`:
```
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=securexpro
SECRET_KEY=change-this-secret-key-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
REDIS_URL=redis://localhost:6379/0
MAX_CONCURRENT_SCANS_PER_USER=3
NVD_API_KEY=                        # optional — raises rate limit from 5/30s to 50/30s
NVD_API_BASE_URL=https://services.nvd.nist.gov/rest/json/cves/2.0
CORS_ORIGINS=["http://localhost:3000"]
```

---

## Modules NOT YET built (planned)

- Reports — PDF/HTML export of scan results (endpoint stub exists, logic not built)
- Dashboard — aggregate stats endpoint (stub exists)
- Agents — remote scan agents (model exists, no logic)
- Audit logs — track user actions
- Email — currently forgot-password returns token in response (no SMTP)
- Exploit correlation — `exploits` collection indexed but not populated

---

## Test target for all 3 phases

Use `http://localhost:8000` with scan type **Full Scan**:
- nmap scans `localhost` → finds 8000 (uvicorn), 6379 (Redis), 27017 (MongoDB)
- NVD lookup finds CVEs for Redis / MongoDB services
- Web assessment hits `http://localhost:8000` → finds missing HSTS, CSP, X-Frame-Options, server disclosure (uvicorn), no HTTPS, etc.
