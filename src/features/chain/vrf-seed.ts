// Pure helpers for the MagicBlock VRF flow — no network, fully unit-testable.
// The on-chain VrfSeed account is: [8 discriminator][32 seed][8 counter u64 LE][1 fulfilled].

/** 32 VRF bytes → a wire-safe hex string used as a Guardian/battle seed. */
export function hexSeed(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

/** Deterministic 16-byte PDA scope from a string (FNV-1a spread). */
export function scopeFromString(s: string): Uint8Array {
  const out = new Uint8Array(16)
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  for (let i = 0; i < 16; i++) {
    h ^= h >>> 13
    h = Math.imul(h, 0x01000193) >>> 0
    out[i] = h & 0xff
  }
  return out
}

/** Random 16-byte scope (for one-off summons). Not pure — uses Math.random. */
export function randomScope(): Uint8Array {
  const s = new Uint8Array(16)
  for (let i = 0; i < 16; i++) s[i] = Math.floor(Math.random() * 256)
  return s
}

/** Decode a standard base64 string to bytes (Hermes-safe — no atob/Buffer). */
export function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array((clean.length * 3) >> 2)
  let bits = 0
  let val = 0
  let p = 0
  for (let i = 0; i < clean.length; i++) {
    val = (val << 6) | lookup[clean.charCodeAt(i)]
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[p++] = (val >> bits) & 0xff
    }
  }
  return out
}

export type VrfSeedAccount = { seed: Uint8Array; counter: number; fulfilled: boolean }

/** Parse raw VrfSeed account bytes. Returns null if too short / uninitialized. */
export function parseVrfSeed(data: Uint8Array): VrfSeedAccount | null {
  if (data.length < 49) return null
  const seed = data.slice(8, 40)
  let counter = 0
  for (let i = 0; i < 8; i++) counter += data[40 + i] * 2 ** (8 * i)
  return { seed, counter, fulfilled: data[48] === 1 }
}
