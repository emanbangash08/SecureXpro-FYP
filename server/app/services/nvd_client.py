"""
NVD API v2.0 client — CPE-exact matching with version range validation + OS compatibility.

Lookup pipeline per service:
  1. Build CPE 2.3 string from nmap service/version data (vendor/product lookup table)
  2. Query NVD by cpeName — NVD handles version range matching server-side (highest precision)
  3. If CPE yields 0 results (unmapped service or no version), fall back to keyword search
  4. On keyword results apply client-side:
       • Version range validation  (versionStartIncluding / versionEndExcluding from CPE match criteria)
       • OS compatibility check    (cross-check CVE CPE configs against detected OS)
  5. Non-blocking: if validation is uncertain, include the CVE (prefer false positive over miss)
"""
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# nmap service name → (cpe_vendor, cpe_product)
_CPE_MAP: dict[str, tuple[str, str]] = {
    "apache":           ("apache", "http_server"),
    "http":             ("apache", "http_server"),
    "http-proxy":       ("apache", "http_server"),
    "nginx":            ("nginx", "nginx"),
    "iis":              ("microsoft", "internet_information_services"),
    "lighttpd":         ("lighttpd", "lighttpd"),
    "tomcat":           ("apache", "tomcat"),
    "jetty":            ("eclipse", "jetty"),
    "ssh":              ("openbsd", "openssh"),
    "openssh":          ("openbsd", "openssh"),
    "dropbear":         ("matt_johnston", "dropbear_ssh_server"),
    "ftp":              ("gnu", "inetutils"),
    "vsftpd":           ("vsftpd_project", "vsftpd"),
    "proftpd":          ("proftpd_project", "proftpd"),
    "pure-ftpd":        ("pureftpd", "pure-ftpd"),
    "smtp":             ("postfix", "postfix"),
    "sendmail":         ("sendmail", "sendmail"),
    "exim":             ("exim", "exim"),
    "postfix":          ("postfix", "postfix"),
    "dovecot":          ("dovecot", "dovecot"),
    "mysql":            ("mysql", "mysql"),
    "mariadb":          ("mariadb", "mariadb"),
    "postgresql":       ("postgresql", "postgresql"),
    "mssql":            ("microsoft", "sql_server"),
    "oracle":           ("oracle", "database_server"),
    "redis":            ("redis", "redis"),
    "mongodb":          ("mongodb", "mongodb"),
    "elasticsearch":    ("elastic", "elasticsearch"),
    "memcached":        ("memcached", "memcached"),
    "cassandra":        ("apache", "cassandra"),
    "rdp":              ("microsoft", "remote_desktop_protocol"),
    "ms-wbt-server":    ("microsoft", "remote_desktop_protocol"),
    "vnc":              ("realvnc", "vnc"),
    "telnet":           ("gnu", "inetutils"),
    "snmp":             ("net-snmp", "net-snmp"),
    "ldap":             ("openldap", "openldap"),
    "samba":            ("samba", "samba"),
    "php":              ("php", "php"),
    "wordpress":        ("wordpress", "wordpress"),
    "drupal":           ("drupal", "drupal"),
    "joomla":           ("joomla", "joomla"),
    "jenkins":          ("jenkins", "jenkins"),
    "openssl":          ("openssl", "openssl"),
    "docker":           ("docker", "docker"),
    "kubernetes":       ("kubernetes", "kubernetes"),
    "bind":             ("isc", "bind"),
    "named":            ("isc", "bind"),
}

# Fallback keyword map for services without a CPE entry
_KEYWORD_MAP: dict[str, str] = {
    "msrpc":            "Microsoft Windows RPC",
    "microsoft-ds":     "Windows SMB",
    "netbios-ssn":      "Windows NetBIOS SMB",
    "http":             "Apache HTTP Server",
    "https":            "OpenSSL TLS",
    "ssh":              "OpenSSH",
    "ftp":              "FTP server vulnerability",
    "smtp":             "SMTP mail server",
    "dns":              "BIND DNS",
    "domain":           "BIND DNS",
    "mysql":            "MySQL database",
    "mssql":            "Microsoft SQL Server",
    "postgresql":       "PostgreSQL database",
    "rdp":              "Windows Remote Desktop Protocol",
    "vnc":              "VNC remote desktop",
    "telnet":           "telnet service vulnerability",
    "snmp":             "SNMP service vulnerability",
    "ldap":             "LDAP server vulnerability",
    "mongodb":          "MongoDB database",
    "redis":            "Redis server",
    "elasticsearch":    "Elasticsearch",
    "memcached":        "Memcached",
}


