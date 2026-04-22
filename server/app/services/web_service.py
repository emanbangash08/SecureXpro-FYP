"""
Web Assessment Service — passive/active HTTP security checks.

No external tools required — uses httpx only.
Each finding is OWASP Top 10 2021 mapped and stored as a vulnerability document.
"""
import ssl
import socket
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse

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
    # (path, finding_title, severity, cvss, owasp)
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
    ("/swagger-ui.html",    "Swagger UI Exposed",              Severity.MEDIUM,   5.3, "A05:2021"),
    ("/api-docs",           "API Docs Exposed",                Severity.MEDIUM,   5.3, "A05:2021"),
    ("/actuator",           "Spring Actuator Exposed",         Severity.HIGH,     8.2, "A05:2021"),
    ("/actuator/env",       "Spring Actuator Env Exposed",     Severity.CRITICAL, 9.8, "A05:2021"),
    ("/.DS_Store",          "DS_Store File Exposed",           Severity.LOW,      4.3, "A05:2021"),
    ("/crossdomain.xml",    "Overly Permissive crossdomain",   Severity.MEDIUM,   5.3, "A05:2021"),
    ("/config.php",         "Config File Exposed",             Severity.CRITICAL, 9.8, "A02:2021"),
    ("/web.config",         "Web Config Exposed",              Severity.HIGH,     8.6, "A05:2021"),
]

