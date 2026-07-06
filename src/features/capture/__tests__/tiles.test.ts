import { TILE_DEG, territoryOutline, tileKey, tilePolygon, tilesAround } from '../tiles'

describe('tiles', () => {
  it('tileKey buckets same-cell coords together', () => {
    // Center of a tile so a small offset stays inside it.
    const lat = TILE_DEG * 100 + TILE_DEG * 0.5
    const lng = TILE_DEG * 200 + TILE_DEG * 0.5
    expect(tileKey(lat, lng)).toBe(tileKey(lat + TILE_DEG * 0.3, lng + TILE_DEG * 0.3))
    expect(tileKey(0, 0)).toBe('0_0')
  })

  it('tileKey changes when you cross a tile boundary', () => {
    expect(tileKey(0, 0)).not.toBe(tileKey(TILE_DEG * 1.5, 0))
  })

  it('tilePolygon returns 4 corners spanning exactly one tile', () => {
    const poly = tilePolygon('0_0')
    expect(poly).toHaveLength(4)
    expect(poly[0]).toEqual({ latitude: 0, longitude: 0 })
    expect(poly[2].latitude).toBeCloseTo(TILE_DEG)
    expect(poly[2].longitude).toBeCloseTo(TILE_DEG)
  })

  it('tilesAround returns a (2r+1)^2 grid of unique keys', () => {
    const keys = tilesAround(17.4239, 78.4738, 2)
    expect(keys).toHaveLength(25)
    expect(new Set(keys).size).toBe(25)
  })

  it('territoryOutline returns [] for fewer than 3 tiles', () => {
    expect(territoryOutline([])).toEqual([])
    expect(territoryOutline(['0_0'])).toEqual([])
  })

  it('territoryOutline returns a hull enclosing the tiles', () => {
    const hull = territoryOutline(['0_0', '0_1', '1_0', '1_1'])
    expect(hull.length).toBeGreaterThanOrEqual(4)
    const lats = hull.map((p) => p.latitude)
    const lngs = hull.map((p) => p.longitude)
    expect(Math.min(...lats)).toBeCloseTo(0)
    expect(Math.max(...lats)).toBeCloseTo(2 * TILE_DEG)
    expect(Math.min(...lngs)).toBeCloseTo(0)
    expect(Math.max(...lngs)).toBeCloseTo(2 * TILE_DEG)
  })
})
