// Deterministic turn-based monster duel.
//
// Faithful port of AlgoQuest's battle math — damage = power·(atk/def)·0.4·eff,
// crit = 10% + low-HP bonus (×2), burn 6%/poison 4% DoT, energy costs — but
// every random draw is keyed off a shared match seed + turn, so running the
// same (beasts, seed, move sequence) on two phones yields identical state.
// The wire only ever carries the chosen ability id; nobody sends damage numbers.

import { generateBeast, type Ability, type Beast, type StatusType } from '../beasts/beast'
import { effectiveness } from '../beasts/element'
import { draw } from './rng'

export type Side = 'p1' | 'p2'
export const WIN_XP = 300
export const LOSE_XP = 80
export const TURN_CAP = 40 // sudden-death guard against stall (heal/guard loops)

export type BeastState = {
  beast: Beast
  health: number
  energy: number
  status: { type: StatusType; duration: number } | null
  guard: boolean
}

export type LogEntry = {
  turn: number
  side: Side
  ability: string
  text: string
  damage?: number
  heal?: number
  energy?: number
  crit?: boolean
  missed?: boolean
  effectiveness?: number
  status?: StatusType
}

export type BattleState = {
  seed: string
  turn: number
  first: Side // who moves on odd turns (higher speed)
  active: Side
  p1: BeastState
  p2: BeastState
  over: boolean
  winner: Side | null
  log: LogEntry[]
}

export const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1')

function activeFor(turn: number, first: Side): Side {
  return turn % 2 === 1 ? first : other(first)
}

function freshBeastState(beast: Beast): BeastState {
  return { beast, health: beast.maxHealth, energy: beast.maxEnergy, status: null, guard: false }
}

export function initBattle(p1: Beast, p2: Beast, seed: string): BattleState {
  const first: Side = p1.stats.speed >= p2.stats.speed ? 'p1' : 'p2'
  return {
    seed,
    turn: 1,
    first,
    active: first,
    p1: freshBeastState(p1),
    p2: freshBeastState(p2),
    over: false,
    winner: null,
    log: [],
  }
}

/** Abilities the active beast can currently afford. */
export function legalAbilities(state: BattleState): Ability[] {
  const me = state[state.active]
  return me.beast.abilities.filter((a) => a.energyCost <= me.energy)
}

const round = Math.round

/**
 * Apply the active player's chosen ability and advance one turn. Pure and
 * deterministic: same (state, abilityId) → same next state on every device.
 */
