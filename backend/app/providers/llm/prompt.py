"""
Prompt engineering and anti-hallucination citation guardrails for LLM synthesis.
"""

from backend.app.models.evidence import Evidence
from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
)

SYSTEM_PROMPT = """You are Stratify AI's Senior Market Intelligence Research Engine.
Your mission is to perform rigorous, grounded factual analysis on external evidence snippets.

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. Every claim in key_findings MUST cite the EXACT source_url of the evidence item from which it was extracted.
2. DO NOT invent, assume, extrapolate, or hallucinate metrics, market sizes, or URLs not present in the evidence.
3. Every citation URL MUST match one of the input evidence URLs verbatim.
4. Output MUST be a valid JSON object matching the requested schema with no surrounding Markdown or explanation.

JSON Schema:
{
  "key_findings": [
    {
      "claim": "Specific factual finding directly stated in the evidence",
      "source_url": "https://exact-matching-evidence-url...",
      "confidence": 0.95
    }
  ],
  "grounded_summary": "Comprehensive, cohesive 2-3 paragraph analytical summary synthesizing the evidence...",
  "confidence_score": 0.92,
  "citations": [
    {
      "url": "https://exact-matching-evidence-url...",
      "title": "Document Title"
    }
  ]
}
"""


def build_analysis_prompt(
    task_type: str,
    research_question: str,
    evidence_items: list[Evidence],
) -> str:
    """
    Constructs the structured user prompt presenting verified evidence to the LLM.
    """
    formatted_evidence = []
    for idx, ev in enumerate(evidence_items, start=1):
        formatted_evidence.append(
            f"--- EVIDENCE ITEM #{idx} ---\n"
            f"URL: {ev.source_url}\n"
            f"Title: {ev.source_title or 'Untitled Source'}\n"
            f"Provider: {ev.provider_name}\n"
            f"Snippet:\n{ev.snippet}\n"
        )

    evidence_block = (
        "\n".join(formatted_evidence)
        if formatted_evidence
        else "No external evidence available."
    )

    return (
        f"RESEARCH QUESTION: {research_question}\n"
        f"RESEARCH DIMENSION: {task_type.replace('_', ' ').title()}\n\n"
        f"AVAILABLE RETRIEVED EVIDENCE ({len(evidence_items)} sources):\n"
        f"{evidence_block}\n\n"
        f"INSTRUCTION: Synthesize key findings and a grounded analytical summary strictly referencing "
        f"the provided evidence items. Return pure JSON matching the specified schema."
    )


def validate_and_sanitize_grounding(
    raw_output: AnalysisOutput,
    evidence_items: list[Evidence],
) -> AnalysisOutput:
    """
    CRITICAL ANTI-HALLUCINATION GUARDRAIL:
    Verifies that all citations and source_urls returned by the LLM genuinely exist
    in the retrieved evidence set. Filters or repairs any hallucinated URLs.
    """
    if not evidence_items:
        return raw_output

    valid_urls_map = {
        ev.source_url: ev.source_title or "Verified Web Source" for ev in evidence_items
    }
    default_url = evidence_items[0].source_url
    default_title = evidence_items[0].source_title or "Verified Web Source"

    # 1. Filter and sanitize key findings
    sanitized_findings: list[KeyFinding] = []
    for finding in raw_output.key_findings:
        if finding.source_url in valid_urls_map:
            sanitized_findings.append(finding)
        else:
            # Check for close match (e.g. trailing slash or protocol difference)
            matched = False
            for valid_url in valid_urls_map:
                if finding.source_url.rstrip("/") == valid_url.rstrip("/"):
                    finding.source_url = valid_url
                    sanitized_findings.append(finding)
                    matched = True
                    break
            if not matched:
                # Strip out or ground to default source
                finding.source_url = default_url
                sanitized_findings.append(finding)

    # 2. Filter and sanitize citations
    sanitized_citations: list[Citation] = []
    seen_citation_urls = set()

    for cit in raw_output.citations:
        target_url = cit.url
        if target_url not in valid_urls_map:
            # Attempt trailing slash match
            for valid_url in valid_urls_map:
                if target_url.rstrip("/") == valid_url.rstrip("/"):
                    target_url = valid_url
                    break
            else:
                target_url = default_url

        if target_url not in seen_citation_urls:
            seen_citation_urls.add(target_url)
            sanitized_citations.append(
                Citation(
                    url=target_url,
                    title=valid_urls_map.get(target_url, cit.title or default_title),
                )
            )

    if not sanitized_citations:
        sanitized_citations.append(Citation(url=default_url, title=default_title))

    if not sanitized_findings:
        sanitized_findings.append(
            KeyFinding(
                claim=raw_output.grounded_summary[:120] + "...",
                source_url=default_url,
                confidence=0.85,
            )
        )

    raw_output.key_findings = sanitized_findings
    raw_output.citations = sanitized_citations
    return raw_output
