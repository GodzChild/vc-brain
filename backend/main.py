"""Synapse API entrypoint (demo mode).

Run from the repo root:
    uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.demo import router as demo_router
from backend.services.demo_store import get_store
from backend.utils.config import get_settings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast: validates every data file against the schemas at boot,
    # so a dataset typo breaks startup instead of the live demo.
    store = get_store()
    logging.getLogger("synapse").info(
        "Demo dataset loaded: %d founders, %d graph nodes",
        len(store.founders_by_id),
        len(store.brain_graph.nodes),
    )
    yield


app = FastAPI(title="Synapse API", version="0.1.0-demo", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(demo_router)
