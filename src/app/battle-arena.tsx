import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Bluetooth, Bot, Coins, Globe, Sparkles, Trophy, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { CTA, GlowCard, MeterBar, Press } from '../components/ui'
import { beastImage } from '../features/beasts/beast-art'
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
import { requestVrfSeed } from '../features/chain/vrf'
import { hexSeed, scopeFromString } from '../features/chain/vrf-seed'
import { failHaptic, hitHaptic, winHaptic } from '../features/core/haptics'
import { useGame } from '../features/game/game-store'
import { cancelWager, reportWager, stakeWager, submitStats } from '../features/nft/nft'
import { tileAreaKm2 } from '../features/run/use-run-session'
import { colors, fonts, radius } from '../theme'

type Mode = 'bot' | 'bt' | 'online'
type Phase = 'connecting' | 'summoning' | 'battle' | 'result'
const TURN_SECONDS = 30

export default function BattleArena() {
  const params = useLocalSearchParams<{ mode?: string; room?: string; stake?: string }>()
  const mode = (params.mode as Mode) || 'bot'
  const room = (params.room as string) || ''
  // Optional $ZORR wager (PvP only). Both players stake the same amount into a
  // shared room; the winner takes the pot. Online keys the pot by room code; BT
  // keys it by the agreed match seed (both peers derive the same one).
  const stake = mode === 'bot' ? 0 : Math.max(0, Math.floor(Number(params.stake) || 0))
  const game = useGame()
  const mySeed = game.activeBeast
  // Your Guardian fights at your real progression level — every run's XP feeds
  // levelForXp(xp) → stronger stats (beast.ts scales +3/level). Sent to peers
  // over the wire, so PvP is level-aware too.
  const myLevel = game.level

  const [phase, setPhase] = useState<Phase>(mode === 'bot' ? 'battle' : 'connecting')
  // Bot battles start immediately (no flash of the connecting screen); PvP waits
  // for the handshake to build the state.
  const [state, setState] = useState<BattleState | null>(() => {
    if (mode !== 'bot') return null
    const botSeed = `bot-${Math.floor(Math.random() * 100000)}`
    // Bot matches your level so the fight stays fair as you climb — progression
    // shows in bigger stats on both sides, not a walkover.
    return initBattle(generateBeast(mySeed, myLevel), generateBeast(botSeed, myLevel), botSeed)
  })
  const [status, setStatus] = useState('Getting ready…')
  const [left, setLeft] = useState(false) // opponent forfeited
  const [clock, setClock] = useState(TURN_SECONDS)
  // $ZORR wager bookkeeping.
  const [pot, setPot] = useState(0)
  const [zorrWon, setZorrWon] = useState(0)
  const wagerRoomRef = useRef<string | null>(null) // set once staked, keys the pot
  const wagerReportedRef = useRef(false)

  // Handshake + battle bookkeeping (refs so the stable message handler sees latest).
  const myNonce = useRef(1 + Math.floor(Math.random() * 1_000_000_000))
  const roleRef = useRef<Role | null>(null)
  const peerNonceRef = useRef<number | null>(null)
  const peerBeastRef = useRef<{ seed: string; level: number } | null>(null)
  const goRef = useRef(false)
  const battleSeedRef = useRef<string | null>(null) // host-authoritative match seed
  const startedRef = useRef(false)
  const helloSentRef = useRef(false)
  const rewardedRef = useRef(false)
  const mySideRef = useRef<Side>('p1')
  const stateRef = useRef<BattleState | null>(null)
  stateRef.current = state
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode
  const transportRef = useRef<{ send: (m: string) => void }>({ send: () => {} })

  // Build the battle from an agreed match seed (VRF or the deterministic
  // fallback). p1 = host's Guardian, p2 = guest's — a convention both know.
  const beginBattleWithSeed = useCallback(
    (matchSeedStr: string) => {
      const peer = peerBeastRef.current
      if (!peer || !roleRef.current) return
      const iAmHost = roleRef.current === 'host'
      const hostSeed = iAmHost ? mySeed : peer.seed
      const hostLvl = iAmHost ? myLevel : peer.level
      const guestSeed = iAmHost ? peer.seed : mySeed
      const guestLvl = iAmHost ? peer.level : myLevel
      mySideRef.current = iAmHost ? 'p1' : 'p2'
      setState(battleFromSeeds(hostSeed, hostLvl, guestSeed, guestLvl, matchSeedStr))
      setPhase('battle')
      // Place the $ZORR wager once both peers reach the agreed seed — online keys
      // the pot by room code, BT by the shared seed, so both stake the same room.
      if (stake > 0 && !wagerRoomRef.current) {
        const wroom = mode === 'online' ? room : `bt-${matchSeedStr.slice(0, 20)}`
        wagerRoomRef.current = wroom
        stakeWager(wroom, stake)
          .then((r) => setPot(r.pot))
          .catch(() => {
            wagerRoomRef.current = null // stake failed (low balance / relay) → play friendly
          })
      }
    },
    [mySeed, myLevel, stake, mode, room],
  )

  // Host is the seed authority: it draws a verifiable VRF seed (falling back to
  // the deterministic nonce seed if VRF is unreachable), broadcasts the final
  // seed, then starts. This keeps both phones on the *same* seed — no desync —
  // and the seed is on-chain verifiable for the match scope.
  const startAsHost = useCallback(async () => {
    const nonceSeed = matchSeed(myNonce.current, peerNonceRef.current ?? 0)
    setPhase('summoning')
    let finalSeed = nonceSeed
    try {
      const { seed } = await requestVrfSeed(scopeFromString(nonceSeed))
      finalSeed = hexSeed(seed)
    } catch {
      finalSeed = nonceSeed
    }
    battleSeedRef.current = finalSeed
    transportRef.current.send(encodeBattleMsg({ type: 'seed', seed: finalSeed }))
    transportRef.current.send(encodeBattleMsg({ type: 'go' }))
    beginBattleWithSeed(finalSeed)
  }, [beginBattleWithSeed])

  const tryStart = useCallback(() => {
    if (startedRef.current || !roleRef.current || !peerBeastRef.current) return
    if (roleRef.current === 'host') {
      startedRef.current = true
      startAsHost()
    } else if (goRef.current && battleSeedRef.current) {
      startedRef.current = true
      beginBattleWithSeed(battleSeedRef.current)
    }
  }, [startAsHost, beginBattleWithSeed])

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
        case 'seed':
          // Guest receives the host's authoritative match seed.
          battleSeedRef.current = msg.seed
          setPhase('summoning')
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

  // Kick off the chosen mode. Bot state is already built in useState above.
  useEffect(() => {
    if (mode === 'bot') return
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

  // Bluetooth: auto-challenge the first player we discover — but only ONE side
  // may initiate. Both phones advertise + discover, so both see each other; if
  // both called connect() at once the link forms then instantly drops (the
  // Nearby symmetric collision). We elect a single initiator deterministically:
  // the phone whose unique tag sorts higher requests the connection, the other
  // simply waits and auto-accepts the invitation (onInvitationReceived).
  useEffect(() => {
    if (mode !== 'bt' || nearby.connected || nearby.peers.length === 0) return
    const peer = nearby.peers[0]
    if (nearby.myTag > peer.rawName) nearby.connect(peer.peerId)
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
      game.recordDuel(true)
      // Opponent vanished before the duel resolved — the relay can't confirm a
      // winner, so reclaim our own stake (their stake waits for them to reclaim).
      if (wagerRoomRef.current && !wagerReportedRef.current) {
        wagerReportedRef.current = true
        cancelWager(wagerRoomRef.current).catch(() => {})
      }
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
      hitHaptic()
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
      const won = state.winner === mySideRef.current
      if (won) winHaptic()
      else failHaptic()
      game.award(won ? WIN_XP : LOSE_XP)
      game.recordDuel(won)
      // Settle the $ZORR wager — the winner takes the pot once both peers report.
      if (wagerRoomRef.current && !wagerReportedRef.current) {
        wagerReportedRef.current = true
        reportWager(wagerRoomRef.current, won)
          .then((r) => {
            if (r.settled && r.iWon && r.won) setZorrWon(r.won)
          })
          .catch(() => {})
      }
      // Publish the fresh record to the global leaderboard (fire-and-forget).
      submitStats({
        name: game.name,
        color: game.color,
        km2: game.tiles.size * tileAreaKm2(17.4239),
        tiles: game.tiles.size,
        xp: game.xp + (won ? WIN_XP : LOSE_XP),
        runs: game.stats.runs,
        wins: game.stats.duelsWon + (won ? 1 : 0),
      }).catch(() => {})
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
  if (phase === 'connecting' || phase === 'summoning' || !state) {
    const summoning = phase === 'summoning'
    return (
      <View style={styles.root}>
        <Aurora />
        <SafeAreaView style={styles.connectSafe}>
          <TouchableOpacity style={styles.close} onPress={quit}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
          <View style={styles.connectCenter}>
            <View style={styles.connIcon}>
              {summoning ? (
                <Sparkles color={colors.gold} size={30} />
              ) : mode === 'bt' ? (
                <Bluetooth color={colors.primary} size={30} />
              ) : (
                <Globe color={colors.primary} size={30} />
              )}
            </View>
            {mode === 'online' && !summoning ? <Text style={styles.roomCode}>{room}</Text> : null}
            <ActivityIndicator color={summoning ? colors.gold : colors.primary} style={{ marginVertical: 16 }} />
            <Text style={styles.connStatus}>{summoning ? 'Rolling verifiable fate — MagicBlock VRF…' : status}</Text>
            {connError && !summoning ? <Text style={styles.connError}>{connError}</Text> : null}
            {mode === 'online' && !summoning ? <Text style={styles.connHint}>Share this room code with a friend to duel.</Text> : null}
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
            {zorrWon > 0 ? (
              <Text style={styles.resultZorr}>+{zorrWon.toLocaleString()} ZORR</Text>
            ) : stake > 0 && !won && !left ? (
              <Text style={styles.resultZorrLost}>−{stake.toLocaleString()} ZORR staked</Text>
            ) : null}
            <CTA label="Back to Arena" onPress={quit} style={{ alignSelf: 'stretch', marginHorizontal: 24, marginTop: 24 }} />
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
          <View style={styles.headerRight}>
            {pot > 0 ? (
              <View style={styles.potBadge}>
                <Coins color={colors.gold} size={13} />
                <Text style={styles.potText}>{pot.toLocaleString()}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.close} onPress={quit}>
              <X color={colors.text} size={18} />
            </TouchableOpacity>
          </View>
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
  const low = beast.health / beast.beast.maxHealth < 0.3
  const art = beastImage(beast.beast.seed, beast.beast.element, beast.beast.name)
  return (
    <GlowCard tint={el.color} glow={mine ? el.color : undefined} radiusSize={radius.lg} contentStyle={[styles.fighter, align === 'right' && styles.fighterRight]}>
      <View style={[styles.avatar, { borderColor: el.color, backgroundColor: `${el.color}1A`, shadowColor: el.color }]}>
        {art ? <Image source={art} style={styles.avatarImg} resizeMode="cover" /> : <Text style={styles.avatarGlyph}>{beast.beast.glyph}</Text>}
      </View>
      <View style={styles.fighterInfo}>
        <View style={styles.fighterTop}>
          <Text style={styles.fighterName} numberOfLines={1}>
            {beast.beast.name}
          </Text>
          {beast.status ? <Text style={[styles.statusTag, { color: colors.enemy }]}>{beast.status.type}</Text> : null}
        </View>
        <MeterBar
          value={beast.health}
          max={beast.beast.maxHealth}
          palette={low ? (['#F43F5E', '#BE123C'] as const) : (['#34E3B8', '#0F766E'] as const)}
        />
        <View style={styles.metaRow}>
          <Text style={styles.hpText}>
            {beast.health}/{beast.beast.maxHealth} HP
          </Text>
          <Text style={[styles.elBadge, { color: el.color }]}>
            {el.glyph} {el.label}
          </Text>
        </View>
        <MeterBar value={beast.energy} max={beast.beast.maxEnergy} palette={['#FBBF24', '#B45309'] as const} height={4} />
      </View>
    </GlowCard>
  )
}

function MoveButton({ ability, disabled, onPress }: { ability: Ability; disabled: boolean; onPress: () => void }) {
  const el = ELEMENT_META[ability.element]
  const tint = ability.kind === 'heal' ? colors.territory : ability.kind === 'energy' ? colors.gold : ability.kind === 'guard' ? colors.textMuted : el.color
  return (
    <Press style={[styles.move, disabled && styles.moveOff]} onPress={onPress} disabled={disabled}>
      <View style={[styles.moveEdge, { borderColor: `${tint}55` }]}>
        <LinearGradient colors={[`${tint}26`, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.moveGrad}>
          <Text style={styles.moveName} numberOfLines={1}>
            {ability.name}
          </Text>
          <Text style={styles.moveMeta}>
            {ability.kind === 'attack' ? `${ability.power} pow` : ability.kind === 'heal' ? 'heal' : ability.kind === 'guard' ? 'guard' : '+energy'} · {ability.energyCost}⚡
          </Text>
        </LinearGradient>
      </View>
    </Press>
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

  fighter: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  fighterRight: { flexDirection: 'row-reverse' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarGlyph: { fontSize: 30 },
  fighterInfo: { flex: 1, gap: 6 },
  fighterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fighterName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, flexShrink: 1 },
  statusTag: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
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
  move: { width: '48.5%' },
  moveOff: { opacity: 0.4 },
  moveEdge: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface2 },
  moveGrad: { paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  moveName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  moveMeta: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },

  resultCrest: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 34 },
  forfeit: { color: colors.territory, fontSize: 13, marginTop: 8 },
  resultSub: { color: colors.textDim, fontSize: 14, marginTop: 8 },
  resultXp: { color: colors.gold, fontSize: 16, fontWeight: '700', marginTop: 8 },
  resultZorr: { color: colors.gold, fontFamily: fonts.display, fontSize: 22, marginTop: 6 },
  resultZorrLost: { color: colors.textDim, fontSize: 14, marginTop: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  potBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.1)' },
  potText: { color: colors.gold, fontSize: 13, fontWeight: '800', fontFamily: fonts.mono },
  primaryBtn: { backgroundColor: colors.territory, paddingVertical: 15, paddingHorizontal: 40, borderRadius: radius.lg },
  primaryText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
