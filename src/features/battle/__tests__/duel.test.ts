import {
  botTapsAt,
  DRAW_XP,
  electRole,
  encodeMsg,
  LOSE_XP,
  outcomeLabel,
  parseMsg,
  resolveOutcome,
  WIN_XP,
  xpForOutcome,
  type DuelMsg,
} from '../duel'

describe('duel protocol', () => {
  const cases: DuelMsg[] = [
    { type: 'hello', nonce: 918273 },
    { type: 'go' },
    { type: 'tap', score: 0 },
    { type: 'tap', score: 42 },
    { type: 'final', score: 137 },
  ]

  it('round-trips every message type', () => {
    for (const m of cases) {
      expect(parseMsg(encodeMsg(m))).toEqual(m)
    }
  })

  it('rejects malformed or hostile input without throwing', () => {
    for (const bad of ['', 'X', 'T:', 'T:-1', 'T:1.5', 'F:abc', ':5', 'nonsense', 'T:99:99']) {
      expect(parseMsg(bad)).toBeNull()
    }
  })

  it('never confuses a go signal with a score', () => {
    expect(parseMsg('G')).toEqual({ type: 'go' })
    expect(parseMsg(encodeMsg({ type: 'go' }))).toEqual({ type: 'go' })
  })
})

describe('host election', () => {
  it('is symmetric — exactly one host for distinct nonces', () => {
    for (const [a, b] of [
      [1, 2],
      [500, 12],
      [9999, 10000],
    ]) {
      const roleA = electRole(a, b)
      const roleB = electRole(b, a)
      expect(roleA).not.toBe('tie')
      expect(roleB).not.toBe('tie')
      expect(roleA).not.toBe(roleB)
      expect([roleA, roleB].sort()).toEqual(['guest', 'host'])
    }
  })

  it('flags ties so the caller can re-roll', () => {
    expect(electRole(7, 7)).toBe('tie')
  })
})

describe('outcome reconciliation', () => {
  it('maps scores to win/lose/draw', () => {
    expect(resolveOutcome(10, 4)).toBe('win')
    expect(resolveOutcome(4, 10)).toBe('lose')
    expect(resolveOutcome(7, 7)).toBe('draw')
  })

  it('is symmetric — my win is always the opponent’s loss', () => {
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [3, 9],
      [50, 50],
      [61, 60],
    ]) {
      const mine = resolveOutcome(a, b)
      const theirs = resolveOutcome(b, a)
      if (mine === 'draw') expect(theirs).toBe('draw')
      else expect(theirs).toBe(mine === 'win' ? 'lose' : 'win')
    }
  })

  it('awards XP per outcome', () => {
    expect(xpForOutcome('win')).toBe(WIN_XP)
    expect(xpForOutcome('draw')).toBe(DRAW_XP)
    expect(xpForOutcome('lose')).toBe(LOSE_XP)
    expect(outcomeLabel('win')).toBe('Victory')
  })
})

// The real "two phones" test, done in software: run a full duel through the
// wire protocol between two independent engine instances and prove they
// converge on complementary outcomes for every score pair.
describe('two-peer loopback (no hardware needed)', () => {
  function playDuel(scoreA: number, scoreB: number) {
    // Each "device" only ever learns the opponent's score via the wire.
    let aSeesOpp = 0
    let bSeesOpp = 0

    // A taps up to scoreA, streaming T: messages that B parses.
    for (let n = 1; n <= scoreA; n++) {
      const msg = parseMsg(encodeMsg({ type: 'tap', score: n }))
      if (msg?.type === 'tap') bSeesOpp = msg.score
    }
    for (let n = 1; n <= scoreB; n++) {
      const msg = parseMsg(encodeMsg({ type: 'tap', score: n }))
      if (msg?.type === 'tap') aSeesOpp = msg.score
    }
    // Both send a final that overrides any dropped taps.
    const aFinal = parseMsg(encodeMsg({ type: 'final', score: scoreA }))
    const bFinal = parseMsg(encodeMsg({ type: 'final', score: scoreB }))
    if (bFinal?.type === 'final') aSeesOpp = bFinal.score
    if (aFinal?.type === 'final') bSeesOpp = aFinal.score

    return {
      a: resolveOutcome(scoreA, aSeesOpp),
      b: resolveOutcome(scoreB, bSeesOpp),
    }
  }

  it('both devices agree on the winner for many score pairs', () => {
    for (const [a, b] of [
      [0, 0],
      [12, 7],
      [7, 12],
      [30, 30],
      [1, 0],
      [45, 46],
    ]) {
      const { a: outA, b: outB } = playDuel(a, b)
      // Complementary outcomes = the two phones never disagree.
      if (outA === 'draw') expect(outB).toBe('draw')
      else expect(outB).toBe(outA === 'win' ? 'lose' : 'win')
      // And exactly one WIN_XP is handed out (or two draws).
      if (outA !== 'draw') {
        expect(xpForOutcome(outA) + xpForOutcome(outB)).toBe(WIN_XP + LOSE_XP)
      }
    }
  })
})

describe('bot tap curve', () => {
  it('is 0 at the start and rises monotonically', () => {
    expect(botTapsAt(0, 6)).toBe(0)
    expect(botTapsAt(-100, 6)).toBe(0)
    let prev = -1
    for (let ms = 0; ms <= 5000; ms += 250) {
      const t = botTapsAt(ms, 6)
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })

  it('respects the configured rate over a full 5s fight', () => {
    expect(botTapsAt(5000, 6)).toBe(30)
    expect(botTapsAt(5000, 8)).toBe(40)
  })
})
