"""
Stage 8: Aggregation Engine & Source-Backed Reports Integration Tests.
Verifies:
1. Full task completion produces FINAL aggregated Report and transitions Job to COMPLETED.
2. Cross-task citation deduplication and global indexing.
3. Partial task completion produces PARTIAL Report with honest research limitations.
4. Total task failure transitions Job to FAILED with error diagnostics.
5. Idempotent aggregation calls return existing Report without duplicate rows.
6. In-flight tasks defer report generation.
7. End-to-end integration: Worker completion automatically triggers aggregation, and GET /report returns HTTP 200.
"""

import httpx
import pytest
from sqlalchemy import select

from backend.app.broker.schemas import TaskMessage
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import JobStatus, ReportStatus, TaskStatus, TaskType
from backend.app.models.evidence import Evidence
from backend.app.models.job import Job
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.models.task_result import TaskResult
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.services.aggregator import ReportAggregatorService
from backend.app.services.job_service import JobService
from workers.processor import TaskProcessor

# ==============================================================================
# Helper to build a job with tasks and mock results
# ==============================================================================


async def create_job_with_mock_results(
    session,
    completed_types: list[TaskType],
    failed_types: list[TaskType] | None = None,
    in_flight_types: list[TaskType] | None = None,
) -> Job:
    failed_types = failed_types or []
    in_flight_types = in_flight_types or []

    job = Job(
        research_question="Next-generation geothermal drilling technology commercialization",
        target_market="Geothermal Energy",
        geography="Global",
    )
    session.add(job)
    await session.flush()

    for ttype in completed_types:
        task = Task(
            job_id=job.id,
            task_type=ttype.value,
            search_queries=[f"{ttype.value} query"],
            status=TaskStatus.COMPLETED.value,
            version=2,
        )
        session.add(task)
        await session.flush()

        evidence = Evidence(
            task_id=task.id,
            job_id=job.id,
            source_url=f"https://market-intel.internal/reports/{ttype.value.lower()}?utm_source=feed",
            source_title=f"{ttype.value.title()} Source",
            snippet=f"Empirical findings for {ttype.value}.",
            provider_name="mock",
            provider_metadata={"relevance_score": 0.94},
        )
        session.add(evidence)

        result = TaskResult(
            task_id=task.id,
            key_findings=[
                {
                    "claim": f"Key validated finding for {ttype.value}.",
                    "source_url": evidence.source_url,
                    "confidence": 0.94,
                }
            ],
            grounded_summary=f"Cohesive synthesis for {ttype.value.replace('_', ' ').title()}.",
            confidence_score=0.93,
            citations=[{"url": evidence.source_url, "title": evidence.source_title}],
            model_name="mock-grounder-v1",
        )
        session.add(result)

    for ttype in failed_types:
        task = Task(
            job_id=job.id,
            task_type=ttype.value,
            search_queries=[f"{ttype.value} query"],
            status=TaskStatus.FAILED.value,
            error_details="Exceeded max attempts (3). Connection refused.",
            version=3,
        )
        session.add(task)

    for ttype in in_flight_types:
        task = Task(
            job_id=job.id,
            task_type=ttype.value,
            search_queries=[f"{ttype.value} query"],
            status=TaskStatus.IN_PROGRESS.value,
            version=1,
        )
        session.add(task)

    await session.commit()
    return job


# ==============================================================================
# 1. Report Aggregator Unit & State Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_aggregator_full_success_creates_final_report():
    """Verify that when all 4 tasks are COMPLETED, ReportAggregator produces a FINAL report."""
    all_types = [
        TaskType.MARKET_OVERVIEW,
        TaskType.COMPETITOR_ANALYSIS,
        TaskType.CUSTOMER_INSIGHTS,
        TaskType.REGULATORY_RISKS,
    ]

    async with AsyncSessionLocal() as session:
        job = await create_job_with_mock_results(session, completed_types=all_types)

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=session,
            job_id=job.id,
        )
        await session.commit()

        assert report is not None
        assert report.status == ReportStatus.FINAL.value
        assert report.job_id == job.id

        # Verify Job state transition
        updated_job = await session.scalar(select(Job).where(Job.id == job.id))
        assert updated_job.status == JobStatus.COMPLETED.value
        assert updated_job.completed_at is not None

        # Verify all sections populated
        assert report.market_findings["status"] == "COMPLETED"
        assert report.competitor_analysis["status"] == "COMPLETED"
        assert report.customer_insights["status"] == "COMPLETED"
        assert report.opportunities_and_risks["status"] == "COMPLETED"

        # Verify citations deduplicated and indexed
        assert len(report.citations) == 4
        assert report.research_limitations is None
        assert "geothermal drilling" in report.executive_summary.lower()


