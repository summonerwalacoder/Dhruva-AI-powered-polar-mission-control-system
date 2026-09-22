"""Optional LLM backend for the AI assistant / emergency AI.

Uses the Gemini REST API when GEMINI_API_KEY is configured. When it is not,
the system transparently reports `provider: "rule-engine"` and falls back to
the deterministic retrieval + rule engine - so the app is always functional.
"""
import httpx

from ..config import settings


def llm_available():
    return bool(settings.gemini_api_key)


def provider_name():
    return "gemini" if llm_available() else "rule-engine"


async def complete(prompt: str, system: str = "", max_tokens: int = 900) -> str | None:
    if not llm_available():
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    body = {
        "system_instruction": {"parts": [{"text": system}]} if system else None,
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.3},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                url,
                params={"key": settings.gemini_api_key},
                json=body,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                return None
            parts = (candidates[0].get("content") or {}).get("parts") or []
            return "".join(p.get("text", "") for p in parts).strip() or None
    except Exception:
        return None