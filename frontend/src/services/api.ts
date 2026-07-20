import type { BrainGraph, GlobePin, QueryResponse, StoryResponse } from '../types'

// Dev: leave VITE_API_BASE unset — the Vite dev server proxies /api to the
// local backend (see vite.config.ts). Production (Cloudflare Pages): set
// VITE_API_BASE to the deployed backend origin, e.g. https://vc-brain-api.onrender.com
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

export const api = {
  brain: () => get<BrainGraph>('/api/brain'),
  globe: () => get<GlobePin[]>('/api/globe'),
  story: (founderId: string) => get<StoryResponse>(`/api/story/${founderId}`),
  query: async (text: string, thesisOverride?: string): Promise<QueryResponse> => {
    const res = await fetch(`${API_BASE}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        ...(thesisOverride ? { thesis_override: thesisOverride } : {}),
      }),
    })
    if (!res.ok) throw new Error(`/api/query → ${res.status}`)
    return res.json()
  },
  quote: async (lead: { name: string; email: string; firm: string; message: string }) => {
    const res = await fetch(`${API_BASE}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    })
    if (!res.ok) throw new Error(`/api/quote → ${res.status}`)
    return res.json() as Promise<{ ok: boolean; message: string }>
  },
}
