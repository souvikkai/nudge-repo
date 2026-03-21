from __future__ import annotations
import time
import urllib.request
import json
from typing import Any, Dict
from app.settings import settings

DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = """You are a disciplined summarization assistant inside Nudge, a thinking companion app.

Your job is to produce a faithful, minimal summary of an article or document.
The goal is cognitive distillation — clearly restating the author's core argument.

Tone and voice:
- Write in a neutral, calm, third-person narrator voice.
- Avoid hype, enthusiasm, or promotional language.

Content rules:
- Restate the central argument or thesis of the author.
- Focus on the main idea rather than listing every section.
- Use only information present in the provided text.

Prohibited behaviors:
- Do NOT invent information.
- Do NOT add interpretation or commentary.
- Do NOT give advice or evaluate the article.
- Do NOT introduce external context.

Output format:
- First: one coherent paragraph of 60-80 words restating the author's thesis.
- Then: exactly 3 key points as short plain-text lines, each starting with a dash.
- No bullet symbols, no markdown, no headers, no labels.
- Do not write "Summary:" or "Key points:" or any prefix.
- Total output must be 200 words or fewer.

Example format:
The article argues that [thesis]. The author contends that [point]. By [approach], the piece suggests [conclusion].

- [key point one]
- [key point two]
- [key point three]

If information is not clearly present in the provided text, do not infer or invent it."""

USER_PROMPT = """Summarize the following article.

Requirements:
- Maximum 200 words total
- One paragraph restating the author's thesis (60-80 words)
- Exactly 3 key points as plain-text lines starting with a dash
- Neutral third-person tone
- No labels, no markdown, no prefixes

Article text:
{text}"""


def _call_deepseek(text: str, model: str, api_key: str) -> tuple[str, int]:
    user_message = USER_PROMPT.format(text=text[:16000])
    payload = json.dumps({
        "model": model,
        "temperature": 0.2,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
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


def _call_gemini(text: str, model: str, api_key: str) -> tuple[str, int]:
    user_message = f"{SYSTEM_PROMPT}\n\n{USER_PROMPT.format(text=text[:16000])}"
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
            summary_text, latency_ms = _call_gemini(text, model, api_key)
        else:
            summary_text, latency_ms = _call_deepseek(text, model, api_key)

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