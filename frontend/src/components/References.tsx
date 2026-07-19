import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinkIcon from '@mui/icons-material/Link'
import type { Evidence, Founder } from '../types'
import { synapse } from '../theme'

/** Every sourced fact scattered across a founder's profile, gathered and
 *  deduped into one reference list — shown once, on the final story slide,
 *  instead of repeating source chips on every beat. */
function collectSources(founder: Founder): { url: string; name: string }[] {
  const all: Evidence[] = [
    ...founder.scorecard.dimensions.flatMap((d) => d.evidence),
    ...founder.signals.map((s) => s.evidence),
    ...founder.vc_metrics.flatMap((m) => m.evidence),
    ...founder.market_stats.map((s) => s.evidence).filter((e): e is Evidence => e != null),
    ...founder.story_beats.flatMap((b) => b.facts),
    ...founder.team.map((m) => m.evidence).filter((e): e is Evidence => e != null),
  ]
  const byUrl = new Map<string, string>()
  for (const e of all) {
    if (!e.source_url || e.inferred) continue
    if (!byUrl.has(e.source_url)) {
      let host = e.source_url
      try {
        host = new URL(e.source_url).hostname.replace(/^www\./, '')
      } catch {
        /* keep raw */
      }
      byUrl.set(e.source_url, e.source_name || host)
    }
  }
  return [...byUrl.entries()].map(([url, name]) => ({ url, name }))
}

export default function References({ founder }: { founder: Founder }) {
  const sources = collectSources(founder)
  if (!sources.length) return null
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="overline" sx={{ color: synapse.violet, letterSpacing: 1.5, display: 'block', mb: 1 }}>
        References · {sources.length} source{sources.length === 1 ? '' : 's'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {sources.map((s, i) => (
          <Box
            key={s.url}
            component="a"
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: synapse.cyan,
              fontSize: '0.82rem',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <Typography component="span" sx={{ color: synapse.textDim, width: 20, textAlign: 'right', fontSize: '0.78rem' }}>
              {i + 1}
            </Typography>
            <LinkIcon sx={{ fontSize: 14 }} />
            <Typography
              component="span"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}
            >
              {s.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
