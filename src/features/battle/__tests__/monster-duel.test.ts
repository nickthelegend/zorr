import { generateBeast } from '../../beasts/beast'
import {
  battleFromSeeds,
  initBattle,
  legalAbilities,
  pickBotMove,
  resolveMove,
  TURN_CAP,
  type BattleState,
} from '../monster-duel'
import { electRole, encodeBattleMsg, matchSeed, parseBattleMsg, type BattleMsg } from '../protocol'

const A = generateBeast('hero-a')
const B = generateBeast('hero-b')

describe('battle setup', () => {
  it('starts both beasts at full HP/energy, faster moves first', () => {
    const s = initBattle(A, B, 'seed1')
    expect(s.p1.health).toBe(A.maxHealth)
    expect(s.p2.energy).toBe(B.maxEnergy)
    expect(s.turn).toBe(1)
    expect(s.over).toBe(false)
    expect(s.active).toBe(A.stats.speed >= B.stats.speed ? 'p1' : 'p2')
  })
})

describe('resolveMove mechanics', () => {
  it('is pure and deterministic', () => {
    const s = initBattle(A, B, 'seed2')
    const id = legalAbilities(s)[0].id
    const once = resolveMove(s, id)
    const twice = resolveMove(s, id)
    expect(once).toEqual(twice)
    // input state was not mutated
    expect(s.turn).toBe(1)
    expect(s.log).toHaveLength(0)
  })

  it('spends energy and advances the turn', () => {
    const s = initBattle(A, B, 'seed3')
    const atk = legalAbilities(s).find((a) => a.kind === 'attack')!
    const n = resolveMove(s, atk.id)
    expect(n.turn).toBe(2)
    expect(n.active).not.toBe(s.active)
    const actor = s.active
    expect(n[actor].energy).toBeLessThanOrEqual(s[actor].energy)
  })

  it('an attack lowers the defender HP by at least 1', () => {
    const s = initBattle(A, B, 'seed4')
    const atk = s[s.active].beast.abilities.find((a) => a.kind === 'attack')!
    const def = s.active === 'p1' ? 'p2' : 'p1'
    const n = resolveMove(s, atk.id)
    // either it hit (HP dropped) or it missed (logged) — never a silent no-op
    const hit = n[def].health < s[def].health
    const missed = n.log.some((l) => l.missed)
    expect(hit || missed).toBe(true)
  })

  it('always terminates within the turn cap', () => {
    let s = initBattle(A, B, 'seed5')
    let guard = 0
    while (!s.over && guard++ < TURN_CAP + 5) {
      s = resolveMove(s, pickBotMove(s))
    }
    expect(s.over).toBe(true)
    expect(['p1', 'p2']).toContain(s.winner)
  })
})

describe('protocol', () => {
  const cases: BattleMsg[] = [
    { type: 'hello', nonce: 42 },
    { type: 'beast', seed: 'abc-123', level: 3 },
    { type: 'seed', seed: 'deadbeef00ff' },
    { type: 'go' },
    { type: 'move', turn: 7, index: 2 },
  ]

  it('round-trips every message', () => {
    for (const m of cases) expect(parseBattleMsg(encodeBattleMsg(m))).toEqual(m)
  })

  it('rejects malformed input', () => {
    for (const bad of ['', 'X', 'H:abc', 'B:has space:1', 'M:1', 'M:1:x', 'B::1']) {
      expect(parseBattleMsg(bad)).toBeNull()
    }
  })

  it('host election is symmetric and match seed is order-independent', () => {
    expect(electRole(9, 4)).toBe('host')
    expect(electRole(4, 9)).toBe('guest')
    expect(electRole(5, 5)).toBe('tie')
    expect(matchSeed(4, 9)).toBe(matchSeed(9, 4))
  })
})

// The real "two phones" proof: two independent devices, each only exchanging
// wire messages, must run the identical battle and agree on the winner.
describe('two-device loopback (no hardware needed)', () => {
  function simulate(seedA: string, seedB: string, nonceA: number, nonceB: number) {
    // Both elect the same host and derive the same match seed from the nonces.
    const roleA = electRole(nonceA, nonceB)
    const seed = matchSeed(nonceA, nonceB)
    const hostSeed = roleA === 'host' ? seedA : seedB
    const guestSeed = roleA === 'host' ? seedB : seedA

    // p1 = host's beast, p2 = guest's — a convention both sides know.
    let deviceA: BattleState = battleFromSeeds(hostSeed, 1, guestSeed, 1, seed)
    let deviceB: BattleState = battleFromSeeds(hostSeed, 1, guestSeed, 1, seed)

    let steps = 0
    while (!deviceA.over && steps++ < TURN_CAP + 5) {
      // The active device decides its move and sends the index over the wire.
      const index = deviceA[deviceA.active].beast.abilities.findIndex((a) => a.id === pickBotMove(deviceA))
      const wire = encodeBattleMsg({ type: 'move', turn: deviceA.turn, index })
      const msg = parseBattleMsg(wire)!
      if (msg.type !== 'move') throw new Error('bad wire')
      const idA = deviceA[deviceA.active].beast.abilities[msg.index].id
      const idB = deviceB[deviceB.active].beast.abilities[msg.index].id
      deviceA = resolveMove(deviceA, idA)
      deviceB = resolveMove(deviceB, idB)
      // After every turn the two devices are byte-for-byte in sync.
      expect(deviceB).toEqual(deviceA)
    }
    return deviceA
  }

  it('both devices converge on the same winner across many matchups', () => {
    for (const [sa, sb, na, nb] of [
      ['a1', 'b1', 10, 20],
      ['a2', 'b2', 99, 1],
      ['fire-x', 'water-y', 555, 777],
      ['legend', 'common', 3, 4],
    ] as const) {
      const final = simulate(sa, sb, na, nb)
      expect(final.over).toBe(true)
      expect(['p1', 'p2']).toContain(final.winner)
    }
  })
})
