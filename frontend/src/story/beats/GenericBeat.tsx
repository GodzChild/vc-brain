import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LaunchIcon from '@mui/icons-material/Launch'
import PersonIcon from '@mui/icons-material/Person'
import type { Founder, StoryBeat } from '../../types'
import { synapse } from '../../theme'

// Keys that are a company/fallback surface, not the member's own profile —
// must read visually distinct from a personal linkedin/twitter/github link
// (see backend live_query._enrich_member_contacts, which writes these keys
// only when no personal link was found).
const FALLBACK_LINK_LABELS: Record<string, string> = {
  website: 'Company site',
  company: 'Company page',
}

/**
 * Renders hook / background / signals / contact beats. Slide 1 (hook) is the
 * company itself; slide 2 (background) is the founder/CEO and shows their
 * portrait. Signals beats get market-stat tiles and a signal timeline;
 * contact beats surface the team roster with per-member links. Sources are
 * not shown per-beat — they are consolidated into References on the last slide.
 */
export default function GenericBeat({ beat, founder }: { beat: StoryBeat; founder: Founder }) {
  const ceoImage = beat.beat === 'background' && founder.images.length > 0 ? founder.images[0] : null

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        {beat.title}
      </Typography>

      {/* Slide 2 (the founder/CEO) leads with their portrait beside the story. */}
      {ceoImage ? (
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <Box
            component="img"
            src={ceoImage}
            alt={founder.name}
            sx={{
              width: 160,
              height: 160,
              flexShrink: 0,
              borderRadius: 3,
              objectFit: 'cover',
              border: `1px solid ${synapse.line}`,
              boxShadow: `0 0 30px rgba(34,211,238,0.12)`,
            }}
          />
          <Typography sx={{ color: '#cbd5e1', fontSize: '1.08rem', lineHeight: 1.75, flex: 1, minWidth: 260 }}>
            {beat.body}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ color: '#cbd5e1', fontSize: '1.08rem', lineHeight: 1.75, mb: 2 }}>
          {beat.body}
        </Typography>
      )}

      {/* Market stats — concrete sourced numbers, shown as display-only tiles. */}
      {beat.beat === 'signals' && founder.market_stats.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', mb: 2 }}>
          {founder.market_stats.map((s, i) => (
            <Paper key={i} sx={{ px: 1.8, py: 1, borderRadius: 2.5, background: 'rgba(34, 211, 238, 0.05)' }}>
              <Typography sx={{ color: synapse.cyan, fontWeight: 700, fontFamily: 'Space Grotesk', lineHeight: 1.2 }}>
                {s.value}
              </Typography>
              <Typography variant="caption" sx={{ color: synapse.textDim }}>
                {s.label}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {beat.beat === 'signals' && founder.signals.length > 0 && (
        <Box sx={{ mb: 2, borderLeft: `2px solid ${synapse.line}`, pl: 2 }}>
          {founder.signals.map((s, i) => (
            <Box key={i} sx={{ mb: 1.2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  size="small"
                  label={s.kind.replace('_', ' ')}
                  sx={{
                    fontSize: '0.65rem',
                    height: 20,
                    color: synapse.violet,
                    border: `1px solid ${synapse.violet}`,
                    background: 'transparent',
                    textTransform: 'uppercase',
                  }}
                />
                <Typography variant="caption" sx={{ color: synapse.textDim }}>
                  {s.date}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.4 }}>
                {s.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Team roster with per-member contact surfaces. */}
      {beat.beat === 'contact' && founder.team.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" sx={{ color: synapse.violet, letterSpacing: 1.5, display: 'block', mb: 0.8 }}>
            Team
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
            {founder.team.map((m, i) => (
              <Paper key={i} sx={{ px: 1.8, py: 1.2, borderRadius: 2.5, background: 'rgba(167, 139, 250, 0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <PersonIcon sx={{ fontSize: 16, color: synapse.violet }} />
                  <Typography sx={{ fontWeight: 600, fontFamily: 'Space Grotesk', fontSize: '0.9rem' }}>
                    {m.name}
                  </Typography>
                  {m.role && (
                    <Typography variant="caption" sx={{ color: synapse.textDim }}>
                      {m.role}
                    </Typography>
                  )}
                </Box>
                {Object.keys(m.links).length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mt: 0.6 }}>
                    {Object.entries(m.links).map(([kind, url]) => {
                      const isFallback = kind in FALLBACK_LINK_LABELS
                      return (
                        <Chip
                          key={kind}
                          size="small"
                          label={isFallback ? FALLBACK_LINK_LABELS[kind] : kind}
                          component="a"
                          href={kind === 'email' && !url.startsWith('mailto:') ? `mailto:${url}` : url}
                          target="_blank"
                          clickable
                          sx={{
                            fontSize: '0.68rem',
                            height: 20,
                            color: isFallback ? synapse.textDim : synapse.cyan,
                            border: `1px ${isFallback ? 'dashed' : 'solid'} ${synapse.line}`,
                            background: 'transparent',
                          }}
                        />
                      )
                    })}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {beat.beat === 'contact' && Object.keys(founder.links).length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {Object.entries(founder.links).map(([kind, url]) => (
            <Button
              key={kind}
              size="small"
              endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
              href={url}
              target="_blank"
              sx={{
                textTransform: 'none',
                color: synapse.cyan,
                border: `1px solid ${synapse.line}`,
                borderRadius: 2,
                px: 1.5,
              }}
            >
              {kind.replace('_', ' ')}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  )
}
