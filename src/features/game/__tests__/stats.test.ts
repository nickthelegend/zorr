import {
  duelCount,
  EMPTY_STATS,
  formatKm,
  formatWinRate,
  hydrateStats,
  nextRank,
  rankForLevel,
  RANKS,
  recordDuel,
  recordRun,
  recordSummon,
  winRate,
} from '../stats'

describe('lifetime stats', () => {
  it('records runs and tracks the longest', () => {
    let s = recordRun(EMPTY_STATS, 2.4)
    s = recordRun(s, 5.1)
    s = recordRun(s, 1.0)
    expect(s.runs).toBe(3)
    expect(s.distanceKm).toBeCloseTo(8.5)
    expect(s.longestRunKm).toBeCloseTo(5.1)
  })

  it('never records negative distance', () => {
    const s = recordRun(EMPTY_STATS, -3)
    expect(s.distanceKm).toBe(0)
    expect(s.runs).toBe(1)
  })

  it('records duels and computes win rate', () => {
    let s = recordDuel(EMPTY_STATS, true)
    s = recordDuel(s, true)
    s = recordDuel(s, false)
    expect(s.duelsWon).toBe(2)
    expect(s.duelsLost).toBe(1)
    expect(duelCount(s)).toBe(3)
    expect(winRate(s)).toBeCloseTo(2 / 3)
    expect(formatWinRate(s)).toBe('67%')
  })

  it('win rate is null (— formatted) before the first duel', () => {
    expect(winRate(EMPTY_STATS)).toBeNull()
    expect(formatWinRate(EMPTY_STATS)).toBe('—')
  })

  it('records summons', () => {
    expect(recordSummon(recordSummon(EMPTY_STATS)).summons).toBe(2)
  })

  it('is immutable — inputs are never mutated', () => {
    const before = { ...EMPTY_STATS }
    recordRun(EMPTY_STATS, 9)
    recordDuel(EMPTY_STATS, true)
    expect(EMPTY_STATS).toEqual(before)
  })

  it('hydrates partial or missing persisted blobs', () => {
    expect(hydrateStats(null)).toEqual(EMPTY_STATS)
    expect(hydrateStats({ runs: 4 })).toEqual({ ...EMPTY_STATS, runs: 4 })
  })

  it('formats km at sensible precision', () => {
    expect(formatKm(0.42)).toBe('0.42')
    expect(formatKm(12.34)).toBe('12.3')
    expect(formatKm(250.7)).toBe('251')
  })
})

describe('rank ladder', () => {
  it('starts at DRIFTER and ends at SOVEREIGN', () => {
    expect(rankForLevel(1).title).toBe('DRIFTER')
    expect(rankForLevel(99).title).toBe('SOVEREIGN')
  })

  it('promotes exactly at thresholds', () => {
    expect(rankForLevel(2).title).toBe('DRIFTER')
    expect(rankForLevel(3).title).toBe('SCOUT')
    expect(rankForLevel(11).title).toBe('CARTOGRAPHER')
    expect(rankForLevel(12).title).toBe('WARDEN')
  })

  it('thresholds strictly ascend', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minLevel).toBeGreaterThan(RANKS[i - 1].minLevel)
    }
  })

  it('nextRank points at the next rung and null at the top', () => {
    expect(nextRank(1)?.title).toBe('SCOUT')
    expect(nextRank(12)?.title).toBe('OVERSEER')
    expect(nextRank(25)).toBeNull()
  })
})
