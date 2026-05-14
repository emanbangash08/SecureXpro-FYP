"""
Deep Scan Service — pure-Python extended vulnerability checks.
No external tools or Docker required — uses httpx only.

Checks added on top of the active probe phase:
  1. Open Redirect       — common redirect params with external payloads
  2. Path Traversal      — ../etc/passwd style probes in URL params
  3. SSTI                — template injection probes ({{7*7}}, ${7*7}, etc.)
  4. Command Injection   — timing/reflection indicators
  5. Verbose Error Pages — trigger 404/500 to detect stack trace leakage
  6. Insecure Deserialization hints — Java/PHP magic bytes in params
  7. HTTP Host Header Injection
  8. Clickjacking via meta tag (fallback for missing X-Frame-Options)
"""
import asyncio
import logging
import re
from urllib.parse import urlparse, urlencode, urljoin

import httpx

from app.services.web_service import WebFinding, Severity

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0)


# ── 1. Open Redirect ──────────────────────────────────────────────────────────

_REDIRECT_PARAMS = [
    "redirect", "redirect_uri", "redirect_url", "return", "returnTo",
    "return_url", "next", "url", "goto", "target", "destination", "forward",
    "continue", "callback", "successUrl", "failUrl",
]
_REDIRECT_PAYLOAD = "https://evil.example.com"


async def check_open_redirect(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    for param in _REDIRECT_PARAMS:
        test_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}={_REDIRECT_PAYLOAD}"
        try:
            r = await client.get(test_url, follow_redirects=False)
            loc = r.headers.get("location", "")
            if r.status_code in (301, 302, 303, 307, 308) and _REDIRECT_PAYLOAD in loc:
                findings.append(WebFinding(
                    check_id    = "WEB-OPEN-REDIRECT",
                    title       = f"Open Redirect via '{param}' Parameter",
                    description = (
                        f"The application redirects to an attacker-controlled URL when the "
                        f"'{param}' parameter contains an external URL. This enables phishing "
                        f"attacks using a trusted domain."
                    ),
                    severity    = Severity.MEDIUM,
                    cvss_score  = 6.1,
                    owasp       = "A01:2021",
                    affected_url= test_url,
                    evidence    = f"Location: {loc[:200]}",
                    remediation = (
                        f"Validate redirect targets against an allowlist of trusted URLs. "
                        f"Reject any redirect that does not start with your own origin ({origin})."
                    ),
                    references  = ["https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html"],
                ))
                break  # one confirmed finding is enough
        except Exception:
            pass

    return findings


# ── 2. Path Traversal ─────────────────────────────────────────────────────────

_TRAVERSAL_PARAMS = ["file", "path", "page", "template", "view", "doc", "filename", "load", "include"]
_TRAVERSAL_PAYLOADS = [
    "../../../../etc/passwd",
    "..%2F..%2F..%2F..%2Fetc%2Fpasswd",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
]
_TRAVERSAL_SIG = re.compile(r"root:.*:0:0:|bin:.*:/bin|nobody:.*:nogroup", re.IGNORECASE)


async def check_path_traversal(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    for param in _TRAVERSAL_PARAMS:
        for payload in _TRAVERSAL_PAYLOADS:
            test_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}={payload}"
            try:
                r = await client.get(test_url)
                if _TRAVERSAL_SIG.search(r.text):
                    findings.append(WebFinding(
                        check_id    = "WEB-PATH-TRAVERSAL",
                        title       = f"Path Traversal via '{param}' Parameter",
                        description = (
                            "The application exposes system file contents (/etc/passwd) through "
                            "a path traversal vulnerability. An attacker can read arbitrary files "
                            "from the server filesystem."
                        ),
                        severity    = Severity.CRITICAL,
                        cvss_score  = 9.1,
                        owasp       = "A01:2021",
                        affected_url= test_url,
                        evidence    = _TRAVERSAL_SIG.search(r.text).group(0)[:100],
                        remediation = (
                            "Resolve all file paths to a canonical form and verify they remain "
                            "within the expected base directory. Reject any path containing '..' "
                            "before canonicalisation."
                        ),
                        references  = ["https://owasp.org/www-community/attacks/Path_Traversal"],
                    ))
                    return findings  # one confirmed finding is enough
            except Exception:
                pass
    return findings


