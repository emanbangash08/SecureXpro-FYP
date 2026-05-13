"""
Vulnerability Correlation Service — Module 2 (complete implementation).

Per open port, the pipeline is:
  1. Build CPE 2.3 string from nmap service + version  (vendor/product lookup)
  2. Query NVD by cpeName → NVD validates version ranges server-side  (exact match)
  3. If CPE yields nothing, fall back to keyword search with client-side
     version-range validation and OS compatibility filtering
  4. After all ports are resolved, batch-enrich every CVE with:
       • EPSS  (Exploit Prediction Scoring System — FIRST.org)
       • CISA KEV  (Known Exploited Vulnerabilities catalog)
  5. exploit_available = True  when CVE is in KEV  OR  EPSS ≥ threshold (0.4)
  6. Deduplicate by (cve_id, host_ip, port) before writing to MongoDB
"""
import asyncio
import logging

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.recon_service import HostResult, PortInfo
from app.models.vulnerability import vulnerability_document, Severity
from app.services import nvd_client, epss_client, kev_client
from app.services.nvd_client import CveRecord

logger = logging.getLogger(__name__)

# Rate-limit NVD requests: without API key the limit is 5 req/30 s
_MAX_CONCURRENT_NVD = 3


async def correlate_vulnerabilities(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    hosts: list[HostResult],
) -> list[dict]:
    """
    Correlate all discovered open ports with CVEs.
    Returns the list of vulnerability documents that were inserted into MongoDB.
    """
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_NVD)

    # ── Step 1: Gather CVEs per port (concurrent, rate-limited) ───────────────
    async with httpx.AsyncClient(timeout=30) as http_client:
        tasks = [
            _fetch_port_cves(http_client, semaphore, host, port)
            for host in hosts
            for port in host.ports
            if port.service
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    valid_results: list[tuple[HostResult, PortInfo, list[CveRecord]]] = []
    all_cve_ids: list[str] = []

    for res in raw_results:
        if isinstance(res, Exception):
            logger.warning("CVE lookup task error: %s", res)
            continue
        host, port, records = res
        valid_results.append((host, port, records))
        all_cve_ids.extend(r.cve_id for r in records)

    if not all_cve_ids:
        return []

    # ── Step 2: Batch-enrich with EPSS + KEV (two concurrent calls) ───────────
    epss_scores, kev_set = await asyncio.gather(
        epss_client.fetch_epss_scores(list(set(all_cve_ids))),
        kev_client.get_kev_set(),
    )

    # ── Step 3: Deduplicate then persist ──────────────────────────────────────
    seen: set[str] = set()
    inserted: list[dict] = []

    for host, port, records in valid_results:
        for record in records:
            dedup_key = f"{record.cve_id}|{host.ip}|{port.port}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            epss = epss_scores.get(record.cve_id)
            in_kev = record.cve_id in kev_set
            exploit_available = in_kev or (epss is not None and epss_client.is_exploit_likely(epss))

            doc = vulnerability_document(
                scan_id=scan_id,
                cve_id=record.cve_id,
                title=record.title,
                description=record.description,
                severity=_map_severity(record.cvss_score),
                cvss_score=record.cvss_score,
                affected_host=host.ip,
                affected_service=port.service,
                affected_port=port.port,
                exploit_available=exploit_available,
                remediation=record.remediation,
                references=record.references,
            )
            # Enrichment fields added on top of the base document
            doc["epss_score"]      = round(epss.epss, 4)       if epss else None
            doc["epss_percentile"] = round(epss.percentile, 4) if epss else None
            doc["in_kev"]          = in_kev
            doc["match_type"]      = record.match_type

            result = await db.vulnerabilities.insert_one(doc)
            doc["_id"] = result.inserted_id
            inserted.append(doc)

    return inserted


# ── Per-port CVE lookup ───────────────────────────────────────────────────────

async def _fetch_port_cves(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    host: HostResult,
    port: PortInfo,
) -> tuple[HostResult, PortInfo, list[CveRecord]]:
    async with semaphore:
        records = await _lookup_cves(client, port.service, port.version, host.os_guess)
    return host, port, records


async def _lookup_cves(
    client: httpx.AsyncClient,
    service: str,
    version: str,
    os_guess: str,
) -> list[CveRecord]:
    """
    Two-stage CVE lookup:
      Stage 1 — CPE with version  →  NVD validates version server-side (highest precision)
      Stage 2 — keyword fallback  →  client-side version range + OS filtering
    """
    # Stage 1: CPE exact match
    if version:
        cpe = nvd_client.build_cpe_string(service, version)
        if cpe:
            records = await nvd_client.fetch_cves_by_cpe(client, cpe, results_per_page=10)
            if records:
                return records

    # Stage 2: Keyword fallback with validation
    keyword = nvd_client.get_keyword_for_service(service, version)
    return await nvd_client.fetch_cves_by_keyword(
        client,
        keyword,
        version=version,
        os_guess=os_guess,
        results_per_page=5,
    )


# ── Severity mapping ──────────────────────────────────────────────────────────

def _map_severity(score: float) -> Severity:
    if score >= 9.0:
        return Severity.CRITICAL
    if score >= 7.0:
        return Severity.HIGH
    if score >= 4.0:
        return Severity.MEDIUM
    if score > 0:
        return Severity.LOW
    return Severity.INFO
