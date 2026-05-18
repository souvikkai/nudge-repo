from __future__ import annotations
import time
import urllib.request
import json
from typing import Any, Dict
from app.settings import settings
from app.llm.prompts import get_prompt

DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _call_deepseek(text: str, model: str, api_key: str, prompt_version: str) -> tuple[str, int]:
    prompt = get_prompt(prompt_version)
    user_message = prompt.user_prompt.format(text=text[:16000])
    payload = json.dumps({
        "model": model,
        "temperature": 0.2,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": prompt.system_prompt},
            {"role": "user", "content": user_message},
        ],
    }).encode("utf-8")

    t0 = time.monotonic()
    req = urllib.request.Request(
        DEEPSEEK_BASE_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    latency_ms = int((time.monotonic() - t0) * 1000)
    summary_text = body["choices"][0]["message"]["content"].strip()
    return summary_text, latency_ms


def _call_gemini(text: str, model: str, api_key: str, prompt_version: str) -> tuple[str, int]:
    prompt = get_prompt(prompt_version)
    user_message = prompt.system_prompt + "\n\n" + prompt.user_prompt.format(text=text[:16000])
    url = GEMINI_BASE_URL.format(model=model)

    payload = json.dumps({
        "contents": [{"parts": [{"text": user_message}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }).encode("utf-8")

    t0 = time.monotonic()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    latency_ms = int((time.monotonic() - t0) * 1000)
    # Gemini 2.5 may return multiple parts (thinking + response)
    # Take the last text part which is the actual response
    parts = body["candidates"][0]["content"]["parts"]
    text_parts = [p["text"] for p in parts if "text" in p]
    summary_text = text_parts[-1].strip() if text_parts else ""
    return summary_text, latency_ms


def generate_summary(text: str, model_key: str, prompt_version: str) -> Dict[str, Any]:
    cfg = settings.get_model_config(model_key)
    api_key = cfg.get("api_key")
    model = cfg.get("model") or "deepseek-chat"
    provider = (cfg.get("provider") or "deepseek").lower()

    if not api_key or api_key == "placeholder":
        return {
            "text": "Summary unavailable: no API key configured.",
            "provider": "placeholder",
            "model": "placeholder",
            "latency_ms": 0,
        }

    try:
        if provider == "gemini":
            summary_text, latency_ms = _call_gemini(text, model, api_key, prompt_version)
        else:
            summary_text, latency_ms = _call_deepseek(text, model, api_key, prompt_version)

        words = summary_text.split()
        if len(words) > 200:
            summary_text = " ".join(words[:200])

        return {
            "text": summary_text,
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
        }
    except Exception as e:
        raise RuntimeError(f"{provider} summary generation failed: {e}") from e
