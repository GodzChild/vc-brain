import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import StoryPlayer from '../story/StoryPlayer'
import NeuralLoader from '../components/NeuralLoader'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { api } from '../services/api'
import type { StoryResponse } from '../types'
import { pageFade } from '../animations/variants'
import { synapse } from '../theme'

export default function StoryPage() {
  const { founderId } = useParams<{ founderId: string }>()
  const navigate = useNavigate()
  const [story, setStory] = useState<StoryResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!founderId) return
    api
      .story(founderId)
      .then(setStory)
      .catch(() => setError(true))
  }, [founderId])

  return (
    <motion.div variants={pageFade} initial="initial" animate="animate" exit="exit">
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 4, pt: 2.5, flexWrap: 'wrap' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/globe')}
            sx={{ color: synapse.textDim, textTransform: 'none' }}
          >
            Globe
          </Button>
          {story && (
            <>
              {story.founder.images.length > 0 && (
                <Avatar
                  src={story.founder.images[0]}
                  alt={story.founder.name}
                  sx={{ width: 36, height: 36, border: `1px solid ${synapse.line}` }}
                />
              )}
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {story.founder.name}
              </Typography>
              <Typography sx={{ color: synapse.textDim }}>
                {story.founder.project} · {story.founder.location.city}
              </Typography>
              <Chip
                size="small"
                label={story.founder.entity_type.replace('_', ' ')}
                sx={{
                  color: synapse.textDim,
                  border: `1px solid ${synapse.line}`,
                  background: 'transparent',
                  fontSize: '0.7rem',
                  textTransform: 'capitalize',
                }}
              />
              <ConfidenceBadge confidence={story.founder.scorecard.confidence} />
              {story.founder.entity_resolution_confidence < 1 && (
                <Chip
                  size="small"
                  label={`possibly same person — ${story.founder.entity_resolution_confidence.toFixed(2)}`}
                  sx={{
                    color: synapse.amber,
                    border: `1px dashed ${synapse.amber}`,
                    background: 'transparent',
                    fontSize: '0.7rem',
                  }}
                />
              )}
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" sx={{ color: synapse.textDim }}>
                discovered via {story.founder.discovered_via.join(' · ')}
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {story ? (
            <StoryPlayer story={story} />
          ) : (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              {error ? (
                <Typography sx={{ color: synapse.textDim }}>
                  Couldn't load this story — is the backend running?
                </Typography>
              ) : (
                <NeuralLoader label="Assembling the story…" />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </motion.div>
  )
}
