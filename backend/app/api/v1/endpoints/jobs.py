"""
Research Jobs API Endpoints.
Handles job submission, status polling, task inspection, and report retrieval.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.job import (
    JobCreateRequest,
    JobDetailResponse,
    JobResponse,
)
from backend.app.schemas.report import ReportResponse
from backend.app.schemas.task import TaskSummaryResponse
from backend.app.services.job_service import JobService

router = APIRouter()

# Modern FastAPI dependency annotation avoiding B008
SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit Market Research Inquiry",
    description="Validates request, persists research Job, and decomposes inquiry into orthogonal tasks.",
)
async def create_research_job(
    request: JobCreateRequest,
    response: Response,
    db: SessionDep,
) -> JobResponse:
    job = await JobService.create_job(db=db, request=request)

    # Set standard HTTP 202 Location header for polling
    response.headers["Location"] = f"/api/v1/jobs/{job.id}"

    return JobResponse(
        id=job.id,
        research_question=job.research_question,
        target_market=job.target_market,
        geography=job.geography,
        time_range=job.time_range,
        focus_areas=job.focus_areas,
        status=job.status,
        tasks_count=len(job.tasks),
        error_summary=job.error_summary,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
    )


@router.get(
    "",
    response_model=list[JobResponse],
    summary="List Research Jobs",
    description="Returns recent research jobs ordered by creation timestamp descending.",
)
async def list_jobs(
    db: SessionDep,
    limit: int = 50,
    offset: int = 0,
) -> list[JobResponse]:
    jobs = await JobService.list_jobs(db=db, limit=limit, offset=offset)
    return [
        JobResponse(
            id=j.id,
            research_question=j.research_question,
            target_market=j.target_market,
            geography=j.geography,
            time_range=j.time_range,
            focus_areas=j.focus_areas,
            status=j.status,
            tasks_count=len(j.tasks),
            error_summary=j.error_summary,
            created_at=j.created_at,
            updated_at=j.updated_at,
            completed_at=j.completed_at,
        )
        for j in jobs
    ]


@router.get(
    "/{job_id}",
    response_model=JobDetailResponse,
    summary="Get Job Details",
    description="Retrieves comprehensive status for a research job including all sub-task progression.",
)
async def get_job_detail(
    job_id: uuid.UUID,
    db: SessionDep,
) -> JobDetailResponse:
    job = await JobService.get_job(db=db, job_id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research job '{job_id}' not found.",
        )

    task_summaries = [TaskSummaryResponse.model_validate(t) for t in job.tasks]

    return JobDetailResponse(
        id=job.id,
        research_question=job.research_question,
        target_market=job.target_market,
        geography=job.geography,
        time_range=job.time_range,
        focus_areas=job.focus_areas,
        status=job.status,
        tasks_count=len(job.tasks),
        error_summary=job.error_summary,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        has_report=(job.report is not None),
        tasks=task_summaries,
    )


@router.get(
    "/{job_id}/tasks",
    response_model=list[TaskSummaryResponse],
    summary="Get Job Sub-Tasks",
    description="Lists all individual research tasks associated with a job.",
)
async def get_job_tasks(
    job_id: uuid.UUID,
    db: SessionDep,
) -> list[TaskSummaryResponse]:
    # Check if job exists
    job = await JobService.get_job(db=db, job_id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research job '{job_id}' not found.",
        )

    tasks = await JobService.get_job_tasks(db=db, job_id=job_id)
    return [TaskSummaryResponse.model_validate(t) for t in tasks]


@router.get(
    "/{job_id}/report",
    response_model=ReportResponse,
    summary="Get Synthesized Research Report",
    description="Retrieves the completed or partial market intelligence report. Returns 404 if not yet generated.",
)
async def get_job_report(
    job_id: uuid.UUID,
    db: SessionDep,
) -> ReportResponse:
    job = await JobService.get_job(db=db, job_id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research job '{job_id}' not found.",
        )

    report = await JobService.get_job_report(db=db, job_id=job_id)
    if not report:
        from backend.app.services.aggregator import ReportAggregatorService

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=db, job_id=job_id
        )
        if report:
            await db.commit()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report is not ready yet. Current job status: '{job.status}'.",
        )

    return ReportResponse.model_validate(report)
