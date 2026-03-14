from __future__ import annotations
import time
import urllib.request
import json
from typing import Any, Dict
from app.settings import settings

DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"

SUMMARIZATION_PROMPT = """You are a neutral summarization assistant for a thinking companion app.
Your task: Summarize the following article in under 120 words.
Rules:
- Write in third-person, neutral tone. No hype, no opinion.
- Restate what the author argues. Do not add interpretation.
- Do not invent facts or context not present in the text.
- Output plain text only. No bullet points, no headers.
- Hard limit: 120 words maximum.
Article:
{text}
Summary:"""

def generate_summary(text: str, model_key: str, prompt_version: str) -> Dict[str, Any]:
    cfg = settings.get_model_config(model_key)
    api_key = cfg.get("api_key")
    model = cfg.get("model") or "deepseek-chat"
    provider = cfg.get("provider") or "deepseek"
    if not api_key or api_key == "placeholder":
        return {"text": "Summary unavailable: no API key configured.", "provider": "placeholder", "model": "placeholder", "latency_ms": 0}
    prompt = SUMMARIZATION_PROMPT.format(text=text[:16000])
    payload = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "max_tokens": 300}).encode("utf-8")
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(
            DEEPSEEK_BASE_URL,
            data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        latency_ms = int((time.monotonic() - t0) * 1000)
        summary_text = body["choices"][0]["message"]["content"].strip()
        words = summary_text.split()
        if len(words) > 120:
            summary_text = " ".join(words[:120])
        return {"text": summary_text, "provider": provider, "model": model, "latency_ms": latency_ms}
    except Exception as e:
        raise RuntimeError(f"DeepSeek summary generation failed: {e}") from e