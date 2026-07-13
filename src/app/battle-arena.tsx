import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Bluetooth, Bot, Coins, Globe, Sparkles, Trophy, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { CTA, MeterBar, Press } from '../components/ui'
import { beastImage } from '../features/beasts/beast-art'
import { generateBeast, RARITY_COLOR, type Ability } from '../features/beasts/beast'
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
import { cancelWager, reportWager, soloSettle, soloStake, stakeWager, submitStats } from '../features/nft/nft'
import { tileAreaKm2 } from '../features/run/use-run-session'
import { colors, fonts, radius } from '../theme'

type Mode = 'bot' | 'bt' | 'online'
type Phase = 'connecting' | 'summoning' | 'staking' | 'battle' | 'result'
const TURN_SECONDS = 30
const STAKE_ANIM_MS = 2100 // pot-staking animation length before a wagered duel

export default function BattleArena() {
  const params = useLocalSearchParams<{ mode?: string; room?: string; stake?: string }>()
  const mode = (params.mode as Mode) || 'bot'
  const room = (params.room as string) || ''
  // Optional $ZORR wager (PvP only). Both players stake the same amount into a
  // shared room; the winner takes the pot. Online keys the pot by room code; BT
  // keys it by the agreed match seed (both peers derive the same one).
  // Optional $ZORR wager on ALL modes now — AI included (the house matches your
  // stake so both enter equal). 0 = a friendly, XP-only duel.
  const stake = Math.max(0, Math.floor(Number(params.stake) || 0))
  const game = useGame()
  const mySeed = game.activeBeast
  // Your Guardian fights at your real progression level — every run's XP feeds
  // levelForXp(xp) → stronger stats (beast.ts scales +3/level). Sent to peers
  // over the wire, so PvP is level-aware too.
  const myLevel = game.level

  // Stable AI identity so re-renders don't reshuffle the opponent Guardian. The
  // bot matches your level so the fight stays fair as you climb.
  const botSeedRef = useRef(`bot-${Math.floor(Math.random() * 100000)}`)
  const buildBotBattle = useCallback(
    () => initBattle(generateBeast(mySeed, myLevel), generateBeast(botSeedRef.current, myLevel), botSeedRef.current),
    [mySeed, myLevel],
  )
  // A wagered AI duel opens on the pot-staking animation; a friendly one drops
  // straight into battle. PvP always starts on the connecting handshake.
  const [phase, setPhase] = useState<Phase>(mode === 'bot' ? (stake > 0 ? 'staking' : 'battle') : 'connecting')
  const [state, setState] = useState<BattleState | null>(() => (mode === 'bot' && stake === 0 ? buildBotBattle() : null))
  const [status, setStatus] = useState('Getting ready…')
  const [left, setLeft] = useState(false) // opponent forfeited
  const [clock, setClock] = useState(TURN_SECONDS)
  // $ZORR wager bookkeeping.
  const [pot, setPot] = useState(0)
  const [zorrWon, setZorrWon] = useState(0)
  const wagerRoomRef = useRef<string | null>(null) // set once staked, keys the pot
  const wagerReportedRef = useRef(false)
  const aiStakedRef = useRef(false) // AI solo wager actually placed → gates the payout

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
      // With a stake, both peers watch the pot fill before the fight begins.
      if (stake > 0) {
        setPhase('staking')
        setTimeout(() => setPhase('battle'), STAKE_ANIM_MS)
      } else {
        setPhase('battle')
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

  // AI wager: play the pot animation, place the real solo stake (house matches
  // you), then reveal the battle. aiStakedRef gates the win payout to a stake
  // that actually landed (low balance / relay down → play friendly).
  useEffect(() => {
    if (mode !== 'bot' || phase !== 'staking') return
    let alive = true
    if (stake > 0) {
      soloStake(stake)
        .then((r) => {
          if (alive) {
            aiStakedRef.current = true
            setPot(r.pot)
          }
        })
        .catch(() => alive && setPot(stake * 2))
    }
    const t = setTimeout(() => {
      if (!alive) return
      setState(buildBotBattle())
      setPhase('battle')
    }, STAKE_ANIM_MS)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [mode, phase, stake, buildBotBattle])

  // Bot takes its turn automatically.
  useEffect(() => {
    if (mode !== 'bot' || !sActive || sOver || sActive === mySideRef.current) return
    const t = setTimeout(() => {
      const s = stateRef.current
      if (s && !s.over && s.active !== mySideRef.current) setState(resolveMove(s, pickBotMove(s)))
    }, 850)
    return () => clearTimeout(t)
  }, [sTurn, sActive, sOver, mode])

  // My-turn countdown; auto-pick on timeout so a duel can't stall. Held until the
  // pot-staking animation finishes so the clock doesn't bleed during it.
  useEffect(() => {
    if (!sActive || sOver || sActive !== mySideRef.current || phase !== 'battle') return
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
  }, [sTurn, sActive, sOver, phase])

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
      // We may report before the opponent (settled:false), so poll: reportWager
      // is idempotent and returns our winnings the moment the pot settles.
      if (wagerRoomRef.current && !wagerReportedRef.current) {
        wagerReportedRef.current = true
        const wroom = wagerRoomRef.current
        ;(async () => {
          for (let i = 0; i < 8; i++) {
            try {
              const r = await reportWager(wroom, won)
              if (r.settled) {
                if (r.iWon && r.won) setZorrWon(r.won)
                return
              }
            } catch {
              /* relay hiccup — retry */
            }
            await new Promise((res) => setTimeout(res, 1200))
          }
        })()
      }
      // AI duel: settle the solo pot — a win takes the whole pot (2× = net +stake).
      if (mode === 'bot' && stake > 0 && aiStakedRef.current) {
        soloSettle(stake, won)
          .then((r) => {
            if (won && r.won) setZorrWon(r.won)
          })
          .catch(() => {
            if (won) setZorrWon(stake * 2)
          })
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
  if (phase === 'staking') {
    return (
      <View style={styles.root}>
        <Aurora />
        <SafeAreaView style={styles.connectSafe}>
          <TouchableOpacity style={styles.close} onPress={quit}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
          <View style={styles.connectCenter}>
            <PotStake stake={stake} foeLabel={mode === 'bot' ? 'AI' : 'Rival'} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

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
              <Animated.View entering={FadeIn.delay(250)} style={styles.wonPill}>
                <Coins color="#1a1206" size={22} />
                <Text style={styles.wonAmt}>+{zorrWon.toLocaleString()}</Text>
                <Text style={styles.wonUnit}>$ZORR</Text>
              </Animated.View>
            ) : stake > 0 && !won && !left ? (
              <Text style={styles.resultZorrLost}>−{stake.toLocaleString()} $ZORR staked</Text>
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

        <Fighter beast={foe} align="left" active={!myTurn && !state.over} />

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

        <Fighter beast={me} align="right" mine active={myTurn} />

        <View style={styles.moves}>
          {me.beast.abilities.map((a, i) => (
            <MoveButton key={a.id} ability={a} disabled={!myTurn || a.energyCost > me.energy} onPress={() => myMove(i)} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  )
}

function Fighter({ beast, align, mine, active }: { beast: BeastState; align: 'left' | 'right'; mine?: boolean; active?: boolean }) {
  const el = ELEMENT_META[beast.beast.element]
  const pct = beast.health / beast.beast.maxHealth
  const low = pct < 0.3
  const art = beastImage(beast.beast.seed, beast.beast.element, beast.beast.name)
  const rar = RARITY_COLOR[beast.beast.rarity]
  return (
    <View style={[styles.fighter, align === 'right' && styles.fighterRight]}>
      {/* Showcase sprite: element glow, framed art, platform shadow */}
      <View style={styles.stage}>
        <View style={[styles.stageGlow, { backgroundColor: el.color, opacity: active ? 0.28 : 0.14 }]} />
        <View style={[styles.platform, { backgroundColor: el.color }]} />
        <View style={[styles.spriteFrame, { borderColor: active ? el.color : `${el.color}66`, shadowColor: el.color, shadowOpacity: active ? 0.9 : 0.5 }]}>
          {art ? (
            <Image source={art} style={styles.spriteImg} resizeMode="cover" />
          ) : (
            <Text style={styles.spriteGlyph}>{beast.beast.glyph}</Text>
          )}
        </View>
        {beast.status ? (
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{beast.status.type}</Text>
          </View>
        ) : null}
      </View>

      {/* Name, rarity, HP + energy */}
      <View style={[styles.info, align === 'right' && styles.infoRight]}>
        <Text style={[styles.name, align === 'right' && styles.tRight]} numberOfLines={1}>
          {beast.beast.name}
        </Text>
        <View style={[styles.badgeRow, align === 'right' && styles.badgeRowR]}>
          <Text style={[styles.badge, { color: el.color, borderColor: `${el.color}55`, backgroundColor: `${el.color}18` }]}>
            {el.glyph} {el.label}
          </Text>
          <Text style={[styles.badge, { color: rar, borderColor: `${rar}55`, backgroundColor: `${rar}18` }]}>{beast.beast.rarity}</Text>
        </View>
        <MeterBar
          value={beast.health}
          max={beast.beast.maxHealth}
          palette={low ? (['#F43F5E', '#BE123C'] as const) : (['#34E3B8', '#0F766E'] as const)}
        />
        <Text style={[styles.hpText, align === 'right' && styles.tRight]}>
          {beast.health} / {beast.beast.maxHealth} HP
        </Text>
        <MeterBar value={beast.energy} max={beast.beast.maxEnergy} palette={['#FBBF24', '#B45309'] as const} height={4} />
      </View>
    </View>
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

// Pre-fight ritual: both fighters slide an equal $ZORR coin into a central pot,
// the coins drop in, and the pot pulses to the doubled total. Shown before every
// wagered duel (AI + PvP) so the stakes read as real money on the line.
function PotStake({ stake, foeLabel }: { stake: number; foeLabel: string }) {
  const leftX = useSharedValue(-130)
  const rightX = useSharedValue(130)
  const coinOpacity = useSharedValue(0)
  const coinDrop = useSharedValue(0) // 0 = coin in place, 1 = dropped into the pot
  const potScale = useSharedValue(0.7)

  useEffect(() => {
    coinOpacity.value = withTiming(1, { duration: 350 })
    leftX.value = withDelay(350, withTiming(0, { duration: 650, easing: Easing.in(Easing.cubic) }))
    rightX.value = withDelay(350, withTiming(0, { duration: 650, easing: Easing.in(Easing.cubic) }))
    coinDrop.value = withDelay(1000, withTiming(1, { duration: 340 }))
    potScale.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.6)) }),
      withDelay(560, withTiming(1.3, { duration: 200 })),
      withTiming(1, { duration: 260 }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const foeCoin = useAnimatedStyle(() => ({ opacity: coinOpacity.value * (1 - coinDrop.value), transform: [{ translateX: leftX.value }, { scale: 1 - coinDrop.value }] }))
  const myCoin = useAnimatedStyle(() => ({ opacity: coinOpacity.value * (1 - coinDrop.value), transform: [{ translateX: rightX.value }, { scale: 1 - coinDrop.value }] }))
  const potStyle = useAnimatedStyle(() => ({ transform: [{ scale: potScale.value }] }))

  return (
    <View style={styles.stakeWrap}>
      <Text style={styles.stakeKicker}>WAGER</Text>
      <Text style={styles.stakeTitle}>Into the pot</Text>
      <Text style={styles.stakeSub}>Both fighters stake {stake.toLocaleString()} $ZORR — winner takes it all</Text>
      <View style={styles.stakeStage}>
        <Animated.View style={[styles.coin, styles.coinFoe, foeCoin]}>
          <Text style={styles.coinAmt}>{stake.toLocaleString()}</Text>
          <Text style={styles.coinWho}>{foeLabel}</Text>
        </Animated.View>
        <Animated.View style={[styles.potBig, potStyle]}>
          <Coins color="#1a1206" size={26} />
          <Text style={styles.potBigAmt}>{(stake * 2).toLocaleString()}</Text>
          <Text style={styles.potBigWord}>POT</Text>
        </Animated.View>
        <Animated.View style={[styles.coin, styles.coinMine, myCoin]}>
          <Text style={styles.coinAmt}>{stake.toLocaleString()}</Text>
          <Text style={styles.coinWho}>You</Text>
        </Animated.View>
      </View>
    </View>
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

  fighter: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 6 },
  fighterRight: { flexDirection: 'row-reverse' },
  stage: { width: 118, height: 116, alignItems: 'center', justifyContent: 'center' },
  stageGlow: { position: 'absolute', width: 106, height: 106, borderRadius: 53 },
  platform: { position: 'absolute', bottom: 4, width: 84, height: 13, borderRadius: 7, opacity: 0.3, transform: [{ scaleX: 1.25 }] },
  spriteFrame: {
    width: 104,
    height: 104,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  spriteImg: { width: '100%', height: '100%' },
  spriteGlyph: { fontSize: 54, lineHeight: 104, textAlign: 'center', width: '100%' },
  statusChip: { position: 'absolute', top: 0, right: 4, backgroundColor: colors.enemy, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  statusChipText: { color: '#fff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  info: { flex: 1, gap: 7 },
  infoRight: {},
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 19 },
  tRight: { textAlign: 'right' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badgeRowR: { justifyContent: 'flex-end' },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, overflow: 'hidden', letterSpacing: 0.3 },
  hpText: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },

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
  wonPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.gold },
  wonAmt: { color: '#1a1206', fontFamily: fonts.display, fontSize: 24 },
  wonUnit: { color: '#3d2c07', fontSize: 12.5, fontWeight: '800', marginBottom: 2 },

  stakeWrap: { alignItems: 'center', paddingHorizontal: 10 },
  stakeKicker: { color: colors.gold, fontSize: 12, letterSpacing: 3, fontWeight: '800' },
  stakeTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 32, marginTop: 6 },
  stakeSub: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19, paddingHorizontal: 16 },
  stakeStage: { alignItems: 'center', justifyContent: 'center', marginTop: 44, height: 120, alignSelf: 'stretch' },
  coin: { position: 'absolute', top: 23, left: '50%', marginLeft: -37, width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  coinFoe: { borderColor: colors.enemy, backgroundColor: 'rgba(244,63,94,0.16)' },
  coinMine: { borderColor: colors.territory, backgroundColor: 'rgba(52,227,184,0.16)' },
  coinAmt: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  coinWho: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginTop: 1 },
  potBig: { width: 108, height: 108, borderRadius: 54, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.7, shadowRadius: 26, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  potBigAmt: { color: '#1a1206', fontFamily: fonts.display, fontSize: 26, marginTop: 2 },
  potBigWord: { color: '#3d2c07', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  potBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.1)' },
  potText: { color: colors.gold, fontSize: 13, fontWeight: '800', fontFamily: fonts.mono },
  primaryBtn: { backgroundColor: colors.territory, paddingVertical: 15, paddingHorizontal: 40, borderRadius: radius.lg },
  primaryText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
