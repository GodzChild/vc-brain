import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import GlobeView from '../globe/GlobeView'
import Leaderboard from '../globe/Leaderboard'
import { useSynapseStore } from '../store/useSynapseStore'
import { synapse } from '../theme'

export default function GlobePage() {
  const navigate = useNavigate()
  const {
    pins,
    phase,
    longWait,
    queryText,
    hoveredFounderId,
    focusedFounderId,
    loadGlobe,
    reset,
    setHoveredFounderId,
    setFocusedFounderId,
  } = useSynapseStore()

  // Pull the pins in as soon as the search finishes; until then the globe just
  // spins (empty pins → GlobeView auto-rotates).
  useEffect(() => {
    if (phase === 'ready') loadGlobe().catch(() => {})
  }, [phase, loadGlobe])

  // Landing here without an active search (e.g. a refresh, which drops the
  // in-memory phase) → send the user back to the prompt.
  useEffect(() => {
    if (phase === 'idle' && pins.length === 0) navigate('/', { replace: true })
  }, [phase, pins.length, navigate])

  const loaded = pins.length > 0
  const searching = phase !== 'ready'
  const focusedPin = pins.find((p) => p.founder_id === focusedFounderId)

  return (
    <Box sx={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        {/* One globe for both states — spins while empty, drops pins when ready. */}
        <GlobeView
          pins={pins}
          focusedFounderId={focusedFounderId}
          hoveredFounderId={hoveredFounderId}
          onPinHover={setHoveredFounderId}
          onPinClick={(id) => navigate(`/story/${id}`)}
        />

        <Box sx={{ position: 'absolute', top: 24, left: 32, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              reset()
              navigate('/')
            }}
            sx={{ color: synapse.textDim, textTransform: 'none' }}
          >
            Brain
          </Button>
          <Box>
            <Typography variant="h6" sx={{ letterSpacing: 4, color: synapse.cyan, lineHeight: 1 }}>
              THE GLOBE
            </Typography>
            <Typography variant="caption" sx={{ color: synapse.textDim }}>
              {loaded
                ? focusedPin
                  ? `Focused: #${focusedPin.rank} ${focusedPin.name} · ${focusedPin.country} — click the pin to open the story`
                  : 'Select a candidate to fly there · click a pin for Story Mode'
                : searching
                  ? 'Scanning the globe for matches…'
                  : 'No matches found — head back and try another search.'}
            </Typography>
          </Box>
        </Box>

        {/* While the search runs: the searched query + a spinner caption. */}
        {searching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: 'absolute',
              bottom: 44,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none',
            }}
          >
            {queryText && (
              <Chip
                label={queryText}
                sx={{
                  maxWidth: '80vw',
                  color: '#e2e8f0',
                  background: synapse.bgElevated,
                  border: `1px solid ${synapse.line}`,
                  backdropFilter: 'blur(8px)',
                  fontSize: '0.9rem',
                }}
              />
            )}
            <Typography
              sx={{ fontFamily: 'Space Grotesk', letterSpacing: 3, color: synapse.cyan, display: 'flex' }}
            >
              loading
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                >
                  .
                </motion.span>
              ))}
            </Typography>
            {longWait && (
              <Typography variant="caption" sx={{ color: synapse.textDim }}>
                Reaching out to the web for real matches — a new query takes a bit longer…
              </Typography>
            )}
          </motion.div>
        )}

        {loaded && (
          <Leaderboard
            pins={pins}
            hoveredFounderId={hoveredFounderId}
            focusedFounderId={focusedFounderId}
            onHover={setHoveredFounderId}
            onSelect={setFocusedFounderId}
            onOpen={(id) => navigate(`/story/${id}`)}
          />
        )}
    </Box>
  )
}
