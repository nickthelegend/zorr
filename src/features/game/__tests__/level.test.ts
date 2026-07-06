import { levelForXp } from '../level'

describe('levelForXp', () => {
  it('is level 1 at 0 xp with 250 to go', () => {
    expect(levelForXp(0)).toEqual({ level: 1, into: 0, need: 250 })
  })

  it('levels up at rising thresholds', () => {
    expect(levelForXp(249).level).toBe(1)
    expect(levelForXp(250).level).toBe(2)
    expect(levelForXp(250 + 500 - 1).level).toBe(2)
    expect(levelForXp(250 + 500).level).toBe(3)
  })

  it('keeps 0 ≤ into < need at every xp', () => {
    for (const xp of [0, 100, 250, 500, 1234, 9999, 50000]) {
      const { into, need } = levelForXp(xp)
      expect(into).toBeGreaterThanOrEqual(0)
      expect(into).toBeLessThan(need)
    }
  })
})
