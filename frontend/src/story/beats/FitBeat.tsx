import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { motion } from 'framer-motion'
import type { FitResult, StoryBeat, VCProfile } from '../../types'
import { synapse } from '../../theme'

/** Fit-engine beat: animated score dial, rationale, and the VC thesis side by side. */
export default function FitBeat({
  beat,
  fit,
  profile,
}: {
  beat: StoryBeat
  fit: FitResult
  profile: VCProfile
}) {
  const R = 54
  const CIRC = 2 * Math.PI * R

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        {beat.title}
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box sx={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
            <motion.circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={synapse.cyan}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC * (1 - fit.fit_score / 100) }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              transform="rotate(-90 70 70)"
              style={{ filter: `drop-shadow(0 0 8px ${synapse.cyan})` }}
            />
          </svg>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: synapse.cyan, lineHeight: 1 }}>
                {fit.fit_score}
              </Typography>
              <Typography variant="caption" sx={{ color: synapse.textDim }}>
                / 100 fit
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 280 }}>
          <Typography sx={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, mb: 2 }}>
            {beat.body}
          </Typography>
          <Paper
            sx={{
              p: 2,
              borderRadius: 3,
              background: 'rgba(167, 139, 250, 0.06)',
              border: `1px solid rgba(167, 139, 250, 0.3)`,
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: synapse.violet, letterSpacing: 1.5, display: 'block', mb: 0.5 }}
            >
              Your thesis — {profile.firm}
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
              {profile.thesis}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              {[...profile.focus_domains, ...profile.focus_geos, profile.check_size].map((t) => (
                <Chip
                  key={t}
                  size="small"
                  label={t}
                  sx={{
                    fontSize: '0.7rem',
                    color: synapse.violet,
                    background: 'rgba(167,139,250,0.12)',
                  }}
                />
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}
