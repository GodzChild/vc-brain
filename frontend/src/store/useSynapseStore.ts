import { create } from 'zustand'
import type { Candidate, GlobePin } from '../types'
import { api } from '../services/api'

// idle: query bar shown, synapses dormant
// activating: prompt hidden, matched keywords lighting up in sequence
// ready: glow settled, "Next" available; user may click keywords to refine
export type QueryPhase = 'idle' | 'activating' | 'ready'

const GLOW_MS = 1700

interface SynapseState {
  queryText: string
  phase: QueryPhase
  longWait: boolean
  candidates: Candidate[]
  pins: GlobePin[]
  hoveredFounderId: string | null
  focusedFounderId: string | null

  loadGlobe: () => Promise<void>
  setQueryText: (text: string) => void
  // `queryHint` (e.g. "startup founders") is prepended to the text SENT to
  // the backend only — the stored queryText (and the visible input) stays
  // exactly what the user typed.
  activate: (queryHint?: string) => void
  setHoveredFounderId: (id: string | null) => void
  setFocusedFounderId: (id: string | null) => void
  reset: () => void
}

export const useSynapseStore = create<SynapseState>((set, get) => ({
  queryText: '',
  phase: 'idle' as QueryPhase,
  longWait: false,
  candidates: [],
  pins: [],
  hoveredFounderId: null,
  focusedFounderId: null,

  // Always refetches, and always resets focus to the top-ranked pin — the
  // globe reflects the CURRENT search only, so a focus id from a previous
  // search must never carry over.
  loadGlobe: async () => {
    const pins = await api.globe()
    set({ pins, focusedFounderId: pins[0]?.founder_id ?? null })
  },

  setQueryText: (queryText) => set({ queryText }),

  activate: (queryHint) => {
    if (get().phase !== 'idle' || !get().queryText.trim()) return
    set({ phase: 'activating', longWait: false })
    // In live mode, a cache-miss search (real Tavily + extraction) can take
    // far longer than the glow animation — "ready" waits for the real
    // query to resolve, not just the fixed animation timer, so the globe
    // page never shows stale data. The animation still gets its full run.
    const longWaitTimer = window.setTimeout(() => {
      if (get().phase === 'activating') set({ longWait: true })
    }, GLOW_MS + 400)
    const minGlow = new Promise<void>((resolve) => window.setTimeout(resolve, GLOW_MS))
    const outgoingText = queryHint ? `[Focus: ${queryHint}] ${get().queryText}` : get().queryText
    const queryDone = api
      .query(outgoingText)
      .then((res) => set({ candidates: res.candidates }))
      .catch(() => {})
    Promise.all([minGlow, queryDone]).then(() => {
      window.clearTimeout(longWaitTimer)
      if (get().phase === 'activating') set({ phase: 'ready', longWait: false })
    })
  },

  setHoveredFounderId: (hoveredFounderId) => set({ hoveredFounderId }),
  setFocusedFounderId: (focusedFounderId) => set({ focusedFounderId }),

  reset: () => set({ phase: 'idle', longWait: false }),
}))