@pytest.mark.asyncio
async def test_aggregator_idempotency_returns_existing_report():
    """Verify calling check_and_aggregate_job repeatedly returns existing report without duplicates."""
    all_types = [
        TaskType.MARKET_OVERVIEW,
        TaskType.COMPETITOR_ANALYSIS,
        TaskType.CUSTOMER_INSIGHTS,
        TaskType.REGULATORY_RISKS,
    ]

    async with AsyncSessionLocal() as session:
        job = await create_job_with_mock_results(session, completed_types=all_types)

        report1 = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        await session.commit()
        assert report1 is not None

        # Second call
        report2 = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        assert report2 is not None
        assert report2.id == report1.id

        # Database must have exactly 1 report for this job
        reports = (
            await session.scalars(select(Report).where(Report.job_id == job.id))
        ).all()
        assert len(reports) == 1


@pytest.mark.asyncio
async def test_aggregator_defers_when_tasks_in_flight():
    """Verify aggregator returns None when sub-tasks are still IN_PROGRESS."""
    async with AsyncSessionLocal() as session:
        job = await create_job_with_mock_results(
            session,
            completed_types=[
                TaskType.MARKET_OVERVIEW,
                TaskType.COMPETITOR_ANALYSIS,
            ],
            in_flight_types=[
                TaskType.CUSTOMER_INSIGHTS,
                TaskType.REGULATORY_RISKS,
            ],
        )

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        assert report is None

        # Job must remain in its original state
        updated_job = await session.scalar(select(Job).where(Job.id == job.id))
        assert updated_job.status != JobStatus.COMPLETED.value
        assert updated_job.completed_at is None


@pytest.mark.asyncio
async def test_aggregator_partial_success_creates_partial_report():
    """
    Verify aggregator creates a PARTIAL report when some tasks succeed and some fail,
    explicitly documenting failed dimensions in research_limitations.
    """
    async with AsyncSessionLocal() as session:
        job = await create_job_with_mock_results(
            session,
            completed_types=[
                TaskType.MARKET_OVERVIEW,
                TaskType.COMPETITOR_ANALYSIS,
                TaskType.CUSTOMER_INSIGHTS,
            ],
            failed_types=[TaskType.REGULATORY_RISKS],
        )

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        await session.commit()

        assert report is not None
        assert report.status == ReportStatus.PARTIAL.value

        # Job must reflect PARTIALLY_COMPLETED
        updated_job = await session.scalar(select(Job).where(Job.id == job.id))
        assert updated_job.status == JobStatus.PARTIALLY_COMPLETED.value

        # Failed section must be marked FAILED
        assert report.opportunities_and_risks["status"] == "FAILED"
        assert "Exceeded max attempts" in report.opportunities_and_risks["error"]

        # Completed sections must be COMPLETED
        assert report.market_findings["status"] == "COMPLETED"

        # Limitations must explain the failure
        assert report.research_limitations is not None
        assert "REGULATORY_RISKS" in report.research_limitations


@pytest.mark.asyncio
async def test_aggregator_total_failure_marks_job_failed():
    """Verify aggregator marks Job as FAILED when all tasks fail, without creating a Report."""
    all_types = [
        TaskType.MARKET_OVERVIEW,
        TaskType.COMPETITOR_ANALYSIS,
        TaskType.CUSTOMER_INSIGHTS,
        TaskType.REGULATORY_RISKS,
    ]

    async with AsyncSessionLocal() as session:
        job = await create_job_with_mock_results(
            session,
            completed_types=[],
            failed_types=all_types,
        )

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        await session.commit()

        assert report is None

        # Verify Job state transition to FAILED
        updated_job = await session.scalar(select(Job).where(Job.id == job.id))
        assert updated_job.status == JobStatus.FAILED.value
        assert "All 4 research tasks failed" in updated_job.error_summary


