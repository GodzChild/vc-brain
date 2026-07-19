import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PublicIcon from '@mui/icons-material/Public'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GenericBeat from './beats/GenericBeat'
import ScorecardBeat from './beats/ScorecardBeat'
import FitBeat from './beats/FitBeat'
import References from '../components/References'
import GlowButton from '../components/GlowButton'
import type { StoryResponse } from '../types'
import { cardSlide } from '../animations/variants'
import { synapse } from '../theme'

const BEAT_LABELS: Record<string, string> = {
  hook: 'Hook',
  background: 'Background',
  scorecard: 'Scorecard',
  signals: 'Signals',
  fit: 'Fit',
  contact: 'Contact',
}

/** Cinematic beat-by-beat card player with keyboard and rail navigation. */
export default function StoryPlayer({ story }: { story: StoryResponse }) {
  const navigate = useNavigate()
  const beats = story.founder.story_beats
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= beats.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [beats.length, index],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  const beat = beats[index]
  const isLast = index === beats.length - 1

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress rail */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2.5, py: 2 }}>
        {beats.map((b, i) => (
          <Tooltip key={i} title={BEAT_LABELS[b.beat] ?? b.beat} arrow>
            <Box
              onClick={() => go(i)}
              sx={{ cursor: 'pointer', textAlign: 'center', width: 64 }}
            >
              <Box
                sx={{
                  height: 4,
                  borderRadius: 2,
                  mb: 0.6,
                  background: i <= index ? synapse.cyan : 'rgba(148,163,184,0.25)',
                  boxShadow: i === index ? `0 0 10px ${synapse.cyan}` : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: i === index ? '#e2e8f0' : synapse.textDim,
                  fontSize: '0.65rem',
                  letterSpacing: 0.5,
                }}
              >
                {BEAT_LABELS[b.beat] ?? b.beat}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* Beat card */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 6 },
          position: 'relative',
          minHeight: 0,
        }}
      >
        <IconButton
          onClick={() => go(index - 1)}
          disabled={index === 0}
          sx={{ position: 'absolute', left: 12, color: synapse.textDim, zIndex: 2 }}
          aria-label="previous beat"
        >
          <ChevronLeftIcon fontSize="large" />
        </IconButton>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={cardSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: 'min(860px, 100%)', maxHeight: '100%' }}
          >
            <Paper
              sx={{
                p: { xs: 3, md: 4.5 },
                borderRadius: 4,
                background: synapse.bgElevated,
                backdropFilter: 'blur(14px)',
                boxShadow: '0 0 80px rgba(34, 211, 238, 0.08)',
                maxHeight: 'calc(100vh - 220px)',
                overflowY: 'auto',
              }}
            >
              {beat.beat === 'scorecard' ? (
                <ScorecardBeat beat={beat} founder={story.founder} />
              ) : beat.beat === 'fit' ? (
                <FitBeat beat={beat} fit={story.fit} profile={story.profile} />
              ) : (
                <GenericBeat beat={beat} founder={story.founder} />
              )}

              {isLast && <References founder={story.founder} />}

              {isLast && (
                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                  <Button
                    startIcon={<PublicIcon />}
                    onClick={() => navigate('/globe')}
                    sx={{
                      textTransform: 'none',
                      color: synapse.textDim,
                      border: `1px solid ${synapse.line}`,
                      borderRadius: 2.5,
                      px: 2.5,
                    }}
                  >
                    Back to Globe
                  </Button>
                  <GlowButton endIcon={<AutoAwesomeIcon />} onClick={() => navigate('/quote')}>
                    See what Profound can do
                  </GlowButton>
                </Box>
              )}
            </Paper>
          </motion.div>
        </AnimatePresence>

        <IconButton
          onClick={() => go(index + 1)}
          disabled={isLast}
          sx={{ position: 'absolute', right: 12, color: synapse.cyan, zIndex: 2 }}
          aria-label="next beat"
        >
          <ChevronRightIcon fontSize="large" />
        </IconButton>
      </Box>
    </Box>
  )
}
