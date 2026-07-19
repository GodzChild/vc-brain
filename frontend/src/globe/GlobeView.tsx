import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Color, MeshPhongMaterial } from 'three'
import type { GlobePin } from '../types'
import { confidenceColor } from '../theme'

interface Props {
  pins: GlobePin[]
  focusedFounderId: string | null
  hoveredFounderId: string | null
  onPinHover: (id: string | null) => void
  onPinClick: (id: string) => void
}

interface CountryFeature {
  properties: { ADMIN?: string; name?: string }
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/**
 * A real-earth globe: deep-blue oceans, green land drawn from bundled country
 * polygons (so borders show and no CDN is touched), and candidate countries
 * highlighted — the focused one brightest. The camera eases to the focused
 * candidate's pin whenever the selection changes.
 */
export default function GlobeView({
  pins,
  focusedFounderId,
  hoveredFounderId,
  onPinHover,
  onPinClick,
}: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const { w, h } = useWindowSize()
  const [countries, setCountries] = useState<CountryFeature[]>([])

  useEffect(() => {
    fetch('/countries.geojson')
      .then((r) => r.json())
      .then((geo) => setCountries(geo.features as CountryFeature[]))
      .catch(() => setCountries([]))
  }, [])

  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color('#0f2a4a'), // ocean
        emissive: new Color('#071426'),
        shininess: 12,
      }),
    [],
  )

  const candidateCountries = useMemo(() => new Set(pins.map((p) => p.country)), [pins])
  const focusedCountry = useMemo(
    () => pins.find((p) => p.founder_id === focusedFounderId)?.country ?? null,
    [pins, focusedFounderId],
  )

  const countryName = (f: object) =>
    (f as CountryFeature).properties.ADMIN ?? (f as CountryFeature).properties.name ?? ''

  // While there are no pins yet (the search is still running) the globe just
  // spins. As soon as pins land, rotation stops and the camera eases to the
  // focused candidate — so loading flows seamlessly into the result.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const controls = g.controls()
    if (pins.length === 0) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 1.6
      controls.enableZoom = false
      return
    }
    controls.autoRotate = false
    controls.enableZoom = true
    const pin = pins.find((p) => p.founder_id === focusedFounderId) ?? pins[0]
    if (pin) g.pointOfView({ lat: pin.lat, lng: pin.lng, altitude: 1.6 }, 1400)
  }, [focusedFounderId, pins])

  const ringsData = useMemo(
    () =>
      pins
        .filter((p) => p.founder_id === focusedFounderId || p.founder_id === hoveredFounderId)
        .map((p) => ({ ...p })),
    [pins, focusedFounderId, hoveredFounderId],
  )

  return (
    <Globe
      ref={globeRef}
      width={w}
      height={h}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial}
      showAtmosphere
      atmosphereColor="#22d3ee"
      atmosphereAltitude={0.2}
      polygonsData={countries}
      polygonCapColor={(f: object) => {
        const name = countryName(f)
        if (name === focusedCountry) return 'rgba(45, 212, 191, 0.92)'
        if (candidateCountries.has(name)) return 'rgba(52, 211, 153, 0.6)'
        return 'rgba(30, 90, 66, 0.85)'
      }}
      polygonSideColor={() => 'rgba(6, 20, 38, 0.9)'}
      polygonStrokeColor={(f: object) =>
        candidateCountries.has(countryName(f)) ? '#a7f3d0' : 'rgba(148, 197, 214, 0.35)'
      }
      polygonAltitude={(f: object) => {
        const name = countryName(f)
        if (name === focusedCountry) return 0.07
        if (candidateCountries.has(name)) return 0.035
        return 0.01
      }}
      pointsData={pins}
      pointLat="lat"
      pointLng="lng"
      pointColor={(p: object) => confidenceColor[(p as GlobePin).confidence]}
      pointAltitude={(p: object) => 0.05 + ((p as GlobePin).score / 100) * 0.12}
      pointRadius={(p: object) => {
        const pin = p as GlobePin
        const base = 0.32 + (pin.score / 100) * 0.4
        return pin.founder_id === focusedFounderId || pin.founder_id === hoveredFounderId
          ? base * 1.5
          : base
      }}
      pointsMerge={false}
      onPointHover={(p: object | null) => onPinHover(p ? (p as GlobePin).founder_id : null)}
      onPointClick={(p: object) => onPinClick((p as GlobePin).founder_id)}
      labelsData={pins}
      labelLat="lat"
      labelLng="lng"
      labelText={(p: object) => `#${(p as GlobePin).rank} ${(p as GlobePin).name}`}
      labelSize={0.7}
      labelDotRadius={0}
      labelColor={(p: object) =>
        (p as GlobePin).founder_id === focusedFounderId
          ? '#ffffff'
          : 'rgba(226, 232, 240, 0.7)'
      }
      labelAltitude={(p: object) => 0.06 + ((p as GlobePin).score / 100) * 0.12}
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      ringColor={(p: object) => () => confidenceColor[(p as GlobePin).confidence]}
      ringMaxRadius={4}
      ringPropagationSpeed={2}
      ringRepeatPeriod={800}
    />
  )
}
