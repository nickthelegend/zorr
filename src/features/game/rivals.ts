// Rival empires — INTVL-style organic territory regions, not tile boxes.
//
// The world is partitioned into coarse cells (~12 tiles wide). A deterministic
// draw decides whether a cell hosts an empire, which clan owns it, and the
// shape of its territory: an irregular 12-vertex blob (seeded radii) that
// renders as a thick colored border on the map. Gameplay reads the SAME
// geometry — a tile is rival-held iff its center falls inside a blob — so the
// steal bonus and scouting toasts always match what the player sees.

import { draw, drawInt } from '../battle/rng'
import { TILE_DEG, tileKey } from '../capture/tiles'

export type Clan = { name: string; color: string }

export const RIVAL_CLANS: Clan[] = [
  { name: 'Crimson Pack', color: '#F43F5E' },
  { name: 'Amber Syndicate', color: '#FBBF24' },
  { name: 'Azure Guild', color: '#3B82F6' },
  { name: 'Rose Collective', color: '#EC4899' },
  { name: 'Emerald Order', color: '#22C55E' },
  { name: 'Violet Court', color: '#A855F7' },
  { name: 'Solar Legion', color: '#FB923C' },
  { name: 'Cyan Circuit', color: '#22D3EE' },
]

export type LatLng = { latitude: number; longitude: number }

export type Empire = {
  id: string
  clan: Clan
  center: LatLng
  /** Organic closed outline (12 seeded vertices). */
  coords: LatLng[]
}

// One empire cell spans 8 tiles (~440 m at TILE_DEG = 0.0005°).
export const EMPIRE_DEG = TILE_DEG * 8
const OCCUPANCY = 0.55
const VERTICES = 12

const cellSeed = (cy: number, cx: number) => `empire:${cy}:${cx}`

/** Seeded per-vertex radii for a cell's blob (fractions of the max radius). */
function radii(seed: string): number[] {
  const out: number[] = []
  for (let i = 0; i < VERTICES; i++) out.push(0.55 + 0.45 * draw(seed, 'r', i))
  return out
}

function buildEmpire(cy: number, cx: number): Empire | null {
  const seed = cellSeed(cy, cx)
  if (draw(seed, 'occ') >= OCCUPANCY) return null
  const clan = RIVAL_CLANS[drawInt(seed, 0, RIVAL_CLANS.length - 1, 'clan')]
  const center: LatLng = {
    latitude: (cy + 0.5 + (draw(seed, 'jy') - 0.5) * 0.35) * EMPIRE_DEG,
    longitude: (cx + 0.5 + (draw(seed, 'jx') - 0.5) * 0.35) * EMPIRE_DEG,
  }
  const maxR = EMPIRE_DEG * 0.52
  const rs = radii(seed)
  const coords: LatLng[] = []
  for (let i = 0; i < VERTICES; i++) {
    const a = (i / VERTICES) * Math.PI * 2
    const r = maxR * rs[i]
    coords.push({ latitude: center.latitude + Math.sin(a) * r, longitude: center.longitude + Math.cos(a) * r })
  }
  return { id: seed, clan, center, coords }
}

/** All empires within `ring` cells of a location — the map's rival layer. */
export function empiresAround(lat: number, lng: number, ring = 2): Empire[] {
  const cy = Math.floor(lat / EMPIRE_DEG)
  const cx = Math.floor(lng / EMPIRE_DEG)
  const out: Empire[] = []
  for (let dy = -ring; dy <= ring; dy++) {
    for (let dx = -ring; dx <= ring; dx++) {
      const e = buildEmpire(cy + dy, cx + dx)
      if (e) out.push(e)
    }
  }
  return out
}

/** The empire covering a point, if any (same geometry the map renders). */
export function empireAt(lat: number, lng: number): Empire | null {
  const cy = Math.floor(lat / EMPIRE_DEG)
  const cx = Math.floor(lng / EMPIRE_DEG)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const e = buildEmpire(cy + dy, cx + dx)
      if (!e) continue
      const dLat = lat - e.center.latitude
      const dLng = lng - e.center.longitude
      const dist = Math.sqrt(dLat * dLat + dLng * dLng)
      const maxR = EMPIRE_DEG * 0.52
      if (dist > maxR) continue
      // Interpolate the blob radius at this bearing between adjacent vertices.
      const rs = radii(e.id)
      const ang = Math.atan2(dLat, dLng)
      const t = ((ang + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / VERTICES)
      const i0 = Math.floor(t) % VERTICES
      const i1 = (i0 + 1) % VERTICES
      const frac = t - Math.floor(t)
      const r = maxR * (rs[i0] * (1 - frac) + rs[i1] * frac)
      if (dist <= r) return e
    }
  }
  return null
}

/** The clan holding a tile, or null — derived from the empire blobs. */
export function rivalForTile(key: string): Clan | null {
  const [ty, tx] = key.split('_').map(Number)
  if (!Number.isFinite(ty) || !Number.isFinite(tx)) return null
  const lat = (ty + 0.5) * TILE_DEG
  const lng = (tx + 0.5) * TILE_DEG
  return empireAt(lat, lng)?.clan ?? null
}

/** Convenience for tests: the tile key of an empire's center. */
export function empireCenterTile(e: Empire): string {
  return tileKey(e.center.latitude, e.center.longitude)
}
