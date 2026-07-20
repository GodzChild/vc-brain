import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import ConfidenceBadge from '../../components/ConfidenceBadge'
import type { Founder, StoryBeat } from '../../types'
import { synapse } from '../../theme'

const DIM_LABEL: Record<string, string> = {
  lead: 'Lead',
  pitch: 'Pitch',
  sell: 'Sell',
  scale: 'Scale',
  grit: 'Grit',
}

const METRIC_LABEL: Record<string, string> = {
  scalability: 'Scalability',
  market_gap: 'Market Gap & Potential',
  innovation: 'Innovation & Business Model',
}

/** The Founder Scorecard beat: Recharts radar + per-dimension evidence. */
export default function ScorecardBeat({ beat, founder }: { beat: StoryBeat; founder: Founder }) {
  const { scorecard } = founder
  const radarData = scorecard.dimensions.map((d) => ({
    dimension: DIM_LABEL[d.dimension] ?? d.dimension,
    score: d.score,
  }))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {beat.title}
        </Typography>
        <ConfidenceBadge confidence={scorecard.confidence} size="medium" />
      </Box>
      <Typography sx={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, mb: 1.5 }}>
        {beat.body}
      </Typography>

      {scorecard.verify_offline_note && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            background: 'rgba(245, 158, 11, 0.08)',
            border: `1px solid rgba(245, 158, 11, 0.4)`,
            color: '#fcd34d',
          }}
        >
          {scorecard.verify_offline_note}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ width: 320, height: 260, flexShrink: 0 }}>
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="rgba(148,163,184,0.2)" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: '#cbd5e1', fontSize: 13, fontFamily: 'Space Grotesk' }}
              />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar
                dataKey="score"
                stroke={synapse.cyan}
                fill={synapse.cyan}
                fillOpacity={0.28}
                isAnimationActive
              />
            </RadarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ flex: 1, minWidth: 260 }}>
          {scorecard.dimensions.map((d) => (
            <Box key={d.dimension} sx={{ mb: 1.1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontFamily: 'Space Grotesk', fontWeight: 600, width: 52 }}>
                  {DIM_LABEL[d.dimension]}
                </Typography>
                <Typography sx={{ color: synapse.cyan, fontWeight: 700, width: 34 }}>
                  {d.score.toFixed(1)}
                </Typography>
                <ConfidenceBadge confidence={d.confidence} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Investor lens — the three VC metrics, when the live pipeline scored them. */}
      {founder.vc_metrics.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="overline"
            sx={{ color: synapse.violet, letterSpacing: 1.5, display: 'block', mb: 1 }}
          >
            Investor lens
          </Typography>
          {founder.vc_metrics.map((m) => (
            <Box key={m.metric} sx={{ mb: 1.6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.4, flexWrap: 'wrap' }}>
                <Typography sx={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '0.92rem' }}>
                  {METRIC_LABEL[m.metric] ?? m.metric}
                </Typography>
                <Typography sx={{ color: synapse.cyan, fontWeight: 700 }}>{m.score.toFixed(1)}</Typography>
                <ConfidenceBadge confidence={m.confidence} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={m.score * 10}
                sx={{
                  height: 5,
                  borderRadius: 2,
                  mb: 0.6,
                  backgroundColor: 'rgba(148,163,184,0.15)',
                  '& .MuiLinearProgress-bar': { backgroundColor: synapse.violet },
                }}
              />
              {m.rationale && (
                <Typography variant="body2" sx={{ color: synapse.textDim, lineHeight: 1.55 }}>
                  {m.rationale}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Pros / Cons — deterministically derived from the scorecard + vc_metrics
          above (backend _build_pros_cons), not a separate AI call. */}
      {((founder.pros_cons?.pros?.length ?? 0) > 0 || (founder.pros_cons?.cons?.length ?? 0) > 0) && (
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="overline"
            sx={{ color: synapse.violet, letterSpacing: 1.5, display: 'block', mb: 1 }}
          >
            Pros &amp; Cons
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
              {(founder.pros_cons.pros ?? []).map((p, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{ color: '#cbd5e1', lineHeight: 1.6, mb: 0.5, display: 'flex', gap: 0.8 }}
                >
                  <span style={{ color: '#4ade80' }}>+</span> {p}
                </Typography>
              ))}
            </Box>
            <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
              {(founder.pros_cons.cons ?? []).map((c, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{ color: '#cbd5e1', lineHeight: 1.6, mb: 0.5, display: 'flex', gap: 0.8 }}
                >
                  <span style={{ color: synapse.amber }}>−</span> {c}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