@pytest.mark.asyncio
async def test_citation_deduplication_across_tasks():
    """Verify overlapping URLs across tasks are normalized and deduplicated in the final report."""
    shared_url_dirty = (
        "https://industry-analytics.com/whitepaper?utm_source=twitter&utm_medium=social"
    )
    shared_url_clean = "https://industry-analytics.com/whitepaper"

    async with AsyncSessionLocal() as session:
        job = Job(
            research_question="Fusion energy commercial viability",
            target_market="Clean Energy",
            geography="Global",
        )
        session.add(job)
        await session.flush()

        # Create two tasks that cite the same URL with different query parameters
        for ttype in (TaskType.MARKET_OVERVIEW, TaskType.COMPETITOR_ANALYSIS):
            task = Task(
                job_id=job.id,
                task_type=ttype.value,
                search_queries=["fusion query"],
                status=TaskStatus.COMPLETED.value,
                version=2,
            )
            session.add(task)
            await session.flush()

            result = TaskResult(
                task_id=task.id,
                key_findings=[
                    {
                        "claim": "Magnetic confinement milestone reached.",
                        "source_url": shared_url_dirty,
                        "confidence": 0.9,
                    }
                ],
                grounded_summary="Fusion summary.",
                confidence_score=0.9,
                citations=[
                    {
                        "url": shared_url_dirty,
                        "title": "Fusion Milestone Whitepaper",
                    }
                ],
                model_name="mock-model",
            )
            session.add(result)

        await session.commit()

        report = await ReportAggregatorService.check_and_aggregate_job(
            session=session, job_id=job.id
        )
        await session.commit()

        assert report is not None
        # Must contain only ONE deduplicated citation
        assert len(report.citations) == 1
        assert report.citations[0]["url"] == shared_url_clean


# ==============================================================================
# 2. End-to-End Worker Pipeline Aggregation Integration
# ==============================================================================


@pytest.mark.asyncio
async def test_end_to_end_worker_aggregation_trigger(
    api_client: httpx.AsyncClient,
):
    """
    CRITICAL END-TO-END DISTRIBUTED INTEGRATION TEST:
    1. Creates a Job via JobService (4 decomposed tasks).
    2. Processes all 4 tasks through TaskProcessor.
    3. The 4th task completion triggers ReportAggregatorService automatically.
    4. GET /api/v1/jobs/{job_id}/report returns HTTP 200 with the full ReportResponse.
    """
    from backend.app.schemas.job import JobCreateRequest

    async with AsyncSessionLocal() as session:
        job_req = JobCreateRequest(
            research_question="Commercial supersonic aviation market feasibility",
            target_market="Aerospace & Defense",
            geography="Global",
        )
        job = await JobService.create_job(db=session, request=job_req)
        await session.commit()
        job_id = job.id

    # Verify report is initially 404 before tasks are processed
    initial_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert initial_res.status_code == 404

    # Process all 4 tasks sequentially
    mock_search = MockSearchProvider()
    mock_llm = MockLLMProvider()

    async with AsyncSessionLocal() as session:
        tasks = await JobService.get_job_tasks(db=session, job_id=job_id)
        assert len(tasks) == 4

        for task in tasks:
            task_msg = TaskMessage(
                task_id=task.id,
                job_id=job_id,
                task_type=task.task_type,
                search_queries=task.search_queries,
                version=task.version,
            )
            success, reason = await TaskProcessor.process_task(
                session=session,
                task_message=task_msg,
                search_provider=mock_search,
                llm_provider=mock_llm,
            )
            assert success is True
            assert reason == "completed"

    # After the 4th task completed, the worker automatically triggered aggregation!
    # Fetch report via API endpoint
    report_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()

    assert report_data["job_id"] == str(job_id)
    assert report_data["status"] == "FINAL"
    assert len(report_data["citations"]) >= 4
    assert len(report_data["executive_summary"]) > 100
    assert report_data["market_findings"]["status"] == "COMPLETED"
    assert report_data["competitor_analysis"]["status"] == "COMPLETED"
    assert report_data["customer_insights"]["status"] == "COMPLETED"
    assert report_data["opportunities_and_risks"]["status"] == "COMPLETED"
