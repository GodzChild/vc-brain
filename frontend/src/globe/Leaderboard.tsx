import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ConfidenceBadge from '../components/ConfidenceBadge'
import type { GlobePin } from '../types'
import { staggerItem, staggerList } from '../animations/variants'
import { confidenceColor, synapse } from '../theme'

interface Props {
  pins: GlobePin[]
  hoveredFounderId: string | null
  focusedFounderId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void // fly the globe to this candidate
  onOpen: (id: string) => void // open Story Mode
}

/**
 * Right-docked ranked leaderboard. Clicking a row flies the globe to that
 * candidate; the focused row reveals an explicit "Open story" action (Story
 * Mode is otherwise entered by clicking the pin itself).
 */
export default function Leaderboard({
  pins,
  hoveredFounderId,
  focusedFounderId,
  onHover,
  onSelect,
  onOpen,
}: Props) {
  return (
    <motion.div
      variants={staggerList}
      initial="initial"
      animate="animate"
      style={{
        position: 'absolute',
        top: 84,
        right: 24,
        bottom: 24,
        width: 330,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingRight: 4,
      }}
    >
      {pins.map((pin) => {
        const hovered = pin.founder_id === hoveredFounderId
        const focused = pin.founder_id === focusedFounderId
        const active = hovered || focused
        return (
          <motion.div key={pin.founder_id} variants={staggerItem}>
            <Paper
              onMouseEnter={() => onHover(pin.founder_id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(pin.founder_id)}
              sx={{
                p: 1.6,
                borderRadius: 3,
                cursor: 'pointer',
                background: synapse.bgElevated,
                backdropFilter: 'blur(10px)',
                borderColor: focused
                  ? confidenceColor[pin.confidence]
                  : active
                    ? synapse.line
                    : undefined,
                boxShadow: focused ? `0 0 24px ${confidenceColor[pin.confidence]}55` : 'none',
                transform: active ? 'translateX(-4px)' : 'none',
                transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ color: synapse.textDim, fontWeight: 700, fontSize: '0.85rem' }}>
                  #{pin.rank}
                </Typography>
                {pin.image_url && (
                  <Avatar src={pin.image_url} alt={pin.name} sx={{ width: 22, height: 22 }} />
                )}
                <Typography sx={{ fontWeight: 600, fontFamily: 'Space Grotesk', flex: 1 }}>
                  {pin.name}
                </Typography>
                <Typography sx={{ color: confidenceColor[pin.confidence], fontWeight: 700 }}>
                  {pin.score}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: synapse.textDim, display: 'block', mb: 0.8 }}>
                {pin.project} · {pin.country}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={pin.score}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  mb: 0.8,
                  backgroundColor: 'rgba(148,163,184,0.15)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: confidenceColor[pin.confidence],
                  },
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <ConfidenceBadge confidence={pin.confidence} />
                {focused && (
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(pin.founder_id)
                    }}
                    sx={{ textTransform: 'none', color: synapse.cyan, fontSize: '0.72rem' }}
                  >
                    Open story
                  </Button>
                )}
              </Box>
            </Paper>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
