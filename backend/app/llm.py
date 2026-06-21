"""LLM factory using OpenRouter."""
from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"


def get_llm() -> ChatOpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Copy backend/.env.example to "
            "backend/.env and add your OpenRouter key."
        )
    return ChatOpenAI(
        model=os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL),
        api_key=api_key,
        base_url=OPENROUTER_BASE,
        temperature=0,
        default_headers={
            "HTTP-Referer": "https://workpodd.com",
            "X-Title": "Workpodd Refund Agent",
        },
    )