# Security response headers that should be present
_REQUIRED_HEADERS: list[tuple[str, str, Severity, float, str, str, str]] = [
    # (header, title, severity, cvss, owasp, description, remediation)
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


# ── Entry point ───────────────────────────────────────────────────────────────

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

        # Run all check categories — each is isolated so one failure won't abort the scan
        for check_fn in [
            lambda: _check_security_headers(resp, url),
            lambda: _check_server_disclosure(resp, url),
            lambda: _check_cors(resp, url),
            lambda: _check_cookies(resp, url),
        ]:
            try:
                findings += check_fn()
            except Exception as exc:
                logger.warning("Web check failed: %s", exc)

        try:
            findings += await _check_sensitive_paths(client, url)
        except Exception as exc:
            logger.warning("Sensitive path check failed: %s", exc)

        try:
            findings += await _check_http_methods(client, url)
        except Exception as exc:
            logger.warning("HTTP methods check failed: %s", exc)

        if parsed.scheme == "https":
            try:
                findings += _check_ssl_cert(host, port)
            except Exception as exc:
                logger.warning("SSL check failed: %s", exc)
        else:
            try:
                findings += _check_missing_https(resp, url)
            except Exception as exc:
                logger.warning("HTTPS check failed: %s", exc)

    # Persist each finding as a vulnerability document
    for f in findings:
        doc = vulnerability_document(
            scan_id=scan_id,
            cve_id=f.check_id,
            title=f.title,
            description=f.description,
            severity=f.severity,
            cvss_score=f.cvss_score,
            affected_host=host,
            affected_service=parsed.scheme,
            affected_port=port,
            exploit_available=False,
            remediation=f.remediation,
            references=f.references,
        )
        # Store OWASP category + evidence as extra fields
        doc["owasp"] = f.owasp
        doc["evidence"] = f.evidence
        doc["affected_url"] = f.affected_url
        await db.vulnerabilities.insert_one(doc)

    # Web summary stored in web_results
    return {
        "url": url,
        "final_url": str(resp.url),
        "status_code": resp.status_code,
        "server": resp.headers.get("server", ""),
        "https": parsed.scheme == "https",
        "total_findings": len(findings),
        "checks_performed": ["headers", "server_disclosure", "cors", "cookies",
                             "sensitive_paths", "http_methods",
                             "ssl" if parsed.scheme == "https" else "https_redirect"],
    }


# ── Individual checks ─────────────────────────────────────────────────────────

def _check_security_headers(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    headers_lower = {k.lower(): v for k, v in resp.headers.items()}

    for header, title, severity, cvss, owasp, desc, remediation in _REQUIRED_HEADERS:
        if header not in headers_lower:
            findings.append(WebFinding(
                check_id=f"WEB-HEADER-{header.upper().replace('-', '_')}",
                title=title,
                severity=severity,
                cvss_score=cvss,
                owasp=owasp,
                affected_url=url,
                description=desc,
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
            severity=Severity.LOW,
            cvss_score=4.3,
            owasp="A06:2021",
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
            severity=Severity.LOW,
            cvss_score=3.7,
            owasp="A06:2021",
            affected_url=url,
            description="The X-Powered-By header discloses the backend technology stack to potential attackers.",
            evidence=f"X-Powered-By: {powered_by}",
            remediation="Remove the X-Powered-By header from server configuration.",
            references=[],
        ))

    return findings


def _check_cors(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    acao = resp.headers.get("access-control-allow-origin", "")
    if acao == "*":
        findings.append(WebFinding(
            check_id="WEB-CORS-WILDCARD",
            title="Overly Permissive CORS Policy",
            severity=Severity.MEDIUM,
            cvss_score=6.5,
            owasp="A01:2021",
            affected_url=url,
            description="The Access-Control-Allow-Origin header is set to '*', allowing any origin to read responses. This can expose sensitive data to malicious sites.",
            evidence="Access-Control-Allow-Origin: *",
            remediation="Restrict CORS to specific trusted origins rather than using a wildcard.",
            references=["https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"],
        ))
    return findings


def _check_cookies(resp: httpx.Response, url: str) -> list[WebFinding]:
    findings = []
    is_https = url.startswith("https://")

    for cookie_header in resp.headers.get_list("set-cookie"):
        cookie_lower = cookie_header.lower()
        name = cookie_header.split("=")[0].strip()

        if is_https and "secure" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOSECURE",
                title="Cookie Missing Secure Flag",
                severity=Severity.MEDIUM,
                cvss_score=5.4,
                owasp="A02:2021",
                affected_url=url,
                description=f"Cookie '{name}' is served over HTTPS but lacks the Secure flag, allowing transmission over HTTP.",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Set the Secure flag on all cookies: Set-Cookie: name=value; Secure",
                references=["https://owasp.org/www-community/controls/SecureCookieAttribute"],
            ))

        if "httponly" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOHTTPONLY",
                title="Cookie Missing HttpOnly Flag",
                severity=Severity.MEDIUM,
                cvss_score=5.4,
                owasp="A02:2021",
                affected_url=url,
                description=f"Cookie '{name}' lacks the HttpOnly flag, making it accessible to JavaScript and vulnerable to XSS theft.",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Set the HttpOnly flag on all session cookies: Set-Cookie: name=value; HttpOnly",
                references=["https://owasp.org/www-community/HttpOnly"],
            ))

        if "samesite" not in cookie_lower:
            findings.append(WebFinding(
                check_id="WEB-COOKIE-NOSAMESITE",
                title="Cookie Missing SameSite Attribute",
                severity=Severity.LOW,
                cvss_score=4.3,
                owasp="A01:2021",
                affected_url=url,
                description=f"Cookie '{name}' has no SameSite attribute, leaving it vulnerable to Cross-Site Request Forgery (CSRF).",
                evidence=f"Set-Cookie: {cookie_header[:120]}",
                remediation="Add SameSite=Strict or SameSite=Lax to cookies: Set-Cookie: name=value; SameSite=Strict",
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
            # Only flag if server returns actual content (not redirect or error)
            if resp.status_code in (200, 403):
                findings.append(WebFinding(
                    check_id=f"WEB-PATH-{path.strip('/').upper().replace('/', '_').replace('.', '_')}",
                    title=title,
                    severity=severity,
                    cvss_score=cvss,
                    owasp=owasp,
                    affected_url=full_url,
                    description=f"The path '{path}' returned HTTP {resp.status_code}. This resource should not be publicly accessible.",
                    evidence=f"GET {full_url} → HTTP {resp.status_code} ({len(resp.content)} bytes)",
                    remediation=f"Restrict access to '{path}' via server configuration or remove the file entirely.",
                    references=["https://owasp.org/www-project-web-security-testing-guide/"],
                ))
        except Exception:
            continue

    return findings


async def _check_http_methods(client: httpx.AsyncClient, url: str) -> list[WebFinding]:
    findings = []
    try:
        resp = await client.request("TRACE", url, follow_redirects=False)
        if resp.status_code not in (405, 501, 400, 403):
            findings.append(WebFinding(
                check_id="WEB-METHOD-TRACE",
                title="HTTP TRACE Method Enabled",
                severity=Severity.LOW,
                cvss_score=4.3,
                owasp="A05:2021",
                affected_url=url,
                description="The HTTP TRACE method is enabled. This can be used in Cross-Site Tracing (XST) attacks to steal session cookies.",
                evidence=f"TRACE {url} → HTTP {resp.status_code}",
                remediation="Disable the TRACE method in your server configuration.",
                references=["https://owasp.org/www-community/attacks/Cross_Site_Tracing"],
            ))
    except Exception:
        pass
    return findings


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
                    severity=sev,
                    cvss_score=7.5 if days_left < 0 else 5.3,
                    owasp="A02:2021",
                    affected_url=f"https://{host}:{port}",
                    description=f"The SSL certificate {'has expired' if days_left < 0 else f'expires in {days_left} days'} ({not_after}).",
                    evidence=f"Certificate notAfter: {not_after}",
                    remediation="Renew the SSL certificate immediately. Consider automated renewal with Let's Encrypt.",
                    references=["https://letsencrypt.org/"],
                ))

    except ssl.SSLCertVerificationError as e:
        findings.append(WebFinding(
            check_id="WEB-SSL-INVALID_CERT",
            title="Invalid or Untrusted SSL Certificate",
            severity=Severity.HIGH,
            cvss_score=7.5,
            owasp="A02:2021",
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
    findings = [
        WebFinding(
            check_id="WEB-SSL-NO_HTTPS",
            title="Site Served Over HTTP (No HTTPS)",
            severity=Severity.HIGH,
            cvss_score=7.5,
            owasp="A02:2021",
            affected_url=url,
            description="The application is accessible over plain HTTP. All data including credentials is transmitted in cleartext.",
            evidence=f"Target URL uses HTTP scheme: {url}",
            remediation="Enable HTTPS with a valid TLS certificate and redirect all HTTP traffic to HTTPS.",
            references=["https://letsencrypt.org/"],
        )
    ]
    # Check if HTTPS redirect is in place
    https_url = url.replace("http://", "https://", 1)
    location = resp.headers.get("location", "")
    if resp.status_code in (301, 302, 307, 308) and "https" in location:
        findings.pop()  # HTTPS redirect exists — not a finding
    return findings


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_url(target: str) -> str:
    target = target.strip()
    if not target.startswith(("http://", "https://")):
        target = "http://" + target
    return target.rstrip("/")
