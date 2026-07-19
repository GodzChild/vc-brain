"""Demo-mode data store.

Loads the pre-generated dataset from backend/data/*.json, validates every
record against the Pydantic schemas (fail-fast on typos), and precomputes
the derived views the API serves: ranked candidates, globe pins, and the
brain graph. Rankings and pins are always derived from founders + fits so
there is a single source of truth — nothing rank-related is hand-written
in more than one file.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from backend.models.schemas import (
    BrainGraph,
    Candidate,
    Founder,
    FitResult,
    GlobePin,
    ParsedQuery,
    VCProfile,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(name: str) -> dict | list:
    path = DATA_DIR / name
    with path.open(encoding="utf-8") as f:
        return json.load(f)


class DemoStore:
    """Validated demo dataset plus derived views, built once at startup."""

    def __init__(self) -> None:
        demo_query = _load_json("demo_query.json")
        self.query_text: str = demo_query["text"]
        self.parsed_query: ParsedQuery = ParsedQuery.model_validate(demo_query["parsed"])
        self.highlight_terms: list[str] = demo_query["highlight_terms"]
        self.help_text: str = demo_query["help_text"]
        matched_terms: dict[str, list[str]] = demo_query["matched_terms_by_founder"]

        founders = [Founder.model_validate(f) for f in _load_json("founders.json")]
        self.founders_by_id: dict[str, Founder] = {f.id: f for f in founders}

        self.profile: VCProfile = VCProfile.model_validate(_load_json("vc_profile.json"))

        fits = [FitResult.model_validate(f) for f in _load_json("fits.json")]
        self.fits_by_id: dict[str, FitResult] = {f.founder_id: f for f in fits}

        self.brain_graph: BrainGraph = BrainGraph.model_validate(_load_json("brain_graph.json"))

        self._check_consistency()

        graph_context = self._graph_context_by_founder()
        ranked = sorted(
            founders, key=lambda f: self.fits_by_id[f.id].fit_score, reverse=True
        )
        self.candidates: list[Candidate] = [
            Candidate(
                founder=f,
                relevance=round(self.fits_by_id[f.id].fit_score / 100, 3),
                fit=self.fits_by_id[f.id],
                matched_terms=matched_terms.get(f.id, []),
                graph_context=graph_context.get(f.id, []),
            )
            for f in ranked
        ]
        self.globe_pins: list[GlobePin] = [
            GlobePin(
                founder_id=f.id,
                name=f.name,
                project=f.project,
                lat=f.location.lat,
                lng=f.location.lng,
                rank=i + 1,
                score=self.fits_by_id[f.id].fit_score,
                confidence=f.scorecard.confidence,
                country=f.location.country,
                image_url=f.images[0] if f.images else None,
            )
            for i, f in enumerate(ranked)
        ]

    def _check_consistency(self) -> None:
        founder_ids = set(self.founders_by_id)
        fit_ids = set(self.fits_by_id)
        if founder_ids != fit_ids:
            raise ValueError(
                f"founders.json / fits.json mismatch: {founder_ids ^ fit_ids}"
            )
        node_ids = {n.id for n in self.brain_graph.nodes}
        for edge in self.brain_graph.edges:
            if edge.source not in node_ids or edge.target not in node_ids:
                raise ValueError(f"brain_graph edge references unknown node: {edge}")
        graph_founder_ids = {
            n.founder_id for n in self.brain_graph.nodes if n.founder_id
        }
        missing = founder_ids - graph_founder_ids
        if missing:
            raise ValueError(f"founders missing from brain_graph: {missing}")

    def _graph_context_by_founder(self) -> dict[str, list[str]]:
        """Human-readable edge summaries like 'WON → HackZurich Health 2026'."""
        labels = {n.id: n.label for n in self.brain_graph.nodes}
        founder_node = {
            n.founder_id: n.id for n in self.brain_graph.nodes if n.founder_id
        }
        node_to_founder = {v: k for k, v in founder_node.items()}
        context: dict[str, list[str]] = {}
        for edge in self.brain_graph.edges:
            for node_id, other_id in ((edge.source, edge.target), (edge.target, edge.source)):
                fid = node_to_founder.get(node_id)
                if fid and edge.rel != "BUILT":  # BUILT is implicit in the project name
                    context.setdefault(fid, []).append(
                        f"{edge.rel} → {labels[other_id]}"
                    )
        return context


@lru_cache
def get_store() -> DemoStore:
    return DemoStore()
