"""API surface for the demo prototype.

Every endpoint serves the pre-generated dataset via DemoStore. /query
simulates the production latency profile (parse → vector search → graph
expansion → rank) with a short sleep, then returns the scripted candidates
regardless of the submitted text — the frontend discloses this in the demo
help text.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.models.schemas import (
    BrainGraph,
    Founder,
    FitResult,
    GlobePin,
    QueryRequest,
    QueryResponse,
    VCProfile,
)
from backend.services import live_query, live_store
from backend.services.demo_store import get_store
from backend.utils.config import get_settings
from backend.utils.rate_limit import client_ip, get_limiter

logger = logging.getLogger("synapse.demo")

router = APIRouter(prefix="/api")


class DemoConfig(BaseModel):
    query_text: str
    highlight_terms: list[str]
    help_text: str
    mode: str = "demo"


class StoryResponse(BaseModel):
    founder: Founder
    fit: FitResult
    profile: VCProfile


class QuoteRequest(BaseModel):
    name: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    firm: str = ""
    message: str = ""


class QuoteResponse(BaseModel):
    ok: bool
    message: str


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "mode": "demo"}


@router.get("/demo/config", response_model=DemoConfig)
async def demo_config() -> DemoConfig:
    store = get_store()
    return DemoConfig(
        query_text=store.query_text,
        highlight_terms=store.highlight_terms,
        help_text=store.help_text,
    )


@router.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest, request: Request) -> QueryResponse:
    # Rate-limit the public, quota-spending endpoint before doing any work.
    await get_limiter().check(client_ip(request))
    started = time.perf_counter()

    if get_settings().live_enabled:
        try:
            result = await live_query.run(req.text, req.limit, req.thesis_override)
            result.took_ms = round((time.perf_counter() - started) * 1000, 1)
            return result
        except Exception:
            logger.exception("Live query pipeline failed — falling back to demo mode")

    store = get_store()
    # Simulated parse + vector search + graph expansion latency.
    await asyncio.sleep(random.uniform(0.6, 1.1))
    took_ms = (time.perf_counter() - started) * 1000
    return QueryResponse(
        parsed=store.parsed_query,
        candidates=store.candidates[: req.limit],
        took_ms=round(took_ms, 1),
        mode="demo",
    )


@router.get("/live/status")
async def live_status() -> dict:
    settings = get_settings()
    return {"enabled": settings.live_enabled, "founder_count": live_store.get_live_store().count()}


@router.get("/brain", response_model=BrainGraph)
async def brain() -> BrainGraph:
    return get_store().brain_graph


@router.get("/globe", response_model=list[GlobePin])
async def globe() -> list[GlobePin]:
    # Only the current search's founders — never the whole accumulated store.
    ls = live_store.get_live_store()
    if ls.has_current_result():
        return ls.build_current_globe_pins()
    return get_store().globe_pins


@router.get("/founder/{founder_id}", response_model=Founder)
async def founder(founder_id: str) -> Founder:
    live_founder = live_store.get_live_store().get_founder(founder_id)
    if live_founder:
        return live_founder
    store = get_store()
    if founder_id not in store.founders_by_id:
        raise HTTPException(status_code=404, detail="Unknown founder")
    return store.founders_by_id[founder_id]


@router.get("/story/{founder_id}", response_model=StoryResponse)
async def story(founder_id: str) -> StoryResponse:
    ls = live_store.get_live_store()
    live_founder = ls.get_founder(founder_id)
    if live_founder:
        return StoryResponse(founder=live_founder, fit=ls.get_fit(founder_id), profile=get_store().profile)
    store = get_store()
    if founder_id not in store.founders_by_id:
        raise HTTPException(status_code=404, detail="Unknown founder")
    return StoryResponse(
        founder=store.founders_by_id[founder_id],
        fit=store.fits_by_id[founder_id],
        profile=store.profile,
    )


@router.get("/profile", response_model=VCProfile)
async def profile() -> VCProfile:
    return get_store().profile


@router.post("/quote", response_model=QuoteResponse)
async def quote(req: QuoteRequest) -> QuoteResponse:
    # Placeholder lead capture: log it so the demo shows a real round-trip.
    logger.info(
        "QUOTE LEAD: name=%s email=%s firm=%s message=%s",
        req.name, req.email, req.firm, req.message,
    )
    return QuoteResponse(ok=True, message="Thanks — we'll be in touch within a day.")
