"""
Initial adaptive inference routing for Nudge.

Maps incoming text and task type to a model tier (model_key) and a machine-readable
route_reason for observability. Rules are deterministic and may evolve as product
telemetry improves.
"""

from __future__ import annotations


def choose_model_key(
    text: str,
    task_type: str = "item_summary",
) -> tuple[str, str]:
    if task_type == "weekly_synthesis":
        return ("strong", "weekly_synthesis")
    if len(text) < 2000:
        return ("budget", "short_input")
    if len(text) < 8000:
        return ("mid", "medium_input")
    return ("strong", "long_input")
