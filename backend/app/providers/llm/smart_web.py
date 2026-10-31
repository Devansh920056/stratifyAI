"""
Smart Web LLM Provider: extractive, evidence-only synthesis.

This provider never generates free text. Every claim it returns is a sentence quoted
verbatim from a retrieved evidence snippet, with the URL it came from. Scores are
computed from the data (see ``_support_score``) rather than assigned.
"""

import logging
import re

from backend.app.models.evidence import Evidence
from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMProvider,
    LLMProviderError,
)

logger = logging.getLogger("stratify.providers.llm.smart_web")

METRIC_PATTERN = re.compile(
    r"(\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:billion|million|trillion|bn|[BMT])\b)?|"
    r"\d+(?:\.\d+)?\s?%|"
    r"\b(?:19|20)\d{2}\b|"
    r"\b(?:CAGR|market share|capacity|gigawatt|megawatt|kWh|Wh/kg|patent|funding)\b)",
    re.IGNORECASE,
)

_STOPWORDS = frozenset(
    "a an and are as at be by for from how in is it of on or that the this to was what when "
    "where which who will with about into than their there these those through over under".split()
)
_WORD = re.compile(r"[a-z0-9][a-z0-9\-\.]+", re.IGNORECASE)

MAX_FINDINGS = 6
MAX_CLAIM_CHARS = 280


def _terms(text: str) -> set[str]:
    return {w.lower().strip(".-") for w in _WORD.findall(text) if len(w) > 2 and w.lower() not in _STOPWORDS}


def _support_score(question_terms: set[str], text: str, provider_score: float | None) -> float:
    """
    Evidence-support score in [0, 1]:
    the share of research-question terms that appear in the source text. When the search
    provider supplied its own relevance score, the two are averaged.
    """
    if not question_terms:
        coverage = 0.0
    else:
        coverage = len(question_terms & _terms(text)) / len(question_terms)
    if provider_score is not None:
        return round(max(0.0, min(1.0, (coverage + float(provider_score)) / 2.0)), 2)
    return round(max(0.0, min(1.0, coverage)), 2)


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 25]


class SmartWebLLMProvider(LLMProvider):
    """Extractive provider: quotes retrieved evidence, cites it, and scores it from the data."""

    def __init__(self, model_name: str = "stratify-extractor-v1"):
        self._model_name = model_name

    @property
    def provider_name(self) -> str:
        return "smart-extractor"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def analyze(
        self,
        task_type: str,
        research_question: str,
        evidence_items: list[Evidence],
    ) -> AnalysisOutput:
        if not evidence_items:
            raise LLMProviderError(
                f"No evidence was retrieved for '{task_type}'; refusing to produce an analysis without sources."
            )

        logger.info(f"[SmartWebLLM] Extracting from {len(evidence_items)} evidence items for '{task_type}'")

        question_terms = _terms(research_question)
        candidates: list[tuple[float, KeyFinding]] = []
        citations: list[Citation] = []
        seen_urls: set[str] = set()

        for ev in evidence_items:
            url = ev.source_url.strip()
            if url in seen_urls:
                continue
            seen_urls.add(url)
            citations.append(Citation(url=url, title=ev.source_title or url))

            sentences = _split_sentences(ev.snippet or "")
            if not sentences:
                continue
            # Prefer the sentence carrying a figure/date/keyword; otherwise the first sentence.
            chosen = next((s for s in sentences if METRIC_PATTERN.search(s)), sentences[0])
            claim = chosen[:MAX_CLAIM_CHARS].rstrip()
            if len(chosen) > MAX_CLAIM_CHARS:
                claim += "..."

            provider_score = (ev.provider_metadata or {}).get("relevance_score")
            score = _support_score(
                question_terms,
                f"{ev.source_title or ''} {ev.snippet}",
                float(provider_score) if provider_score is not None else None,
            )
            candidates.append((score, KeyFinding(claim=claim, source_url=url, confidence=score)))

        if not candidates:
            raise LLMProviderError(
                f"Retrieved {len(evidence_items)} evidence items for '{task_type}' but none contained usable text."
            )

        candidates.sort(key=lambda c: c[0], reverse=True)
        key_findings = [f for _, f in candidates[:MAX_FINDINGS]]
        overall = round(sum(f.confidence for f in key_findings) / len(key_findings), 2)

        human_task = task_type.replace("_", " ").title()
        quoted = " ".join(f"[{i}] {f.claim}" for i, f in enumerate(key_findings, start=1))
        grounded_summary = (
            f"{human_task} - extracted from {len(citations)} retrieved source(s) for the question "
            f"'{research_question}'. Quoted statements: {quoted}"
        )

        return AnalysisOutput(
            key_findings=key_findings,
            grounded_summary=grounded_summary,
            confidence_score=overall,
            citations=citations,
            model_name=self._model_name,
        )
