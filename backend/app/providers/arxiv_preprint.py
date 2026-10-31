"""
arXiv Provider: live search of the public arXiv API (https://info.arxiv.org/help/api/).

Returns real preprints only. If nothing matches, or arXiv is unreachable, no papers are
returned (network failures raise ArxivProviderError) - nothing is substituted.
"""

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger("stratify.providers.arxiv_preprint")

ARXIV_API_URL = "https://export.arxiv.org/api/query"
ATOM = "{http://www.w3.org/2005/Atom}"
EXCERPT_CHARS = 700
MAX_QUERY_TERMS = 6

# Source-class prior (peer-unreviewed preprints), recorded in metadata as such. Not a measurement.
ARXIV_SOURCE_RELIABILITY_PRIOR = 0.7

_STOPWORDS = frozenset("a an and are as at be by for from in is of on or the to with".split())


class ArxivProviderError(Exception):
    """Raised when arXiv cannot be reached or returns an unexpected response."""


@dataclass
class ArxivPaperResult:
    arxiv_id: str
    title: str
    authors: list[str]
    published_date: str
    categories: list[str]
    abstract_excerpt: str
    source_url: str
    reliability_score: float = ARXIV_SOURCE_RELIABILITY_PRIOR
    metadata: dict[str, Any] = field(default_factory=dict)


def build_search_query(topic: str) -> str | None:
    """Builds an arXiv `search_query` that ANDs the significant words of the topic."""
    words: list[str] = []
    for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-]+", topic):
        lw = w.lower()
        if lw not in _STOPWORDS and lw not in words:
            words.append(lw)
    words = words[:MAX_QUERY_TERMS]
    if not words:
        return None
    return " AND ".join(f"all:{w}" for w in words)


def parse_atom_feed(xml_text: str) -> list[ArxivPaperResult]:
    """Parses an arXiv Atom response into paper results."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise ArxivProviderError(f"arXiv returned malformed XML: {exc!s}") from exc

    results: list[ArxivPaperResult] = []
    for entry in root.findall(f"{ATOM}entry"):
        raw_id = (entry.findtext(f"{ATOM}id") or "").strip()
        if not raw_id:
            continue
        arxiv_id = re.sub(r"v\d+$", "", raw_id.rsplit("/abs/", 1)[-1])
        title = re.sub(r"\s+", " ", entry.findtext(f"{ATOM}title") or "").strip()
        summary = re.sub(r"\s+", " ", entry.findtext(f"{ATOM}summary") or "").strip()
        if not title or not summary:
            continue
        excerpt = summary if len(summary) <= EXCERPT_CHARS else summary[:EXCERPT_CHARS].rsplit(" ", 1)[0] + "..."
        authors = [
            (a.findtext(f"{ATOM}name") or "").strip() for a in entry.findall(f"{ATOM}author")
        ]
        authors = [a for a in authors if a]
        categories = [c.get("term", "") for c in entry.findall(f"{ATOM}category") if c.get("term")]
        published = (entry.findtext(f"{ATOM}published") or "")[:10]
        results.append(
            ArxivPaperResult(
                arxiv_id=arxiv_id,
                title=title,
                authors=authors,
                published_date=published,
                categories=categories,
                abstract_excerpt=excerpt,
                source_url=f"https://arxiv.org/abs/{arxiv_id}",
                metadata={
                    "arxiv_id": arxiv_id,
                    "authors": authors,
                    "categories": categories,
                    "published_date": published,
                    "reliability_basis": "source_class_prior",
                    "source": "arXiv API",
                },
            )
        )
    return results


class ArxivPreprintProvider:
    """Searches real arXiv preprints."""

    def __init__(self, timeout_seconds: float = 15.0, client: httpx.AsyncClient | None = None):
        self.timeout = timeout_seconds
        self.client = client

    async def search_preprints(self, topic: str, max_results: int = 5) -> list[ArxivPaperResult]:
        query = build_search_query(topic)
        if not query:
            return []
        params = {
            "search_query": query,
            "start": 0,
            "max_results": max(1, min(max_results, 25)),
            "sortBy": "relevance",
            "sortOrder": "descending",
        }
        try:
            if self.client is not None:
                response = await self.client.get(ARXIV_API_URL, params=params, timeout=self.timeout)
            else:
                async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                    response = await client.get(ARXIV_API_URL, params=params)
        except httpx.HTTPError as exc:
            raise ArxivProviderError(f"arXiv request failed: {exc!s}") from exc
        if response.status_code != 200:
            raise ArxivProviderError(f"arXiv returned HTTP {response.status_code}")
        return parse_atom_feed(response.text)[:max_results]
