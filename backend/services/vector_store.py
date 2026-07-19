"""Local persisted vector store (Chroma) for live-mode founder embeddings.

Embeddings and extraction/scoring happen elsewhere (openai_client); this
module only stores and searches vectors — the founder documents themselves
live in live_store, since Chroma metadata can't hold nested JSON.
"""
from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

import chromadb

CHROMA_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma"
FOUNDERS_COLLECTION = "founders"
QUERIES_COLLECTION = "queries"


@lru_cache
def _client() -> chromadb.ClientAPI:
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_DIR))


@lru_cache
def _founders_collection():
    return _client().get_or_create_collection(FOUNDERS_COLLECTION, metadata={"hnsw:space": "cosine"})


@lru_cache
def _queries_collection():
    return _client().get_or_create_collection(QUERIES_COLLECTION, metadata={"hnsw:space": "cosine"})


def upsert(founder_id: str, embedding: list[float], document: str) -> None:
    _founders_collection().upsert(ids=[founder_id], embeddings=[embedding], documents=[document])


def query(embedding: list[float], k: int = 3) -> list[tuple[str, float]]:
    """Returns [(founder_id, similarity)] best-first. Similarity is
    1 - cosine_distance, so higher is better, roughly in 0..1."""
    coll = _founders_collection()
    n = coll.count()
    if n == 0:
        return []
    res = coll.query(query_embeddings=[embedding], n_results=min(k, n))
    ids = res["ids"][0]
    distances = res["distances"][0]
    return list(zip(ids, (1 - d for d in distances)))


def count() -> int:
    return _founders_collection().count()


def cache_query(query_text: str, embedding: list[float], founder_ids: list[str]) -> None:
    """Remembers which founders a query resolved to, keyed by a hash of the
    query text — so a repeat (or near-duplicate) query can skip straight to
    those founders instead of re-running Tavily + extraction."""
    qid = hashlib.sha1(query_text.strip().lower().encode("utf-8")).hexdigest()
    _queries_collection().upsert(
        ids=[qid],
        embeddings=[embedding],
        documents=[query_text],
        metadatas=[{"founder_ids": ",".join(founder_ids)}],
    )


def lookup_similar_query(embedding: list[float], threshold: float) -> list[str] | None:
    """Query-to-query comparison (not query-to-founder-profile, which is an
    asymmetric comparison that never scores as similar as expected — even a
    verbatim repeat query). Returns the cached founder_ids, or None on a
    cache miss."""
    coll = _queries_collection()
    if coll.count() == 0:
        return None
    res = coll.query(query_embeddings=[embedding], n_results=1)
    if not res["ids"][0]:
        return None
    similarity = 1 - res["distances"][0][0]
    if similarity < threshold:
        return None
    founder_ids = res["metadatas"][0][0].get("founder_ids", "")
    return [fid for fid in founder_ids.split(",") if fid]
