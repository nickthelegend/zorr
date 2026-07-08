// Curate the Genesis 48: 8 beasts per element (balanced board), distinct names
// within an element, natural VRF-style rarity spread. Writes out/genesis.json —
// the canonical list the mint + relayer + art all read from.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ELEMENTS, generateBeast } from './beast-traits.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const PER_ELEMENT = 8
// A deliberate rarity chase per element (curated drop): up to 1 Legendary,
// 2 Epic, 2 Rare, rest Common. Earliest matching seed wins each slot.
const QUOTA = { Legendary: 1, Epic: 2, Rare: 2, Common: 3 }

// Wide scan: collect candidates per element, keeping earliest-seen distinct names.
const candidates = Object.fromEntries(ELEMENTS.map((e) => [e, []]))
const namesByEl = Object.fromEntries(ELEMENTS.map((e) => [e, new Set()]))
for (let i = 0; i < 40000; i++) {
  const seed = `zorr-genesis-${String(i).padStart(4, '0')}`
  const b = generateBeast(seed)
  if (namesByEl[b.element].has(b.name)) continue
  namesByEl[b.element].add(b.name)
  candidates[b.element].push({ seed, ...b })
}

const buckets = {}
for (const e of ELEMENTS) {
  const pool = candidates[e]
  const pick = []
  const need = { ...QUOTA }
  // First pass: satisfy the rarity quota from earliest seeds.
  for (const b of pool) {
    if (pick.length >= PER_ELEMENT) break
    if ((need[b.rarity] ?? 0) > 0) {
      pick.push(b)
      need[b.rarity]--
    }
  }
  // Backfill any shortfall (rarity that didn't exist in the pool) with Commons.
  for (const b of pool) {
    if (pick.length >= PER_ELEMENT) break
    if (!pick.includes(b)) pick.push(b)
  }
  buckets[e] = pick.map((b) => ({
    seed: b.seed,
    name: b.name,
    element: b.element,
    rarity: b.rarity,
    power: b.power,
    maxHealth: b.maxHealth,
    stats: b.stats,
  }))
}

// Interleave elements so the collection order feels varied, then reindex.
const beasts = []
for (let k = 0; k < PER_ELEMENT; k++) for (const e of ELEMENTS) beasts.push(buckets[e][k])
beasts.forEach((b, n) => (b.id = n))

const rarityCount = beasts.reduce((m, b) => ((m[b.rarity] = (m[b.rarity] || 0) + 1), m), {})
const elementCount = beasts.reduce((m, b) => ((m[b.element] = (m[b.element] || 0) + 1), m), {})

fs.mkdirSync(path.join(here, '..', 'out'), { recursive: true })
fs.writeFileSync(path.join(here, '..', 'out', 'genesis.json'), JSON.stringify(beasts, null, 2))

console.log(`Curated ${beasts.length} Zorr Beasts`)
console.log('Elements:', elementCount)
console.log('Rarity:  ', rarityCount)
console.log(
  'Legendaries:',
  beasts.filter((b) => b.rarity === 'Legendary').map((b) => `${b.name} (${b.element})`).join(', ') || 'none',
)
console.log('→ out/genesis.json')
