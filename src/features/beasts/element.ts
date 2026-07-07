// Elemental type system — ported from AlgoQuest's battle-arena elementalChart.
// Six elements with a super-effective (2x) / resisted (0.5x) / neutral (1x)
// matrix. Kept as data so both the battle engine and the UI read from one source.

export const ELEMENTS = ['fire', 'water', 'earth', 'wind', 'light', 'dark'] as const
export type Element = (typeof ELEMENTS)[number]

// attacker → defender → multiplier (AlgoQuest values, verbatim).
export const ELEMENT_CHART: Record<Element, Record<Element, number>> = {
  fire: { water: 0.5, earth: 2.0, wind: 1.5, light: 1.0, dark: 1.0, fire: 0.5 },
  water: { fire: 2.0, earth: 0.5, wind: 1.0, light: 1.0, dark: 1.0, water: 0.5 },
  earth: { fire: 0.5, water: 2.0, wind: 0.5, light: 1.0, dark: 1.0, earth: 0.5 },
  wind: { fire: 0.5, water: 1.0, earth: 2.0, light: 1.0, dark: 1.0, wind: 0.5 },
  light: { dark: 2.0, fire: 1.0, water: 1.0, earth: 1.0, wind: 1.0, light: 0.5 },
  dark: { light: 2.0, fire: 1.0, water: 1.0, earth: 1.0, wind: 1.0, dark: 0.5 },
}

/** Damage multiplier for an attack of `atk` element landing on a `def` beast. */
export function effectiveness(atk: Element, def: Element): number {
  return ELEMENT_CHART[atk]?.[def] ?? 1.0
}

export function effectivenessLabel(mult: number): string {
  if (mult >= 2) return 'Super effective!'
  if (mult > 1) return 'Effective'
  if (mult < 1) return 'Resisted'
  return ''
}

// Display metadata — neon-cartography palette, one accent per element.
export const ELEMENT_META: Record<Element, { label: string; color: string; glyph: string }> = {
  fire: { label: 'Ember', color: '#F43F5E', glyph: '🔥' },
  water: { label: 'Tidal', color: '#38BDF8', glyph: '🌊' },
  earth: { label: 'Terra', color: '#A3E635', glyph: '⛰️' },
  wind: { label: 'Gale', color: '#22D3A6', glyph: '🌪️' },
  light: { label: 'Lumen', color: '#FBBF24', glyph: '✨' },
  dark: { label: 'Umbra', color: '#7C3AED', glyph: '🌑' },
}
