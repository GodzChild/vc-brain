"""Thin async wrapper around the Tavily search API.

Used to discover founder signals (hackathon wins, launches, GitHub repos,
press) for a natural-language scouting query. Live mode only — callers
must check config.get_settings().live_enabled first.
"""
from __future__ import annotations

import httpx

from backend.utils.config import get_settings

TAVILY_URL = "https://api.tavily.com/search"


async def search(query: str, max_results: int = 8) -> dict:
    """Runs a Tavily search and returns the raw response (results + images)."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TAVILY_URL,
            json={
                "api_key": settings.tavily_api_key,
                "query": query,
                "search_depth": "advanced",
                "max_results": max_results,
                "include_images": True,
                "include_answer": False,
            },
        )
        resp.raise_for_status()
        return resp.json()
