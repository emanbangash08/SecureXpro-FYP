"""
Metasploit module-metadata index (search-only — no execution).

We do NOT integrate with msfrpcd or run the Metasploit framework. We download
the official `db/modules_metadata_base.json` file from the rapid7 GitHub
mirror, cache it under `server/data/`, and expose a CVE → modules lookup.

This satisfies "Integrates Metasploit exploit metadata (search-only)" from
Module 3 without pulling in heavyweight dependencies or shelling out to msfconsole.

File source:
  https://raw.githubusercontent.com/rapid7/metasploit-framework/master/db/modules_metadata_base.json

The metadata file is ~5–10 MB and contains ~3000+ modules. Each module entry
has a `references` block listing CVEs, EDB-IDs, URLs, etc. We index by CVE id.

Public API:
  await get_index()                    -> MetasploitIndex
  await refresh_index(force=False)     -> MetasploitIndex
  index.lookup_by_cve(cve_id)          -> list[ModuleInfo]
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Where the cached JSON lives. Relative to repo root → server/data/msf_modules.json
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_CACHE_FILE = _DATA_DIR / "msf_modules.json"
_REFRESH_AFTER_DAYS = 30
_DOWNLOAD_URL = (
    "https://raw.githubusercontent.com/rapid7/metasploit-framework/"
    "master/db/modules_metadata_base.json"
)
_DOWNLOAD_TIMEOUT_SEC = 60


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class ModuleInfo:
    """A single Metasploit module entry, distilled to the fields we display."""
    name: str                                  # e.g. "MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption"
    fullname: str                              # e.g. "exploit/windows/smb/ms17_010_eternalblue"
    type: str                                  # exploit | auxiliary | post | payload
    rank: str                                  # excellent | great | good | normal | average | low | manual
    disclosure_date: Optional[str] = None
    references: list[dict] = field(default_factory=list)


@dataclass
class MetasploitIndex:
    """In-memory index built from the metadata JSON."""
    by_cve: dict[str, list[ModuleInfo]] = field(default_factory=dict)
    total_modules: int = 0
    indexed_cves: int = 0
    source_age_days: float = 0.0

    def lookup_by_cve(self, cve_id: str) -> list[ModuleInfo]:
        """Return all Metasploit modules referencing this CVE (case-insensitive)."""
        if not cve_id:
            return []
        return list(self.by_cve.get(cve_id.upper(), []))

    def is_ready(self) -> bool:
        return self.total_modules > 0


# ── Module-level singleton + load lock ────────────────────────────────────────

_index: Optional[MetasploitIndex] = None
_index_lock = asyncio.Lock()


async def get_index() -> MetasploitIndex:
    """
    Return the cached MetasploitIndex, building it if necessary.
    Safe to call concurrently — the underlying load is locked.
    """
    global _index
    if _index is not None and _index.is_ready():
        return _index
    async with _index_lock:
        if _index is not None and _index.is_ready():
            return _index
        _index = await _build_index_from_cache_or_download()
        return _index


async def refresh_index(force: bool = False) -> MetasploitIndex:
    """Refresh the index from the network. Pass force=True to bypass age check."""
    global _index
    async with _index_lock:
        await _download_metadata(force=force)
        _index = _build_index_from_disk()
    return _index


# ── Loading & downloading ─────────────────────────────────────────────────────

async def _build_index_from_cache_or_download() -> MetasploitIndex:
    needs_download = (
        not _CACHE_FILE.exists()
        or _cache_age_days() > _REFRESH_AFTER_DAYS
    )
    if needs_download:
        try:
            await _download_metadata(force=True)
        except Exception as exc:
            # If we already have a stale cache, use it; otherwise return empty index
            if _CACHE_FILE.exists():
                logger.warning(
                    "Failed to refresh Metasploit metadata (%s); using stale cache",
                    exc,
                )
            else:
                logger.error(
                    "Failed to download Metasploit metadata and no cache available: %s",
                    exc,
                )
                return MetasploitIndex()
    return _build_index_from_disk()


async def _download_metadata(force: bool) -> None:
    """Pull the modules_metadata_base.json file from rapid7's GitHub."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)

    if _CACHE_FILE.exists() and not force and _cache_age_days() <= _REFRESH_AFTER_DAYS:
        return

    logger.info("Downloading Metasploit module metadata from %s ...", _DOWNLOAD_URL)
    async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT_SEC) as client:
        resp = await client.get(_DOWNLOAD_URL, follow_redirects=True)
        resp.raise_for_status()
        # Atomic write: write to .tmp then rename
        tmp = _CACHE_FILE.with_suffix(".json.tmp")
        tmp.write_bytes(resp.content)
        os.replace(tmp, _CACHE_FILE)
    logger.info(
        "Metasploit metadata cached at %s (%.1f MB)",
        _CACHE_FILE, _CACHE_FILE.stat().st_size / (1024 * 1024),
    )


