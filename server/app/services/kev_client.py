"""
CISA Known Exploited Vulnerabilities (KEV) catalog client.

Official CISA JSON feed — no API key required.
Cached in-process for 12 hours to avoid repeated downloads across scan tasks.

Feed URL: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
"""
import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

KEV_CATALOG_URL = (
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
)
_KEV_TTL = timedelta(hours=12)

# Module-level cache — survives across coroutines within the same Celery worker process
_kev_cache: set[str] = set()
_kev_loaded_at: datetime | None = None


async def get_kev_set() -> set[str]:
    """
    Return the full set of CVE IDs currently in the CISA KEV catalog.
    Reloads from CISA when the cache is empty or older than the TTL.
    Returns an empty set on download failure so the pipeline continues.
    """
    await _ensure_loaded()
    return _kev_cache.copy()


async def _ensure_loaded() -> None:
    global _kev_loaded_at
    now = datetime.now(timezone.utc)
    if _kev_loaded_at and (now - _kev_loaded_at) < _KEV_TTL and _kev_cache:
        return
    await _load_kev()


async def _load_kev() -> None:
    global _kev_cache, _kev_loaded_at
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(KEV_CATALOG_URL)
            resp.raise_for_status()
            data = resp.json()

        vulns = data.get("vulnerabilities", [])
        _kev_cache = {v["cveID"] for v in vulns if v.get("cveID")}
        _kev_loaded_at = datetime.now(timezone.utc)
        logger.info("CISA KEV catalog loaded — %d known-exploited CVEs.", len(_kev_cache))

    except Exception as exc:
        logger.warning("CISA KEV catalog download failed: %s", exc)
        if not _kev_cache:
            _kev_cache = set()  # ensure cache is always a set even on first-load failure
