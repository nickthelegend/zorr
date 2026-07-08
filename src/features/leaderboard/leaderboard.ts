// Weekly territory ranking — REAL players only. Every row is a device that
// reported its live game stats to the relay (POST /stats); your row is merged
// from local state so it's correct even before the next sync.
export type Runner = {
  owner?: string
  name: string
  color: string
  km2: number
  you?: boolean
}

/**
 * Merge your live local row with the relay's player list (deduped by owner —
 * the relay copy of you is replaced by fresher local numbers) and rank by km².
 */
export function rankBoard(you: Runner & { owner?: string }, others: Runner[]): Runner[] {
  const rest = others.filter((o) => !you.owner || o.owner !== you.owner)
  return [...rest, { ...you, you: true }].sort((a, b) => b.km2 - a.km2)
}
