// Rival clans hold ~a third of the map. Ownership is a deterministic function of
// the tile key, so contested ground looks consistent wherever you run — and
// capturing a rival tile (running through it) flips it to your color.

export type Clan = { name: string; color: string }

export const RIVAL_CLANS: Clan[] = [
  { name: 'Crimson Pack', color: '#F43F5E' },
  { name: 'Amber Syndicate', color: '#FBBF24' },
  { name: 'Azure Guild', color: '#3B82F6' },
  { name: 'Rose Collective', color: '#EC4899' },
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** The clan holding a tile, or null if it's neutral/unclaimed. */
export function rivalForTile(key: string): Clan | null {
  const h = hash(key)
  if (h % 100 < 35) return RIVAL_CLANS[h % RIVAL_CLANS.length]
  return null
}
