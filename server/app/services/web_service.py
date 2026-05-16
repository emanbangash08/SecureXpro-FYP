"""
Web Assessment Service — passive/active HTTP security checks.

No external tools required — uses httpx only.
Each finding is OWASP Top 10 2021 mapped and stored as a vulnerability document.

Public API (for scan_tasks.py granular phase control):
  connect_to_target(url)              → (client, resp)
  check_headers_and_disclosure()      → list[WebFinding]
  check_cors()                        → list[WebFinding]
  check_cookies()                     → list[WebFinding]
  check_sensitive_paths()             → list[WebFinding]  (async)
  check_http_methods()                → list[WebFinding]  (async)
  check_ssl_or_https()                → list[WebFinding]
  check_sql_injection()               → list[WebFinding]  (async)
  check_xss()                         → list[WebFinding]  (async)
  check_csrf()                        → list[WebFinding]  (async)
  check_cookies_on_endpoints()        → list[WebFinding]  (async)
  check_rate_limiting()               → list[WebFinding]  (async)  [A04]
  check_subresource_integrity()       → list[WebFinding]            [A08]
  check_logging_and_monitoring()      → list[WebFinding]  (async)  [A09]
  persist_findings()                  → None  (async)
  make_summary()                      → dict
  run_web_assessment()                → dict  (all-in-one, backward compat)
"""
import re
import ssl
import socket
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse, ParseResult
from typing import Callable, Awaitable

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.vulnerability import vulnerability_document, Severity

logger = logging.getLogger(__name__)

# ── Finding definition ────────────────────────────────────────────────────────

@dataclass
class WebFinding:
    check_id: str
    title: str
    description: str
    severity: Severity
    cvss_score: float
    owasp: str
    affected_url: str
    evidence: str
    remediation: str
    references: list[str] = field(default_factory=list)


# ── Sensitive paths to probe ──────────────────────────────────────────────────

_SENSITIVE_PATHS: list[tuple[str, str, Severity, float, str]] = [
    ("/.git/HEAD",          "Git Repository Exposed",          Severity.CRITICAL, 9.8, "A05:2021"),
    ("/.env",               "Environment File Exposed",        Severity.CRITICAL, 9.8, "A02:2021"),
    ("/.env.local",         "Environment File Exposed",        Severity.CRITICAL, 9.8, "A02:2021"),
    ("/.env.production",    "Environment File Exposed",        Severity.CRITICAL, 9.8, "A02:2021"),
    ("/backup.zip",         "Backup Archive Exposed",          Severity.HIGH,     8.6, "A05:2021"),
    ("/backup.sql",         "Database Backup Exposed",         Severity.CRITICAL, 9.8, "A02:2021"),
    ("/phpinfo.php",        "PHP Info Page Exposed",           Severity.HIGH,     7.5, "A05:2021"),
    ("/server-status",      "Apache Server Status Exposed",    Severity.MEDIUM,   5.3, "A05:2021"),
    ("/server-info",        "Apache Server Info Exposed",      Severity.MEDIUM,   5.3, "A05:2021"),
    ("/.htaccess",          "Htaccess File Exposed",           Severity.MEDIUM,   5.3, "A05:2021"),
    ("/wp-login.php",       "WordPress Login Page Detected",   Severity.MEDIUM,   5.3, "A07:2021"),
    ("/wp-admin/",          "WordPress Admin Panel Exposed",   Severity.HIGH,     7.5, "A07:2021"),
    ("/admin/",             "Admin Panel Exposed",             Severity.HIGH,     7.5, "A07:2021"),
    ("/administrator/",     "Admin Panel Exposed",             Severity.HIGH,     7.5, "A07:2021"),
    ("/phpmyadmin/",        "phpMyAdmin Exposed",              Severity.CRITICAL, 9.8, "A05:2021"),
    ("/adminer.php",        "Adminer Database Tool Exposed",   Severity.CRITICAL, 9.8, "A05:2021"),
    ("/api/v1/",            "API Endpoint Enumeration",        Severity.LOW,      3.7, "A01:2021"),
    ("/docs",               "Swagger UI Exposed",              Severity.MEDIUM,   5.3, "A05:2021"),
    ("/openapi.json",       "OpenAPI Schema Exposed",          Severity.MEDIUM,   5.3, "A05:2021"),
    ("/redoc",              "ReDoc API Docs Exposed",          Severity.LOW,      3.7, "A05:2021"),
    ("/swagger-ui.html",    "Swagger UI Exposed",              Severity.MEDIUM,   5.3, "A05:2021"),
    ("/api-docs",           "API Docs Exposed",                Severity.MEDIUM,   5.3, "A05:2021"),
    ("/actuator",           "Spring Actuator Exposed",         Severity.HIGH,     8.2, "A05:2021"),
    ("/actuator/env",       "Spring Actuator Env Exposed",     Severity.CRITICAL, 9.8, "A05:2021"),
    ("/.DS_Store",          "DS_Store File Exposed",           Severity.LOW,      4.3, "A05:2021"),
    ("/crossdomain.xml",    "Overly Permissive crossdomain",   Severity.MEDIUM,   5.3, "A05:2021"),
    ("/config.php",         "Config File Exposed",             Severity.CRITICAL, 9.8, "A02:2021"),
    ("/web.config",         "Web Config Exposed",              Severity.HIGH,     8.6, "A05:2021"),
]

SENSITIVE_PATH_COUNT = len(_SENSITIVE_PATHS)

