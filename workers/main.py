"""
Worker Process CLI Entrypoint.
Can be launched independently of the FastAPI coordinator:
  python -m workers.main --worker-id worker-alpha --concurrency 1
"""

import argparse
import asyncio
import logging
import signal

from backend.app.core.config import get_settings
from workers.consumer import WorkerConsumer

settings = get_settings()

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("stratify.workers.main")


async def main():
    parser = argparse.ArgumentParser(
        description="Stratify AI Independent Worker Process"
    )
    parser.add_argument(
        "--worker-id",
        type=str,
        default="worker-1",
        help="Unique identifier for this worker instance (e.g. worker-1, worker-2)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=settings.WORKER_CONCURRENCY,
        help="QoS prefetch count (number of unacknowledged messages processed concurrently)",
    )
    args = parser.parse_args()

    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda s=sig: _handle_signal(s, stop_event))

    consumer = WorkerConsumer(worker_id=args.worker_id, prefetch_count=args.concurrency)

    logger.info(
        f"Starting Stratify AI Worker [{args.worker_id}] (concurrency={args.concurrency})..."
    )
    try:
        await consumer.start(stop_event=stop_event)
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()


def _handle_signal(sig, stop_event: asyncio.Event):
    logger.info(
        f"Received shutdown signal {sig.name}. Triggering graceful worker drain..."
    )
    stop_event.set()


if __name__ == "__main__":
    asyncio.run(main())
