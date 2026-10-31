"""
Purge rows that earlier versions of Stratify AI fabricated.

Older builds stored invented data next to real data: mock-provider evidence, hard-coded news
fallbacks, a hard-coded SEC/arXiv catalogue, scripted debate personas and "simulated" alerts.
This script removes exactly those rows. Rows with real provenance are never touched.

Usage (dry run is the default and changes nothing):
    python -m scripts.purge_fabricated_data            # report what would be deleted
    python -m scripts.purge_fabricated_data --apply    # delete it

Reports and task results built from mock evidence are deleted as well, because their content
came from invented sources. The affected job IDs are printed so those jobs can be re-run.
"""

import argparse
import asyncio

from sqlalchemy import text

from backend.app.db.session import AsyncSessionLocal

# Each rule: (label, SELECT count SQL, DELETE SQL). Markers come from the removed code paths.
FALLBACK_NEWS = (
    "canonical_url ~ '^https?://(economictimes\\.indiatimes\\.com/industry/[^/]+-funding-record"
    "|livemint\\.com/market/[^/]+-regulatory-directive"
    "|business-standard\\.com/companies/[^/]+-national-partnership"
    "|financialexpress\\.com/market/[^/]+-tier2-expansion)/?$'"
)
OLD_PERSONAS = (
    "agent_name LIKE 'Marcus Vance%' OR agent_name LIKE 'Dr. Evelyn Reed%' "
    "OR agent_name LIKE 'Hon. Elena Rostova%' OR agent_name LIKE 'Arbiter Core v2.0%'"
)
OLD_ARXIV_IDS = ("2405.11244", "2407.18921", "2409.04102")  # hard-coded catalogue entries seen in v0

RULES: list[tuple[str, str, str]] = [
    (
        "evidence rows from the mock search provider",
        "SELECT count(*) FROM evidence WHERE provider_name = 'mock' OR source_url LIKE '%.internal/%'",
        "DELETE FROM evidence WHERE provider_name = 'mock' OR source_url LIKE '%.internal/%'",
    ),
    (
        "task results whose tasks only have mock evidence",
        "SELECT count(*) FROM task_results WHERE task_id IN (SELECT DISTINCT task_id FROM evidence "
        "WHERE provider_name = 'mock' OR source_url LIKE '%.internal/%')",
        "DELETE FROM task_results WHERE task_id IN (SELECT DISTINCT task_id FROM evidence "
        "WHERE provider_name = 'mock' OR source_url LIKE '%.internal/%')",
    ),
    (
        "hard-coded fallback news signals",
        f"SELECT count(*) FROM market_signals WHERE {FALLBACK_NEWS}",
        f"DELETE FROM market_signals WHERE {FALLBACK_NEWS}",
    ),
    (
        "hard-coded SEC placeholder filings",
        "SELECT count(*) FROM fused_evidence WHERE source_type = 'SEC_EDGAR' AND "
        "(source_url LIKE 'https://www.sec.gov/edgar/browse/?CIK=%' "
        "OR source_url = 'https://www.sec.gov/edgar/searchedgar/companysearch')",
        "DELETE FROM fused_evidence WHERE source_type = 'SEC_EDGAR' AND "
        "(source_url LIKE 'https://www.sec.gov/edgar/browse/?CIK=%' "
        "OR source_url = 'https://www.sec.gov/edgar/searchedgar/companysearch')",
    ),
    (
        "hard-coded arXiv catalogue entries",
        "SELECT count(*) FROM fused_evidence WHERE source_type = 'ARXIV_PREPRINT' AND "
        "metadata_json->>'arxiv_id' = ANY(:ids)",
        "DELETE FROM fused_evidence WHERE source_type = 'ARXIV_PREPRINT' AND "
        "metadata_json->>'arxiv_id' = ANY(:ids)",
    ),
    (
        "debates written by the scripted personas",
        f"SELECT count(DISTINCT debate_id) FROM debate_messages WHERE {OLD_PERSONAS}",
        f"DELETE FROM debates WHERE id IN (SELECT debate_id FROM debate_messages WHERE {OLD_PERSONAS})",
    ),
    (
        "simulated alerts (not produced by any stored signal)",
        "SELECT count(*) FROM alerts WHERE signal_id IS NULL",
        "DELETE FROM alerts WHERE signal_id IS NULL",
    ),
]

REPORTS_SQL = (
    "SELECT DISTINCT job_id FROM evidence WHERE provider_name = 'mock' OR source_url LIKE '%.internal/%'"
)


async def main(apply: bool) -> None:
    params = {"ids": list(OLD_ARXIV_IDS)}
    async with AsyncSessionLocal() as session:
        affected_jobs = [str(r[0]) for r in (await session.execute(text(REPORTS_SQL))).all()]

        print(("APPLYING" if apply else "DRY RUN (no changes)") + " - fabricated-data purge\n")
        for label, count_sql, delete_sql in RULES:
            n = (await session.execute(text(count_sql), params if ":ids" in count_sql else {})).scalar_one()
            print(f"  {n:>6}  {label}")
            if apply and n:
                await session.execute(text(delete_sql), params if ":ids" in delete_sql else {})

        if affected_jobs:
            n_reports = (
                await session.execute(
                    text("SELECT count(*) FROM reports WHERE job_id = ANY(CAST(:jobs AS uuid[]))"),
                    {"jobs": affected_jobs},
                )
            ).scalar_one()
            print(f"  {n_reports:>6}  reports built from mock evidence")
            if apply and n_reports:
                await session.execute(
                    text("DELETE FROM reports WHERE job_id = ANY(CAST(:jobs AS uuid[]))"),
                    {"jobs": affected_jobs},
                )
            print("\nJobs whose results came from mock evidence (re-run them to get real data):")
            for job_id in affected_jobs:
                print(f"  {job_id}")

        if apply:
            await session.commit()
            print("\nDone.")
        else:
            await session.rollback()
            print("\nNothing was changed. Re-run with --apply to delete these rows.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="actually delete (default is a dry run)")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
