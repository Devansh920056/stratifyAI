"""
Deterministic Mock Research & Analysis Provider for Stage 5.
Generates structured, validated evidence and grounded findings for testing
the distributed queue-to-database worker pipeline without external API credentials.
"""

import uuid

from backend.app.models.enums import TaskType
from backend.app.models.evidence import Evidence
from backend.app.models.task_result import TaskResult


class MockResearchProvider:
    """
    Deterministic provider that generates verifiable mock evidence and analysis
    matching the exact schemas required by the database layer.
    """

    @staticmethod
    def execute_mock_research(
        task_id: uuid.UUID,
        job_id: uuid.UUID,
        task_type: str,
        search_queries: list[str],
    ) -> tuple[list[Evidence], TaskResult]:
        query_summary = search_queries[0] if search_queries else "market analysis"

        if task_type == TaskType.MARKET_OVERVIEW.value:
            url = f"https://mock-market-intelligence.internal/reports/{task_id}/tam"
            evidence = [
                Evidence(
                    task_id=task_id,
                    job_id=job_id,
                    source_url=url,
                    source_title="[Mock] Global Market Sizing and Growth Projections Report",
                    snippet=(
                        f"According to internal synthesis for query '{query_summary}', the target sector "
                        f"is valued at $42.5B in 2024 and projected to reach $118.2B by 2030, representing "
                        f"a Compound Annual Growth Rate (CAGR) of 18.6%. Key drivers include industrial automation "
                        f"and rising enterprise cloud expenditures."
                    ),
                    provider_name="mock",
                    provider_metadata={"query": query_summary, "deterministic": True},
                ),
            ]
            result = TaskResult(
                task_id=task_id,
                key_findings=[
                    {
                        "claim": "Target market is projected to reach $118.2B by 2030 with an 18.6% CAGR.",
                        "source_url": url,
                        "confidence": 0.94,
                    },
                    {
                        "claim": "Growth is primarily propelled by enterprise automation investments.",
                        "source_url": url,
                        "confidence": 0.91,
                    },
                ],
                grounded_summary=(
                    "The market demonstrates robust double-digit expansion driven by macro efficiency mandates. "
                    "Near-term capital deployment focuses on high-yield software and infrastructure upgrades."
                ),
                confidence_score=0.93,
                citations=[{"url": url, "title": "Global Market Sizing Report"}],
                model_name="mock-grounder-v1",
            )

        elif task_type == TaskType.COMPETITOR_ANALYSIS.value:
            url = f"https://mock-market-intelligence.internal/reports/{task_id}/competitors"
            evidence = [
                Evidence(
                    task_id=task_id,
                    job_id=job_id,
                    source_url=url,
                    source_title="[Mock] Competitive Landscape & Market Concentration Matrix",
                    snippet=(
                        f"Competitive audit for query '{query_summary}' reveals a moderately concentrated sector. "
                        f"The top three incumbents hold approximately 58% cumulative market share, while emerging "
                        f"challengers compete through aggressive pricing and vertical integration."
                    ),
                    provider_name="mock",
                    provider_metadata={"query": query_summary, "deterministic": True},
                ),
            ]
            result = TaskResult(
                task_id=task_id,
                key_findings=[
                    {
                        "claim": "Top 3 incumbents control 58% cumulative market share.",
                        "source_url": url,
                        "confidence": 0.89,
                    },
                    {
                        "claim": "Challengers are gaining ground via modular, open-architecture alternatives.",
                        "source_url": url,
                        "confidence": 0.87,
                    },
                ],
                grounded_summary=(
                    "The competitive environment is consolidating around platform ecosystems. "
                    "Point-solution vendors face margin compression unless offering proprietary data advantages."
                ),
                confidence_score=0.88,
                citations=[{"url": url, "title": "Competitive Landscape Matrix"}],
                model_name="mock-grounder-v1",
            )

        elif task_type == TaskType.CUSTOMER_INSIGHTS.value:
            url = (
                f"https://mock-market-intelligence.internal/reports/{task_id}/customers"
            )
            evidence = [
                Evidence(
                    task_id=task_id,
                    job_id=job_id,
                    source_url=url,
                    source_title="[Mock] Buyer Persona, Procurement Criteria, and Adoption Friction Survey",
                    snippet=(
                        f"Customer interviews evaluating '{query_summary}' indicate high buyer willingness-to-pay "
                        f"when demonstrable ROI occurs within 6 months. Primary adoption friction involves complex "
                        f"legacy integration and internal compliance hurdles."
                    ),
                    provider_name="mock",
                    provider_metadata={"query": query_summary, "deterministic": True},
                ),
            ]
            result = TaskResult(
                task_id=task_id,
                key_findings=[
                    {
                        "claim": "Enterprises require sub-6-month payback periods before expanding pilot deployments.",
                        "source_url": url,
                        "confidence": 0.92,
                    },
                    {
                        "claim": "Legacy workflow friction remains the chief impediment to widespread adoption.",
                        "source_url": url,
                        "confidence": 0.90,
                    },
                ],
                grounded_summary=(
                    "Customer sentiment is overwhelmingly positive on core utility, but buying cycles "
                    "are elongated by security audits and integration requirements."
                ),
                confidence_score=0.91,
                citations=[{"url": url, "title": "Customer Procurement Survey"}],
                model_name="mock-grounder-v1",
            )

        else:  # REGULATORY_RISKS or fallback
            url = f"https://mock-market-intelligence.internal/reports/{task_id}/regulatory"
            evidence = [
                Evidence(
                    task_id=task_id,
                    job_id=job_id,
                    source_url=url,
                    source_title="[Mock] Regulatory Compliance, Antitrust, and Jurisdictional Risk Brief",
                    snippet=(
                        f"Regulatory review for '{query_summary}' highlights tightening data sovereignty "
                        f"mandates in the EU and emerging FTC scrutiny in North America. Supply chain dependencies "
                        f"on specialized semiconductor fabrication present secondary operational risks."
                    ),
                    provider_name="mock",
                    provider_metadata={"query": query_summary, "deterministic": True},
                ),
            ]
            result = TaskResult(
                task_id=task_id,
                key_findings=[
                    {
                        "claim": "Cross-border data governance rules require localized data processing architecture.",
                        "source_url": url,
                        "confidence": 0.95,
                    },
                    {
                        "claim": "Hardware supply chain single-points-of-failure present moderate operational vulnerability.",
                        "source_url": url,
                        "confidence": 0.88,
                    },
                ],
                grounded_summary=(
                    "Regulatory burdens are increasing globally. Compliance readiness is becoming "
                    "a major competitive moat for enterprise software providers."
                ),
                confidence_score=0.92,
                citations=[{"url": url, "title": "Regulatory Risk Brief"}],
                model_name="mock-grounder-v1",
            )

        return evidence, result
