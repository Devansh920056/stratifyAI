"""
Job Service managing transactional persistence of research jobs and task decomposition.
"""

import uuid

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.enums import JobStatus, OutboxStatus
from backend.app.models.job import Job
from backend.app.models.outbox import OutboxEvent
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.schemas.job import JobCreateRequest
from backend.app.services.decomposition import decompose_job_into_tasks


class JobService:
    @staticmethod
    async def create_job(db: AsyncSession, request: JobCreateRequest) -> Job:
        """
        Creates a new Job, decomposes it into orthogonal tasks, and records
        corresponding Outbox events in a single atomic database transaction.
        """
        job_id = uuid.uuid4()

        job = Job(
            id=job_id,
            research_question=request.research_question,
            target_market=request.target_market,
            geography=request.geography,
            time_range=request.time_range,
            focus_areas=request.focus_areas,
            status=JobStatus.PENDING.value,
        )
        db.add(job)

        # Decompose the inquiry into orthogonal tasks
        task_specs = decompose_job_into_tasks(job_id=job_id, request=request)

        for spec in task_specs:
            task = Task(
                id=spec["id"],
                job=job,
                job_id=job_id,
                task_type=spec["task_type"],
                search_queries=spec["search_queries"],
                status=spec["status"],
                attempt_count=spec["attempt_count"],
                max_attempts=spec["max_attempts"],
                version=spec["version"],
            )
            db.add(task)

            # Transactional Outbox pattern: write event in the same ACID transaction
            outbox_event = OutboxEvent(
                aggregate_type="TASK",
                aggregate_id=task.id,
                event_type="TASK_CREATED",
                payload={
                    "task_id": str(task.id),
                    "job_id": str(job_id),
                    "task_type": task.task_type,
                    "search_queries": task.search_queries,
                    "version": task.version,
                },
                status=OutboxStatus.PENDING.value,
            )
            db.add(outbox_event)

        # Flush to persist entities
        await db.flush()
        return job

    @staticmethod
    async def get_job(db: AsyncSession, job_id: uuid.UUID) -> Job | None:
        """Fetch a Job by UUID with related tasks, results, and report eagerly loaded."""
        stmt = (
            select(Job)
            .options(
                selectinload(Job.tasks).selectinload(Task.result),
                selectinload(Job.report),
            )
            .where(Job.id == job_id)
        )
        return await db.scalar(stmt)

    @staticmethod
    async def list_jobs(
        db: AsyncSession, limit: int = 50, offset: int = 0
    ) -> list[Job]:
        """Fetch recent jobs ordered by creation date descending with tasks eagerly loaded."""
        stmt = (
            select(Job)
            .options(
                selectinload(Job.tasks).selectinload(Task.result),
                selectinload(Job.report),
            )
            .order_by(desc(Job.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await db.scalars(stmt)
        return list(result.all())

    @staticmethod
    async def get_job_tasks(db: AsyncSession, job_id: uuid.UUID) -> list[Task]:
        """Fetch all child tasks for a given Job with results eagerly loaded."""
        stmt = (
            select(Task)
            .options(selectinload(Task.result))
            .where(Task.job_id == job_id)
            .order_by(Task.created_at)
        )
        result = await db.scalars(stmt)
        return list(result.all())

    @staticmethod
    async def get_job_report(db: AsyncSession, job_id: uuid.UUID) -> Report | None:
        """Fetch the generated report for a given Job if completed."""
        stmt = select(Report).where(Report.job_id == job_id)
        return await db.scalar(stmt)
