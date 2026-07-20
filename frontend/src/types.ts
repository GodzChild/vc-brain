// TS mirrors of backend/models/schemas.py.
// NOTE: kept snake_case end-to-end (matching the API wire format) for this
// iteration instead of the camelCase convention — skips a mapping layer.

export type ScoreDimension = 'lead' | 'pitch' | 'sell' | 'scale' | 'grit'
export type Confidence = 'high' | 'medium' | 'low' | 'verify_offline'
export type EntityType = 'startup' | 'hackathon_project' | 'research' | 'indie_project' | 'other'
export type VCMetricKind = 'scalability' | 'market_gap' | 'innovation'

export interface Evidence {
  claim: string
  source_url: string | null
  source_name: string | null
  inferred: boolean
}

export interface TeamMember {
  name: string
  role: string
  links: Record<string, string>
  evidence: Evidence | null
  thesis_relevance: string
}

export interface VCMetric {
  metric: VCMetricKind
  score: number
  confidence: Confidence
  rationale: string
  evidence: Evidence[]
}

export interface MarketStat {
  label: string
  value: string
  evidence: Evidence | null
}

export interface DimensionScore {
  dimension: ScoreDimension
  score: number
  confidence: Confidence
  evidence: Evidence[]
}

export interface Scorecard {
  overall: number
  confidence: Confidence
  dimensions: DimensionScore[]
  verify_offline_note: string | null
}

export interface Location {
  city: string
  country: string
  lat: number
  lng: number
}

export interface Signal {
  kind: string
  text: string
  date: string | null
  evidence: Evidence
}

export type BeatKind = 'hook' | 'background' | 'scorecard' | 'signals' | 'fit' | 'contact'

export interface StoryBeat {
  beat: BeatKind
  title: string
  body: string
  facts: Evidence[]
}

export interface Founder {
  id: string
  name: string
  headline: string
  project: string
  project_description: string
  domains: string[]
  stage: string
  location: Location
  avatar_seed: string
  images: string[]
  entity_type: EntityType
  team: TeamMember[]
  vc_metrics: VCMetric[]
  market_stats: MarketStat[]
  scorecard: Scorecard
  signals: Signal[]
  story_beats: StoryBeat[]
  links: Record<string, string>
  discovered_via: string[]
  first_seen: string | null
  entity_resolution_confidence: number
}

export interface VCProfile {
  id: string
  firm: string
  thesis: string
  focus_domains: string[]
  focus_geos: string[]
  preferred_stages: string[]
  check_size: string
}

export interface FitResult {
  founder_id: string
  fit_score: number
  rationale: string
  inferred: boolean
}

export interface ParsedQuery {
  domains: string[]
  signals: string[]
  geo: string | null
  time_window: string | null
  stage: string | null
  free_text: string
}

export interface Candidate {
  founder: Founder
  relevance: number
  fit: FitResult | null
  matched_terms: string[]
  graph_context: string[]
}

export interface QueryResponse {
  parsed: ParsedQuery
  candidates: Candidate[]
  took_ms: number
  mode: string
}

export interface GraphNode {
  id: string
  label: string
  kind: string
  score: number | null
  founder_id: string | null
}

export interface GraphEdge {
  source: string
  target: string
  rel: string
  confidence: number
}

export interface BrainGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GlobePin {
  founder_id: string
  name: string
  project: string
  lat: number
  lng: number
  rank: number
  score: number
  confidence: Confidence
  country: string
  image_url: string | null
}

// --- Concept map (Brain view keyword constellation) -----------------------
// Purely presentational search-refinement data; lives on the frontend since
// node positions are a view concern.
export interface ConceptNode {
  id: string
  label: string
  x: number // normalized 0..1 across the viewport width
  y: number // normalized 0..1 across the viewport height
  kind: 'primary' | 'related'
  /** primary nodes that the demo query lights up */
  matched: boolean
}

export interface ConceptEdge {
  source: string
  target: string
}

export interface ConceptMap {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
}

export interface StoryResponse {
  founder: Founder
  fit: FitResult
  profile: VCProfile
}
