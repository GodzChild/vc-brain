import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import MicIcon from '@mui/icons-material/Mic'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SponsorStrip from '../components/SponsorStrip'
import { useSynapseStore } from '../store/useSynapseStore'
import { pageFade } from '../animations/variants'
import { synapse } from '../theme'

// UI label -> hint text sent to the backend (see useSynapseStore.activate) ->
// biases the model toward the matching existing entity_type value
// (startup / research / hackathon_project) already supported by the
// extraction prompt. No new backend enum values invented here.
const ENTITY_TYPE_OPTIONS: { label: string; hint: string }[] = [
  { label: 'Startups', hint: 'startup founders' },
  { label: 'Research Papers', hint: 'research papers' },
  { label: 'Hackathon Winners', hint: 'hackathon winners' },
]

export default function BrainPage() {
  const navigate = useNavigate()
  // Subscribe narrowly: if BrainPage re-rendered on every store change (phase,
  // pins, longWait…) it would restart its own exit animation mid-transition
  // and never unmount. queryText only changes while typing, before we leave.
  const queryText = useSynapseStore((s) => s.queryText)
  const setQueryText = useSynapseStore((s) => s.setQueryText)
  const activate = useSynapseStore((s) => s.activate)

  // Page-local: which entity-type pill is selected, if any. Not global store
  // state — it only matters for the single search about to fire.
  const [entityType, setEntityType] = useState<string | null>(null)

  // Session-only thesis override — never persisted, lost on refresh (see
  // useSynapseStore.activate / api.query). Page-local: only matters for the
  // single search about to fire.
  const [showThesis, setShowThesis] = useState(false)
  const [thesisText, setThesisText] = useState('')

  // Warm the globe chunk (three.js) in the background so navigating to it after
  // a search doesn't suspend mid-transition and stall the route animation.
  useEffect(() => {
    import('./GlobePage')
  }, [])

  // Fire the search and head to the globe, which spins while the data loads
  // and drops the pins in once it's ready.
  const runSearch = () => {
    if (!queryText.trim()) return
    const hint = ENTITY_TYPE_OPTIONS.find((o) => o.label === entityType)?.hint
    activate(hint, thesisText.trim() || undefined)
    navigate('/globe')
  }

  const onThesisFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setThesisText(String(reader.result ?? ''))
    reader.readAsText(file)
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
            top: '34%',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <Box sx={{ textAlign: 'center', px: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#e2e8f0', mb: 0.75 }}>
              Who are you looking for?
            </Typography>
            <Typography variant="body2" sx={{ color: synapse.textDim }}>
              Optionally focus the search, then describe what you want in your own words.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ENTITY_TYPE_OPTIONS.map((opt) => {
              const selected = entityType === opt.label
              return (
                <Chip
                  key={opt.label}
                  label={opt.label}
                  clickable
                  onClick={() => setEntityType(selected ? null : opt.label)}
                  sx={{
                    px: 1,
                    py: 2.2,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: selected ? '#031018' : synapse.textDim,
                    background: selected ? synapse.cyan : 'transparent',
                    border: `1px solid ${selected ? synapse.cyan : synapse.line}`,
                    '&:hover': { background: selected ? '#67e8f9' : 'rgba(34, 211, 238, 0.08)' },
                  }}
                />
              )
            })}
          </Box>

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
                placeholder={
                  entityType
                    ? `Describe the ${entityType.toLowerCase()} you're looking for…`
                    : 'e.g. "technical founder, Berlin, AI infra, no prior VC backing"'
                }
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

          {/* Session-only thesis override (Task 2) — never persisted, lost on
              refresh. Kept compact (small max-height, internal scroll) so it
              can't push the sponsor strip below out of place. */}
          <Box sx={{ width: 'min(720px, 92vw)' }}>
            <Link
              component="button"
              type="button"
              onClick={() => setShowThesis((v) => !v)}
              underline="none"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: synapse.textDim,
                fontSize: '0.82rem',
                mx: 'auto',
              }}
            >
              {showThesis ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              Add your investment thesis (optional)
            </Link>
            <Collapse in={showThesis}>
              <Paper
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 3,
                  background: synapse.bgElevated,
                }}
              >
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  variant="standard"
                  value={thesisText}
                  onChange={(e) => setThesisText(e.target.value)}
                  placeholder="Paste your thesis — it replaces the demo thesis for this search only."
                  slotProps={{ input: { disableUnderline: true, sx: { fontSize: '0.9rem' } } }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                  <Link
                    component="label"
                    sx={{ color: synapse.cyan, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    or upload a .txt file
                    <input
                      type="file"
                      accept=".txt,text/plain"
                      hidden
                      onChange={(e) => onThesisFile(e.target.files?.[0])}
                    />
                  </Link>
                </Box>
              </Paper>
            </Collapse>
          </Box>
        </motion.div>

        {/* Sponsor / investor strip — below the prompt. Hidden while the
            thesis panel is open so its expansion never overlaps the strip
            (this only changes when SponsorStrip renders on THIS page, not
            the shared component itself). */}
        {!showThesis && (
          <Box sx={{ position: 'absolute', top: '68%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <SponsorStrip />
          </Box>
        )}
      </Box>
    </motion.div>
  )
}
