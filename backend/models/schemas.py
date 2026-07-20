"""Pydantic schemas shared across the API surface.

Concept names mirror the frontend TypeScript types in frontend/src/types.ts —
snake_case here, camelCase there, identical concept names.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ScoreDimension = Literal["lead", "pitch", "sell", "scale", "grit"]
Confidence = Literal["high", "medium", "low", "verify_offline"]
EntityType = Literal["startup", "hackathon_project", "research", "indie_project", "other"]
VCMetricKind = Literal["scalability", "market_gap", "innovation"]


class Evidence(BaseModel):
    """A single sourced fact. Unsourced facts must be labeled inferred."""

    claim: str
    source_url: str | None = None
    source_name: str | None = None
    inferred: bool = False


class TeamMember(BaseModel):
    """A person on the team — CEO, co-founder, hackathon teammate, or
    research collaborator — with whatever real contact surface was found."""

    name: str
    role: str = ""  # e.g. "CEO", "co-founder", "ML lead", "PhD advisor"
    links: dict[str, str] = {}  # linkedin / github / twitter / email / ...
    evidence: Evidence | None = None
    # One sentence, grounded in search results, on how this person's specific
    # background connects to the loaded VC thesis. "" when nothing supports it.
    thesis_relevance: str = ""


class VCMetric(BaseModel):
    """Investor-lens assessment on one axis, scored with evidence."""

    metric: VCMetricKind
    score: float = Field(ge=0, le=10)
    confidence: Confidence
    rationale: str
    evidence: list[Evidence] = []


class MarketStat(BaseModel):
    """A concrete, chartable number: funding, users, growth, team size,
    market size. Value stays a string to preserve units ("$2.3M", "300 users")."""

    label: str
    value: str
    evidence: Evidence | None = None


class DimensionScore(BaseModel):
    dimension: ScoreDimension
    score: float = Field(ge=0, le=10)
    confidence: Confidence
    evidence: list[Evidence] = []


class Scorecard(BaseModel):
    overall: float = Field(ge=0, le=10)
    confidence: Confidence
    dimensions: list[DimensionScore]
    verify_offline_note: str | None = None


class Location(BaseModel):
    city: str
    country: str
    lat: float
    lng: float


class Signal(BaseModel):
    kind: str  # e.g. "hackathon_win", "launch", "traction", "velocity"
    text: str
    date: str | None = None
    evidence: Evidence


class StoryBeat(BaseModel):
    beat: Literal["hook", "background", "scorecard", "signals", "fit", "contact"]
    title: str
    body: str
    facts: list[Evidence] = []


class Founder(BaseModel):
    id: str
    name: str
    headline: str
    project: str
    project_description: str
    domains: list[str]
    stage: str  # "idea" | "prototype" | "launched" | "revenue"
    location: Location
    avatar_seed: str = ""
    images: list[str] = []  # real photo/screenshot URLs, sourced from search — never invented
    entity_type: EntityType = "startup"
    team: list[TeamMember] = []
    vc_metrics: list[VCMetric] = []
    market_stats: list[MarketStat] = []
    scorecard: Scorecard
    signals: list[Signal] = []
    story_beats: list[StoryBeat] = []
    links: dict[str, str] = {}
    discovered_via: list[str] = []  # sources: github, hn, devpost, ...
    first_seen: str | None = None
    entity_resolution_confidence: float = 1.0  # <1.0 => "possibly same person"


class VCProfile(BaseModel):
    id: str = "default"
    firm: str = ""
    thesis: str = ""
    focus_domains: list[str] = []
    focus_geos: list[str] = []
    preferred_stages: list[str] = []
    check_size: str = ""


class FitResult(BaseModel):
    founder_id: str
    fit_score: float = Field(ge=0, le=100)
    rationale: str
    inferred: bool = True  # heuristic/LLM opinion, not a sourced fact


class ParsedQuery(BaseModel):
    domains: list[str] = []
    signals: list[str] = []
    geo: str | None = None
    time_window: str | None = None
    stage: str | None = None
    free_text: str = ""


class QueryRequest(BaseModel):
    text: str
    profile_id: str = "default"
    limit: int = 3
    # Session-only: when set, replaces the demo-seeded profile.thesis for THIS
    # query only. Not persisted — a page refresh loses it. Everything else
    # about the VC profile (focus_domains/geos/preferred_stages) is unchanged.
    thesis_override: str | None = None


class Candidate(BaseModel):
    founder: Founder
    relevance: float
    fit: FitResult | None = None
    matched_terms: list[str] = []
    graph_context: list[str] = []  # human-readable edge summaries


class QueryResponse(BaseModel):
    parsed: ParsedQuery
    candidates: list[Candidate]
    took_ms: float
    mode: str  # "demo" | "live"


class GraphNode(BaseModel):
    id: str
    label: str
    kind: str  # founder | project | hackathon | tech | investor | geo
    score: float | None = None
    founder_id: str | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    rel: str  # BUILT | WON | USES | TEAMED_WITH | LOCATED_IN | BACKED_BY
    confidence: float = 1.0


class BrainGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class GlobePin(BaseModel):
    founder_id: str
    name: str
    project: str
    lat: float
    lng: float
    rank: int
    score: float
    confidence: Confidence
    country: str = ""  # matched against country-border GeoJSON on the globe
    image_url: str | None = None


class SkipSignal(BaseModel):
    founder_id: str
    beat: str
    profile_id: str = "default"


class CrawlerRunRequest(BaseModel):
    source: Literal["github", "hn", "devpost", "producthunt", "arxiv"]
    query: str = "ai"
    limit: int = 10