@dataclass
class CveRecord:
    cve_id: str
    title: str
    description: str
    cvss_score: float
    references: list[str] = field(default_factory=list)
    remediation: str = ""
    match_type: str = "keyword"  # "cpe_exact" | "keyword"
    # ── Module-3 enrichment (parsed from NVD, used by exploit_service) ─────────
    cvss_vector: str = ""       # e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
    cwe_ids: list[str] = field(default_factory=list)  # e.g. ["CWE-89", "CWE-79"]


# ── CPE building ──────────────────────────────────────────────────────────────

def build_cpe_string(service: str, version: str) -> Optional[str]:
    """
    Build a CPE 2.3 string from nmap service name and version.
    Returns None when the service has no entry in the CPE map.
    """
    svc = service.lower().strip()

    # Direct lookup
    mapping = _CPE_MAP.get(svc)

    # Substring fallback (e.g. "apache httpd 2.4" → "apache")
    if not mapping:
        for key, val in _CPE_MAP.items():
            if key in svc:
                mapping = val
                break

    if not mapping:
        return None

    vendor, product = mapping
    ver = _clean_version(version) if version else "*"
    return f"cpe:2.3:a:{vendor}:{product}:{ver}:*:*:*:*:*:*:*"


def _clean_version(version: str) -> str:
    """Extract a clean semver from nmap's version string (e.g. '2.4.51' from 'Apache/2.4.51 (Ubuntu)')."""
    match = re.search(r"(\d+\.\d+(?:\.\d+(?:\.\d+)*)?)", version)
    return match.group(1) if match else version.strip().split()[0]


# ── NVD queries ───────────────────────────────────────────────────────────────

