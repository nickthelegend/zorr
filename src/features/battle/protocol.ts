// Wire protocol for the monster duel. Single-line messages over either
// transport (Bluetooth Nearby or the socket relay). Because the battle engine
// is deterministic, the only in-fight payload is which ability was chosen —
// both devices recompute the identical result.
//
//   H:<nonce>          hello + election nonce (on connect)
//   B:<seed>:<level>   my chosen Guardian (peer regenerates it from the seed)
//   G                  go — host's shared start signal
//   M:<turn>:<index>   ability index chosen on <turn>

export type BattleMsg =
  | { type: 'hello'; nonce: number }
  | { type: 'beast'; seed: string; level: number }
  | { type: 'seed'; seed: string } // host-authoritative match seed (VRF or fallback)
  | { type: 'go' }
  | { type: 'move'; turn: number; index: number }

const DIGITS = /^\d+$/
// Seeds are our own alphanumeric ids (no colon/whitespace) so they survive the
// colon-delimited framing intact.
const SEED_OK = /^[A-Za-z0-9_-]+$/

export function encodeBattleMsg(m: BattleMsg): string {
  switch (m.type) {
    case 'hello':
      return `H:${m.nonce}`
    case 'beast':
      return `B:${m.seed}:${m.level}`
    case 'seed':
      return `S:${m.seed}`
    case 'go':
      return 'G'
    case 'move':
      return `M:${m.turn}:${m.index}`
  }
}

export function parseBattleMsg(text: string): BattleMsg | null {
  if (text === 'G') return { type: 'go' }
  const parts = text.split(':')
  const tag = parts[0]
  if (tag === 'H' && parts.length === 2 && DIGITS.test(parts[1])) {
    return { type: 'hello', nonce: Number(parts[1]) }
  }
  if (tag === 'B' && parts.length === 3 && SEED_OK.test(parts[1]) && DIGITS.test(parts[2])) {
    return { type: 'beast', seed: parts[1], level: Number(parts[2]) }
  }
  if (tag === 'S' && parts.length === 2 && SEED_OK.test(parts[1])) {
    return { type: 'seed', seed: parts[1] }
  }
  if (tag === 'M' && parts.length === 3 && DIGITS.test(parts[1]) && DIGITS.test(parts[2])) {
    return { type: 'move', turn: Number(parts[1]), index: Number(parts[2]) }
  }
  return null
}

// ---- Host election + shared match seed ------------------------------------
// Reused pattern: each side rolls a nonce, both exchange it, higher nonce hosts
// (symmetric — exactly one host unless they tie, then the caller re-rolls). The
// match seed is order-independent so both devices derive the same RNG stream.

export type Role = 'host' | 'guest' | 'tie'

export function electRole(myNonce: number, peerNonce: number): Role {
  if (myNonce === peerNonce) return 'tie'
  return myNonce > peerNonce ? 'host' : 'guest'
}

export function matchSeed(a: number, b: number): string {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return `${lo}x${hi}`
}
