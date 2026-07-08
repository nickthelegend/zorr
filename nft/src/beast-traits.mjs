// JS port of the app's seed→traits algorithm (src/features/battle/rng.ts +
// src/features/beasts/beast.ts). The genesis NFTs bake the SEED as their key
// attribute, and the app re-derives battle stats from that seed with the exact
// same code — so there is ONE source of truth and nothing is mocked. This port
// only needs to match element/rarity/name/stats for the metadata + art prompt;
// a parity test (beast-traits.test.mjs) pins it to the TS output.

// ---- rng (mulberry32 + FNV-1a), identical to src/features/battle/rng.ts ----
export function hashSeed(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function draw(seed, ...tags) {
  return mulberry32(hashSeed(`${seed}:${tags.join(':')}`))()
}

export function drawInt(seed, min, max, ...tags) {
  if (max <= min) return min
  return min + Math.floor(draw(seed, ...tags) * (max - min + 1))
}

// ---- beast, identical to src/features/beasts/beast.ts -----------------------
export const ELEMENTS = ['fire', 'water', 'earth', 'wind', 'light', 'dark']

export const ELEMENT_META = {
  fire: { label: 'Ember', color: '#F43F5E', glyph: '🔥' },
  water: { label: 'Tidal', color: '#38BDF8', glyph: '🌊' },
  earth: { label: 'Terra', color: '#A3E635', glyph: '⛰️' },
  wind: { label: 'Gale', color: '#22D3A6', glyph: '🌪️' },
  light: { label: 'Lumen', color: '#FBBF24', glyph: '✨' },
  dark: { label: 'Umbra', color: '#7C3AED', glyph: '🌑' },
}

const ADJECTIVES = ['Blazing', 'Frost', 'Iron', 'Storm', 'Radiant', 'Shadow', 'Ancient', 'Feral', 'Astral', 'Molten']
const NOUNS = {
  fire: ['Salamander', 'Phoenix', 'Drake'],
  water: ['Leviathan', 'Serpent', 'Kraken'],
  earth: ['Golem', 'Tortoise', 'Behemoth'],
  wind: ['Griffin', 'Falcon', 'Wyvern'],
  light: ['Seraph', 'Unicorn', 'Lumen'],
  dark: ['Wraith', 'Panther', 'Reaper'],
}

const RARITY_SPAN = { Common: 30, Rare: 42, Epic: 52, Legendary: 62 }

export function rarityFor(seed) {
  const r = draw(seed, 'rarity')
  if (r < 0.6) return 'Common'
  if (r < 0.85) return 'Rare'
  if (r < 0.97) return 'Epic'
  return 'Legendary'
}

export function generateBeast(seed, level = 1) {
  const element = ELEMENTS[drawInt(seed, 0, ELEMENTS.length - 1, 'element')]
  const rarity = rarityFor(seed)
  const span = RARITY_SPAN[rarity]
  const roll = (tag) => 40 + drawInt(seed, 0, span, tag)
  const lvlBonus = (level - 1) * 3
  const stats = {
    attack: roll('atk') + lvlBonus,
    defense: roll('def') + lvlBonus,
    speed: roll('spd') + lvlBonus,
    magic: roll('mag') + lvlBonus,
  }
  const healthStat = roll('hp') + lvlBonus
  const maxHealth = healthStat * 4
  const nouns = NOUNS[element]
  const name = `${ADJECTIVES[drawInt(seed, 0, ADJECTIVES.length - 1, 'adj')]} ${nouns[drawInt(seed, 0, nouns.length - 1, 'noun')]}`
  return {
    seed,
    name,
    element,
    rarity,
    level,
    maxHealth,
    maxEnergy: 100,
    stats,
    power: Math.round((stats.attack + stats.defense + stats.speed + stats.magic) / 4),
    glyph: ELEMENT_META[element].glyph,
  }
}
