// Lifetime game metrics — pure, persisted by the game store, unit-tested.
//
// Everything a player has done across sessions: runs logged, ground covered,
// duels fought. Rendered on Home ("mission log") and Profile, and used for
// achievement gates and the rank ladder.

export type LifetimeStats = {
  runs: number
  distanceKm: number
  longestRunKm: number
  duelsWon: number
  duelsLost: number
  summons: number
}

export const EMPTY_STATS: LifetimeStats = {
  runs: 0,
  distanceKm: 0,
  longestRunKm: 0,
  duelsWon: 0,
  duelsLost: 0,
  summons: 0,
}

/** Merge a persisted blob (possibly partial / from an older version) safely. */
export function hydrateStats(raw: Partial<LifetimeStats> | undefined | null): LifetimeStats {
  return { ...EMPTY_STATS, ...(raw ?? {}) }
}

export function recordRun(s: LifetimeStats, distanceKm: number): LifetimeStats {
  const d = Math.max(0, distanceKm)
  return {
    ...s,
    runs: s.runs + 1,
    distanceKm: s.distanceKm + d,
    longestRunKm: Math.max(s.longestRunKm, d),
  }
}

export function recordDuel(s: LifetimeStats, won: boolean): LifetimeStats {
  return won ? { ...s, duelsWon: s.duelsWon + 1 } : { ...s, duelsLost: s.duelsLost + 1 }
}

export function recordSummon(s: LifetimeStats): LifetimeStats {
  return { ...s, summons: s.summons + 1 }
}

export function duelCount(s: LifetimeStats): number {
  return s.duelsWon + s.duelsLost
}

/** Win rate in [0,1], or null before the first duel. */
export function winRate(s: LifetimeStats): number | null {
  const n = duelCount(s)
  return n === 0 ? null : s.duelsWon / n
}

export function formatWinRate(s: LifetimeStats): string {
  const r = winRate(s)
  return r === null ? '—' : `${Math.round(r * 100)}%`
}

export function formatKm(km: number): string {
  if (km >= 100) return `${Math.round(km)}`
  return km >= 10 ? km.toFixed(1) : km.toFixed(2)
}

// ---- Rank ladder ------------------------------------------------------------
// Cartography-flavored titles: every explorer starts as a Drifter and ends as
// a Sovereign of the map. Thresholds are levels (levelForXp).

export type Rank = { title: string; color: string; minLevel: number }

export const RANKS: Rank[] = [
  { title: 'DRIFTER', color: '#94A3B8', minLevel: 1 },
  { title: 'SCOUT', color: '#22D3A6', minLevel: 3 },
  { title: 'PATHFINDER', color: '#38BDF8', minLevel: 5 },
  { title: 'CARTOGRAPHER', color: '#7C3AED', minLevel: 8 },
  { title: 'WARDEN', color: '#F43F5E', minLevel: 12 },
  { title: 'OVERSEER', color: '#FB923C', minLevel: 17 },
  { title: 'SOVEREIGN', color: '#FBBF24', minLevel: 25 },
]

export function rankForLevel(level: number): Rank {
  let current = RANKS[0]
  for (const r of RANKS) if (level >= r.minLevel) current = r
  return current
}

/** The next rank to chase, or null at the top of the ladder. */
export function nextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null
}