_REQUIRED_HEADERS: list[tuple[str, str, Severity, float, str, str, str]] = [
    (
        "strict-transport-security",
        "Missing HSTS Header",
        Severity.MEDIUM, 6.1, "A02:2021",
        "The Strict-Transport-Security header is absent, allowing downgrade attacks and cookie hijacking over HTTP.",
        "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' to all HTTPS responses.",
    ),
    (
        "content-security-policy",
        "Missing Content-Security-Policy Header",
        Severity.MEDIUM, 6.1, "A05:2021",
        "No Content-Security-Policy header found. This leaves the application open to XSS and data injection attacks.",
        "Define a strict CSP policy. Start with 'Content-Security-Policy: default-src \\'self\\''.",
    ),
    (
        "x-frame-options",
        "Clickjacking Vulnerability (Missing X-Frame-Options)",
        Severity.MEDIUM, 6.1, "A05:2021",
        "The X-Frame-Options header is missing, allowing attackers to embed this page in an iframe for clickjacking.",
        "Add 'X-Frame-Options: DENY' or use 'Content-Security-Policy: frame-ancestors \\'none\\''.",
    ),
    (
        "x-content-type-options",
        "Missing X-Content-Type-Options Header",
        Severity.LOW, 4.3, "A05:2021",
        "The X-Content-Type-Options header is absent. Browsers may MIME-sniff responses, enabling XSS vectors.",
        "Add 'X-Content-Type-Options: nosniff' to all responses.",
    ),
    (
        "referrer-policy",
        "Missing Referrer-Policy Header",
        Severity.LOW, 3.7, "A05:2021",
        "No Referrer-Policy header. Sensitive URL information may leak to third-party sites via the Referer header.",
        "Add 'Referrer-Policy: strict-origin-when-cross-origin'.",
    ),
    (
        "permissions-policy",
        "Missing Permissions-Policy Header",
        Severity.LOW, 3.7, "A05:2021",
        "No Permissions-Policy header. Browser features (camera, geolocation, microphone) are not restricted.",
        "Add 'Permissions-Policy: geolocation=(), microphone=(), camera=()'.",
    ),
]


# ── SQL Injection detection ───────────────────────────────────────────────────

# Database error fingerprints — error-based detection only (non-intrusive)
_SQL_ERROR_PATTERNS: list[str] = [
    "you have an error in your sql syntax",
    "warning: mysql",
    "mysql_fetch", "mysql_num_rows",
    "pg::syntaxerror", "psqlexception", "postgresql",
    "ora-00933", "ora-01756", "oracle error",
    "microsoft ole db", "odbc sql server", "sqlserver jdbc",
    "unclosed quotation mark", "incorrect syntax near",
    "sqlite3", "sqlite_error",
    "syntax error in sql", "invalid sql statement",
    "sql command not properly ended",
    "db2 sql error", "com.ibm.db2",
]

# Error-based payloads only — no time-delay or UNION (safe/non-destructive)
_SQL_PAYLOADS: list[str] = ["'", "\"", "1'--", "1\" --", "') OR ('1'='1"]

_SQL_TEST_PARAMS: list[str] = [
    "id", "q", "query", "search", "page", "cat", "category",
    "item", "product", "sort", "order", "name", "user", "filter",
]

# ── XSS detection ─────────────────────────────────────────────────────────────

# Unique probe string — easy to spot in reflected response
_XSS_PROBE  = "secxpro<img src=x onerror=alert(1)>secxpro"
_XSS_MARKER = "secxpro<img"   # unencoded reflection means XSS

_XSS_TEST_PARAMS: list[str] = [
    "q", "query", "search", "name", "input", "msg",
    "message", "text", "comment", "title", "keyword", "s",
]

# ── CSRF detection ────────────────────────────────────────────────────────────

_CSRF_TOKEN_NAMES = re.compile(
    r'(csrf|token|_token|authenticity_token|__requestverificationtoken|nonce)',
    re.IGNORECASE,
)
_HTML_FORM_RE    = re.compile(r'<form[^>]*>(.*?)</form>', re.IGNORECASE | re.DOTALL)
_FORM_METHOD_RE  = re.compile(r'method=["\']?(post)["\']?', re.IGNORECASE)
_FORM_INPUT_RE   = re.compile(r'<input[^>]+>', re.IGNORECASE)

# ── Cookie endpoint probing ───────────────────────────────────────────────────

# Auth endpoints likely to issue Set-Cookie headers
_COOKIE_PROBE_ENDPOINTS: list[tuple[str, dict]] = [
    ("/api/v1/auth/login", {"email": "probe@test.com", "password": "probe123"}),
    ("/login",             {"username": "probe",        "password": "probe123"}),
    ("/signin",            {"email": "probe@test.com",  "password": "probe123"}),
    ("/auth/login",        {"email": "probe@test.com",  "password": "probe123"}),
]

# ── A04 Insecure Design — Rate Limiting probe ─────────────────────────────────

# Number of rapid-fire requests sent to an auth endpoint to detect rate limits.
# Kept low and capped by RATE_PROBE_DELAY so we never actually brute-force.
_RATE_PROBE_COUNT = 6
_RATE_PROBE_DELAY = 0.15   # seconds between requests

_RATE_LIMIT_HEADERS = (
    "x-ratelimit-remaining",
    "x-ratelimit-limit",
    "x-rate-limit-remaining",
    "x-rate-limit-limit",
    "ratelimit-remaining",
    "retry-after",
)

# ── A08 Software & Data Integrity — Subresource Integrity probe ───────────────

