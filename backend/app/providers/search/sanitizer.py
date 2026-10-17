"""
Sanitization, validation, and deduplication utilities for search evidence.
"""

import re
import urllib.parse
import uuid

from backend.app.models.evidence import Evidence
from backend.app.providers.search.base import SearchResult

# Strip tracking query parameters commonly found on web search results
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
}

# Regex to detect and strip basic HTML tags from raw search snippets
HTML_TAG_REGEX = re.compile(r"<[^>]+>")
WHITESPACE_REGEX = re.compile(r"\s+")


def validate_url(url: str) -> bool:
    """
    Validates that a string is a well-formed HTTP or HTTPS URL.
    """
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urllib.parse.urlparse(url.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except (ValueError, AttributeError):
        return False


def normalize_url(url: str) -> str:
    """
    Normalizes a URL by stripping tracking parameters, fragments, and redundant whitespace.
    """
    url = url.strip()
    try:
        parsed = urllib.parse.urlparse(url)
        query_pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
        clean_query = urllib.parse.urlencode(
            [(k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS]
        )
        # Strip trailing slash from path if it's just root or empty
        path = parsed.path
        if path == "/":
            path = ""
        normalized = urllib.parse.urlunparse(
            (parsed.scheme.lower(), parsed.netloc.lower(), path, "", clean_query, "")
        )
        return normalized or url
    except (ValueError, AttributeError):
        return url


def sanitize_snippet(raw_text: str, max_chars: int = 2000) -> str:
    """
    Strips HTML tags, collapses excessive whitespace, and bounds snippet length.
    """
    if not raw_text:
        return ""

    # Remove HTML tags
    cleaned = HTML_TAG_REGEX.sub(" ", raw_text)
    # Collapse multiple spaces and newlines
    cleaned = WHITESPACE_REGEX.sub(" ", cleaned).strip()

    if len(cleaned) <= max_chars:
        return cleaned

    # Truncate at word boundary
    truncated = cleaned[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars * 0.8:
        truncated = truncated[:last_space]
    return f"{truncated}..."


def deduplicate_results(results: list[SearchResult]) -> list[SearchResult]:
    """
    Deduplicates SearchResult items by normalized URL.
    When duplicate URLs are found, retains the instance with the higher relevance score.
    """
    seen: dict[str, SearchResult] = {}
    for res in results:
        if not validate_url(res.url):
            continue
        norm_url = normalize_url(res.url)
        if norm_url not in seen or res.score > seen[norm_url].score:
            res.url = norm_url
            res.content = sanitize_snippet(res.content)
            res.title = sanitize_snippet(res.title, max_chars=300) if res.title else ""
            seen[norm_url] = res

    return list(seen.values())


def results_to_evidence(
    results: list[SearchResult],
    task_id: uuid.UUID,
    job_id: uuid.UUID,
    provider_name: str,
) -> list[Evidence]:
    """
    Converts sanitized, deduplicated SearchResult items into SQLAlchemy Evidence records.
    """
    deduped = deduplicate_results(results)
    evidence_items: list[Evidence] = []

    for item in deduped:
        metadata = {
            "relevance_score": item.score,
            "published_date": item.published_date,
            **item.raw_metadata,
        }
        ev = Evidence(
            task_id=task_id,
            job_id=job_id,
            source_url=item.url,
            source_title=item.title or "Untitled Web Source",
            snippet=item.content,
            provider_name=provider_name,
            provider_metadata=metadata,
        )
        evidence_items.append(ev)

    return evidence_items
