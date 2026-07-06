import { RIVAL_CLANS, rivalForTile } from '../rivals'

describe('rivals', () => {
  it('is deterministic per tile key', () => {
    expect(rivalForTile('12_34')).toEqual(rivalForTile('12_34'))
    expect(rivalForTile('99_-7')).toEqual(rivalForTile('99_-7'))
  })

  it('holds a plausible share (~1/3) of tiles', () => {
    const N = 3000
    let owned = 0
    for (let i = 0; i < N; i++) if (rivalForTile(`${i}_${(i * 7) % 500}`)) owned++
    const frac = owned / N
    expect(frac).toBeGreaterThan(0.25)
    expect(frac).toBeLessThan(0.45)
  })

  it('only ever returns a clan from the roster', () => {
    for (let i = 0; i < 200; i++) {
      const r = rivalForTile(`${i}_${i}`)
      if (r) expect(RIVAL_CLANS).toContainEqual(r)
    }
  })

  it('distributes across all clans', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const r = rivalForTile(`${i}_${i * 3}`)
      if (r) seen.add(r.name)
    }
    expect(seen.size).toBe(RIVAL_CLANS.length)
  })
})
