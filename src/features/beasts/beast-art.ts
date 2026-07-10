import type { ImageSourcePropType } from 'react-native'

import { ELEMENT, SPECIES, SPRITES } from './sprites.gen'

// Resolve a pixel-art sprite for ANY beast (NFT, starter, or bot). Tries the
// exact seed first, then the element+species (creature type), then the element —
// so even procedurally-seeded opponents get on-theme art. Returns null when no
// sprite exists yet, and callers fall back to the beast's emoji glyph.
export function beastImage(seed: string, element: string, name: string): ImageSourcePropType | null {
  const exact = SPRITES[seed]
  if (exact) return exact
  const noun = name.split(' ').pop()?.toLowerCase()
  const species = noun ? SPECIES[`${element}-${noun}`] : undefined
  if (species && SPRITES[species]) return SPRITES[species]
  const el = ELEMENT[element]
  if (el && SPRITES[el]) return SPRITES[el]
  return null
}
