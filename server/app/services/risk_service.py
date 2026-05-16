"""
Risk Scoring & Prioritization — Module 5.

Aggregates vulnerability data into a structured risk summary. Beyond the
basic CVSS-band severity counts, the score now folds in:

  • Exploit availability:
        - CISA KEV-listed CVEs        → force overall ≥ "high"
        - exploit_available=true + CVSS≥7  → force overall = "critical"

  • Service exposure:
        - External (public IP / hostname)  → bump baseline up one band
        - Internal (RFC-1918, loopback, .local/.lan/.internal) → no bump
        - Unknown (no target supplied) → no bump

  • CIA triad impact:
        - parses the CVSS vector's C:/I:/A: components for every finding
        - returns per-scan counts of how many findings have "high" impact
          on each of confidentiality / integrity / availability

The output dict is JSON-safe and back-compatible with the previous shape
(all existing fields preserved, new fields appended).
"""
from __future__ import annotations

import ipaddress
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.vulnerability import Severity


# ── Exposure classification ───────────────────────────────────────────────────

_INTERNAL_TLDS = (".local", ".internal", ".lan", ".intranet", ".corp")


def _classify_exposure(target: Optional[str]) -> str:
    """
    Return "internal" | "external" | "unknown" for the scan target.

    Heuristic:
      • IP address → use ipaddress.is_private / is_loopback / is_link_local.
      • Hostname → "external" unless it ends with a known intranet TLD.
      • Anything unparseable → "unknown" (no bump applied).
    """
    if not target:
        return "unknown"

    raw = target.strip()
    if not raw:
        return "unknown"

    # Strip protocol scheme + path + port
    if "://" in raw:
        raw = raw.split("://", 1)[1]
    raw = raw.split("/", 1)[0]
    raw = raw.rsplit(":", 1)[0] if ":" in raw and "]" not in raw else raw

    try:
        ip = ipaddress.ip_address(raw)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified:
            return "internal"
        return "external"
    except ValueError:
        host = raw.lower()
        if any(host.endswith(t) for t in _INTERNAL_TLDS) or host == "localhost":
            return "internal"
        return "external"


# ── CVSS vector parsing — CIA components only ────────────────────────────────

