"""
Vulnerability Correlation Service — maps recon results to CVEs via NVD API.
"""
import httpx
from app.core.config import settings
from app.services.recon_service import HostResult
from app.models.vulnerability import vulnerability_document, Severity
from motor.motor_asyncio import AsyncIOMotorDatabase


async def correlate_vulnerabilities(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    hosts: list[HostResult],
) -> list[dict]:
    inserted: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        for host in hosts:
            for port in host.ports:
                if not port.service or not port.version:
                    continue
                cves = await _fetch_cves(client, port.service, port.version)
                for cve in cves:
                    severity = _map_severity(cve.get("cvss_score", 0.0))
                    doc = vulnerability_document(
                        scan_id=scan_id,
                        cve_id=cve["cve_id"],
                        title=cve["title"],
                        description=cve["description"],
                        severity=severity,
                        cvss_score=cve.get("cvss_score", 0.0),
                        affected_host=host.ip,
                        affected_service=port.service,
                        affected_port=port.port,
                        remediation=cve.get("remediation", ""),
                        references=cve.get("references", []),
                    )
                    result = await db.vulnerabilities.insert_one(doc)
                    doc["_id"] = result.inserted_id
                    inserted.append(doc)

    return inserted


async def _fetch_cves(client: httpx.AsyncClient, service: str, version: str) -> list[dict]:
    keyword = f"{service} {version}"
    params = {"keywordSearch": keyword, "resultsPerPage": 5}
    headers = {}
    if settings.NVD_API_KEY:
        headers["apiKey"] = settings.NVD_API_KEY

    try:
        resp = await client.get(settings.NVD_API_BASE_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    results = []
    for item in data.get("vulnerabilities", []):
        cve_data = item.get("cve", {})
        cve_id = cve_data.get("id", "")
        descriptions = cve_data.get("descriptions", [])
        description = next((d["value"] for d in descriptions if d["lang"] == "en"), "")
        metrics = cve_data.get("metrics", {})
        cvss_score = _extract_cvss_score(metrics)
        refs = [r["url"] for r in cve_data.get("references", [])[:5]]
        results.append({
            "cve_id": cve_id,
            "title": cve_id,
            "description": description,
            "cvss_score": cvss_score,
            "references": refs,
            "remediation": "",
        })

    return results


def _extract_cvss_score(metrics: dict) -> float:
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key, [])
        if entries:
            return entries[0].get("cvssData", {}).get("baseScore", 0.0)
    return 0.0


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