export function resolveMove(state: BattleState, abilityId: string): BattleState {
  if (state.over) return state

  const seed = state.seed
  const turn = state.turn
  const atkSide = state.active
  const defSide = other(atkSide)
  // Work on shallow clones so the input state is never mutated.
  const atk: BeastState = { ...state[atkSide], beast: state[atkSide].beast }
  const def: BeastState = { ...state[defSide], beast: state[defSide].beast }
  const log: LogEntry[] = [...state.log]

  const push = (e: Omit<LogEntry, 'turn' | 'side'>) => log.push({ turn, side: atkSide, ...e })

  // 1. Damage-over-time ticks on the acting beast at the start of its turn.
  if (atk.status) {
    const pct = atk.status.type === 'burn' ? 0.06 : 0.04
    const dot = Math.floor(atk.beast.maxHealth * pct)
    atk.health = Math.max(0, atk.health - dot)
    push({ ability: 'status', text: `${atk.beast.name} takes ${dot} ${atk.status.type} damage`, damage: dot, status: atk.status.type })
    atk.status = atk.status.duration > 1 ? { ...atk.status, duration: atk.status.duration - 1 } : null
    if (atk.health <= 0) {
      return finish(state, { ...atk }, { ...def }, atkSide, defSide, defSide, log)
    }
  }

  // 2. Resolve the ability (fall back to Energy Focus if somehow unaffordable).
  let ability = atk.beast.abilities.find((a) => a.id === abilityId)
  if (!ability || ability.energyCost > atk.energy) {
    ability = atk.beast.abilities.find((a) => a.kind === 'energy') ?? atk.beast.abilities[0]
  }
  atk.energy = Math.max(0, atk.energy - ability.energyCost)

  if (ability.kind === 'energy') {
    const restore = 30 + Math.floor(draw(seed, 'energy', turn) * 31) // 30..60
    atk.energy = Math.min(atk.beast.maxEnergy, atk.energy + restore)
    push({ ability: ability.name, text: `${atk.beast.name} focuses — +${restore} energy`, energy: restore })
  } else if (ability.kind === 'heal') {
    const heal = round(ability.power * 0.8)
    atk.health = Math.min(atk.beast.maxHealth, atk.health + heal)
    push({ ability: ability.name, text: `${atk.beast.name} mends — +${heal} HP`, heal })
  } else if (ability.kind === 'guard') {
    atk.guard = true
    push({ ability: ability.name, text: `${atk.beast.name} braces for impact` })
  } else {
    // attack
    const missRoll = draw(seed, 'hit', turn) * 100
    if (missRoll < 100 - ability.accuracy) {
      push({ ability: ability.name, text: `${atk.beast.name}'s ${ability.name} missed!`, missed: true })
    } else {
      const eff = effectiveness(ability.element, def.beast.element)
      const healthPct = atk.health / atk.beast.maxHealth
      const critChance = 10 + (1 - healthPct) * 20
      const isCrit = draw(seed, 'crit', turn) * 100 < critChance
      const base = ability.power * (atk.beast.stats.attack / def.beast.stats.defense) * 0.4 * eff
      const variance = 0.75 + draw(seed, 'var', turn) * 0.5
      let dmg = base * variance
      if (isCrit) dmg *= 2
      if (def.guard) {
        dmg *= 0.5
        def.guard = false
      }
      dmg = Math.max(1, round(dmg))
      def.health = Math.max(0, def.health - dmg)
      push({
        ability: ability.name,
        text: `${atk.beast.name} hits for ${dmg}${isCrit ? ' (crit!)' : ''}`,
        damage: dmg,
        crit: isCrit,
        effectiveness: eff,
      })
      // Status proc (only sticks if the defender survives).
      if (ability.status && def.health > 0 && !def.status && draw(seed, 'proc', turn) < ability.status.chance) {
        def.status = { type: ability.status.type, duration: ability.status.duration }
        push({ ability: ability.name, text: `${def.beast.name} is ${ability.status.type}ed!`, status: ability.status.type })
      }
    }
  }

  if (def.health <= 0) {
    return finish(state, atk, def, atkSide, defSide, atkSide, log)
  }

  // 3. Advance the turn. Sudden death at the cap: higher HP% wins.
  const nextTurn = turn + 1
  if (nextTurn > TURN_CAP) {
    const atkPct = atk.health / atk.beast.maxHealth
    const defPct = def.health / def.beast.maxHealth
    const winner = atkPct === defPct ? state.first : atkPct > defPct ? atkSide : defSide
    return finish(state, atk, def, atkSide, defSide, winner, log)
  }

  return {
    ...state,
    turn: nextTurn,
    active: activeFor(nextTurn, state.first),
    [atkSide]: atk,
    [defSide]: def,
    log,
  }
}

function finish(
  state: BattleState,
  atk: BeastState,
  def: BeastState,
  atkSide: Side,
  defSide: Side,
  winner: Side,
  log: LogEntry[],
): BattleState {
  return { ...state, over: true, winner, [atkSide]: atk, [defSide]: def, log }
}

/**
 * Deterministic-ish bot move for single-player: heal when low and able,
 * otherwise the strongest affordable attack, with the seed adding variety.
 */
export function pickBotMove(state: BattleState): string {
  const me = state[state.active]
  const legal = legalAbilities(state)
  if (legal.length === 0) return state[state.active].beast.abilities.find((a) => a.kind === 'energy')!.id
  if (me.energy < 15) {
    const e = legal.find((a) => a.kind === 'energy')
    if (e) return e.id
  }
  if (me.health < me.beast.maxHealth * 0.3) {
    const heal = legal.find((a) => a.kind === 'heal')
    if (heal && draw(state.seed, 'botheal', state.turn) < 0.7) return heal.id
  }
  const attacks = legal.filter((a) => a.kind === 'attack')
  if (attacks.length === 0) return legal[0].id
  const best = attacks.reduce((a, b) => (b.power > a.power ? b : a))
  // Sometimes throw the quick move to vary the fight.
  if (draw(state.seed, 'botvar', state.turn) < 0.35) {
    const light = attacks.find((a) => a.id !== best.id)
    if (light) return light.id
  }
  return best.id
}

/** Rebuild both beasts from their seeds — used when a match starts from wire seeds. */
export function battleFromSeeds(seedP1: string, lvlP1: number, seedP2: string, lvlP2: number, matchSeed: string): BattleState {
  return initBattle(generateBeast(seedP1, lvlP1), generateBeast(seedP2, lvlP2), matchSeed)
}
