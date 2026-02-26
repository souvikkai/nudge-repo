from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SummaryResult:
    text: str
    provider: str
    model: str
    latency_ms: int


def generate_summary(text: str, model_key: str, prompt_version: str) -> SummaryResult:
    """
    Placeholder LLM integration.

    Contract for now:
      generate_summary(text, model_key, prompt_version) -> {text, provider, model, latency_ms}

    This implementation is intentionally deterministic and non-networked (no dependencies).
    Replace with real provider integration later.
    """
    t0 = time.perf_counter()

    # Keep output format stable and <= 120 words.
    # NOTE: This is a placeholder; it does not attempt factual distillation beyond acknowledging input.
    out = (
        "Thesis: The provided text is available, but this placeholder does not perform true distillation.\n"
        "Key points:\n"
        "- A summary was requested for the item’s canonical text.\n"
        "- This implementation is a stub and should be replaced with a real LLM call.\n"
        "Why it matters: It enables end-to-end plumbing (API + persistence) before model integration."
    )

    latency_ms = int((time.perf_counter() - t0) * 1000)

    # Use transparent placeholders for benchmarking metadata until real providers are wired.
    provider = "placeholder"
    model = f"{model_key}:{prompt_version}"

    return SummaryResult(text=out, provider=provider, model=model, latency_ms=latency_ms)
