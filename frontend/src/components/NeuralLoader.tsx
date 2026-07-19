import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { synapse } from '../theme'

const STATUS_LINES = [
  'Parsing intent…',
  'Querying vector index…',
  'Traversing knowledge graph…',
  'Ranking founders…',
]

/**
 * Designed loading state: three pulsing synapse dots plus rotating status
 * copy that narrates the (production) query pipeline. Used instead of any
 * default spinner across the app.
 */
export default function NeuralLoader({ label }: { label?: string }) {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % STATUS_LINES.length), 650)
    return () => clearInterval(t)
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        py: 4,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: synapse.cyan,
              boxShadow: `0 0 16px ${synapse.cyan}`,
            }}
          />
        ))}
      </Box>
      <Typography variant="body2" sx={{ color: synapse.textDim, fontFamily: 'Space Grotesk' }}>
        {label ?? STATUS_LINES[line]}
      </Typography>
    </Box>
  )
}
