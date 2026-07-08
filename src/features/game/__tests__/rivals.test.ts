import { TILE_DEG, tileKey } from '../../capture/tiles'
import { EMPIRE_DEG, empireAt, empiresAround, RIVAL_CLANS, rivalForTile } from '../rivals'

describe('rival empires', () => {
  const LAT = 17.4239
  const LNG = 78.4738

  it('is deterministic — same area yields identical empires', () => {
    const a = empiresAround(LAT, LNG, 2)
    const b = empiresAround(LAT, LNG, 2)
    expect(a).toEqual(b)
  })

  it('produces organic closed outlines (12 vertices) owned by roster clans', () => {
    const empires = empiresAround(LAT, LNG, 2)
    expect(empires.length).toBeGreaterThan(3) // ~55% of a 5×5 cell grid
    for (const e of empires) {
      expect(e.coords).toHaveLength(12)
      expect(RIVAL_CLANS).toContainEqual(e.clan)
      // Vertices stay within the seeded radius band around the center.
      for (const c of e.coords) {
        const d = Math.hypot(c.latitude - e.center.latitude, c.longitude - e.center.longitude)
        expect(d).toBeLessThanOrEqual(EMPIRE_DEG * 0.52 + 1e-12)
        expect(d).toBeGreaterThanOrEqual(EMPIRE_DEG * 0.52 * 0.55 - 1e-12)
      }
    }
  })

  it('empireAt matches the rendered geometry (center is inside)', () => {
    const empires = empiresAround(LAT, LNG, 2)
    const e = empires[0]
    const hit = empireAt(e.center.latitude, e.center.longitude)
    expect(hit?.id).toBe(e.id)
    // A point many cells away cannot resolve to this same empire.
    const far = empireAt(e.center.latitude + EMPIRE_DEG * 10.5, e.center.longitude + EMPIRE_DEG * 10.5)
    expect(far?.id).not.toBe(e.id)
  })

  it('rivalForTile derives from the same blobs the map renders', () => {
    const empires = empiresAround(LAT, LNG, 2)
    const e = empires[0]
    const key = tileKey(e.center.latitude, e.center.longitude)
    expect(rivalForTile(key)?.name).toBe(e.clan.name)
  })

  it('leaves meaningful neutral ground between empires', () => {
    let held = 0
    const n = 40
    for (let i = 0; i < n; i++) {
      const key = tileKey(LAT + i * TILE_DEG * 3, LNG + i * TILE_DEG * 2)
      if (rivalForTile(key)) held++
    }
    expect(held).toBeGreaterThan(0) // some ground is contested…
    expect(held).toBeLessThan(n) // …and some is free to claim
  })

  it('rejects malformed tile keys', () => {
    expect(rivalForTile('not-a-key')).toBeNull()
  })
})
