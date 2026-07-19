"""Persisted store for live-ingested founders.

Chroma only holds vectors, so the actual Founder/FitResult objects live
here, keyed by founder_id, and are written back to disk on every ingest so
the brain survives a restart — mirrors DemoStore's derived-views pattern,
but mutable and write-through instead of loaded once at startup.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from backend.models.schemas import Founder, FitResult, GlobePin

LIVE_DIR = Path(__file__).resolve().parent.parent / "data" / "live"
FOUNDERS_PATH = LIVE_DIR / "founders.json"


class LiveStore:
    def __init__(self) -> None:
        self.founders: dict[str, Founder] = {}
        self.fits: dict[str, FitResult] = {}
        # The founders belonging to the most recent search. The store as a
        # whole accumulates every founder ever found (that is the cache), but
        # the UI must only ever show the *current* search's results — so the
        # globe/leaderboard are built from this ordered subset, not the whole
        # store. In-memory only: a fresh search always replaces it.
        self.current_result_ids: list[str] = []
        self._load()

    def set_current_result(self, founder_ids: list[str]) -> None:
        self.current_result_ids = founder_ids

    def _load(self) -> None:
        if not FOUNDERS_PATH.exists():
            return
        raw = json.loads(FOUNDERS_PATH.read_text(encoding="utf-8"))
        for entry in raw:
            founder = Founder.model_validate(entry["founder"])
            fit = FitResult.model_validate(entry["fit"])
            self.founders[founder.id] = founder
            self.fits[founder.id] = fit

    def _persist(self) -> None:
        LIVE_DIR.mkdir(parents=True, exist_ok=True)
        payload = [
            {"founder": self.founders[fid].model_dump(mode="json"), "fit": self.fits[fid].model_dump(mode="json")}
            for fid in self.founders
        ]
        FOUNDERS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def upsert(self, founder: Founder, fit: FitResult) -> None:
        self.founders[founder.id] = founder
        self.fits[founder.id] = fit
        self._persist()

    def get_founder(self, founder_id: str) -> Founder | None:
        return self.founders.get(founder_id)

    def get_fit(self, founder_id: str) -> FitResult | None:
        return self.fits.get(founder_id)

    def count(self) -> int:
        return len(self.founders)

    def build_current_globe_pins(self) -> list[GlobePin]:
        """Pins for the current search only, ranked by fit score."""
        founders = [self.founders[fid] for fid in self.current_result_ids if fid in self.founders]
        ranked = sorted(founders, key=lambda f: self.fits[f.id].fit_score, reverse=True)
        return [
            GlobePin(
                founder_id=f.id,
                name=f.name,
                project=f.project,
                lat=f.location.lat,
                lng=f.location.lng,
                rank=i + 1,
                score=self.fits[f.id].fit_score,
                confidence=f.scorecard.confidence,
                country=f.location.country,
                image_url=f.images[0] if f.images else None,
            )
            for i, f in enumerate(ranked)
        ]

    def has_current_result(self) -> bool:
        return any(fid in self.founders for fid in self.current_result_ids)


@lru_cache
def get_live_store() -> LiveStore:
    return LiveStore()
