// Guardian (NFT monster) model + deterministic generation.
//
// Ported from AlgoQuest's beast shape (stats + health*4 + 4 abilities). A
// Guardian is fully determined by its seed string, so its "identity" travels as
// a tiny BEAST:<seed> message — the peer regenerates the exact same creature
// with no need to serialize stats or trust the sender.

import { draw, drawInt } from '../battle/rng'
import { ELEMENT_META, ELEMENTS, type Element } from './element'

export type MoveKind = 'attack' | 'heal' | 'energy' | 'guard'
export type StatusType = 'burn' | 'poison'

export type Ability = {
  id: string
  name: string
  kind: MoveKind
  element: Element
  power: number
  accuracy: number // 0..100
  energyCost: number
  description: string
  status?: { type: StatusType; chance: number; duration: number } // deterministic proc
}

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export type BeastStats = { attack: number; defense: number; speed: number; magic: number }

export type Beast = {
  seed: string
  name: string
  element: Element
  rarity: Rarity
  level: number
  maxHealth: number
  maxEnergy: number
  stats: BeastStats
  power: number // headline number for cards
  abilities: Ability[] // 4 chosen + Energy Focus
  glyph: string
}

// ---- Names ----------------------------------------------------------------
const ADJECTIVES = ['Blazing', 'Frost', 'Iron', 'Storm', 'Radiant', 'Shadow', 'Ancient', 'Feral', 'Astral', 'Molten']
const NOUNS: Record<Element, string[]> = {
  fire: ['Salamander', 'Phoenix', 'Drake'],
  water: ['Leviathan', 'Serpent', 'Kraken'],
  earth: ['Golem', 'Tortoise', 'Behemoth'],
  wind: ['Griffin', 'Falcon', 'Wyvern'],
  light: ['Seraph', 'Unicorn', 'Lumen'],
  dark: ['Wraith', 'Panther', 'Reaper'],
}

// ---- Ability catalogue ----------------------------------------------------
// Two attacks in the beast's own element (one heavy, may inflict a status), one
// off-element coverage attack, and one utility. Plus the universal Energy Focus.
const ATTACKS: Record<Element, { light: Omit<Ability, 'id'>; heavy: Omit<Ability, 'id'> }> = {
  fire: {
    light: { name: 'Ember Strike', kind: 'attack', element: 'fire', power: 55, accuracy: 95, energyCost: 15, description: 'A quick searing jab.' },
    heavy: { name: 'Inferno', kind: 'attack', element: 'fire', power: 82, accuracy: 80, energyCost: 35, description: 'Engulfs the foe — can burn.', status: { type: 'burn', chance: 0.4, duration: 3 } },
  },
  water: {
    light: { name: 'Aqua Jet', kind: 'attack', element: 'water', power: 55, accuracy: 100, energyCost: 15, description: 'A pressured, unerring stream.' },
    heavy: { name: 'Tidal Crash', kind: 'attack', element: 'water', power: 82, accuracy: 85, energyCost: 35, description: 'A crushing wave.' },
  },
  earth: {
    light: { name: 'Rock Throw', kind: 'attack', element: 'earth', power: 55, accuracy: 95, energyCost: 15, description: 'Hurls jagged stone.' },
    heavy: { name: 'Quake', kind: 'attack', element: 'earth', power: 85, accuracy: 80, energyCost: 38, description: 'Splits the ground open.' },
  },
  wind: {
    light: { name: 'Gust', kind: 'attack', element: 'wind', power: 52, accuracy: 100, energyCost: 14, description: 'A slicing draft.' },
    heavy: { name: 'Cyclone', kind: 'attack', element: 'wind', power: 80, accuracy: 85, energyCost: 34, description: 'A tearing vortex.' },
  },
  light: {
    light: { name: 'Flash', kind: 'attack', element: 'light', power: 55, accuracy: 95, energyCost: 15, description: 'A blinding lance.' },
    heavy: { name: 'Radiance', kind: 'attack', element: 'light', power: 82, accuracy: 85, energyCost: 35, description: 'Overwhelming brilliance.' },
  },
  dark: {
    light: { name: 'Shadow Claw', kind: 'attack', element: 'dark', power: 60, accuracy: 95, energyCost: 16, description: 'Rakes with dark energy.' },
    heavy: { name: 'Void Rip', kind: 'attack', element: 'dark', power: 85, accuracy: 80, energyCost: 38, description: 'Tears a rift — can poison.', status: { type: 'poison', chance: 0.4, duration: 3 } },
  },
}

const MEND: Omit<Ability, 'id'> = { name: 'Mend', kind: 'heal', element: 'light', power: 60, accuracy: 100, energyCost: 30, description: 'Knit wounds — restores health.' }
const GUARD: Omit<Ability, 'id'> = { name: 'Bulwark', kind: 'guard', element: 'earth', power: 0, accuracy: 100, energyCost: 20, description: 'Brace — halve the next hit taken.' }
const ENERGY_FOCUS: Ability = { id: 'energy_focus', name: 'Energy Focus', kind: 'energy', element: 'light', power: 45, accuracy: 100, energyCost: 0, description: 'Focus to restore 30–60 energy.' }

const RARITY_SPAN: Record<Rarity, number> = { Common: 30, Rare: 42, Epic: 52, Legendary: 62 }

function rarityFor(seed: string): Rarity {
  const r = draw(seed, 'rarity')
  if (r < 0.6) return 'Common'
  if (r < 0.85) return 'Rare'
  if (r < 0.97) return 'Epic'
  return 'Legendary'
}

/** Regenerate the exact Guardian for a seed. Deterministic and side-effect free. */
export function generateBeast(seed: string, level = 1): Beast {
  const element = ELEMENTS[drawInt(seed, 0, ELEMENTS.length - 1, 'element')]
  const rarity = rarityFor(seed)
  const span = RARITY_SPAN[rarity]
  const roll = (tag: string) => 40 + drawInt(seed, 0, span, tag)

  const lvlBonus = (level - 1) * 3
  const stats: BeastStats = {
    attack: roll('atk') + lvlBonus,
    defense: roll('def') + lvlBonus,
    speed: roll('spd') + lvlBonus,
    magic: roll('mag') + lvlBonus,
  }
  const healthStat = roll('hp') + lvlBonus
  const maxHealth = healthStat * 4

  const nouns = NOUNS[element]
  const name = `${ADJECTIVES[drawInt(seed, 0, ADJECTIVES.length - 1, 'adj')]} ${nouns[drawInt(seed, 0, nouns.length - 1, 'noun')]}`

  // Off-element coverage: the element this beast is strong against reads best,
  // but any distinct element works — pick deterministically.
  const coverageEl = ELEMENTS[(ELEMENTS.indexOf(element) + 1 + drawInt(seed, 0, 3, 'cov')) % ELEMENTS.length]
  const utility = draw(seed, 'util') < 0.5 ? MEND : GUARD

  const abilities: Ability[] = [
    { ...ATTACKS[element].light, id: `${seed}-a1` },
    { ...ATTACKS[element].heavy, id: `${seed}-a2` },
    { ...ATTACKS[coverageEl].light, id: `${seed}-a3` },
    { ...utility, id: `${seed}-a4` },
    ENERGY_FOCUS,
  ]

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
    abilities,
    glyph: ELEMENT_META[element].glyph,
  }
}

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#94A3B8',
  Rare: '#38BDF8',
  Epic: '#A855F7',
  Legendary: '#FBBF24',
}