# External script/link tags pulled in via http(s) origins are candidates for SRI.
# Same-origin assets and protocol-relative URLs are skipped.
_HTML_SCRIPT_RE = re.compile(
    r'<script[^>]*\bsrc\s*=\s*["\']([^"\']+)["\'][^>]*>',
    re.IGNORECASE,
)
_HTML_LINK_RE = re.compile(
    r'<link[^>]*\brel\s*=\s*["\'](?:stylesheet|preload)["\'][^>]*>',
    re.IGNORECASE,
)
_LINK_HREF_RE = re.compile(r'\bhref\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
_INTEGRITY_RE = re.compile(r'\bintegrity\s*=\s*["\']', re.IGNORECASE)

# ── A09 Logging & Monitoring — Exposed log paths + verbose errors ─────────────

# Common log/monitoring endpoints. Any 200 response is a serious leak.
_LOG_EXPOSURE_PATHS: list[tuple[str, str, Severity, float]] = [
    ("/access.log",       "Apache/Nginx access log exposed",      Severity.HIGH,     8.6),
    ("/error.log",        "Server error log exposed",             Severity.HIGH,     8.6),
    ("/error_log",        "Server error_log exposed",             Severity.HIGH,     8.6),
    ("/server.log",       "Application server log exposed",       Severity.HIGH,     8.6),
    ("/app.log",          "Application log exposed",              Severity.HIGH,     8.6),
    ("/debug.log",        "Debug log exposed",                    Severity.CRITICAL, 9.1),
    ("/logs",             "Logs directory listing exposed",       Severity.HIGH,     7.5),
    ("/logs/",            "Logs directory listing exposed",       Severity.HIGH,     7.5),
    ("/log.txt",          "Plain-text log file exposed",          Severity.HIGH,     8.6),
    ("/audit.log",        "Audit log exposed",                    Severity.CRITICAL, 9.1),
    ("/laravel.log",      "Laravel framework log exposed",        Severity.CRITICAL, 9.1),
    ("/storage/logs/",    "Laravel storage logs directory",       Severity.CRITICAL, 9.1),
    ("/metrics",          "Prometheus metrics endpoint exposed",  Severity.MEDIUM,   5.3),
    ("/health",           "Health endpoint exposed (info leak)",  Severity.LOW,      3.7),
    ("/healthz",          "Health endpoint exposed (info leak)",  Severity.LOW,      3.7),
]

# Patterns that indicate a stack trace / verbose framework error in a response body
_STACK_TRACE_PATTERNS: list[tuple[str, str]] = [
    ("traceback (most recent call last)", "Python traceback"),
    ("file \"/", "Python traceback"),
    ("at java.", "Java stack trace"),
    ("at sun.", "Java stack trace"),
    ("at org.springframework.", "Spring stack trace"),
    ("symfony\\component", "Symfony stack trace"),
    ("at express", "Express.js stack trace"),
    ("error: at", "Generic JS stack trace"),
    ("microsoft .net framework", ".NET framework error page"),
    ("system.web.httpexception", ".NET HTTP exception"),
    ("activerecord::", "Rails ActiveRecord error"),
    ("railties (", "Rails verbose error"),
    ("django.core.exceptions", "Django exception trace"),
    ("at line", "Generic stack trace"),
]

# Payloads designed to trigger verbose error pages — all safe / non-destructive
_VERBOSE_ERROR_PROBES: list[tuple[str, str]] = [
    ("/?id[]=array",         "Array parameter coercion error"),
    ("/?debug=1",            "Debug-mode probe"),
    ("/nonexistent-%00-path", "Null-byte path probe"),
]

# ── Public building-block functions ──────────────────────────────────────────

async def connect_to_target(url: str) -> tuple[httpx.AsyncClient, httpx.Response]:
    """Connect to target and return (persistent client, initial response)."""
    client = httpx.AsyncClient(
        verify=False,
        follow_redirects=True,
        timeout=httpx.Timeout(connect=10, read=20, write=10, pool=5),
        headers={"User-Agent": "SecureXPro-Scanner/1.0"},
    )
    resp = await client.get(url)
    return client, resp


def check_headers_and_disclosure(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = _check_security_headers(resp, url)
    findings += _check_server_disclosure(resp, url)
    return findings


def check_cors(resp: httpx.Response, url: str) -> list[WebFinding]:
    return _check_cors(resp, url)


def check_cookies(resp: httpx.Response, url: str) -> list[WebFinding]:
    return _check_cookies(resp, url)


async def check_sensitive_paths(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    return await _check_sensitive_paths(client, url)


async def check_http_methods(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    return await _check_http_methods(client, url)


def check_ssl_or_https(parsed: ParseResult, resp: httpx.Response, url: str) -> list[WebFinding]:
    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if parsed.scheme == "https":
        return _check_ssl_cert(host, port)
    return _check_missing_https(resp, url)


async def check_sql_injection(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    """
    Error-based SQL injection detection.
    Injects payloads into common URL parameters and checks responses
    for database error fingerprints. Non-intrusive — no time-delay or UNION.
    """
    return await _check_sql_injection(client, url)


async def check_xss(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    """
    Reflected XSS detection.
    Injects a unique probe string into common URL parameters and checks
    whether it appears unencoded in the response body.
    """
    return await _check_xss(client, url)


async def check_csrf(
    client: httpx.AsyncClient,
    url: str,
    resp: httpx.Response,
) -> list[WebFinding]:
    """
    CSRF protection checks.
    - Parses HTML forms in the initial response for missing CSRF tokens
    - Probes the API with a forged Origin to detect CORS credential misconfig
    """
    return await _check_csrf(client, url, resp)


async def check_cookies_on_endpoints(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    Probes known auth endpoints (login, signin) to discover Set-Cookie headers,
    then checks each cookie for Secure / HttpOnly / SameSite flags.
    """
    return await _check_cookies_on_endpoints(client, url)


async def check_rate_limiting(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    A04 — Insecure Design: probes auth endpoints to detect missing rate limiting.
    Sends a small burst of requests with random invalid credentials and looks for:
      - 429 Too Many Requests responses
      - X-RateLimit-* / Retry-After response headers
    Absence of both after the burst is reported as a design weakness.
    """
    return await _check_rate_limiting(client, url)


def check_subresource_integrity(resp: httpx.Response, url: str) -> list[WebFinding]:
    """
    A08 — Software & Data Integrity Failures: parses the initial HTML for
    cross-origin <script src> and <link rel=stylesheet> tags and flags those
    that lack a Subresource Integrity (SRI) `integrity=` attribute.
    """
    return _check_subresource_integrity(resp, url)


async def check_logging_and_monitoring(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    A09 — Security Logging & Monitoring Failures:
      1. Probes a curated list of log/monitoring paths for direct exposure.
      2. Sends crafted malformed requests and inspects responses for stack
         traces / verbose framework errors that leak internals.
    """
    return await _check_logging_and_monitoring(client, url)


async def persist_findings(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    findings: list[WebFinding],
    host: str,
    port: int,
    scheme: str,
) -> None:
    for f in findings:
        doc = vulnerability_document(
            scan_id=scan_id,
            cve_id=f.check_id,
            title=f.title,
            description=f.description,
            severity=f.severity,
            cvss_score=f.cvss_score,
            affected_host=host,
            affected_service=scheme,
            affected_port=port,
            exploit_available=False,
            remediation=f.remediation,
            references=f.references,
        )
        doc["owasp"] = f.owasp
        doc["evidence"] = f.evidence
        doc["affected_url"] = f.affected_url
        await db.vulnerabilities.insert_one(doc)


def get_ssl_info(host: str, port: int) -> dict:
    """Return SSL certificate details as a plain dict (no findings)."""
    import ssl as _ssl
    try:
        ctx = _ssl.create_default_context()
        with socket.create_connection((host, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert   = ssock.getpeercert()
                cipher = ssock.cipher()
        not_after  = cert.get("notAfter", "")
        not_before = cert.get("notBefore", "")
        subject    = dict(x[0] for x in cert.get("subject", []))
        issuer     = dict(x[0] for x in cert.get("issuer", []))
        days_left: int | None = None
        if not_after:
            try:
                expiry    = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
                days_left = (expiry - datetime.utcnow()).days
            except Exception:
                pass
        san: list[str] = []
        for ext in cert.get("subjectAltName", []):
            if ext[0] == "DNS":
                san.append(ext[1])
        return {
            "valid":              True,
            "subject_cn":         subject.get("commonName", ""),
            "issuer_org":         issuer.get("organizationName", ""),
            "issuer_cn":          issuer.get("commonName", ""),
            "not_before":         not_before,
            "not_after":          not_after,
            "days_until_expiry":  days_left,
            "san":                san[:8],
            "cipher":             cipher[0] if cipher else "",
            "protocol":           cipher[1] if cipher else "",
            "key_bits":           cipher[2] if cipher else None,
        }
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


def _extract_tech_stack(resp: httpx.Response) -> list[dict]:
    """Fingerprint technologies from response headers."""
    tech: list[dict] = []
    h = resp.headers

    server = h.get("server", "")
    if server:
        tech.append({"name": server, "category": "Server"})

    powered = h.get("x-powered-by", "")
    if powered:
        tech.append({"name": powered, "category": "Framework"})

    # CDN detection
    if h.get("cf-ray") or h.get("cf-cache-status") or "cloudflare" in server.lower():
        if not any(t["name"] == "Cloudflare" for t in tech):
            tech.append({"name": "Cloudflare", "category": "CDN"})
    if h.get("x-amz-cf-id") or h.get("x-amz-request-id"):
        tech.append({"name": "Amazon CloudFront", "category": "CDN"})
    if h.get("x-cache", "").startswith("HIT") and "akamai" in h.get("via", "").lower():
        tech.append({"name": "Akamai", "category": "CDN"})

    # CMS / frameworks
    if h.get("x-generator"):
        tech.append({"name": h["x-generator"], "category": "CMS"})
    if h.get("x-drupal-cache") or h.get("x-drupal-dynamic-cache"):
        tech.append({"name": "Drupal", "category": "CMS"})
    if h.get("x-wp-total") or h.get("x-pingback"):
        tech.append({"name": "WordPress", "category": "CMS"})
    if h.get("x-shopify-stage") or h.get("x-shopid"):
        tech.append({"name": "Shopify", "category": "E-commerce"})

    # Backend frameworks
    if h.get("x-aspnet-version"):
        tech.append({"name": f"ASP.NET {h['x-aspnet-version']}", "category": "Framework"})
    if h.get("x-aspnetmvc-version"):
        tech.append({"name": f"ASP.NET MVC {h['x-aspnetmvc-version']}", "category": "Framework"})

    # Proxy / LB
    via = h.get("via", "")
    if via:
        tech.append({"name": via, "category": "Proxy/Load Balancer"})

    return tech


def make_summary(
    resp: httpx.Response,
    url: str,
    findings: list[WebFinding],
    ssl_info: dict | None = None,
    spider_urls: list[str] | None = None,
    phase_timings: dict | None = None,
) -> dict:
    parsed = urlparse(url)
    try:
        response_time_ms: float | None = round(resp.elapsed.total_seconds() * 1000, 1)
    except Exception:
        response_time_ms = None
    return {
        "url":              url,
        "final_url":        str(resp.url),
        "status_code":      resp.status_code,
        "server":           resp.headers.get("server", ""),
        "https":            parsed.scheme == "https",
        "total_findings":   len(findings),
        "content_length":   len(resp.content),
        "response_time_ms": response_time_ms,
        "tech_stack":       _extract_tech_stack(resp),
        "ssl_info":         ssl_info or {},
        "spider_urls":      spider_urls or [],
        "phase_timings":    phase_timings or {},
        "checks_performed": [
            "headers", "server_disclosure", "cors", "cookies",
            "sensitive_paths", "http_methods",
            "ssl" if parsed.scheme == "https" else "https_redirect",
            "sql_injection", "xss", "csrf",
            "rate_limiting",          # A04
            "subresource_integrity",  # A08
            "logging_monitoring",     # A09
            "zap_active_scan", "nikto_misconfig_scan",
        ],
    }


# ── All-in-one entry point (backward compat for full scan type) ───────────────

async def run_web_assessment(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    target: str,
    options: dict,
) -> dict:
    url = _normalize_url(target)
    parsed = urlparse(url)
    host = parsed.hostname or target
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    findings: list[WebFinding] = []

    async with httpx.AsyncClient(
        verify=False,
        follow_redirects=True,
        timeout=httpx.Timeout(connect=10, read=20, write=10, pool=5),
        headers={"User-Agent": "SecureXPro-Scanner/1.0"},
    ) as client:
        try:
            resp = await client.get(url)
        except httpx.ConnectError:
            raise RuntimeError(f"Cannot connect to {url} — host unreachable or not a web server")
        except httpx.TimeoutException:
            raise RuntimeError(f"Connection to {url} timed out")
        except Exception as exc:
            raise RuntimeError(f"Web assessment failed for {url}: {exc}")

        for check_fn in [
            lambda: check_headers_and_disclosure(resp, url),
            lambda: check_cors(resp, url),
            lambda: check_cookies(resp, url),
        ]:
            try:
                findings += check_fn()
            except Exception as exc:
                logger.warning("Web check failed: %s", exc)

        try:
            findings += await check_sensitive_paths(client, url)
        except Exception as exc:
            logger.warning("Sensitive path check failed: %s", exc)

        try:
            findings += await check_http_methods(client, url)
        except Exception as exc:
            logger.warning("HTTP methods check failed: %s", exc)

        try:
            findings += check_ssl_or_https(parsed, resp, url)
        except Exception as exc:
            logger.warning("SSL check failed: %s", exc)

        try:
            findings += await check_sql_injection(client, url)
        except Exception as exc:
            logger.warning("SQLi check failed: %s", exc)

        try:
            findings += await check_xss(client, url)
        except Exception as exc:
            logger.warning("XSS check failed: %s", exc)

        try:
            findings += await check_csrf(client, url, resp)
        except Exception as exc:
            logger.warning("CSRF check failed: %s", exc)

        try:
            findings += await check_cookies_on_endpoints(client, url)
        except Exception as exc:
            logger.warning("Cookie endpoint check failed: %s", exc)

        try:
            findings += await check_rate_limiting(client, url)
        except Exception as exc:
            logger.warning("Rate limiting check failed: %s", exc)

        try:
            findings += check_subresource_integrity(resp, url)
        except Exception as exc:
            logger.warning("SRI check failed: %s", exc)

        try:
            findings += await check_logging_and_monitoring(client, url)
        except Exception as exc:
            logger.warning("Logging/Monitoring check failed: %s", exc)

    await persist_findings(db, scan_id, findings, host, port, parsed.scheme)
    return make_summary(resp, url, findings)


# ── Private check implementations ────────────────────────────────────────────

def _check_security_headers(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    headers_lower = {k.lower(): v for k, v in resp.headers.items()}
    for header, title, severity, cvss, owasp, desc, remediation in _REQUIRED_HEADERS:
        if header not in headers_lower:
            findings.append(WebFinding(
                check_id=f"WEB-HEADER-{header.upper().replace('-', '_')}",
                title=title, severity=severity, cvss_score=cvss, owasp=owasp,
                affected_url=url, description=desc,
                evidence=f"Header '{header}' was not present in the response.",
                remediation=remediation,
                references=["https://owasp.org/www-project-secure-headers/"],
            ))
    return findings


def _check_server_disclosure(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    headers_lower = {k.lower(): v for k, v in resp.headers.items()}
    server = headers_lower.get("server", "")
    if server:
        findings.append(WebFinding(
            check_id="WEB-INFO-SERVER_BANNER",
            title="Server Version Disclosure",
            severity=Severity.LOW, cvss_score=4.3, owasp="A06:2021",
            affected_url=url,
            description="The Server header reveals the web server software and version, aiding attackers in fingerprinting.",
            evidence=f"Server: {server}",
            remediation="Configure the server to suppress or genericise the Server header.",
            references=["https://owasp.org/www-project-top-ten/2017/A6_2017-Security_Misconfiguration"],
        ))
    powered_by = headers_lower.get("x-powered-by", "")
    if powered_by:
        findings.append(WebFinding(
            check_id="WEB-INFO-XPOWEREDBY",
            title="Technology Disclosure via X-Powered-By",
            severity=Severity.LOW, cvss_score=3.7, owasp="A06:2021",
            affected_url=url,
            description="The X-Powered-By header discloses the backend technology stack to potential attackers.",
            evidence=f"X-Powered-By: {powered_by}",
            remediation="Remove the X-Powered-By header from server configuration.",
            references=[],
        ))
    return findings


def _check_cors(resp: httpx.Response, url: str) -> list[WebFinding]:
    acao = resp.headers.get("access-control-allow-origin", "")
    if acao == "*":
        return [WebFinding(
            check_id="WEB-CORS-WILDCARD",
            title="Overly Permissive CORS Policy",
            severity=Severity.MEDIUM, cvss_score=6.5, owasp="A01:2021",
            affected_url=url,
            description="The Access-Control-Allow-Origin header is set to '*', allowing any origin to read responses.",
            evidence="Access-Control-Allow-Origin: *",
            remediation="Restrict CORS to specific trusted origins rather than using a wildcard.",
            references=["https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"],
        )]
    return []


def _check_cookies(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    is_https = url.startswith("https://")
    for cookie_header in resp.headers.get_list("set-cookie"):
        cookie_lower = cookie_header.lower()
        name = cookie_header.split("=")[0].strip()
        if is_https and "secure" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOSECURE", title="Cookie Missing Secure Flag",
                severity=Severity.MEDIUM, cvss_score=5.4, owasp="A02:2021",
                affected_url=url,
                description=f"Cookie '{name}' is served over HTTPS but lacks the Secure flag.",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Set the Secure flag on all cookies: Set-Cookie: name=value; Secure",
                references=["https://owasp.org/www-community/controls/SecureCookieAttribute"],
            ))
        if "httponly" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOHTTPONLY", title="Cookie Missing HttpOnly Flag",
                severity=Severity.MEDIUM, cvss_score=5.4, owasp="A02:2021",
                affected_url=url,
                description=f"Cookie '{name}' lacks the HttpOnly flag, making it accessible to JavaScript.",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Set the HttpOnly flag: Set-Cookie: name=value; HttpOnly",
                references=["https://owasp.org/www-community/HttpOnly"],
            ))
        if "samesite" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOSAMESITE", title="Cookie Missing SameSite Attribute",
                severity=Severity.LOW, cvss_score=4.3, owasp="A01:2021",
                affected_url=url,
                description=f"Cookie '{name}' has no SameSite attribute, vulnerable to CSRF.",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Add SameSite=Strict or SameSite=Lax: Set-Cookie: name=value; SameSite=Strict",
                references=["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite"],
            ))
    return findings


async def _check_sensitive_paths(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings = []
    parsed = urlparse(base_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    for path, title, severity, cvss, owasp in _SENSITIVE_PATHS:
        full_url = base + path
        try:
            resp = await client.get(full_url, follow_redirects=False, timeout=5)
            if resp.status_code == 200:
                # File is genuinely accessible — report at full configured severity
                findings.append(WebFinding(
                    check_id=f"WEB-PATH-{path.strip('/').upper().replace('/', '_').replace('.', '_')}",
                    title=title, severity=severity, cvss_score=cvss, owasp=owasp,
                    affected_url=full_url,
                    description=f"The path '{path}' is publicly accessible (HTTP 200). This file should not be reachable from the internet.",
                    evidence=f"GET {full_url} → HTTP 200 ({len(resp.content)} bytes)",
                    remediation=f"Remove or restrict access to '{path}' via server configuration or .htaccess rules.",
                    references=["https://owasp.org/www-project-web-security-testing-guide/"],
                ))
            elif resp.status_code == 403:
                # Server returned Forbidden — path exists but access is blocked.
                # Downgrade to LOW: information disclosure (existence confirmed, content not accessible).
                findings.append(WebFinding(
                    check_id=f"WEB-PATH-{path.strip('/').upper().replace('/', '_').replace('.', '_')}-EXISTS",
                    title=f"{title} (Access Restricted)",
                    severity=Severity.LOW, cvss_score=3.1, owasp=owasp,
                    affected_url=full_url,
                    description=f"The path '{path}' exists on the server but returns HTTP 403 (Forbidden). While direct access is blocked, the file's existence is confirmed, which may aid an attacker.",
                    evidence=f"GET {full_url} → HTTP 403 ({len(resp.content)} bytes)",
                    remediation=f"Remove '{path}' from the server entirely rather than relying on access controls to protect it.",
                    references=["https://owasp.org/www-project-web-security-testing-guide/"],
                ))
        except Exception:
            continue
    return findings


async def _check_http_methods(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    try:
        resp = await client.request("TRACE", url, follow_redirects=False)
        if resp.status_code not in (405, 501, 400, 403):
            return [WebFinding(
                check_id="WEB-METHOD-TRACE", title="HTTP TRACE Method Enabled",
                severity=Severity.LOW, cvss_score=4.3, owasp="A05:2021",
                affected_url=url,
                description="The HTTP TRACE method is enabled, enabling Cross-Site Tracing (XST) attacks.",
                evidence=f"TRACE {url} → HTTP {resp.status_code}",
                remediation="Disable the TRACE method in your server configuration.",
                references=["https://owasp.org/www-community/attacks/Cross_Site_Tracing"],
            )]
    except Exception:
        pass
    return []


def _check_ssl_cert(host: str, port: int) -> list[WebFinding]:
    findings = []
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get("notAfter", "")
        if not_after:
            expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
            days_left = (expiry - datetime.utcnow()).days
            if days_left < 30:
                sev = Severity.CRITICAL if days_left < 0 else Severity.HIGH if days_left < 7 else Severity.MEDIUM
                findings.append(WebFinding(
                    check_id="WEB-SSL-CERT_EXPIRY",
                    title="SSL Certificate Expiring Soon" if days_left >= 0 else "SSL Certificate Expired",
                    severity=sev, cvss_score=7.5 if days_left < 0 else 5.3, owasp="A02:2021",
                    affected_url=f"https://{host}:{port}",
                    description=f"The SSL certificate {'has expired' if days_left < 0 else f'expires in {days_left} days'} ({not_after}).",
                    evidence=f"Certificate notAfter: {not_after}",
                    remediation="Renew the SSL certificate. Consider automated renewal with Let's Encrypt.",
                    references=["https://letsencrypt.org/"],
                ))
    except ssl.SSLCertVerificationError as e:
        findings.append(WebFinding(
            check_id="WEB-SSL-INVALID_CERT", title="Invalid or Untrusted SSL Certificate",
            severity=Severity.HIGH, cvss_score=7.5, owasp="A02:2021",
            affected_url=f"https://{host}:{port}",
            description="The SSL certificate is invalid, self-signed, or not trusted by a public CA.",
            evidence=str(e),
            remediation="Install a valid certificate from a trusted Certificate Authority.",
            references=[],
        ))
    except Exception:
        pass
    return findings


def _check_missing_https(resp: httpx.Response, url: str) -> list[WebFinding]:
    location = resp.headers.get("location", "")
    if resp.status_code in (301, 302, 307, 308) and "https" in location:
        return []
    return [WebFinding(
        check_id="WEB-SSL-NO_HTTPS", title="Site Served Over HTTP (No HTTPS)",
        severity=Severity.HIGH, cvss_score=7.5, owasp="A02:2021",
        affected_url=url,
        description="The application is accessible over plain HTTP. All data including credentials is transmitted in cleartext.",
        evidence=f"Target URL uses HTTP scheme: {url}",
        remediation="Enable HTTPS with a valid TLS certificate and redirect all HTTP traffic to HTTPS.",
        references=["https://letsencrypt.org/"],
    )]


async def _check_sql_injection(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    seen_params: set[str] = set()
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    for param in _SQL_TEST_PARAMS:
        if param in seen_params:
            continue
        for payload in _SQL_PAYLOADS:
            test_url = f"{base}?{param}={payload}"
            try:
                resp = await client.get(test_url, timeout=8, follow_redirects=True)
                body = resp.text.lower()
                matched = next((p for p in _SQL_ERROR_PATTERNS if p in body), None)
                if matched:
                    seen_params.add(param)
                    findings.append(WebFinding(
                        check_id=f"WEB-SQLI-{param.upper()}",
                        title="SQL Injection Vulnerability",
                        severity=Severity.CRITICAL,
                        cvss_score=9.8,
                        owasp="A03:2021",
                        affected_url=test_url,
                        description=(
                            f"SQL injection detected in parameter '{param}'. "
                            f"The server returned a database error when injected with payload '{payload}'."
                        ),
                        evidence=f"Payload: {payload!r}  →  DB error pattern matched: {matched!r}",
                        remediation=(
                            "Use parameterized queries / prepared statements. "
                            "Never concatenate user input into SQL strings."
                        ),
                        references=[
                            "https://owasp.org/www-community/attacks/SQL_Injection",
                            "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
                        ],
                    ))
                    break  # one finding per param is enough
            except Exception:
                continue

    return findings


async def _check_xss(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    seen_params: set[str] = set()
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    for param in _XSS_TEST_PARAMS:
        if param in seen_params:
            continue
        test_url = f"{base}?{param}={_XSS_PROBE}"
        try:
            resp = await client.get(test_url, timeout=8, follow_redirects=True)
            if _XSS_MARKER in resp.text:
                seen_params.add(param)
                findings.append(WebFinding(
                    check_id=f"WEB-XSS-{param.upper()}",
                    title="Reflected Cross-Site Scripting (XSS)",
                    severity=Severity.HIGH,
                    cvss_score=7.2,
                    owasp="A03:2021",
                    affected_url=test_url,
                    description=(
                        f"Reflected XSS detected in parameter '{param}'. "
                        "The injected probe was returned unencoded in the response body, "
                        "allowing an attacker to execute arbitrary JavaScript in a victim's browser."
                    ),
                    evidence=f"Probe {_XSS_PROBE!r} reflected unescaped via param '{param}'",
                    remediation=(
                        "HTML-encode all user-controlled output in the correct context "
                        "(HTML body, attribute, JavaScript). Enforce a strict Content-Security-Policy."
                    ),
                    references=[
                        "https://owasp.org/www-community/attacks/xss/",
                        "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
                    ],
                ))
        except Exception:
            continue

    return findings


async def _check_csrf(
    client: httpx.AsyncClient,
    url: str,
    resp: httpx.Response,
) -> list[WebFinding]:
    findings: list[WebFinding] = []

    # ── 1. Detect POST forms without CSRF tokens ──────────────────────────────
    forms = _HTML_FORM_RE.findall(resp.text)
    unprotected = 0

    for form_body in forms:
        if not _FORM_METHOD_RE.search(form_body):
            continue  # GET forms are not CSRF-relevant
        has_token = any(
            _CSRF_TOKEN_NAMES.search(inp)
            for inp in _FORM_INPUT_RE.findall(form_body)
        )
        if not has_token:
            unprotected += 1

    if unprotected:
        findings.append(WebFinding(
            check_id="WEB-CSRF-NO_TOKEN",
            title="CSRF Protection Missing on HTML Forms",
            severity=Severity.MEDIUM,
            cvss_score=6.5,
            owasp="A01:2021",
            affected_url=url,
            description=(
                f"Found {unprotected} HTML POST form(s) without a CSRF token field. "
                "Attackers can forge requests on behalf of authenticated users."
            ),
            evidence=f"{unprotected} POST form(s) with no detectable CSRF token input.",
            remediation=(
                "Add a CSRF token to all state-changing forms. "
                "Use SameSite=Strict on session cookies as an additional layer."
            ),
            references=[
                "https://owasp.org/www-community/attacks/csrf",
                "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
            ],
        ))

    # ── 2. Probe API for CORS credential misconfiguration (CSRF via CORS) ─────
    parsed = urlparse(url)
    probe_endpoint = f"{parsed.scheme}://{parsed.netloc}/api/v1/scans/"
    try:
        cors_resp = await client.post(
            probe_endpoint,
            headers={
                "Origin": "https://evil-attacker.com",
                "Content-Type": "application/json",
            },
            content=b"{}",
            timeout=8,
        )
        acao = cors_resp.headers.get("access-control-allow-origin", "")
        acac = cors_resp.headers.get("access-control-allow-credentials", "").lower()

        if acao == "https://evil-attacker.com" and acac == "true":
            findings.append(WebFinding(
                check_id="WEB-CSRF-CORS_CREDENTIALS",
                title="CORS Allows Credentials from Arbitrary Origin",
                severity=Severity.HIGH,
                cvss_score=8.1,
                owasp="A01:2021",
                affected_url=probe_endpoint,
                description=(
                    "The server reflects the attacker-controlled Origin header and permits "
                    "credentialed requests. This enables cross-origin request forgery via CORS."
                ),
                evidence=(
                    f"Access-Control-Allow-Origin: {acao}\n"
                    f"Access-Control-Allow-Credentials: {acac}"
                ),
                remediation=(
                    "Never reflect arbitrary Origins. Maintain an explicit whitelist of "
                    "trusted origins and reject all others."
                ),
                references=["https://portswigger.net/web-security/cors"],
            ))
    except Exception:
        pass

    return findings


async def _check_cookies_on_endpoints(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    Probe known auth endpoints to discover Set-Cookie headers, then
    apply the standard cookie security checks to each response.
    """
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    for path, payload in _COOKIE_PROBE_ENDPOINTS:
        endpoint = base + path
        try:
            resp = await client.post(
                endpoint,
                json=payload,
                timeout=8,
                follow_redirects=True,
            )
            cookie_headers = resp.headers.get_list("set-cookie")
            if cookie_headers:
                return _check_cookies(resp, endpoint)
        except Exception:
            continue

    return []


async def _check_rate_limiting(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    A04 — Insecure Design: rate limiting absent on authentication endpoints.

    Strategy:
      • For each candidate auth endpoint, send N rapid requests with random
        invalid credentials.
      • Record per-response: status code + rate-limit headers.
      • If no 429/Retry-After/X-RateLimit-* appears across the burst, flag.

    Safe because:
      • Only invalid credentials are submitted (no actual user accounts).
      • Burst is capped at _RATE_PROBE_COUNT (default 6).
      • A small inter-request delay keeps total RPS modest.
    """
    findings: list[WebFinding] = []
    import secrets
    import asyncio as _asyncio

    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    for path, payload_template in _COOKIE_PROBE_ENDPOINTS:
        endpoint = base + path
        statuses: list[int] = []
        rl_headers_seen = False
        endpoint_reachable = False

        for _ in range(_RATE_PROBE_COUNT):
            # Randomise per-request so caching / static 401s aren't conflated with rate limiting
            payload = {
                k: f"{v}-{secrets.token_hex(4)}" if isinstance(v, str) else v
                for k, v in payload_template.items()
            }
            try:
                resp = await client.post(
                    endpoint,
                    json=payload,
                    timeout=4,
                    follow_redirects=False,
                )
            except Exception:
                break
            endpoint_reachable = True
            statuses.append(resp.status_code)

            headers_lower = {k.lower() for k in resp.headers.keys()}
            if any(h in headers_lower for h in _RATE_LIMIT_HEADERS):
                rl_headers_seen = True
                break
            if resp.status_code == 429:
                rl_headers_seen = True
                break

            await _asyncio.sleep(_RATE_PROBE_DELAY)

        # Only report when the endpoint actually exists (we got at least one
        # response that wasn't a 404) AND nothing throttled us.
        if (
            endpoint_reachable
            and statuses
            and not rl_headers_seen
            and not all(s == 404 for s in statuses)
        ):
            findings.append(WebFinding(
                check_id="WEB-DESIGN-NO_RATE_LIMIT",
                title="No Rate Limiting on Authentication Endpoint",
                severity=Severity.MEDIUM,
                cvss_score=6.5,
                owasp="A04:2021",
                affected_url=endpoint,
                description=(
                    "The authentication endpoint accepted "
                    f"{len(statuses)} consecutive failed login attempts "
                    "without returning a 429 response, a Retry-After header, "
                    "or any X-RateLimit-* header. This is an Insecure Design "
                    "weakness enabling credential stuffing and brute-force attacks."
                ),
                evidence=(
                    f"POST {endpoint} x{len(statuses)} → statuses {statuses}, "
                    "no rate-limit headers observed."
                ),
                remediation=(
                    "Add server-side rate limiting on all authentication endpoints "
                    "(e.g. 5 attempts per IP / per username per 15 minutes). "
                    "Return HTTP 429 with a Retry-After header once the threshold "
                    "is exceeded, and consider account lockout / CAPTCHA escalation."
                ),
                references=[
                    "https://owasp.org/Top10/A04_2021-Insecure_Design/",
                    "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
                ],
            ))
            # Only need to flag the first reachable auth endpoint — don't spam
            break

    return findings


def _check_subresource_integrity(resp: httpx.Response, url: str) -> list[WebFinding]:
    """
    A08 — Software & Data Integrity Failures.

    Inspects the initial HTML response for external <script src> and
    <link rel=stylesheet> tags loaded from a different origin and lacking
    an `integrity="sha…"` attribute.
    """
    findings: list[WebFinding] = []
    ctype = resp.headers.get("content-type", "").lower()
    if "html" not in ctype:
        return findings

    body = resp.text
    parsed = urlparse(url)
    own_host = (parsed.hostname or "").lower()

    def _is_external(src: str) -> bool:
        s = src.strip()
        if not s:
            return False
        if s.startswith("//"):
            return True
        if s.startswith(("http://", "https://")):
            try:
                host = urlparse(s).hostname or ""
                return bool(host) and host.lower() != own_host
            except Exception:
                return False
        return False

    missing_scripts: list[str] = []
    missing_links: list[str] = []

    for match in re.finditer(
        r'<script\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\'][^>]*>',
        body,
        re.IGNORECASE,
    ):
        tag = match.group(0)
        src = match.group(1)
        if _is_external(src) and not _INTEGRITY_RE.search(tag):
            missing_scripts.append(src)

    for match in _HTML_LINK_RE.finditer(body):
        tag = match.group(0)
        href_m = _LINK_HREF_RE.search(tag)
        if not href_m:
            continue
        href = href_m.group(1)
        if _is_external(href) and not _INTEGRITY_RE.search(tag):
            missing_links.append(href)

    if missing_scripts or missing_links:
        total = len(missing_scripts) + len(missing_links)
        sample = (missing_scripts + missing_links)[:5]
        findings.append(WebFinding(
            check_id="WEB-INTEGRITY-NO_SRI",
            title="Cross-Origin Assets Loaded Without Subresource Integrity",
            severity=Severity.MEDIUM,
            cvss_score=5.9,
            owasp="A08:2021",
            affected_url=url,
            description=(
                f"Found {total} cross-origin <script>/<link> reference(s) loaded "
                "without an `integrity=\"sha…\"` attribute. A compromised CDN or "
                "MITM can substitute the asset and execute arbitrary code in the "
                "context of this site (supply-chain attack)."
            ),
            evidence="Missing integrity on: " + ", ".join(s[:80] for s in sample) +
                     (f"  (+{total - len(sample)} more)" if total > len(sample) else ""),
            remediation=(
                "Add Subresource Integrity (SRI) hashes to every cross-origin "
                "<script> and <link rel=\"stylesheet\">: e.g. "
                "<script src=\"…\" integrity=\"sha384-…\" crossorigin=\"anonymous\">. "
                "Pin asset versions and regenerate the hash on each upgrade."
            ),
            references=[
                "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/",
                "https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity",
            ],
        ))

    return findings


async def _check_logging_and_monitoring(
    client: httpx.AsyncClient,
    url: str,
) -> list[WebFinding]:
    """
    A09 — Security Logging & Monitoring Failures.

    Two probes:
      (a) Direct log/monitoring path exposure
      (b) Verbose error pages on malformed requests
    """
    findings: list[WebFinding] = []
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    # ── (a) Log/monitoring path exposure ──────────────────────────────────────
    for path, title, severity, cvss in _LOG_EXPOSURE_PATHS:
        full = base + path
        try:
            resp = await client.get(full, timeout=5, follow_redirects=False)
        except Exception:
            continue
        # 200 with non-empty body and a textual content type → real exposure
        ctype = resp.headers.get("content-type", "").lower()
        if resp.status_code == 200 and len(resp.content) > 0 and (
            "text" in ctype or "json" in ctype or "log" in ctype or not ctype
        ):
            findings.append(WebFinding(
                check_id=f"WEB-LOG-EXPOSED-{path.strip('/').upper().replace('/', '_').replace('.', '_')}",
                title=title,
                severity=severity,
                cvss_score=cvss,
                owasp="A09:2021",
                affected_url=full,
                description=(
                    f"The log/monitoring path '{path}' is publicly accessible "
                    f"(HTTP 200, {len(resp.content)} bytes). Direct log exposure "
                    "leaks request patterns, internal hostnames, stack traces, and "
                    "sometimes credentials — defeating the purpose of logging."
                ),
                evidence=f"GET {full} → HTTP 200 ({len(resp.content)} bytes, content-type: {ctype or 'unknown'})",
                remediation=(
                    "Remove log files from the public web root, or block access "
                    "via server config (deny in nginx / <Files> directive in Apache). "
                    "Ship logs to a separate aggregator (ELK, Loki, CloudWatch) "
                    "rather than serving them from the application."
                ),
                references=[
                    "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/",
                ],
            ))

    # ── (b) Verbose error pages on malformed requests ─────────────────────────
    seen_trace_pattern = False
    for probe_path, _label in _VERBOSE_ERROR_PROBES:
        try:
            resp = await client.get(base + probe_path, timeout=5, follow_redirects=False)
        except Exception:
            continue
        body_lower = resp.text.lower() if resp.text else ""
        if not body_lower:
            continue
        matched_kind: Optional[str] = None
        for needle, kind in _STACK_TRACE_PATTERNS:
            if needle in body_lower:
                matched_kind = kind
                break
        if matched_kind and not seen_trace_pattern:
            seen_trace_pattern = True  # one finding per scan is enough
            findings.append(WebFinding(
                check_id="WEB-LOG-VERBOSE_ERROR",
                title="Verbose Error Page Leaks Application Internals",
                severity=Severity.MEDIUM,
                cvss_score=5.3,
                owasp="A09:2021",
                affected_url=base + probe_path,
                description=(
                    f"A request to '{probe_path}' triggered a {matched_kind} in the "
                    "response body. Production servers should not return stack traces "
                    "or framework debug output — this both leaks implementation "
                    "details and signals that errors are not being captured/monitored "
                    "by a centralised logger."
                ),
                evidence=f"GET {base + probe_path} → HTTP {resp.status_code}; detected: {matched_kind}",
                remediation=(
                    "Disable debug / development mode in production. Return a generic "
                    "error page to clients and forward the real exception to a logging "
                    "and monitoring backend (Sentry, ELK, CloudWatch). Add alerts on "
                    "5xx-rate spikes."
                ),
                references=[
                    "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/",
                    "https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html",
                ],
            ))

    return findings


def _normalize_url(target: str) -> str:
    target = target.strip()
    if not target.startswith(("http://", "https://")):
        target = "http://" + target
    return target.rstrip("/")
