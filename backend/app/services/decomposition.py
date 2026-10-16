"""
Task Decomposition Engine.
Decomposes a broad market research question into orthogonal, independently executable research vectors.
"""

import uuid

from backend.app.models.enums import TaskStatus, TaskType
from backend.app.schemas.job import JobCreateRequest


def generate_search_queries(
    task_type: TaskType,
    question: str,
    market: str,
    geography: str,
    time_range: str,
    focus_areas: list[str],
) -> list[str]:
    """
    Deterministically crafts targeted search queries for a specific research vector.
    """
    clean_time = time_range or "current"
    extra_context = f"{focus_areas[0]}" if focus_areas else ""

    if task_type == TaskType.MARKET_OVERVIEW:
        return [
            f"{market} market size TAM growth rate {geography} {clean_time}",
            f"{question} industry analysis forecast {clean_time}",
            f"{market} key market drivers trends {geography}",
        ]
    elif task_type == TaskType.COMPETITOR_ANALYSIS:
        base = [
            f"top competitors market share {market} {geography} {clean_time}",
            f"key players market leaders {market} competitive landscape",
        ]
        if extra_context:
            base.append(f"{market} competitors {extra_context}")
        return base
    elif task_type == TaskType.CUSTOMER_INSIGHTS:
        base = [
            f"{market} customer adoption barriers pricing sentiment {clean_time}",
            f"buyer behavior willingness to pay {market} {geography}",
        ]
        if focus_areas:
            base.append(f"{market} customer demand {focus_areas[-1]}")
        return base
    elif task_type == TaskType.REGULATORY_RISKS:
        base = [
            f"{market} regulatory risks compliance policy hurdles {geography} {clean_time}",
            f"{market} legal challenges supply chain technology risks",
        ]
        return base
    else:
        return [f"{question} {market} {geography}"]


def decompose_job_into_tasks(
    job_id: uuid.UUID, request: JobCreateRequest
) -> list[dict]:
    """
    Decomposes a research request into 4 distinct, orthogonal task specifications.
    Each task has its own unique UUID and targeted search queries.
    """
    orthogonal_types = [
        TaskType.MARKET_OVERVIEW,
        TaskType.COMPETITOR_ANALYSIS,
        TaskType.CUSTOMER_INSIGHTS,
        TaskType.REGULATORY_RISKS,
    ]

    decomposed_tasks = []
    for task_type in orthogonal_types:
        task_id = uuid.uuid4()
        queries = generate_search_queries(
            task_type=task_type,
            question=request.research_question,
            market=request.target_market,
            geography=request.geography,
            time_range=request.time_range or "2024-2026",
            focus_areas=request.focus_areas,
        )

        decomposed_tasks.append(
            {
                "id": task_id,
                "job_id": job_id,
                "task_type": task_type.value,
                "search_queries": queries,
                "status": TaskStatus.PENDING.value,
                "attempt_count": 0,
                "max_attempts": 3,
                "version": 1,
            }
        )

    return decomposed_tasks