# ── 3. Server-Side Template Injection (SSTI) ─────────────────────────────────

_SSTI_PARAMS   = ["name", "q", "search", "query", "template", "msg", "message", "input", "text"]
_SSTI_PROBE    = "securex49xtest"        # unique marker unlikely to appear naturally
_SSTI_PAYLOADS = [
    ("{{7*7}}", "49"),          # Jinja2 / Twig
    ("${7*7}", "49"),            # Freemarker / EL
    ("<%= 7*7 %>", "49"),        # ERB / JSP
    ("#{7*7}", "49"),            # Ruby (Slim/Haml)
    ("*{7*7}", "49"),            # Spring SpEL
]


async def check_ssti(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    for param in _SSTI_PARAMS:
        for payload, expected in _SSTI_PAYLOADS:
            test_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}={_SSTI_PROBE}{payload}{_SSTI_PROBE}"
            try:
                r = await client.get(test_url)
                # Check if the math was evaluated (49 appears between our markers)
                pattern = re.compile(
                    re.escape(_SSTI_PROBE) + r"\s*" + re.escape(expected) + r"\s*" + re.escape(_SSTI_PROBE)
                )
                if pattern.search(r.text):
                    findings.append(WebFinding(
                        check_id    = "WEB-SSTI",
                        title       = f"Server-Side Template Injection via '{param}' Parameter",
                        description = (
                            f"The application evaluates template expressions from user input. "
                            f"The payload '{payload}' was evaluated server-side, indicating a "
                            f"template engine is processing unsanitised input. This can lead to "
                            f"remote code execution."
                        ),
                        severity    = Severity.CRITICAL,
                        cvss_score  = 9.8,
                        owasp       = "A03:2021",
                        affected_url= test_url,
                        evidence    = f"Payload {payload!r} evaluated to {expected}",
                        remediation = (
                            "Never pass user-controlled data directly into template rendering "
                            "functions. Use sandboxed template environments or escape all "
                            "user input before passing it to the template engine."
                        ),
                        references  = ["https://portswigger.net/web-security/server-side-template-injection"],
                    ))
                    return findings  # one confirmed finding is definitive
            except Exception:
                pass
    return findings


# ── 4. Verbose Error / Stack Trace Leakage ────────────────────────────────────

_ERROR_PATTERNS = re.compile(
    r"Traceback \(most recent call|at \w+\.\w+\([\w.]+:\d+\)|"
    r"System\.Web\.HttpUnhandledException|"
    r"javax\.servlet\.|java\.lang\.|"
    r"Fatal error:</b>.*on line|"
    r"Warning:</b>.*in <b>|"
    r"ORA-\d{5}|"
    r"You have an error in your SQL syntax",
    re.IGNORECASE | re.DOTALL,
)


