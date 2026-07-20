"""Thin async wrapper around the Tavily search API.

Used to discover founder signals (hackathon wins, launches, GitHub repos,
press) for a natural-language scouting query. Live mode only — callers
must check config.get_settings().live_enabled first.
"""
from __future__ import annotations

import asyncio

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


async def primary_source_search(project: str) -> dict:
    """Two searches anchored on the project's OWN primary sources — its
    official website and its GitHub org — merged into one result set. Used to
    verify who is actually affiliated with a project, rather than trusting
    whoever a broad discovery search happened to name."""
    website_data, github_data = await asyncio.gather(
        search(f"{project} official website team founders", max_results=8),
        search(f"{project} github organization", max_results=8),
    )

    seen_urls: set[str] = set()
    merged_results: list[dict] = []
    for data in (website_data, github_data):
        for r in data.get("results", []):
            url = r.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                merged_results.append(r)

    seen_images: set[str] = set()
    merged_images: list = []
    for data in (website_data, github_data):
        for img in data.get("images", []):
            img_url = img.get("url") if isinstance(img, dict) else img
            if img_url and img_url not in seen_images:
                seen_images.add(img_url)
                merged_images.append(img)

    return {"results": merged_results, "images": merged_images}
