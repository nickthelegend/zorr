// Deterministic RNG for peer duels.
//
// Two phones battle with no server, so both must compute *identical* results
// from identical inputs. We never call Math.random() during a fight — every
// "random" value (crit, damage variance, stat rolls) comes from this seeded
// PRNG keyed by a shared match seed plus the turn/slot, so both devices derive
// the same stream. mulberry32 is tiny, fast, and well-distributed enough.

/** FNV-1a hash of a string → uint32. Stable across devices. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: seed → generator producing floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A single deterministic draw in [0, 1) for a specific (seed, ...tags) point.
 * Order-independent: draw(seed, 'crit', 3) is always the same value regardless
 * of what else was drawn, so both peers agree without lock-stepping call order.
 */
export function draw(seed: string, ...tags: (string | number)[]): number {
  return mulberry32(hashSeed(`${seed}:${tags.join(':')}`))()
}

/** Deterministic integer in [min, max] inclusive. */
export function drawInt(seed: string, min: number, max: number, ...tags: (string | number)[]): number {
  if (max <= min) return min
  return min + Math.floor(draw(seed, ...tags) * (max - min + 1))
}