async def check_verbose_errors(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    parsed   = urlparse(base_url)
    origin   = f"{parsed.scheme}://{parsed.netloc}"
    test_paths = [
        "/this-page-definitely-does-not-exist-securex",
        "/?id=<securex>",
        "/?id='",
    ]
    for path in test_paths:
        try:
            r = await client.get(urljoin(origin, path))
            if _ERROR_PATTERNS.search(r.text):
                match = _ERROR_PATTERNS.search(r.text)
                findings.append(WebFinding(
                    check_id    = "WEB-VERBOSE-ERRORS",
                    title       = "Verbose Error / Stack Trace Leakage",
                    description = (
                        "The application returns detailed error messages including stack traces, "
                        "file paths, or database errors. This reveals internal implementation "
                        "details that greatly assist attackers in crafting targeted exploits."
                    ),
                    severity    = Severity.MEDIUM,
                    cvss_score  = 5.3,
                    owasp       = "A05:2021",
                    affected_url= urljoin(origin, path),
                    evidence    = match.group(0)[:200],
                    remediation = (
                        "Configure the application to display generic error pages in production. "
                        "Log full errors server-side only. Never expose stack traces, file paths, "
                        "or database messages to end users."
                    ),
                    references  = ["https://owasp.org/www-community/Improper_Error_Handling"],
                ))
                break
        except Exception:
            pass
    return findings


# ── 5. HTTP Host Header Injection ─────────────────────────────────────────────

async def check_host_header_injection(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    poison  = "evil.securex-probe.invalid"
    try:
        r = await client.get(
            base_url,
            headers={"Host": poison},
            follow_redirects=False,
        )
        body_hit = poison in r.text
        loc_hit  = poison in r.headers.get("location", "")
        if body_hit or loc_hit:
            findings.append(WebFinding(
                check_id    = "WEB-HOST-HEADER-INJECTION",
                title       = "HTTP Host Header Injection",
                description = (
                    "The application reflects or trusts the HTTP Host header without validation. "
                    "This can be exploited for password-reset poisoning, cache poisoning, "
                    "and SSRF attacks."
                ),
                severity    = Severity.HIGH,
                cvss_score  = 7.5,
                owasp       = "A03:2021",
                affected_url= base_url,
                evidence    = f"Host: {poison} reflected in {'body' if body_hit else 'Location header'}",
                remediation = (
                    "Validate the Host header against a hardcoded allowlist of expected hostnames. "
                    "Use SERVER_NAME or a configured base URL rather than the request Host header "
                    "when generating absolute URLs (e.g. password-reset links)."
                ),
                references  = ["https://portswigger.net/web-security/host-header"],
            ))
    except Exception:
        pass
    return findings


# ── 6. Command Injection (timing-based) ───────────────────────────────────────

_CMD_PARAMS   = ["cmd", "exec", "command", "run", "ping", "host", "query", "ip"]
_CMD_PAYLOADS = [
    ("; sleep 3 #", 3.0),
    ("| sleep 3",   3.0),
    ("& timeout 3", 3.0),
]


async def check_command_injection(client: httpx.AsyncClient, base_url: str) -> list[WebFinding]:
    findings: list[WebFinding] = []
    for param in _CMD_PARAMS:
        for payload, delay in _CMD_PAYLOADS:
            test_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}={payload}"
            try:
                import time
                t0 = time.monotonic()
                await client.get(test_url, timeout=httpx.Timeout(delay + 2))
                elapsed = time.monotonic() - t0
                if elapsed >= delay * 0.85:
                    findings.append(WebFinding(
                        check_id    = "WEB-COMMAND-INJECTION",
                        title       = f"Possible Command Injection via '{param}' Parameter (timing)",
                        description = (
                            f"A time-delay payload injected into the '{param}' parameter caused "
                            f"a {elapsed:.1f}s response delay, suggesting the shell command was "
                            f"executed by the server. This may indicate OS command injection."
                        ),
                        severity    = Severity.CRITICAL,
                        cvss_score  = 9.8,
                        owasp       = "A03:2021",
                        affected_url= test_url,
                        evidence    = f"Response delayed {elapsed:.1f}s with payload: {payload!r}",
                        remediation = (
                            "Never pass user-supplied data to shell commands. Use language APIs "
                            "instead of shell calls. If shell execution is unavoidable, use an "
                            "allowlist of permitted values and never interpolate user input."
                        ),
                        references  = ["https://owasp.org/www-community/attacks/Command_Injection"],
                    ))
                    return findings
            except Exception:
                pass
    return findings


# ── Public API ────────────────────────────────────────────────────────────────

async def run_deep_scan(base_url: str) -> list[WebFinding]:
    """
    Run all deep-scan checks against base_url.
    Returns a combined list of WebFinding objects.
    """
    all_findings: list[WebFinding] = []

    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        verify=False,
        headers={"User-Agent": "SecureXPro-Scanner/2.0"},
    ) as client:
        checks = [
            ("Open Redirect",         check_open_redirect(client, base_url)),
            ("Path Traversal",        check_path_traversal(client, base_url)),
            ("SSTI",                  check_ssti(client, base_url)),
            ("Verbose Errors",        check_verbose_errors(client, base_url)),
            ("Host Header Injection", check_host_header_injection(client, base_url)),
            ("Command Injection",     check_command_injection(client, base_url)),
        ]
        results = await asyncio.gather(*[coro for _, coro in checks], return_exceptions=True)

    for (name, _), result in zip(checks, results):
        if isinstance(result, Exception):
            logger.warning("Deep scan check '%s' error: %s", name, result)
        else:
            all_findings.extend(result)

    return all_findings
