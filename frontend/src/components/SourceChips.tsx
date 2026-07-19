import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import LinkIcon from '@mui/icons-material/Link'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { Evidence } from '../types'
import { synapse } from '../theme'

/**
 * Every fact card renders its sources through this component — sourcing is a
 * first-class trust feature, not a footnote. Inferred facts get a visually
 * distinct dashed chip so model opinions are never dressed up as facts.
 */
export default function SourceChips({ facts }: { facts: Evidence[] }) {
  if (!facts.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1.5 }}>
      {facts.map((f, i) =>
        f.inferred ? (
          <Tooltip key={i} title={f.claim} arrow>
            <Chip
              size="small"
              icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
              label={`inferred — ${f.source_name ?? 'model opinion'}`}
              sx={{
                border: `1px dashed ${synapse.violet}`,
                background: 'transparent',
                color: synapse.violet,
                fontSize: '0.72rem',
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip key={i} title={f.claim} arrow>
            <Chip
              size="small"
              icon={<LinkIcon sx={{ fontSize: 14 }} />}
              label={f.source_name ?? f.source_url ?? 'source'}
              component={f.source_url ? 'a' : 'div'}
              href={f.source_url ?? undefined}
              target="_blank"
              clickable={Boolean(f.source_url)}
              sx={{
                border: `1px solid ${synapse.line}`,
                background: 'rgba(34, 211, 238, 0.06)',
                color: synapse.cyan,
                fontSize: '0.72rem',
                '&:hover': { background: 'rgba(34, 211, 238, 0.14)' },
              }}
            />
          </Tooltip>
        ),
      )}
    </Box>
  )
}
