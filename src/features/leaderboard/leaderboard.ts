// Weekly territory ranking. Rival runners are sample data; your row is real
// (your captured km² from the game store), inserted and ranked live.
export type Runner = { name: string; color: string; km2: number; you?: boolean }

const RIVAL_RUNNERS: Runner[] = [
  { name: 'NightStrider', color: '#F43F5E', km2: 9.12 },
  { name: 'Vanta', color: '#3B82F6', km2: 7.84 },
  { name: 'Kestrel', color: '#FBBF24', km2: 6.55 },
  { name: 'Orbit', color: '#22D3A6', km2: 5.98 },
  { name: 'Halcyon', color: '#EC4899', km2: 4.73 },
  { name: 'Rumble', color: '#7C3AED', km2: 3.9 },
  { name: 'Fenwick', color: '#3B82F6', km2: 3.12 },
  { name: 'Sable', color: '#F43F5E', km2: 2.44 },
  { name: 'Pixel', color: '#FBBF24', km2: 1.78 },
  { name: 'Dune', color: '#22D3A6', km2: 1.2 },
  { name: 'Echo', color: '#EC4899', km2: 0.64 },
  { name: 'Wisp', color: '#7C3AED', km2: 0.21 },
]

export function buildLeaderboard(you: { name: string; color: string; km2: number }): Runner[] {
  return [...RIVAL_RUNNERS, { ...you, you: true }].sort((a, b) => b.km2 - a.km2)
}
