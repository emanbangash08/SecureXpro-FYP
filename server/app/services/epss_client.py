"""
EPSS (Exploit Prediction Scoring System) client — FIRST.org API v1.

Scores represent the probability that a CVE will be exploited in the wild
within the next 30 days. No API key required.

Batch endpoint: GET https://api.first.org/data/v1/epss?cve=CVE-A,CVE-B,...
"""
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

EPSS_API_URL = "https://api.first.org/data/v1/epss"

# CVEs scoring at or above this probability are flagged as exploit_available
EPSS_EXPLOIT_THRESHOLD = 0.4


@dataclass
class EpssScore:
    cve_id: str
    epss: float        # 0.0 – 1.0  (probability of exploitation within 30 days)
    percentile: float  # 0.0 – 1.0  (relative rank among all scored CVEs)


async def fetch_epss_scores(cve_ids: list[str]) -> dict[str, EpssScore]:
    """
    Batch-fetch EPSS scores for a list of CVE IDs in a single HTTP request.
    Returns a dict of cve_id → EpssScore; missing CVEs are simply absent.
    Failures are logged and return an empty dict so the pipeline continues.
    """
    if not cve_ids:
        return {}

    params = {"cve": ",".join(set(cve_ids))}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(EPSS_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("EPSS API request failed: %s", exc)
        return {}

    results: dict[str, EpssScore] = {}
    for entry in data.get("data", []):
        cve_id = entry.get("cve", "")
        if cve_id:
            results[cve_id] = EpssScore(
                cve_id=cve_id,
                epss=float(entry.get("epss", 0.0)),
                percentile=float(entry.get("percentile", 0.0)),
            )

    return results


def is_exploit_likely(score: EpssScore) -> bool:
    """Return True when EPSS probability meets or exceeds the exploit threshold."""
    return score.epss >= EPSS_EXPLOIT_THRESHOLD
