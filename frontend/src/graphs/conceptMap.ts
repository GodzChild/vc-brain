import type { ConceptMap } from '../types'

/**
 * The Brain's keyword constellation. Five matched "primary" concepts (lit by
 * the demo query) are spread far apart; "related" concepts sit in the gaps
 * between them and are clickable to refine the search. Positions are
 * normalized (0..1) across the viewport.
 */
export const CONCEPT_MAP: ConceptMap = {
  nodes: [
    // Primary — the demo query's matched concepts, spread wide. Vertical range
    // is kept above ~0.68 so the "Next" CTA zone at the bottom stays clear.
    { id: 'ai', label: 'AI', x: 0.29, y: 0.24, kind: 'primary', matched: true },
    { id: 'healthcare', label: 'Healthcare', x: 0.71, y: 0.22, kind: 'primary', matched: true },
    { id: 'europe', label: 'Europe', x: 0.86, y: 0.5, kind: 'primary', matched: true },
    { id: 'hackathon', label: 'Hackathon Winner', x: 0.5, y: 0.68, kind: 'primary', matched: true },
    { id: 'recent', label: 'Last 3 Months', x: 0.14, y: 0.5, kind: 'primary', matched: true },

    // Related — refinement concepts sitting between the primaries.
    { id: 'clinical-nlp', label: 'Clinical NLP', x: 0.5, y: 0.15, kind: 'related', matched: false },
    { id: 'diagnostics', label: 'Diagnostics', x: 0.41, y: 0.3, kind: 'related', matched: false },
    { id: 'imaging', label: 'Medical Imaging', x: 0.61, y: 0.31, kind: 'related', matched: false },
    { id: 'genai', label: 'Generative AI', x: 0.37, y: 0.4, kind: 'related', matched: false },
    { id: 'velocity', label: 'High Velocity', x: 0.22, y: 0.37, kind: 'related', matched: false },
    { id: 'mentalhealth', label: 'Mental Health', x: 0.52, y: 0.43, kind: 'related', matched: false },
    { id: 'triage', label: 'Triage', x: 0.62, y: 0.55, kind: 'related', matched: false },
    { id: 'wearables', label: 'Wearables', x: 0.79, y: 0.35, kind: 'related', matched: false },
    { id: 'monitoring', label: 'Remote Monitoring', x: 0.72, y: 0.42, kind: 'related', matched: false },
    { id: 'dtx', label: 'Digital Therapeutics', x: 0.7, y: 0.6, kind: 'related', matched: false },
    { id: 'prototype', label: 'Prototype Stage', x: 0.34, y: 0.6, kind: 'related', matched: false },
    { id: 'opensource', label: 'Open Source', x: 0.25, y: 0.58, kind: 'related', matched: false },
    { id: 'london', label: 'London', x: 0.92, y: 0.4, kind: 'related', matched: false },
    { id: 'berlin', label: 'Berlin', x: 0.94, y: 0.5, kind: 'related', matched: false },
    { id: 'paris', label: 'Paris', x: 0.92, y: 0.6, kind: 'related', matched: false },
  ],
  edges: [
    // Faint primary ring.
    { source: 'ai', target: 'healthcare' },
    { source: 'healthcare', target: 'europe' },
    { source: 'europe', target: 'hackathon' },
    { source: 'hackathon', target: 'recent' },
    { source: 'recent', target: 'ai' },
    // AI cluster.
    { source: 'ai', target: 'diagnostics' },
    { source: 'ai', target: 'genai' },
    { source: 'ai', target: 'velocity' },
    { source: 'ai', target: 'clinical-nlp' },
    // Healthcare cluster.
    { source: 'healthcare', target: 'clinical-nlp' },
    { source: 'healthcare', target: 'imaging' },
    { source: 'healthcare', target: 'wearables' },
    { source: 'healthcare', target: 'mentalhealth' },
    { source: 'healthcare', target: 'triage' },
    // Europe cluster.
    { source: 'europe', target: 'london' },
    { source: 'europe', target: 'berlin' },
    { source: 'europe', target: 'paris' },
    { source: 'europe', target: 'monitoring' },
    { source: 'europe', target: 'wearables' },
    // Hackathon cluster.
    { source: 'hackathon', target: 'prototype' },
    { source: 'hackathon', target: 'dtx' },
    { source: 'hackathon', target: 'triage' },
    // Recent cluster.
    { source: 'recent', target: 'opensource' },
    { source: 'recent', target: 'velocity' },
    { source: 'recent', target: 'prototype' },
    // Cross-web.
    { source: 'imaging', target: 'diagnostics' },
    { source: 'monitoring', target: 'wearables' },
    { source: 'genai', target: 'mentalhealth' },
    { source: 'triage', target: 'mentalhealth' },
    { source: 'dtx', target: 'monitoring' },
    { source: 'opensource', target: 'genai' },
  ],
}
