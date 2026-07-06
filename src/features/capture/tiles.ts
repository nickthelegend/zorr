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
