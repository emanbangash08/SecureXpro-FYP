"""
Risk Scoring & Prioritization — aggregates vulnerability data into a risk summary.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.vulnerability import Severity


async def compute_risk_summary(db: AsyncIOMotorDatabase, scan_id: str) -> dict:
    pipeline = [
        {"$match": {"scan_id": scan_id}},
        {"$group": {
            "_id": "$severity",
            "count": {"$sum": 1},
            "avg_cvss": {"$avg": "$cvss_score"},
            "max_cvss": {"$max": "$cvss_score"},
        }},
    ]
    counts = {s.value: 0 for s in Severity}
    max_cvss = 0.0
    total = 0

    async for doc in db.vulnerabilities.aggregate(pipeline):
        sev = doc["_id"]
        counts[sev] = doc["count"]
        total += doc["count"]
        if doc["max_cvss"] > max_cvss:
            max_cvss = doc["max_cvss"]

    overall_risk = _overall_risk_level(counts, max_cvss)

    return {
        "total": total,
        "critical": counts[Severity.CRITICAL.value],
        "high": counts[Severity.HIGH.value],
        "medium": counts[Severity.MEDIUM.value],
        "low": counts[Severity.LOW.value],
        "info": counts[Severity.INFO.value],
        "max_cvss_score": max_cvss,
        "overall_risk": overall_risk,
    }


def _overall_risk_level(counts: dict, max_cvss: float) -> str:
    if counts[Severity.CRITICAL.value] > 0 or max_cvss >= 9.0:
        return "critical"
    if counts[Severity.HIGH.value] > 0 or max_cvss >= 7.0:
        return "high"
    if counts[Severity.MEDIUM.value] > 0 or max_cvss >= 4.0:
        return "medium"
    if counts[Severity.LOW.value] > 0:
        return "low"
    return "info"
