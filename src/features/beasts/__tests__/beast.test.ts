import { effectiveness, ELEMENT_CHART, ELEMENTS } from '../element'
import { generateBeast } from '../beast'

describe('element chart', () => {
  it('matches the ported AlgoQuest values', () => {
    expect(effectiveness('fire', 'earth')).toBe(2.0)
    expect(effectiveness('fire', 'water')).toBe(0.5)
    expect(effectiveness('water', 'fire')).toBe(2.0)
    expect(effectiveness('light', 'dark')).toBe(2.0)
    expect(effectiveness('dark', 'light')).toBe(2.0)
    expect(effectiveness('fire', 'light')).toBe(1.0) // neutral
  })

  it('defines every matchup for every element', () => {
    for (const a of ELEMENTS) {
      for (const b of ELEMENTS) {
        expect(typeof ELEMENT_CHART[a][b]).toBe('number')
      }
    }
  })
})

describe('generateBeast', () => {
  it('is deterministic — same seed yields an identical Guardian', () => {
    expect(generateBeast('alpha')).toEqual(generateBeast('alpha'))
  })

  it('produces different Guardians for different seeds', () => {
    const names = new Set(Array.from({ length: 20 }, (_, i) => generateBeast(`seed-${i}`).name))
    expect(names.size).toBeGreaterThan(1)
  })

  it('has a valid, well-formed shape', () => {
    for (let i = 0; i < 30; i++) {
      const b = generateBeast(`beast-${i}`)
      expect(ELEMENTS).toContain(b.element)
      expect(['Common', 'Rare', 'Epic', 'Legendary']).toContain(b.rarity)
      // AlgoQuest rule: health is a stat ×4.
      expect(b.maxHealth % 4).toBe(0)
      expect(b.maxEnergy).toBe(100)
      // 4 chosen abilities + the universal Energy Focus.
      expect(b.abilities).toHaveLength(5)
      expect(b.abilities[b.abilities.length - 1].id).toBe('energy_focus')
      expect(b.abilities.some((a) => a.kind === 'attack')).toBe(true)
      for (const s of [b.stats.attack, b.stats.defense, b.stats.speed, b.stats.magic]) {
        expect(s).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('scales stats up with level', () => {
    const l1 = generateBeast('grow', 1)
    const l5 = generateBeast('grow', 5)
    expect(l5.stats.attack).toBeGreaterThan(l1.stats.attack)
    expect(l5.maxHealth).toBeGreaterThan(l1.maxHealth)
    expect(l5.element).toBe(l1.element) // identity is stable across levels
  })
})
