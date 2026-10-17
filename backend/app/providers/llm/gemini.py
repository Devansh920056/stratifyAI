"""
Google Gemini LLM Provider implementation using async httpx.
"""

import json
import logging
from typing import Any

import httpx
from pydantic import ValidationError

from backend.app.models.evidence import Evidence
from backend.app.providers.llm.base import (
    AnalysisOutput,
    LLMAuthError,
    LLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMSchemaValidationError,
    LLMTimeoutError,
)
from backend.app.providers.llm.prompt import (
    SYSTEM_PROMPT,
    build_analysis_prompt,
    validate_and_sanitize_grounding,
)

logger = logging.getLogger("stratify.providers.llm.gemini")

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiLLMProvider(LLMProvider):
    """
    Live AI reasoning provider using Google Gemini models (e.g. gemini-1.5-flash).
    Extracts structured, grounded findings and enforces anti-hallucination verification.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
        timeout_seconds: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ):
        if not api_key or not api_key.strip():
            raise LLMAuthError("Gemini API key cannot be empty.")
        self._api_key = api_key.strip()
        self._model = model.strip()
        self._timeout = timeout_seconds
        self._client = client

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model

    async def analyze(
        self,
        task_type: str,
        research_question: str,
        evidence_items: list[Evidence],
    ) -> AnalysisOutput:
        """
        Executes Gemini structured reasoning over the evidence and returns validated AnalysisOutput.
        """
        user_prompt = build_analysis_prompt(
            task_type, research_question, evidence_items
        )
        url = f"{GEMINI_API_BASE}/{self._model}:generateContent?key={self._api_key}"

        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        try:
            if self._client:
                response = await self._client.post(
                    url, json=payload, timeout=self._timeout
                )
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.post(url, json=payload)

            if response.status_code == 200:
                body = response.json()
                try:
                    candidates = body.get("candidates", [])
                    if not candidates:
                        raise LLMSchemaValidationError(
                            "Gemini returned empty candidate response."
                        )

                    text_content = candidates[0]["content"]["parts"][0]["text"].strip()
                    if text_content.startswith("```"):
                        lines = text_content.splitlines()
                        if lines and lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        text_content = "\n".join(lines).strip()

                    parsed_json = json.loads(text_content)
                    parsed_json["model_name"] = self._model

                    raw_output = AnalysisOutput.model_validate(parsed_json)
                    # Enforce strict anti-hallucination URL verification
                    verified_output = validate_and_sanitize_grounding(
                        raw_output, evidence_items
                    )
                    return verified_output

                except (
                    KeyError,
                    IndexError,
                    json.JSONDecodeError,
                    ValidationError,
                ) as parse_err:
                    logger.error(
                        f"[Gemini] Schema validation failure: {parse_err!s}. Response body: {response.text[:200]}"
                    )
                    raise LLMSchemaValidationError(
                        f"Invalid structured JSON from Gemini: {parse_err!s}"
                    ) from parse_err

            elif response.status_code in (400, 401, 403):
                raise LLMAuthError(
                    f"Gemini authentication/request error ({response.status_code}): {response.text}"
                )
            elif response.status_code == 429:
                raise LLMRateLimitError(
                    f"Gemini rate limit exceeded (429): {response.text}"
                )
            elif response.status_code >= 500:
                raise LLMProviderError(
                    f"Gemini server error ({response.status_code}): {response.text}"
                )
            else:
                raise LLMProviderError(
                    f"Gemini unexpected status ({response.status_code}): {response.text}"
                )

        except httpx.TimeoutException as exc:
            logger.warning(
                f"[Gemini] Request timed out after {self._timeout}s for task {task_type}"
            )
            raise LLMTimeoutError(
                f"Gemini request timed out after {self._timeout}s"
            ) from exc
        except (
            LLMAuthError,
            LLMRateLimitError,
            LLMSchemaValidationError,
            LLMTimeoutError,
        ):
            raise
        except Exception as exc:
            logger.error(f"[Gemini] Request failed: {exc!s}")
            raise LLMProviderError(f"Gemini execution failed: {exc!s}") from exc
