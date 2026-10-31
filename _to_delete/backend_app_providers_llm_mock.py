"""
Deterministic Mock LLM Provider for testing and offline development.
"""

import logging

from backend.app.models.evidence import Evidence
from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMProvider,
)

logger = logging.getLogger("stratify.providers.llm.mock")


class MockLLMProvider(LLMProvider):
    """
    Deterministic mock LLM reasoning provider that generates grounded,
    schema-compliant research analysis without external network or API costs.
    """

    def __init__(self, model_name: str = "mock-grounder-v1"):
        self._model_name = model_name

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def analyze(
        self,
        task_type: str,
        research_question: str,
        evidence_items: list[Evidence],
    ) -> AnalysisOutput:
        """
        Synthesizes realistic, evidence-grounded key findings and summary
        strictly referencing the provided evidence items.
        """
        logger.info(
            f"[MockLLM] Analyzing {len(evidence_items)} evidence sources for task '{task_type}'"
        )

        default_url = (
            evidence_items[0].source_url
            if evidence_items
            else f"https://mock-market-intelligence.internal/reports/{task_type}"
        )
        default_title = (
            evidence_items[0].source_title
            if evidence_items and evidence_items[0].source_title
            else "Grounded Research Brief"
        )

        key_findings: list[KeyFinding] = []
        citations: list[Citation] = []
        seen_urls = set()

        if evidence_items:
            for ev in evidence_items[:4]:
                if ev.source_url not in seen_urls:
                    seen_urls.add(ev.source_url)
                    citations.append(
                        Citation(
                            url=ev.source_url,
                            title=ev.source_title or "Market Source",
                        )
                    )

                # Formulate grounded claim from snippet
                snippet_preview = (
                    ev.snippet[:150] + "..." if len(ev.snippet) > 150 else ev.snippet
                )
                score = float(ev.provider_metadata.get("relevance_score", 0.92))
                key_findings.append(
                    KeyFinding(
                        claim=snippet_preview,
                        source_url=ev.source_url,
                        confidence=round(score, 2),
                    )
                )

        if not key_findings:
            key_findings.append(
                KeyFinding(
                    claim=f"Preliminary market synthesis for {task_type}.",
                    source_url=default_url,
                    confidence=0.85,
                )
            )
            citations.append(Citation(url=default_url, title=default_title))

        human_task = task_type.replace("_", " ").title()
        summary = (
            f"Strategic market synthesis for '{research_question}' across {human_task}. "
            f"Cross-referencing {len(evidence_items)} independent evidence sources confirms "
            f"robust sector expansion, strong unit economics, and distinct differentiation moats "
            f"driven by scalable technology adoption."
        )

        return AnalysisOutput(
            key_findings=key_findings,
            grounded_summary=summary,
            confidence_score=0.93,
            citations=citations,
            model_name=self._model_name,
        )
