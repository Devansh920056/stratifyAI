"""
Prompt engineering and anti-hallucination citation guardrails for LLM synthesis.
"""

from backend.app.models.evidence import Evidence
import logging

from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMSchemaValidationError,
)

logger = logging.getLogger("stratify.providers.llm.prompt")

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
      "confidence": <number between 0 and 1: how directly the snippet supports the claim>
    }
  ],
  "grounded_summary": "Comprehensive, cohesive 2-3 paragraph analytical summary synthesizing the evidence...",
  "confidence_score": <number between 0 and 1>,
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
    ANTI-HALLUCINATION GUARDRAIL.
    Keeps only findings and citations whose URL matches a retrieved evidence item
    (a trailing-slash difference is tolerated). Anything else is dropped - it is never
    re-attributed to a different source. If nothing grounded remains, the output is
    rejected with LLMSchemaValidationError.
    """
    if not evidence_items:
        raise LLMSchemaValidationError("Cannot ground an analysis without any retrieved evidence.")

    valid = {ev.source_url: ev.source_title or ev.source_url for ev in evidence_items}
    by_stripped = {u.rstrip("/"): u for u in valid}

    def resolve(url: str) -> str | None:
        if url in valid:
            return url
        return by_stripped.get(url.rstrip("/"))

    findings: list[KeyFinding] = []
    for finding in raw_output.key_findings:
        resolved = resolve(finding.source_url)
        if resolved:
            finding.source_url = resolved
            findings.append(finding)
        else:
            logger.warning("Dropping ungrounded finding citing unknown URL: %s", finding.source_url)

    if not findings:
        raise LLMSchemaValidationError("LLM output contained no findings grounded in the retrieved evidence.")

    citations: list[Citation] = []
    seen: set[str] = set()
    for cit in raw_output.citations:
        resolved = resolve(cit.url)
        if resolved and resolved not in seen:
            seen.add(resolved)
            citations.append(Citation(url=resolved, title=valid[resolved]))
    # Always cite every source that a retained finding relies on.
    for f in findings:
        if f.source_url not in seen:
            seen.add(f.source_url)
            citations.append(Citation(url=f.source_url, title=valid[f.source_url]))

    raw_output.key_findings = findings
    raw_output.citations = citations
    return raw_output
