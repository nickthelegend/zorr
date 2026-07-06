import { useCallback, useEffect, useRef, useState } from 'react'

import { tileKey, TILE_DEG } from '../capture/tiles'

export type LatLng = { latitude: number; longitude: number }

// Approx area of one ~TILE_DEG square tile in km² (lat-dependent; good enough for display).
export function tileAreaKm2(lat: number) {
  const mPerDegLat = 111_320
  const latM = TILE_DEG * mPerDegLat
  const lngM = TILE_DEG * mPerDegLat * Math.cos((lat * Math.PI) / 180)
  return (latM * lngM) / 1_000_000
}

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = `${m}`.padStart(2, '0')
  const ss = `${s}`.padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatPace(distanceKm: number, durationSec: number) {
  if (distanceKm < 0.01) return '—'
  const paceSecPerKm = durationSec / distanceKm
  const m = Math.floor(paceSecPerKm / 60)
  const s = Math.floor(paceSecPerKm % 60)
  return `${m}:${`${s}`.padStart(2, '0')}`
}

export type RunSummary = {
  path: LatLng[]
  distanceKm: number
  durationSec: number
  tiles: string[]
  areaKm2: number
}

/**
 * Manages a run: accumulates the GPS path + distance, ticks the duration, and
 * captures tiles the runner passes through. `newTiles` fires when a fresh tile
 * is claimed so the screen can push it to the game store / on-chain.
 */
export function useRunSession(opts: { onCapture?: (key: string) => void }) {
  const [running, setRunning] = useState(false)
  const [path, setPath] = useState<LatLng[]>([])
  const [distanceKm, setDistanceKm] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [runTiles, setRunTiles] = useState<Set<string>>(new Set())

  const startedAt = useRef(0)
  const lastPoint = useRef<LatLng | null>(null)
  const areaAccKm2 = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setDurationSec((Date.now() - startedAt.current) / 1000)
    }, 500)
    return () => clearInterval(id)
  }, [running])

  const start = useCallback(() => {
    setPath([])
    setDistanceKm(0)
    setDurationSec(0)
    setRunTiles(new Set())
    lastPoint.current = null
    areaAccKm2.current = 0
    startedAt.current = Date.now()
    setRunning(true)
  }, [])

  const stop = useCallback((): RunSummary => {
    setRunning(false)
    const summary: RunSummary = {
      path,
      distanceKm,
      durationSec,
      tiles: [...runTiles],
      areaKm2: areaAccKm2.current,
    }
    return summary
  }, [path, distanceKm, durationSec, runTiles])

  // Feed each GPS fix here while running; `canCapture` reflects the anti-cheat gate.
  const onFix = useCallback(
    (p: LatLng & { lat?: number }, canCapture: boolean, alreadyOwned: (k: string) => boolean) => {
      if (!running) return
      const point: LatLng = { latitude: p.latitude, longitude: p.longitude }
      const prev = lastPoint.current
      if (prev) setDistanceKm((d) => d + haversineKm(prev, point))
      lastPoint.current = point
      setPath((pts) => (pts.length > 400 ? [...pts.slice(-400), point] : [...pts, point]))

      if (canCapture) {
        const key = tileKey(point.latitude, point.longitude)
        if (!alreadyOwned(key) && !runTiles.has(key)) {
          setRunTiles((prevSet) => new Set(prevSet).add(key))
          areaAccKm2.current += tileAreaKm2(point.latitude)
          opts.onCapture?.(key)
        }
      }
    },
    [running, runTiles, opts],
  )

  const areaKm2 = areaAccKm2.current

  return { running, path, distanceKm, durationSec, runTiles, areaKm2, start, stop, onFix }
}
