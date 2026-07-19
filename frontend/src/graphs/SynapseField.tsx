import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d'
import type { ConceptMap, ConceptNode } from '../types'
import { synapse } from '../theme'
import type { QueryPhase } from '../store/useSynapseStore'

interface Props {
  map: ConceptMap
  phase: QueryPhase
}

interface GNode extends NodeObject {
  id: string
  label: string
  kind: ConceptNode['kind']
  matched: boolean
}
type GLink = LinkObject<GNode>

// Virtual seed space (not pixels) — the normalized 0..1 layout is projected
// into this box as the simulation's starting composition; zoomToFit then
// adapts it to the real viewport at engine-stop.
const SEED_W = 1000
const SEED_H = 640
const REVEAL_STEP_MS = 220

function linkEndId(end: GLink['source']): string {
  if (end == null) return ''
  return typeof end === 'object' ? String((end as GNode).id) : String(end)
}

/**
 * The Brain's knowledge graph — a force-directed layout (drag, pan, zoom)
 * in the vein of learn-anything.xyz, rendered on canvas via
 * react-force-graph-2d. Stays fully hidden until a search fires; matched
 * "primary" concepts then light up in sequence. Hovering a node highlights
 * its neighbors, but nothing is clickable — the graph is a reveal, not an
 * input.
 */
export default function SynapseField({ map, phase }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const didInitialFit = useRef(false)

  const nodeById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map])
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of map.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set())
      if (!m.has(e.target)) m.set(e.target, new Set())
      m.get(e.source)!.add(e.target)
      m.get(e.target)!.add(e.source)
    }
    return m
  }, [map])

  const isLit = useCallback(
    (id: string) => {
      const n = nodeById.get(id)
      return !!n && n.kind === 'primary' && n.matched && revealed.has(id)
    },
    [nodeById, revealed],
  )

  // Stagger the matched primaries' light-up over time (canvas has no CSS
  // transition-delay, so the reveal itself has to be time-driven).
  useEffect(() => {
    if (phase === 'idle') {
      setRevealed(new Set())
      return
    }
    const matched = map.nodes.filter((n) => n.kind === 'primary' && n.matched)
    const timers = matched.map((n, i) =>
      window.setTimeout(() => {
        setRevealed((prev) => new Set(prev).add(n.id))
      }, i * REVEAL_STEP_MS),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [phase, map])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const graphData = useMemo(() => {
    const nodes: GNode[] = map.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      matched: n.matched,
      x: n.x * SEED_W,
      y: n.y * SEED_H,
    }))
    const links: GLink[] = map.edges.map((e) => ({ source: e.source, target: e.target }))
    return { nodes, links }
  }, [map])

  // Loosen the default forces so the constellation breathes and settles near
  // the seed composition instead of collapsing to a tight ball.
  useEffect(() => {
    if (phase === 'idle') return
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength?.(-110)
    fg.d3Force('link')?.distance?.(65)
    fg.d3ReheatSimulation()
    didInitialFit.current = false
  }, [graphData, phase])

  const handleEngineStop = useCallback(() => {
    if (didInitialFit.current) return
    didInitialFit.current = true
    fgRef.current?.zoomToFit(600, 70)
  }, [])

  const handleNodeHover = useCallback((node: GNode | null) => {
    setHovered(node ? node.id : null)
  }, [])

  const nodeCanvasObject = useCallback(
    (node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const isPrimary = node.kind === 'primary'
      const lit = isLit(node.id)
      const neighborIds = neighbors.get(node.id)
      const emphasized = hovered === node.id || (hovered != null && (neighborIds?.has(hovered) ?? false))

      const radius = isPrimary ? (lit ? 7 : 5) : lit ? 5 : 3.2
      const glow = lit ? (isPrimary ? 16 : 11) : emphasized ? 8 : 0

      ctx.save()
      if (glow) {
        ctx.shadowColor = synapse.cyan
        ctx.shadowBlur = glow
      }
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      if (lit) {
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(1, synapse.cyan)
        ctx.fillStyle = grad
      } else if (emphasized) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)'
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'
      }
      ctx.fill()
      ctx.restore()

      const fontSize = (isPrimary ? 12.5 : 10.5) / globalScale
      ctx.font = `${isPrimary ? 600 : 500} ${fontSize}px "Space Grotesk", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const textColor = lit ? '#e2e8f0' : emphasized ? '#cbd5e1' : 'rgba(148, 163, 184, 0.55)'

      ctx.save()
      if (lit) {
        ctx.shadowColor = synapse.cyan
        ctx.shadowBlur = 8 / globalScale
      }
      ctx.fillStyle = textColor
      ctx.fillText(node.label, x, y + radius + 3 / globalScale)
      ctx.restore()
    },
    [isLit, neighbors, hovered],
  )

  const nodePointerAreaPaint = useCallback((node: GNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, 11, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  const linkColor = useCallback(
    (link: GLink) => {
      const s = linkEndId(link.source)
      const t = linkEndId(link.target)
      const bothLit = isLit(s) && isLit(t)
      const touchesHover = hovered != null && (s === hovered || t === hovered)
      if (bothLit) return 'rgba(34, 211, 238, 0.5)'
      if (touchesHover) return 'rgba(167, 139, 250, 0.45)'
      return 'rgba(34, 211, 238, 0.07)'
    },
    [isLit, hovered],
  )

  const linkWidth = useCallback(
    (link: GLink) => {
      const s = linkEndId(link.source)
      const t = linkEndId(link.target)
      if (isLit(s) && isLit(t)) return 1.4
      if (hovered != null && (s === hovered || t === hovered)) return 1.1
      return 0.6
    },
    [isLit, hovered],
  )

  const linkParticles = useCallback(
    (link: GLink) => {
      const s = linkEndId(link.source)
      const t = linkEndId(link.target)
      return isLit(s) && isLit(t) ? 2 : 0
    },
    [isLit],
  )

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {phase !== 'idle' && size.width > 0 && size.height > 0 && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={4}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkCurvature={0.18}
          linkDirectionalParticles={linkParticles}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => synapse.cyan}
          linkDirectionalParticleSpeed={0.006}
          cooldownTicks={90}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.35}
          onNodeHover={handleNodeHover}
          onEngineStop={handleEngineStop}
          enableNodeDrag={false}
          minZoom={0.5}
          maxZoom={6}
        />
      )}
    </div>
  )
}
