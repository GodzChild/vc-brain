import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HubIcon from '@mui/icons-material/Hub'
import InsightsIcon from '@mui/icons-material/Insights'
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer'
import HandshakeIcon from '@mui/icons-material/Handshake'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GlowButton from '../components/GlowButton'
import { api } from '../services/api'
import { pageFade, staggerItem, staggerList } from '../animations/variants'
import { synapse } from '../theme'

const FEATURES = [
  {
    icon: <HubIcon sx={{ color: synapse.cyan, fontSize: 30 }} />,
    title: 'Everything you just tried — from day one',
    body: 'The Brain, the Globe, and Story Mode. Voice-driven search over founders who never registered anywhere, each with a sourced Founder Scorecard you can audit link by link.',
  },
  {
    icon: <InsightsIcon sx={{ color: synapse.violet, fontSize: 30 }} />,
    title: 'Trained on your own portfolio',
    body: 'Premium tier: Profound ingests your past investments — thesis, check sizes, sectors, outcomes — and surfaces founders who resemble what has already worked for you, not generic matches.',
  },
  {
    icon: <QuestionAnswerIcon sx={{ color: synapse.cyan, fontSize: 30 }} />,
    title: 'A running analyst, not a static report',
    body: 'Ask direct questions about candidates, markets, or fit and get answers informed by your profile and history — on demand, every day, between board meetings.',
  },
  {
    icon: <HandshakeIcon sx={{ color: synapse.violet, fontSize: 30 }} />,
    title: 'Warm paths, not cold outreach',
    body: 'Graph-routed introductions through mutual connections, plus pre-generated reference-call questions for every candidate before you pick up the phone.',
  },
]

export default function QuotePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', firm: '', email: '', seats: '1–3 seats' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!form.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError('Please add your name and a valid email.')
      return
    }
    setError(null)
    setSending(true)
    try {
      await api.quote({
        name: form.name,
        email: form.email,
        firm: form.firm,
        message: `Estimated volume: ${form.seats}`,
      })
      setSent(true)
    } catch {
      setError("Couldn't reach the server — is the backend running?")
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div variants={pageFade} initial="initial" animate="animate" exit="exit">
      <Box sx={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ pt: 2, px: { xs: 3, md: 6 } }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ color: synapse.textDim, textTransform: 'none' }}
          >
            Back
          </Button>
        </Box>

        {/* The form is the first thing visible, no scroll needed — the pitch
            column is a bonus that only shows once there's room for it. */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
            alignItems: 'center',
            gap: { xs: 2, md: 6 },
            px: { xs: 3, md: 6 },
            pb: { xs: 3, md: 4 },
            overflow: 'hidden',
          }}
        >
          {/* Lead capture */}
          <motion.div variants={staggerItem} initial="initial" animate="animate">
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 4,
                background: synapse.bgElevated,
                maxWidth: 480,
                boxShadow: '0 0 60px rgba(34,211,238,0.1)',
              }}
            >
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CheckCircleIcon sx={{ color: synapse.cyan, fontSize: 52, mb: 1 }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                    You're on the list.
                  </Typography>
                  <Typography sx={{ color: synapse.textDim }}>
                    We'll reach out with a tailored quote within a day. Until then — the brain keeps
                    crawling.
                  </Typography>
                </motion.div>
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Get a quote
                  </Typography>
                  <Typography variant="body2" sx={{ color: synapse.textDim, mb: 2.5 }}>
                    Priced by seats and query volume. Tell us where to send it.
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      label="Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <TextField
                      label="Firm"
                      value={form.firm}
                      onChange={(e) => setForm({ ...form, firm: e.target.value })}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <TextField
                      select
                      label="Team size"
                      value={form.seats}
                      onChange={(e) => setForm({ ...form, seats: e.target.value })}
                    >
                      {['1–3 seats', '4–10 seats', '10+ seats', 'Fund-wide'].map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  {error && (
                    <Typography variant="caption" sx={{ color: synapse.amber, display: 'block', mt: 1.5 }}>
                      {error}
                    </Typography>
                  )}
                  <GlowButton fullWidth onClick={submit} disabled={sending} sx={{ mt: 3 }}>
                    {sending ? 'Sending…' : 'Get a Quote'}
                  </GlowButton>
                </>
              )}
            </Paper>
          </motion.div>

          {/* Pitch — condensed to fit the same viewport, hidden below md where
              there isn't room for it alongside the form without scrolling. */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 560 }}>
            <motion.div variants={staggerItem} initial="initial" animate="animate">
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mb: 1.2,
                  background: `linear-gradient(120deg, #e2e8f0, ${synapse.cyan})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                This is what dealflow looks like when it finds you.
              </Typography>
              <Typography sx={{ color: synapse.textDim, fontSize: '0.95rem', mb: 2.5 }}>
                You just sourced, scored, and story-boarded seven founders in under two minutes —
                work that costs an associate a week of manual crawling.
              </Typography>
            </motion.div>

            <motion.div
              variants={staggerList}
              initial="initial"
              animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {FEATURES.map((f) => (
                <motion.div key={f.title} variants={staggerItem} style={{ display: 'flex', gap: 12 }}>
                  <Box sx={{ flexShrink: 0 }}>{f.icon}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontFamily: 'Space Grotesk', fontSize: '0.92rem' }}>
                      {f.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: synapse.textDim, lineHeight: 1.5 }}>
                      {f.body}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </motion.div>
          </Box>
        </Box>
      </Box>
    </motion.div>
  )
}
