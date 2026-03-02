"""Gemini API wrapper for analytics (summaries, root cause explanations)."""
import asyncio
import logging
import warnings

from src import config

logger = logging.getLogger(__name__)

# Lazy init to avoid import-time failure when key is missing
_gen_model = None

# Model ID: gemini-1.5-flash is retired in 2025; use a current model. Override with GEMINI_MODEL env.
_DEFAULT_MODEL = "gemini-2.0-flash"


def _get_model():
    global _gen_model
    if _gen_model is not None:
        return _gen_model
    api_key = getattr(config, "GEMINI_API_KEY", "") or ""
    if not api_key:
        logger.warning("GEMINI_API_KEY not set; LLM calls will no-op or raise.")
        return None
    model_id = getattr(config, "GEMINI_MODEL", "") or _DEFAULT_MODEL
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=FutureWarning)  # google.generativeai deprecation
            import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gen_model = genai.GenerativeModel(model_id)
        return _gen_model
    except Exception as e:
        logger.warning("Gemini model init failed: %s", e)
        return None


def _generate_sync(prompt: str, temperature: float, max_tokens: int) -> str | None:
    model = _get_model()
    if model is None:
        return None
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        },
    )
    if response and response.text:
        return response.text.strip()
    return None


async def generate(prompt: str, temperature: float = 0.3, max_tokens: int = 1024) -> str | None:
    """
    Generate text with Gemini (runs sync SDK in thread pool). Returns None if key missing or request fails.
    """
    try:
        return await asyncio.to_thread(_generate_sync, prompt, temperature, max_tokens)
    except Exception as e:
        logger.exception("Gemini generate failed: %s", e)
        return None
