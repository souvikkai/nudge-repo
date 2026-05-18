from __future__ import annotations

import argparse
import logging
import os

from app.worker.worker import run_forever, run_once


def _configure_logging() -> None:
    #Basic readable logs for MVP debugging.
    level_str = os.getenv("WORKER_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def main() -> None:
    _configure_logging()

    parser = argparse.ArgumentParser(description="Nudge MVP background worker")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one claim/process batch and exit (dev/tests).",
    )
    args = parser.parse_args()

    if args.once:
        run_once()
    else:
        run_forever()


if __name__ == "__main__":
    main()
