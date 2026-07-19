import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { synapse } from '../theme'

// Real venture firms, each rendered as a text wordmark in a typeface chosen to
// echo the spirit of its actual brand (serif houses vs. modern/mono marks).
// These are illustrative names for the demo, not claimed partnerships.
const FIRMS: { name: string; sx: object }[] = [
  {
    name: 'Sequoia Capital',
    sx: { fontFamily: '"Playfair Display", serif', fontWeight: 700, letterSpacing: '0.01em' },
  },
  {
    name: 'a16z',
    sx: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: '-0.02em' },
  },
  {
    name: 'ACCEL',
    sx: { fontFamily: '"Archivo Black", sans-serif', letterSpacing: '0.14em' },
  },
  {
    name: 'Benchmark',
    sx: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 500, letterSpacing: '0.12em' },
  },
  {
    name: 'Greylock',
    sx: { fontFamily: '"DM Serif Display", serif', letterSpacing: '0.01em' },
  },
  {
    name: 'Index Ventures',
    sx: { fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, letterSpacing: '0.03em' },
  },
  {
    name: 'Lightspeed',
    sx: { fontFamily: '"Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
  },
]

/** Muted "logos" strip below the prompt — the venture firms whose lens the
 *  Brain is tuned to think in. */
export default function SponsorStrip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <Box sx={{ textAlign: 'center', px: 2 }}>
        <Typography
          variant="caption"
          sx={{
            color: synapse.textDim,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            fontSize: '0.68rem',
          }}
        >
          The funds shaping tomorrow's companies
        </Typography>

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2.5, md: 4.5 },
            flexWrap: 'wrap',
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          {FIRMS.map((firm) => (
            <Typography
              key={firm.name}
              component="span"
              sx={{
                color: 'rgba(226, 232, 240, 0.38)',
                fontSize: { xs: '1rem', md: '1.25rem' },
                lineHeight: 1,
                whiteSpace: 'nowrap',
                transition: 'color 0.3s ease',
                cursor: 'default',
                '&:hover': { color: 'rgba(226, 232, 240, 0.75)' },
                ...firm.sx,
              }}
            >
              {firm.name}
            </Typography>
          ))}
        </Box>
      </Box>
    </motion.div>
  )
}