def _parse_cia(vector: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract (C, I, A) from a CVSS v3.x vector. Returns Nones if absent."""
    if not vector:
        return None, None, None
    c = i = a = None
    for part in vector.split("/"):
        if ":" not in part:
            continue
        k, v = part.split(":", 1)
        if k == "C":
            c = v
        elif k == "I":
            i = v
        elif k == "A":
            a = v
    return c, i, a


# ── Severity band escalation ─────────────────────────────────────────────────

_BANDS = ("info", "low", "medium", "high", "critical")


def _baseline_band(counts: dict, max_cvss: float) -> str:
    if counts[Severity.CRITICAL.value] > 0 or max_cvss >= 9.0:
        return "critical"
    if counts[Severity.HIGH.value] > 0 or max_cvss >= 7.0:
        return "high"
    if counts[Severity.MEDIUM.value] > 0 or max_cvss >= 4.0:
        return "medium"
    if counts[Severity.LOW.value] > 0:
        return "low"
    return "info"


def _escalate(
    base: str,
    *,
    kev_count: int,
    exploit_count: int,
    max_cvss: float,
    exposure: str,
) -> tuple[str, list[str]]:
    """
    Apply escalations on top of the CVSS baseline.

    Returns (final_band, reasons[]) so callers can show why the score moved.
    """
    idx = _BANDS.index(base)
    reasons: list[str] = []

    # 1) KEV-listed → at least "high"
    if kev_count > 0 and idx < _BANDS.index("high"):
        idx = _BANDS.index("high")
        reasons.append(f"{kev_count} CISA KEV-listed CVE(s)")

    # 2) Public exploit + CVSS≥7 → critical
    if exploit_count > 0 and max_cvss >= 7.0 and idx < _BANDS.index("critical"):
        idx = _BANDS.index("critical")
        reasons.append(f"{exploit_count} CVE(s) with public exploit at CVSS ≥ 7.0")

    # 3) External exposure bumps baseline up one band (capped at critical)
    if exposure == "external" and idx > _BANDS.index("info") and idx < _BANDS.index("critical"):
        new_idx = min(idx + 1, _BANDS.index("critical"))
        if new_idx != idx:
            idx = new_idx
            reasons.append("internet-exposed target")

    return _BANDS[idx], reasons


# ── Public API ────────────────────────────────────────────────────────────────

async def compute_risk_summary(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    target: Optional[str] = None,
) -> dict:
    """
    Aggregate every vulnerability for `scan_id` into a risk summary.

    `target` is the scan's IP/hostname; if omitted, exposure is "unknown" and
    no external-bump escalation is applied.
    """
    # ── 1. Severity counts + max CVSS ──
    pipeline = [
        {"$match": {"scan_id": scan_id}},
        {"$group": {
            "_id": "$severity",
            "count": {"$sum": 1},
            "max_cvss": {"$max": "$cvss_score"},
        }},
    ]
    counts = {s.value: 0 for s in Severity}
    max_cvss = 0.0
    total = 0
    async for doc in db.vulnerabilities.aggregate(pipeline):
        sev = doc["_id"]
        if sev in counts:
            counts[sev] = doc["count"]
        total += doc["count"]
        if doc["max_cvss"] and doc["max_cvss"] > max_cvss:
            max_cvss = doc["max_cvss"]

    # ── 2. Exploit-availability counts ──
    kev_count = await db.vulnerabilities.count_documents(
        {"scan_id": scan_id, "in_kev": True},
    )
    exploit_count = await db.vulnerabilities.count_documents(
        {"scan_id": scan_id, "exploit_available": True},
    )
    msf_count = await db.vulnerabilities.count_documents(
        {"scan_id": scan_id, "metasploit_module_count": {"$gt": 0}},
    )

    # ── 3. CIA-triad impact aggregation ──
    cia_high = {"confidentiality": 0, "integrity": 0, "availability": 0}
    cursor = db.vulnerabilities.find(
        {"scan_id": scan_id, "cvss_vector": {"$nin": ["", None]}},
        {"cvss_vector": 1},
    )
    async for v in cursor:
        c, i, a = _parse_cia(v.get("cvss_vector") or "")
        if c == "H":
            cia_high["confidentiality"] += 1
        if i == "H":
            cia_high["integrity"] += 1
        if a == "H":
            cia_high["availability"] += 1

    # ── 4. Service-exposure classification ──
    exposure = _classify_exposure(target)

    # ── 5. Final risk band ──
    base = _baseline_band(counts, max_cvss)
    overall_risk, escalation_reasons = _escalate(
        base,
        kev_count=kev_count,
        exploit_count=exploit_count,
        max_cvss=max_cvss,
        exposure=exposure,
    )

    return {
        # ── Back-compatible fields (unchanged keys) ──
        "total":          total,
        "critical":       counts[Severity.CRITICAL.value],
        "high":           counts[Severity.HIGH.value],
        "medium":         counts[Severity.MEDIUM.value],
        "low":            counts[Severity.LOW.value],
        "info":           counts[Severity.INFO.value],
        "max_cvss_score": round(max_cvss, 1),
        "overall_risk":   overall_risk,

        # ── New: exploit-availability factor ──
        "kev_count":          kev_count,
        "exploit_count":      exploit_count,
        "msf_module_count":   msf_count,

        # ── New: service exposure ──
        "target":          target,
        "exposure":        exposure,

        # ── New: CIA-triad impact ──
        "cia_high":        cia_high,

        # ── Audit trail: why the score escalated ──
        "baseline_risk":      base,
        "escalation_reasons": escalation_reasons,
    }
