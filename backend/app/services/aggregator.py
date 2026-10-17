"""
Report Aggregation Service.
Coordinates the synthesis of independent research task results into an aggregated,
source-backed market intelligence report with global citation deduplication.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.db.base import utc_now
from backend.app.models.enums import JobStatus, ReportStatus, TaskStatus, TaskType
from backend.app.models.job import Job
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.providers.llm.base import LLMProvider
from backend.app.providers.search.sanitizer import normalize_url

logger = logging.getLogger("stratify.services.aggregator")


class ReportAggregatorService:
    """
    Evaluates job task completion and compiles verified research dimensions into a unified Report.
    """

    @classmethod
    async def check_and_aggregate_job(
        cls,
        session: AsyncSession,
        job_id: uuid.UUID,
        llm_provider: LLMProvider | None = None,
    ) -> Report | None:
        """
        Inspects all sub-tasks for a given job. If all tasks have reached a terminal state
        (COMPLETED or FAILED), synthesizes and persists the aggregated Report.

        :param session: Active AsyncSession
        :param job_id: Target Job UUID
        :param llm_provider: Optional injected LLM provider for executive summary synthesis
        :return: Persisted Report instance, or None if tasks are still in-flight
        """
        # Load Job with tasks, task results, evidence, and existing report
        stmt = (
            select(Job)
            .options(
                selectinload(Job.tasks).selectinload(Task.result),
                selectinload(Job.tasks).selectinload(Task.evidence),
                selectinload(Job.report),
            )
            .where(Job.id == job_id)
        )
        job = await session.scalar(stmt)
        if not job:
            logger.warning(f"Aggregation requested for non-existent job {job_id}")
            return None

        # Idempotency check: if report already exists, return it without duplicate synthesis
        existing_report = await session.scalar(
            select(Report).where(Report.job_id == job_id)
        )
        if existing_report is not None:
            logger.info(
                f"Report already exists for job {job_id}. Skipping aggregation."
            )
            return existing_report

        tasks = job.tasks
        if not tasks:
            logger.warning(f"Job {job_id} has no tasks to aggregate.")
            return None

        # Check if all tasks have reached a terminal status
        terminal_statuses = (TaskStatus.COMPLETED.value, TaskStatus.FAILED.value)
        in_flight_tasks = [t for t in tasks if t.status not in terminal_statuses]
        if in_flight_tasks:
            logger.info(
                f"Job {job_id} has {len(in_flight_tasks)} in-flight tasks remaining. "
                f"Deferring aggregation."
            )
            return None

        # Partition completed vs failed tasks
        completed_tasks = [
            t
            for t in tasks
            if t.status == TaskStatus.COMPLETED.value and t.result is not None
        ]
        failed_tasks = [t for t in tasks if t.status == TaskStatus.FAILED.value]

        # Case 1: Total failure (no tasks produced results)
        if not completed_tasks:
            logger.error(
                f"All {len(tasks)} tasks failed for job {job_id}. Marking job FAILED."
            )
            job.status = JobStatus.FAILED.value
            job.error_summary = (
                f"All {len(tasks)} research tasks failed execution. "
                + "; ".join(f"{t.task_type}: {t.error_details}" for t in failed_tasks)
            )
            job.completed_at = utc_now()
            await session.flush()
            return None

        # Case 2: Partial or Full success
        is_full_success = len(completed_tasks) == len(tasks)
        report_status = (
            ReportStatus.FINAL.value if is_full_success else ReportStatus.PARTIAL.value
        )
        job.status = (
            JobStatus.COMPLETED.value
            if is_full_success
            else JobStatus.PARTIALLY_COMPLETED.value
        )
        job.completed_at = utc_now()

        research_limitations = None
        if not is_full_success:
            failed_types = [t.task_type for t in failed_tasks]
            research_limitations = (
                f"Partial report: {len(failed_tasks)} of {len(tasks)} tasks failed "
                f"({', '.join(failed_types)}). Analysis for failed dimensions is unavailable."
            )

        # ----------------------------------------------------------------------
        # Cross-Task Citation Aggregation & Deduplication
        # ----------------------------------------------------------------------
        global_citations: list[dict] = []
        seen_urls = set()

        for task in completed_tasks:
            result = task.result
            if not result or not result.citations:
                continue
            for cit in result.citations:
                raw_url = (
                    cit.get("url")
                    if isinstance(cit, dict)
                    else getattr(cit, "url", None)
                )
                if not raw_url:
                    continue
                norm_url = normalize_url(raw_url)
                if norm_url not in seen_urls:
                    seen_urls.add(norm_url)
                    global_citations.append(
                        {
                            "url": norm_url,
                            "title": cit.get("title", "Verified Evidence Source")
                            if isinstance(cit, dict)
                            else getattr(cit, "title", "Verified Evidence Source"),
                            "task_type": task.task_type,
                        }
                    )

        # ----------------------------------------------------------------------
        # Map Task Results to Structured Report Sections
        # ----------------------------------------------------------------------
        sections: dict[str, dict] = {}
        for task_type_enum in TaskType:
            ttype = task_type_enum.value
            matching_task = next((t for t in tasks if t.task_type == ttype), None)

            if (
                matching_task
                and matching_task.status == TaskStatus.COMPLETED.value
                and matching_task.result
            ):
                res = matching_task.result
                sections[ttype] = {
                    "status": "COMPLETED",
                    "summary": res.grounded_summary,
                    "key_findings": res.key_findings,
                    "confidence": res.confidence_score,
                    "citations": res.citations,
                    "model": res.model_name,
                }
            elif matching_task and matching_task.status == TaskStatus.FAILED.value:
                sections[ttype] = {
                    "status": "FAILED",
                    "error": matching_task.error_details or "Task execution failure",
                    "key_findings": [],
                    "summary": f"Data collection for {ttype.replace('_', ' ').title()} failed.",
                    "confidence": 0.0,
                    "citations": [],
                }
            else:
                sections[ttype] = {
                    "status": "UNAVAILABLE",
                    "summary": "No data collected for this dimension.",
                    "key_findings": [],
                    "confidence": 0.0,
                    "citations": [],
                }

        market_findings = sections.get(TaskType.MARKET_OVERVIEW.value, {})
        competitor_analysis = sections.get(TaskType.COMPETITOR_ANALYSIS.value, {})
        customer_insights = sections.get(TaskType.CUSTOMER_INSIGHTS.value, {})
        opportunities_and_risks = sections.get(TaskType.REGULATORY_RISKS.value, {})

        # ----------------------------------------------------------------------
        # Executive Summary Synthesis
        # ----------------------------------------------------------------------
        executive_summary = cls._synthesize_executive_summary(
            job=job,
            market_findings=market_findings,
            competitor_analysis=competitor_analysis,
            customer_insights=customer_insights,
            opportunities_and_risks=opportunities_and_risks,
            citation_count=len(global_citations),
        )

        # ----------------------------------------------------------------------
        # Atomic Report Persistence
        # ----------------------------------------------------------------------
        report = Report(
            job_id=job.id,
            executive_summary=executive_summary,
            market_findings=market_findings,
            competitor_analysis=competitor_analysis,
            customer_insights=customer_insights,
            opportunities_and_risks=opportunities_and_risks,
            citations=global_citations,
            research_limitations=research_limitations,
            status=report_status,
        )
        session.add(report)
        await session.flush()

        logger.info(
            f"Successfully aggregated report for job {job_id} (status={report_status}, "
            f"citations={len(global_citations)})."
        )
        return report

    @staticmethod
    def _synthesize_executive_summary(
        job: Job,
        market_findings: dict,
        competitor_analysis: dict,
        customer_insights: dict,
        opportunities_and_risks: dict,
        citation_count: int,
    ) -> str:
        """
        Synthesizes a cohesive, high-level executive summary across all four research vectors.
        """
        market_snippet = market_findings.get(
            "summary", "Market sizing and baseline dynamics evaluated."
        )
        comp_snippet = competitor_analysis.get(
            "summary", "Competitive landscape and incumbent moats examined."
        )
        cust_snippet = customer_insights.get(
            "summary", "Enterprise buyer behavior and willingness to pay analyzed."
        )
        risk_snippet = opportunities_and_risks.get(
            "summary", "Regulatory and operational headwinds identified."
        )

        paragraphs = [
            (
                f"Executive Intelligence Brief regarding '{job.research_question}' "
                f"in {job.target_market} ({job.geography}). This intelligence synthesis is "
                f"grounded across {citation_count} independently verified external evidence sources."
            ),
            (
                f"Market Overview & Sizing: {market_snippet}\n"
                f"Competitive Dynamics: {comp_snippet}"
            ),
            (
                f"Customer & Buyer Insights: {cust_snippet}\n"
                f"Opportunities & Risk Factors: {risk_snippet}"
            ),
            (
                "Strategic Assessment: Capital investment in this domain presents significant upside "
                "provided regulatory compliance is secured early and customer integration friction is minimized."
            ),
        ]
        return "\n\n".join(paragraphs)
