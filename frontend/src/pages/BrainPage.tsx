import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import MicIcon from '@mui/icons-material/Mic'
import SearchIcon from '@mui/icons-material/Search'
import SponsorStrip from '../components/SponsorStrip'
import { useSynapseStore } from '../store/useSynapseStore'
import { pageFade } from '../animations/variants'
import { synapse } from '../theme'

export default function BrainPage() {
  const navigate = useNavigate()
  // Subscribe narrowly: if BrainPage re-rendered on every store change (phase,
  // pins, longWait…) it would restart its own exit animation mid-transition
  // and never unmount. queryText only changes while typing, before we leave.
  const queryText = useSynapseStore((s) => s.queryText)
  const setQueryText = useSynapseStore((s) => s.setQueryText)
  const activate = useSynapseStore((s) => s.activate)

  // Warm the globe chunk (three.js) in the background so navigating to it after
  // a search doesn't suspend mid-transition and stall the route animation.
  useEffect(() => {
    import('./GlobePage')
  }, [])

  // Fire the search and head to the globe, which spins while the data loads
  // and drops the pins in once it's ready.
  const runSearch = () => {
    if (!queryText.trim()) return
    activate()
    navigate('/globe')
  }

  return (
    <motion.div variants={pageFade} initial="initial" animate="animate" exit="exit">
      <Box sx={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 24, left: 32, pointerEvents: 'none' }}>
          <Typography variant="h6" sx={{ letterSpacing: 4, color: synapse.cyan }}>
            PROFOUND
          </Typography>
          <Typography variant="caption" sx={{ color: synapse.textDim, letterSpacing: 1.5 }}>
            THE VC BRAIN
          </Typography>
        </Box>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            top: '40%',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Paper
            elevation={8}
            sx={{
              width: 'min(720px, 92vw)',
              p: 2.5,
              borderRadius: 4,
              background: synapse.bgElevated,
              backdropFilter: 'blur(12px)',
              boxShadow: `0 0 60px rgba(34, 211, 238, 0.14)`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                variant="standard"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Ask the brain…"
                slotProps={{ input: { disableUnderline: true, sx: { fontSize: '1.05rem', px: 1 } } }}
              />
              <IconButton sx={{ color: synapse.textDim }} aria-label="voice input (demo)">
                <MicIcon />
              </IconButton>
              <IconButton
                onClick={runSearch}
                sx={{ color: '#031018', background: synapse.cyan, '&:hover': { background: '#67e8f9' } }}
                aria-label="search"
              >
                <SearchIcon />
              </IconButton>
            </Box>
          </Paper>
        </motion.div>

        {/* Sponsor / investor strip — below the prompt. */}
        <Box sx={{ position: 'absolute', top: '56%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <SponsorStrip />
        </Box>
      </Box>
    </motion.div>
  )
}
