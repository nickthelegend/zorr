// Pure duel engine — no React, no native deps, fully unit-testable.
//
// Two phones running Zorr sync a 5-second tap-duel over the Nearby text
// channel. Everything that decides *fairness* lives here as pure functions so
// it can be proven correct in software (see the loopback test) instead of
// deferred to two physical devices:
//   - the wire protocol (encode/parse)
//   - host election (who fires the shared start signal)
//   - outcome reconciliation (both phones must agree on the winner)
//   - the bot's tap curve (deterministic, so single-player is testable too)

export const FIGHT_MS = 5000
export const COUNTDOWN_FROM = 3
export const WIN_XP = 300
export const DRAW_XP = 120
export const LOSE_XP = 60

// ---- Wire protocol --------------------------------------------------------
// Compact single-line messages so they fit the Nearby text channel cheaply.
//   H:<nonce>   hello + election nonce   (sent once on connect)
//   G           go — host's shared start signal
//   T:<n>       live tap count
//   F:<n>       final score at end of my clock

export type DuelMsg =
  | { type: 'hello'; nonce: number }
  | { type: 'go' }
  | { type: 'tap'; score: number }
  | { type: 'final'; score: number }

export function encodeMsg(m: DuelMsg): string {
  switch (m.type) {
    case 'hello':
      return `H:${m.nonce}`
    case 'go':
      return 'G'
    case 'tap':
      return `T:${m.score}`
    case 'final':
      return `F:${m.score}`
  }
}

/** Parse a wire message. Returns null for anything malformed (never throws). */
export function parseMsg(text: string): DuelMsg | null {
  if (text === 'G') return { type: 'go' }
  const i = text.indexOf(':')
  if (i < 0) return null
  const tag = text.slice(0, i)
  const raw = text.slice(i + 1)
  // Payloads are always a run of digits — reject empty/negative/float/hostile
  // input (note Number('') === 0, so an explicit digit check is required).
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  if (tag === 'H') return { type: 'hello', nonce: n }
  if (tag === 'T') return { type: 'tap', score: n }
  if (tag === 'F') return { type: 'final', score: n }
  return null
}

// ---- Host election --------------------------------------------------------
// Nearby only tells each device the *remote* peer's id, so we can't compare
// peer ids. Instead each side rolls a nonce, both exchange it, and the higher
// nonce hosts. Symmetric by construction: given (a, b) one side sees (a,b) and
// the other (b,a), so exactly one gets 'host' — unless the nonces tie, which
// the caller resolves by re-rolling.

export type Role = 'host' | 'guest' | 'tie'

export function electRole(myNonce: number, peerNonce: number): Role {
  if (myNonce === peerNonce) return 'tie'
  return myNonce > peerNonce ? 'host' : 'guest'
}

// ---- Outcome --------------------------------------------------------------

export type Outcome = 'win' | 'lose' | 'draw'

/** Symmetric: if I resolve 'win', my opponent (with args swapped) resolves 'lose'. */
export function resolveOutcome(mine: number, opp: number): Outcome {
  if (mine > opp) return 'win'
  if (mine < opp) return 'lose'
  return 'draw'
}

export function xpForOutcome(o: Outcome): number {
  return o === 'win' ? WIN_XP : o === 'draw' ? DRAW_XP : LOSE_XP
}

export function outcomeLabel(o: Outcome): string {
  return o === 'win' ? 'Victory' : o === 'draw' ? 'Draw' : 'Defeated'
}

// ---- Bot ------------------------------------------------------------------
// Deterministic tap count for a bot at `tapsPerSec` after `elapsedMs`. Pure so
// single-player difficulty is testable and reproducible.
export function botTapsAt(elapsedMs: number, tapsPerSec: number): number {
  if (elapsedMs <= 0 || tapsPerSec <= 0) return 0
  return Math.floor((elapsedMs / 1000) * tapsPerSec)
}

export type BotLevel = 'easy' | 'even' | 'hard'
export function botRate(level: BotLevel): number {
  return level === 'easy' ? 4 : level === 'hard' ? 8 : 6
}
