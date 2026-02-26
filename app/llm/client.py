from __future__ import annotations

import time
from typing import Any, Dict

from app.settings import settings


def generate_summary(text: str, model_key: str, prompt_version: str) -> Dict[str, Any]:
    """
    Provider-agnostic summary generator (stub).

    Behavior:
    - Loads tier config via settings.get_model_config(model_key)
    - Measures deterministic latency using time.monotonic()
    - Returns a structured dict:
        { "text": str, "provider": str, "model": str, "latency_ms": int }

    NOTE: This does NOT call any external provider yet.
    """
    cfg = settings.get_model_config(model_key)

    t0 = time.monotonic()

    # Deterministic placeholder output that matches format requirements.
    # Keep under 120 words and avoid adding facts.
    out = (
        "Thesis: The text is summarized in a neutral, third-person format using a placeholder generator.\n"
        "Key points:\n"
        "- The summary is produced from the item’s canonical text after character-based truncation.\n"
        "- The system records model tier metadata for benchmarking without calling a real provider.\n"
        "Why it matters: This enables end-to-end API + persistence before choosing an LLM vendor."
    )

    latency_ms = int((time.monotonic() - t0) * 1000)

    return {
        "text": out,
        "provider": cfg.get("provider") or "placeholder",
        "model": cfg.get("model") or "placeholder",
        "latency_ms": latency_ms,
    }
