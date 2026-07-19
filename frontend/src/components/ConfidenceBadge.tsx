import Chip from '@mui/material/Chip'
import { keyframes } from '@mui/material/styles'
import type { Confidence } from '../types'
import { confidenceColor } from '../theme'

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 6px rgba(245, 158, 11, 0.5); }
  50% { box-shadow: 0 0 18px rgba(245, 158, 11, 0.9); }
`

const LABELS: Record<Confidence, string> = {
  high: 'high confidence',
  medium: 'medium confidence',
  low: 'low confidence',
  verify_offline: 'verify offline',
}

/** Confidence pill; verify_offline pulses amber — a distinct state, not a penalty. */
export default function ConfidenceBadge({
  confidence,
  size = 'small',
}: {
  confidence: Confidence
  size?: 'small' | 'medium'
}) {
  const color = confidenceColor[confidence]
  return (
    <Chip
      size={size}
      label={LABELS[confidence]}
      sx={{
        color,
        border: `1px solid ${color}`,
        background: 'transparent',
        fontWeight: 600,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        ...(confidence === 'verify_offline' && { animation: `${pulse} 2s ease-in-out infinite` }),
      }}
    />
  )
}
