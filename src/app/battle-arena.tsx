import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Bluetooth, Bot, Globe, Trophy, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { generateBeast, type Ability } from '../features/beasts/beast'
import { ELEMENT_META } from '../features/beasts/element'
import {
  battleFromSeeds,
  initBattle,
  legalAbilities,
  LOSE_XP,
  pickBotMove,
  resolveMove,
  WIN_XP,
  type BattleState,
  type BeastState,
  type Side,
} from '../features/battle/monster-duel'
import { electRole, encodeBattleMsg, matchSeed, parseBattleMsg, type Role } from '../features/battle/protocol'
import { useNearby } from '../features/battle/use-nearby'
import { useSocket } from '../features/battle/use-socket'
import { useGame } from '../features/game/game-store'
import { colors, fonts, radius } from '../theme'

type Mode = 'bot' | 'bt' | 'online'
type Phase = 'connecting' | 'battle' | 'result'
const TURN_SECONDS = 30

export default function BattleArena() {
  const params = useLocalSearchParams<{ mode?: string; room?: string }>()
  const mode = (params.mode as Mode) || 'bot'
  const room = (params.room as string) || ''
  const game = useGame()
  const mySeed = game.activeBeast
  const myLevel = 1

  const [phase, setPhase] = useState<Phase>(mode === 'bot' ? 'battle' : 'connecting')
  const [state, setState] = useState<BattleState | null>(null)
  const [status, setStatus] = useState('Getting ready…')
  const [left, setLeft] = useState(false) // opponent forfeited
  const [clock, setClock] = useState(TURN_SECONDS)

  // Handshake + battle bookkeeping (refs so the stable message handler sees latest).
  const myNonce = useRef(1 + Math.floor(Math.random() * 1_000_000_000))
  const roleRef = useRef<Role | null>(null)
  const peerNonceRef = useRef<number | null>(null)
  const peerBeastRef = useRef<{ seed: string; level: number } | null>(null)
  const goRef = useRef(false)
  const startedRef = useRef(false)
  const helloSentRef = useRef(false)
  const rewardedRef = useRef(false)
  const mySideRef = useRef<Side>('p1')
  const stateRef = useRef<BattleState | null>(null)
  stateRef.current = state
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode
  const transportRef = useRef<{ send: (m: string) => void }>({ send: () => {} })

  const startBattle = useCallback(() => {
    const peer = peerBeastRef.current
    if (!peer || peerNonceRef.current == null || !roleRef.current) return
    const seed = matchSeed(myNonce.current, peerNonceRef.current)
    const iAmHost = roleRef.current === 'host'
    const hostSeed = iAmHost ? mySeed : peer.seed
    const hostLvl = iAmHost ? myLevel : peer.level
    const guestSeed = iAmHost ? peer.seed : mySeed
    const guestLvl = iAmHost ? peer.level : myLevel
    mySideRef.current = iAmHost ? 'p1' : 'p2'
    setState(battleFromSeeds(hostSeed, hostLvl, guestSeed, guestLvl, seed))
    setPhase('battle')
  }, [mySeed])

  const tryStart = useCallback(() => {
    if (startedRef.current || !roleRef.current || !peerBeastRef.current) return
    if (roleRef.current === 'host') {
      startedRef.current = true
      transportRef.current.send(encodeBattleMsg({ type: 'go' }))
      startBattle()
    } else if (goRef.current) {
      startedRef.current = true
      startBattle()
    }
  }, [startBattle])

  const applyPeerMove = useCallback((turn: number, index: number) => {
    const s = stateRef.current
    if (!s || s.over || s.active === mySideRef.current || s.turn !== turn) return
    const id = s[s.active].beast.abilities[index]?.id
    if (id) setState(resolveMove(s, id))
  }, [])

  const handleText = useCallback(
    (text: string) => {
      const msg = parseBattleMsg(text)
      if (!msg) return
      switch (msg.type) {
        case 'hello': {
          peerNonceRef.current = msg.nonce
          const role = electRole(myNonce.current, msg.nonce)
          if (role === 'tie') {
            myNonce.current = 1 + Math.floor(Math.random() * 1_000_000_000)
            transportRef.current.send(encodeBattleMsg({ type: 'hello', nonce: myNonce.current }))
            return
          }
          roleRef.current = role
          tryStart()
          break
        }
        case 'beast':
          peerBeastRef.current = { seed: msg.seed, level: msg.level }
          tryStart()
          break
        case 'go':
          goRef.current = true
          tryStart()
          break
        case 'move':
          applyPeerMove(msg.turn, msg.index)
          break
      }
    },
    [tryStart, applyPeerMove],
  )

  const nearby = useNearby(game.name, handleText)
  const socket = useSocket(handleText)
  transportRef.current = {
    send: (m) => (modeRef.current === 'bt' ? nearby.send(m) : modeRef.current === 'online' ? socket.send(m) : undefined),
  }

  // Kick off the chosen mode.
  useEffect(() => {
    if (mode === 'bot') {
      const botSeed = `bot-${Math.floor(Math.random() * 100000)}`
      mySideRef.current = 'p1'
      setState(initBattle(generateBeast(mySeed, myLevel), generateBeast(botSeed), `bot${myNonce.current}`))
      return
    }
    if (mode === 'bt') {
      setStatus('Searching for a nearby player…')
      nearby.start()
    } else {
      setStatus(`Room ${room} — waiting for an opponent…`)
      socket.join(room)
    }
    return () => {
      nearby.stop()
      socket.leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bluetooth: auto-challenge the first player we discover.
  useEffect(() => {
    if (mode === 'bt' && !nearby.connected && nearby.peers.length > 0) nearby.connect(nearby.peers[0].peerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby.peers, nearby.connected])

  // On connect, open the handshake (send hello + our beast).
  const peerConnected = mode === 'bt' ? nearby.connected : mode === 'online' ? socket.connected : null
  useEffect(() => {
    if (mode === 'bot' || !peerConnected || helloSentRef.current) return
    helloSentRef.current = true
    setStatus('Opponent found — syncing Guardians…')
    transportRef.current.send(encodeBattleMsg({ type: 'hello', nonce: myNonce.current }))
    transportRef.current.send(encodeBattleMsg({ type: 'beast', seed: mySeed, level: myLevel }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerConnected])

  // Opponent dropping mid-fight is a forfeit.
  useEffect(() => {
    if (mode === 'bot' || phase !== 'battle' || !startedRef.current) return
    if (!peerConnected && state && !state.over && !rewardedRef.current) {
      rewardedRef.current = true
      setLeft(true)
      game.award(WIN_XP)
      setPhase('result')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerConnected])

  const myMove = useCallback(
    (index: number) => {
      const s = stateRef.current
      if (!s || s.over || s.active !== mySideRef.current) return
      const ability = s[s.active].beast.abilities[index]
      if (!ability || ability.energyCost > s[s.active].energy) return
      if (modeRef.current !== 'bot') transportRef.current.send(encodeBattleMsg({ type: 'move', turn: s.turn, index }))
      setState(resolveMove(s, ability.id))
    },
    [],
  )
  const myMoveRef = useRef(myMove)
  myMoveRef.current = myMove

  // Turn-transition keys — effects below fire on these, not on every HP tick.
  const sTurn = state?.turn
  const sActive = state?.active
  const sOver = state?.over

  // Bot takes its turn automatically.
  useEffect(() => {
    if (mode !== 'bot' || !sActive || sOver || sActive === mySideRef.current) return
    const t = setTimeout(() => {
      const s = stateRef.current
      if (s && !s.over && s.active !== mySideRef.current) setState(resolveMove(s, pickBotMove(s)))
    }, 850)
    return () => clearTimeout(t)
  }, [sTurn, sActive, sOver, mode])

  // My-turn countdown; auto-pick on timeout so a duel can't stall.
  useEffect(() => {
    if (!sActive || sOver || sActive !== mySideRef.current) return
    setClock(TURN_SECONDS)
    const started = Date.now()
    const id = setInterval(() => {
      const remaining = TURN_SECONDS - Math.floor((Date.now() - started) / 1000)
      setClock(Math.max(0, remaining))
      if (remaining <= 0) {
        clearInterval(id)
        const s = stateRef.current
        if (s && !s.over && s.active === mySideRef.current) {
          const legal = legalAbilities(s)
          const pick = legal.find((a) => a.kind === 'attack') ?? legal[0]
          const idx = s[s.active].beast.abilities.findIndex((a) => a.id === pick.id)
          myMoveRef.current(idx)
        }
      }
    }, 250)
    return () => clearInterval(id)
  }, [sTurn, sActive, sOver])

  // Award + move to result exactly once.
  useEffect(() => {
    if (state?.over && !rewardedRef.current) {
      rewardedRef.current = true
      game.award(state.winner === mySideRef.current ? WIN_XP : LOSE_XP)
      setPhase('result')
    }
  }, [state?.over, state?.winner, game])

  const quit = useCallback(() => {
    nearby.stop()
    socket.leave()
    router.replace('/battle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connError = mode === 'bt' ? nearby.error : mode === 'online' ? socket.error : null

  // ---- Render ----
  if (phase === 'connecting' || !state) {
    return (
      <View style={styles.root}>
        <Aurora />
        <SafeAreaView style={styles.connectSafe}>
          <TouchableOpacity style={styles.close} onPress={quit}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
          <View style={styles.connectCenter}>
            <View style={styles.connIcon}>
              {mode === 'bt' ? <Bluetooth color={colors.primary} size={30} /> : <Globe color={colors.primary} size={30} />}
            </View>
            {mode === 'online' ? <Text style={styles.roomCode}>{room}</Text> : null}
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            <Text style={styles.connStatus}>{status}</Text>
            {connError ? <Text style={styles.connError}>{connError}</Text> : null}
            {mode === 'online' ? <Text style={styles.connHint}>Share this room code with a friend to duel.</Text> : null}
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const meSide = mySideRef.current
  const foeSide: Side = meSide === 'p1' ? 'p2' : 'p1'
  const me = state[meSide]
  const foe = state[foeSide]
  const myTurn = !state.over && state.active === meSide
  const recent = state.log.slice(-4)

  if (phase === 'result') {
    const won = left || state.winner === meSide
    return (
      <View style={styles.root}>
        <Aurora />
        <SafeAreaView style={styles.connectSafe}>
          <Animated.View entering={FadeIn} style={styles.connectCenter}>
            <View style={[styles.resultCrest, { borderColor: won ? colors.gold : colors.border }]}>
              <Trophy color={won ? colors.gold : colors.textDim} size={44} />
            </View>
            <Text style={styles.resultTitle}>{won ? 'Victory' : 'Defeated'}</Text>
            {left ? <Text style={styles.forfeit}>Opponent left the duel</Text> : null}
            <Text style={styles.resultSub}>
              {me.beast.name} vs {foe.beast.name}
            </Text>
            <Text style={styles.resultXp}>+{won ? WIN_XP : LOSE_XP} XP</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={quit}>
              <Text style={styles.primaryText}>Back to Arena</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.modeTag}>
            {mode === 'bot' ? <Bot color={colors.textDim} size={14} /> : mode === 'bt' ? <Bluetooth color={colors.textDim} size={14} /> : <Globe color={colors.textDim} size={14} />}
            <Text style={styles.modeText}>{mode === 'bot' ? 'vs AI' : mode === 'bt' ? 'Bluetooth' : `Room ${room}`}</Text>
          </View>
          <TouchableOpacity style={styles.close} onPress={quit}>
            <X color={colors.text} size={18} />
          </TouchableOpacity>
        </View>

        <Fighter beast={foe} align="left" />

        <View style={styles.turnBar}>
          <Text style={[styles.turnText, { color: myTurn ? colors.territory : colors.textDim }]}>
            {myTurn ? 'Your move' : `${foe.beast.name}'s move`}
          </Text>
          {myTurn ? <Text style={styles.clock}>{clock}s</Text> : <ActivityIndicator color={colors.textDim} size="small" />}
        </View>

        <View style={styles.log}>
          {recent.length === 0 ? (
            <Text style={styles.logLine}>The duel begins — {state[state.first].beast.name} is faster and strikes first.</Text>
          ) : (
            recent.map((l, i) => (
              <Text key={`${l.turn}-${i}`} style={[styles.logLine, i === recent.length - 1 && styles.logLast]}>
                {l.text}
              </Text>
            ))
          )}
        </View>

        <Fighter beast={me} align="right" mine />

        <View style={styles.moves}>
          {me.beast.abilities.map((a, i) => (
            <MoveButton key={a.id} ability={a} disabled={!myTurn || a.energyCost > me.energy} onPress={() => myMove(i)} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  )
}

function Fighter({ beast, align, mine }: { beast: BeastState; align: 'left' | 'right'; mine?: boolean }) {
  const el = ELEMENT_META[beast.beast.element]
  const hpPct = Math.max(0, beast.health / beast.beast.maxHealth)
  const enPct = Math.max(0, beast.energy / beast.beast.maxEnergy)
  const low = hpPct < 0.3
  return (
    <View style={[styles.fighter, align === 'right' && styles.fighterRight]}>
      <View style={[styles.avatar, { borderColor: el.color, backgroundColor: `${el.color}1A` }]}>
        <Text style={styles.avatarGlyph}>{beast.beast.glyph}</Text>
      </View>
      <View style={styles.fighterInfo}>
        <View style={styles.fighterTop}>
          <Text style={styles.fighterName} numberOfLines={1}>
            {beast.beast.name}
          </Text>
          {beast.status ? <Text style={[styles.statusTag, { color: colors.enemy }]}>{beast.status.type}</Text> : null}
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${hpPct * 100}%`, backgroundColor: low ? colors.enemy : colors.territory }]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.hpText}>
            {beast.health}/{beast.beast.maxHealth} HP
          </Text>
          <Text style={[styles.elBadge, { color: el.color }]}>
            {el.glyph} {el.label}
          </Text>
        </View>
        <View style={[styles.barTrack, styles.energyTrack]}>
          <View style={[styles.barFill, { width: `${enPct * 100}%`, backgroundColor: colors.gold }]} />
        </View>
      </View>
    </View>
  )
}

function MoveButton({ ability, disabled, onPress }: { ability: Ability; disabled: boolean; onPress: () => void }) {
  const el = ELEMENT_META[ability.element]
  const tint = ability.kind === 'heal' ? colors.territory : ability.kind === 'energy' ? colors.gold : ability.kind === 'guard' ? colors.textMuted : el.color
  return (
    <TouchableOpacity style={[styles.move, { borderColor: `${tint}66` }, disabled && styles.moveOff]} activeOpacity={0.85} onPress={onPress} disabled={disabled}>
      <LinearGradient colors={[`${tint}22`, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.moveGrad}>
        <Text style={styles.moveName} numberOfLines={1}>
          {ability.name}
        </Text>
        <Text style={styles.moveMeta}>
          {ability.kind === 'attack' ? `${ability.power} pow` : ability.kind === 'heal' ? 'heal' : ability.kind === 'guard' ? 'guard' : '+energy'} · {ability.energyCost}⚡
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 16 },
  connectSafe: { flex: 1, paddingHorizontal: 20 },
  connectCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  modeText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  connIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  roomCode: { color: colors.text, fontFamily: fonts.mono, fontSize: 40, letterSpacing: 10, marginTop: 20 },
  connStatus: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  connError: { color: colors.enemy, fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  connHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 16 },

  fighter: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12 },
  fighterRight: { flexDirection: 'row-reverse' },
  avatar: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarGlyph: { fontSize: 30 },
  fighterInfo: { flex: 1, gap: 5 },
  fighterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fighterName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, flexShrink: 1 },
  statusTag: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  energyTrack: { height: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hpText: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },
  elBadge: { fontSize: 11, fontWeight: '700' },

  turnBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 10 },
  turnText: { fontSize: 14, fontWeight: '700', fontFamily: fonts.display },
  clock: { color: colors.text, fontFamily: fonts.mono, fontSize: 16 },
  log: { flex: 1, justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  logLine: { color: colors.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  logLast: { color: colors.textMuted, fontSize: 13 },

  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12, justifyContent: 'space-between' },
  move: { width: '48.5%', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  moveOff: { opacity: 0.4 },
  moveGrad: { paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  moveName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  moveMeta: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },

  resultCrest: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 34 },
  forfeit: { color: colors.territory, fontSize: 13, marginTop: 8 },
  resultSub: { color: colors.textDim, fontSize: 14, marginTop: 8 },
  resultXp: { color: colors.gold, fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 24 },
  primaryBtn: { backgroundColor: colors.territory, paddingVertical: 15, paddingHorizontal: 40, borderRadius: radius.lg },
  primaryText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
