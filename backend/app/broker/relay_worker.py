"""
Standalone Outbox Relay Worker Process.
Continuously polls PostgreSQL for PENDING outbox events and publishes them to RabbitMQ.
Can be run as an independent background daemon:
  python -m backend.app.broker.relay_worker
"""

import asyncio
import logging
import signal

from backend.app.core.config import get_settings
from backend.app.services.outbox_relay import OutboxRelayService

settings = get_settings()

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("stratify.relay_worker")


async def main():
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: stop_event.set())

    logger.info("Initializing Outbox Relay Worker...")
    try:
        await OutboxRelayService.run_relay_loop(stop_event=stop_event)
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("Outbox Relay Worker shutdown cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
