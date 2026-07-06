// ~55m square territory tiles on a fixed lat/lng grid.
export const TILE_DEG = 0.0005

export type LatLng = { latitude: number; longitude: number }

export function tileKey(lat: number, lng: number) {
  return `${Math.floor(lat / TILE_DEG)}_${Math.floor(lng / TILE_DEG)}`
}

/** Four corners of a tile, for a react-native-maps Polygon. */
export function tilePolygon(key: string): LatLng[] {
  const [y, x] = key.split('_').map(Number)
  const latMin = y * TILE_DEG
  const lngMin = x * TILE_DEG
  const latMax = latMin + TILE_DEG
  const lngMax = lngMin + TILE_DEG
  return [
    { latitude: latMin, longitude: lngMin },
    { latitude: latMax, longitude: lngMin },
    { latitude: latMax, longitude: lngMax },
    { latitude: latMin, longitude: lngMax },
  ]
}

/** Grid of tile keys within `radius` tiles of the tile containing (lat,lng). */
export function tilesAround(lat: number, lng: number, radius = 4): string[] {
  const cy = Math.floor(lat / TILE_DEG)
  const cx = Math.floor(lng / TILE_DEG)
  const keys: string[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      keys.push(`${cy + dy}_${cx + dx}`)
    }
  }
  return keys
}

/**
 * Smooth outline enclosing a set of tiles (convex hull of their corners), so
 * captured land renders as one filled region instead of a grid of squares.
 * Returns [] for fewer than 3 tiles (fall back to drawing the tiles).
 */
export function territoryOutline(keys: string[]): LatLng[] {
  if (keys.length < 3) return []
  const pts: { x: number; y: number }[] = []
  for (const key of keys) {
    for (const c of tilePolygon(key)) pts.push({ x: c.longitude, y: c.latitude })
  }
  pts.sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: { x: number; y: number }[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: { x: number; y: number }[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper).map((p) => ({ latitude: p.y, longitude: p.x }))
}