async def fetch_cves_by_cpe(
    client: httpx.AsyncClient,
    cpe_name: str,
    results_per_page: int = 10,
) -> list[CveRecord]:
    """
    Query NVD using an exact CPE name (with version).
    NVD validates version ranges server-side — highest precision path.
    """
    params: dict = {"cpeName": cpe_name, "resultsPerPage": results_per_page}
    headers = {"apiKey": settings.NVD_API_KEY} if settings.NVD_API_KEY else {}

    try:
        resp = await client.get(settings.NVD_API_BASE_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("NVD CPE query HTTP error for %r: %s", cpe_name, exc)
        return []
    except Exception as exc:
        logger.warning("NVD CPE query failed for %r: %s", cpe_name, exc)
        return []

    records = []
    for item in data.get("vulnerabilities", []):
        record = _parse_cve_item(item, match_type="cpe_exact")
        if record:
            records.append(record)
    return records


async def fetch_cves_by_keyword(
    client: httpx.AsyncClient,
    keyword: str,
    version: str = "",
    os_guess: str = "",
    results_per_page: int = 5,
) -> list[CveRecord]:
    """
    Keyword-based NVD search with client-side version range + OS compatibility validation.
    Used as fallback when CPE mapping is unavailable or CPE query returns nothing.
    """
    params: dict = {"keywordSearch": keyword, "resultsPerPage": results_per_page}
    headers = {"apiKey": settings.NVD_API_KEY} if settings.NVD_API_KEY else {}

    try:
        resp = await client.get(settings.NVD_API_BASE_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("NVD keyword query HTTP error for %r: %s", keyword, exc)
        return []
    except Exception as exc:
        logger.warning("NVD keyword query failed for %r: %s", keyword, exc)
        return []

    records = []
    for item in data.get("vulnerabilities", []):
        if version and not _validate_version_range(item, version):
            continue
        if os_guess and not _validate_os_compatibility(item, os_guess):
            continue
        record = _parse_cve_item(item, match_type="keyword")
        if record:
            records.append(record)
    return records


def get_keyword_for_service(service: str, version: str) -> str:
    """Build an NVD keyword query from service name and optional version."""
    svc_lower = service.lower()
    base = _KEYWORD_MAP.get(svc_lower, service)
    return f"{base} {version}".strip() if version else base


# ── Version range validation (client-side, used for keyword results) ──────────

def _validate_version_range(cve_item: dict, version: str) -> bool:
    """
    Check whether the detected version falls within any vulnerable CPE range
    declared in the CVE's configuration data.

    Returns True when:
    - No configuration/range data exists  (can't validate → safe to include)
    - Detected version is within a listed vulnerable range
    Returns False only when config data exists AND version matches no range.
    """
    if not version:
        return True

    clean_ver = _clean_version(version)
    if not clean_ver or clean_ver == "*":
        return True

    configs = cve_item.get("cve", {}).get("configurations", [])
    if not configs:
        return True

    for config in configs:
        for node in config.get("nodes", []):
            for match in node.get("cpeMatch", []):
                if not match.get("vulnerable", False):
                    continue

                s_incl = match.get("versionStartIncluding")
                s_excl = match.get("versionStartExcluding")
                e_incl = match.get("versionEndIncluding")
                e_excl = match.get("versionEndExcluding")

                # No bounds declared → any version is vulnerable
                if not any([s_incl, s_excl, e_incl, e_excl]):
                    return True

                try:
                    if _is_in_range(clean_ver, s_incl, s_excl, e_incl, e_excl):
                        return True
                except Exception:
                    return True  # parse error → include (non-blocking)

    return False


def _is_in_range(
    ver: str,
    s_incl: Optional[str],
    s_excl: Optional[str],
    e_incl: Optional[str],
    e_excl: Optional[str],
) -> bool:
    v = _ver_tuple(ver)
    if s_incl and _ver_tuple(s_incl) > v:
        return False
    if s_excl and _ver_tuple(s_excl) >= v:
        return False
    if e_incl and _ver_tuple(e_incl) < v:
        return False
    if e_excl and _ver_tuple(e_excl) <= v:
        return False
    return True


def _ver_tuple(version: str) -> tuple:
    """Convert a version string into a comparable tuple of ints."""
    parts = re.split(r"[.\-_]", version)
    result = []
    for part in parts:
        try:
            result.append(int(part))
        except ValueError:
            result.append(0)
    return tuple(result)


# ── OS compatibility check (client-side, used for keyword results) ────────────

def _validate_os_compatibility(cve_item: dict, os_guess: str) -> bool:
    """
    Cross-check CVE CPE configuration data against the detected OS.

    Returns True when:
    - No OS constraints exist in the CVE (cross-platform vulnerability)
    - Detected OS matches one of the declared OS CPE platforms
    - OS is unknown (can't validate → include)
    Returns False only when the CVE is explicitly scoped to a different OS.
    """
    os_lower = os_guess.lower()
    is_windows = any(w in os_lower for w in ("windows", "win"))
    is_linux   = any(w in os_lower for w in ("linux", "ubuntu", "debian", "centos", "fedora", "rhel", "redhat"))

    if not is_windows and not is_linux:
        return True  # Unknown OS → can't filter

    cpe_os_platforms: set[str] = set()
    configs = cve_item.get("cve", {}).get("configurations", [])

    for config in configs:
        for node in config.get("nodes", []):
            for match in node.get("cpeMatch", []):
                cpe = match.get("criteria", "").lower()
                if ":o:" not in cpe:
                    continue
                if "microsoft:windows" in cpe:
                    cpe_os_platforms.add("windows")
                elif "linux:linux_kernel" in cpe or "canonical:ubuntu" in cpe or "debian:debian" in cpe:
                    cpe_os_platforms.add("linux")

    if not cpe_os_platforms:
        return True  # No OS constraints in CVE → applicable to all platforms

    if is_windows and "windows" in cpe_os_platforms:
        return True
    if is_linux and "linux" in cpe_os_platforms:
        return True

    return False


# ── CVE item parser ───────────────────────────────────────────────────────────

def _parse_cve_item(item: dict, match_type: str) -> Optional[CveRecord]:
    cve_data = item.get("cve", {})
    cve_id = cve_data.get("id", "")
    if not cve_id:
        return None

    descriptions = cve_data.get("descriptions", [])
    description = next((d["value"] for d in descriptions if d["lang"] == "en"), "")

    metrics = cve_data.get("metrics", {})
    cvss_score, cvss_vector = _extract_cvss(metrics)

    refs = [r["url"] for r in cve_data.get("references", [])[:5]]

    # Weakness types — flatten the CWE descriptions block.
    cwe_ids: list[str] = []
    for weakness in cve_data.get("weaknesses", []):
        for desc in weakness.get("description", []):
            val = (desc.get("value") or "").strip()
            if val.startswith("CWE-") and val not in cwe_ids:
                cwe_ids.append(val)

    return CveRecord(
        cve_id=cve_id,
        title=cve_id,
        description=description,
        cvss_score=cvss_score,
        references=refs,
        match_type=match_type,
        cvss_vector=cvss_vector,
        cwe_ids=cwe_ids,
    )


def _extract_cvss(metrics: dict) -> tuple[float, str]:
    """Return (base_score, vector_string) from the best available CVSS block."""
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key, [])
        if entries:
            data = entries[0].get("cvssData", {}) or {}
            return data.get("baseScore", 0.0), data.get("vectorString", "")
    return 0.0, ""


# Legacy-compatible wrapper, kept for callers that only need the score.
def _extract_cvss_score(metrics: dict) -> float:
    return _extract_cvss(metrics)[0]
