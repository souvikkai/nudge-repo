from __future__ import annotations
import time
import urllib.request
import json
from typing import Any, Dict
from app.settings import settings

DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"

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


def generate_summary(text: str, model_key: str, prompt_version: str) -> Dict[str, Any]:
    cfg = settings.get_model_config(model_key)
    api_key = cfg.get("api_key")
    model = cfg.get("model") or "deepseek-chat"
    provider = cfg.get("provider") or "deepseek"

    if not api_key or api_key == "placeholder":
        return {
            "text": "Summary unavailable: no API key configured.",
            "provider": "placeholder",
            "model": "placeholder",
            "latency_ms": 0,
        }

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
    try:
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
        raise RuntimeError(f"DeepSeek summary generation failed: {e}") from e