def _cache_age_days() -> float:
    if not _CACHE_FILE.exists():
        return float("inf")
    return (time.time() - _CACHE_FILE.stat().st_mtime) / 86400.0


def _build_index_from_disk() -> MetasploitIndex:
    """Parse the cached JSON and build the by-CVE index."""
    if not _CACHE_FILE.exists():
        return MetasploitIndex()

    try:
        with _CACHE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        logger.exception("Failed to parse Metasploit metadata cache: %s", exc)
        return MetasploitIndex()

    index = MetasploitIndex(source_age_days=_cache_age_days())
    # The metadata file is a dict { fullname: module_object }
    if not isinstance(data, dict):
        logger.error("Unexpected MSF metadata shape (expected dict, got %s)", type(data))
        return index

    import re as _re
    _CVE_STR_RE = _re.compile(r"^CVE-\d{4}-\d{4,7}$", _re.IGNORECASE)

    for fullname, mod in data.items():
        if not isinstance(mod, dict):
            continue
        refs = mod.get("references") or []
        mi = ModuleInfo(
            name        = mod.get("name", fullname),
            fullname    = mod.get("fullname", fullname),
            type        = mod.get("type", "unknown"),
            rank        = _rank_name(mod.get("rank")),
            disclosure_date = mod.get("disclosure_date"),
            references  = refs,
        )
        index.total_modules += 1
        for ref in refs:
            # Two known shapes in the wild:
            #   1) plain string  "CVE-2017-0144"      (current rapid7 format)
            #   2) object        {"type": "CVE", "ref": "2017-0144"}  (older bundles)
            cve_id: str = ""
            if isinstance(ref, str):
                token = ref.strip()
                if _CVE_STR_RE.match(token):
                    cve_id = token.upper()
            elif isinstance(ref, dict):
                if (ref.get("type") or "").upper() == "CVE":
                    raw = (ref.get("ref") or "").upper().strip()
                    if raw:
                        cve_id = raw if raw.startswith("CVE-") else f"CVE-{raw}"
            if cve_id:
                index.by_cve.setdefault(cve_id, []).append(mi)

    index.indexed_cves = len(index.by_cve)
    logger.info(
        "Metasploit index built: %d modules, %d CVE references (cache age %.1f days)",
        index.total_modules, index.indexed_cves, index.source_age_days,
    )
    return index


# Metasploit numeric ranks (in modules_metadata_base.json `rank` is an int 0-600).
# 600 = ExcellentRanking, 500 = GreatRanking, 400 = GoodRanking, 300 = NormalRanking,
# 200 = AverageRanking, 100 = LowRanking, 0 = ManualRanking
_RANK_NAMES = {
    600: "excellent",
    500: "great",
    400: "good",
    300: "normal",
    200: "average",
    100: "low",
    0:   "manual",
}


def _rank_name(rank_val) -> str:
    if isinstance(rank_val, str):
        return rank_val.lower()
    if isinstance(rank_val, (int, float)):
        # Round down to nearest 100 and look up
        bucket = int(rank_val) // 100 * 100
        return _RANK_NAMES.get(bucket, "normal")
    return "normal"
