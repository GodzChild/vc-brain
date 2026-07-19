import type { ConceptMap, ConceptNode, ConceptEdge } from '../types'

// Query filler that shouldn't become a node. Kept deliberately small — we
// want the graph to echo the user's own words, not a curated taxonomy.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but', 'who', 'whom',
  'that', 'which', 'with', 'from', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'these', 'those', 'their', 'they', 'them', 'it', 'its', 'into', 'over', 'under', 'about',
  'recently', 'recent', 'last', 'past', 'me', 'my', 'show', 'find', 'give', 'list', 'i', 'want',
  'need', 'looking', 'look', 'any', 'some', 'all', 'more', 'most', 'than', 'then', 'have', 'has',
  'had', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'get', 'got', 'up', 'out', 'so',
  'we', 'our', 'us', 'you', 'your', 'like', 'using', 'use', 'based', 'within', 'across', 'near',
  'raised', 'built', 'building', 'made', 'making', 'new',
])

const clamp = (v: number) => Math.min(0.94, Math.max(0.06, v))
const clean = (t: string) => t.replace(/[^A-Za-z0-9+.#-]/g, '')

const MAX_NODES = 7

/**
 * Builds the Brain's constellation from the user's query, so the keywords
 * that light up are the ones they actually typed. Each significant word
 * becomes one node — predictable and always faithful to the prompt — laid
 * out in a ring and cross-linked into a web.
 */
export function buildConceptMap(query: string): ConceptMap {
  // Significant words, in order of appearance, deduped case-insensitively.
  const words: string[] = []
  const seen = new Set<string>()
  for (const raw of query.trim().split(/\s+/)) {
    const word = clean(raw)
    const key = word.toLowerCase()
    if (word.length < 2 || STOPWORDS.has(key) || seen.has(key)) continue
    seen.add(key)
    words.push(word)
    if (words.length >= MAX_NODES) break
  }

  // Fallback: an all-stopword or empty query still gets something to show.
  if (words.length === 0) {
    words.push(query.trim() || 'query')
  }

  const n = words.length
  const nodes: ConceptNode[] = words.map((label, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    const r = n === 1 ? 0 : 0.32
    return {
      id: `n${i}`,
      label,
      kind: 'primary',
      matched: true,
      x: clamp(0.5 + r * Math.cos(angle)),
      y: clamp(0.5 + r * Math.sin(angle)),
    }
  })

  const edges: ConceptEdge[] = []
  if (n === 2) {
    edges.push({ source: 'n0', target: 'n1' })
  } else if (n >= 3) {
    for (let i = 0; i < n; i++) edges.push({ source: `n${i}`, target: `n${(i + 1) % n}` })
    // Chords across the ring give the constellation a denser, web-like feel.
    if (n >= 5) for (let i = 0; i < n; i++) edges.push({ source: `n${i}`, target: `n${(i + 2) % n}` })
  }

  return { nodes, edges }
}
