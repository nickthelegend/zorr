import { router } from 'expo-router'
import { Bluetooth, Swords, Trophy, X, Zap } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import {
  botRate,
  botTapsAt,
  COUNTDOWN_FROM,
  electRole,
  encodeMsg,
  FIGHT_MS,
  outcomeLabel,
  parseMsg,
  resolveOutcome,
  xpForOutcome,
  type Outcome,
  type Role,
} from '../features/battle/duel'
import { useNearby } from '../features/battle/use-nearby'
import { useGame } from '../features/game/game-store'
import { RIVAL_CLANS } from '../features/game/rivals'
import { colors, fonts, radius } from '../theme'

type Mode = 'lobby' | 'countdown' | 'fight' | 'result'

export default function BattleScreen() {
  const game = useGame()
  const [mode, setMode] = useState<Mode>('lobby')
  const [oppName, setOppName] = useState('Rival')
  const [isPeer, setIsPeer] = useState(false)
  const [left, setLeft] = useState(false) // opponent forfeited by disconnecting
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [count, setCount] = useState(COUNTDOWN_FROM)
  const [timeLeft, setTimeLeft] = useState(FIGHT_MS)

  const myScoreRef = useRef(0)
  const oppScoreRef = useRef(0)
  const oppFinalRef = useRef<number | null>(null) // authoritative once peer's clock ends
  const leftRef = useRef(false)
  const roleRef = useRef<Role | null>(null)
  const modeRef = useRef<Mode>('lobby')
  modeRef.current = mode

  // Stable, non-zero election nonce for this session.
  const myNonceRef = useRef(0)
  if (!myNonceRef.current) myNonceRef.current = 1 + Math.floor(Math.random() * 1_000_000_000)

  const beginCountdown = useCallback(() => {
    setMyScore(0)
    setOppScore(0)
    setLeft(false)
    myScoreRef.current = 0
    oppScoreRef.current = 0
    oppFinalRef.current = null
    leftRef.current = false
    setCount(COUNTDOWN_FROM)
    setMode('countdown')
  }, [])

  // Points at the latest transport so callbacks/effects can reach it without
  // taking it as a dependency. Declared before the hook so the message handler
  // below can close over it.
  const nearbyRef = useRef<ReturnType<typeof useNearby> | null>(null)

  // Peer duel handshake + score sync, all over the Nearby text channel.
  const nearby = useNearby(game.name, (text) => {
    const msg = parseMsg(text)
    if (!msg) return
    const idle = modeRef.current === 'lobby' || modeRef.current === 'result'
    switch (msg.type) {
      case 'hello': {
        const role = electRole(myNonceRef.current, msg.nonce)
        if (role === 'tie') {
          myNonceRef.current = 1 + Math.floor(Math.random() * 1_000_000_000)
          nearbyRef.current?.send(encodeMsg({ type: 'hello', nonce: myNonceRef.current }))
          return
        }
        roleRef.current = role
        // The host fires the single shared start signal.
        if (role === 'host' && idle) {
          nearbyRef.current?.send(encodeMsg({ type: 'go' }))
          beginCountdown()
        }
        break
      }
      case 'go':
        if (roleRef.current !== 'host' && idle) beginCountdown()
        break
      case 'tap':
        oppScoreRef.current = msg.score
        setOppScore(msg.score)
        break
      case 'final':
        oppFinalRef.current = msg.score
        oppScoreRef.current = msg.score
        setOppScore(msg.score)
        break
    }
  })

  nearbyRef.current = nearby

  // On connect, name the opponent and open the handshake.
  useEffect(() => {
    if (!nearby.connected) return
    setOppName(nearby.connected.name)
    setIsPeer(true)
    nearbyRef.current?.send(encodeMsg({ type: 'hello', nonce: myNonceRef.current }))
  }, [nearby.connected])

  // Opponent dropping mid-match is a forfeit — you take the win.
  useEffect(() => {
    if (isPeer && !nearby.connected && (mode === 'countdown' || mode === 'fight')) {
      leftRef.current = true
      setLeft(true)
      setMode('result')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby.connected])

  // Countdown 3→2→1→fight.
  useEffect(() => {
    if (mode !== 'countdown') return
    if (count <= 0) {
      setTimeLeft(FIGHT_MS)
      setMode('fight')
      return
    }
    const id = setTimeout(() => setCount((c) => c - 1), 700)
    return () => clearTimeout(id)
  }, [mode, count])

  // Fight clock. In single-player the opponent is a deterministic bot driven by
  // the same clock; in a peer duel the opponent score arrives over the wire.
  useEffect(() => {
    if (mode !== 'fight') return
    const started = Date.now()
    const rate = botRate('even')
    const timer = setInterval(() => {
      const elapsed = Date.now() - started
      const remaining = FIGHT_MS - elapsed
      setTimeLeft(Math.max(0, remaining))
      if (!isPeer) {
        oppScoreRef.current = botTapsAt(elapsed, rate)
        setOppScore(oppScoreRef.current)
      }
      if (remaining <= 0) {
        clearInterval(timer)
        if (isPeer) nearbyRef.current?.send(encodeMsg({ type: 'final', score: myScoreRef.current }))
        setMode('result')
      }
    }, 100)
    return () => clearInterval(timer)
  }, [mode, isPeer])

  // Award XP once. For peer duels, wait a beat for the opponent's FINAL so the
  // reward is computed from reconciled scores, not a mid-flight snapshot.
  const rewarded = useRef(false)
  useEffect(() => {
    if (mode !== 'result') {
      rewarded.current = false
      return
    }
    if (rewarded.current) return
    const grant = () => {
      rewarded.current = true
      const opp = oppFinalRef.current ?? oppScoreRef.current
      const outcome: Outcome = leftRef.current ? 'win' : resolveOutcome(myScoreRef.current, opp)
      game.award(xpForOutcome(outcome))
    }
    if (isPeer && !leftRef.current) {
      const id = setTimeout(grant, 600)
      return () => clearTimeout(id)
    }
    grant()
  }, [mode, isPeer, game])

  const tapScale = useSharedValue(1)
  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scale: tapScale.value }] }))
  const onTap = () => {
    if (mode !== 'fight') return
    myScoreRef.current += 1
    setMyScore(myScoreRef.current)
    if (isPeer) nearbyRef.current?.send(encodeMsg({ type: 'tap', score: myScoreRef.current }))
    tapScale.value = withSpring(0.94, { damping: 8 }, () => {
      tapScale.value = withTiming(1, { duration: 90 })
    })
  }

  const quit = useCallback(() => {
    nearbyRef.current?.stop()
    router.back()
  }, [])

  // Rematch: re-run the handshake if a peer is still connected, otherwise drop
  // back to a quick bot match so the button always does something sensible.
  const onRematch = useCallback(() => {
    if (isPeer && nearbyRef.current?.connected) {
      nearbyRef.current?.send(encodeMsg({ type: 'hello', nonce: myNonceRef.current }))
      if (roleRef.current === 'host') {
        nearbyRef.current?.send(encodeMsg({ type: 'go' }))
        beginCountdown()
      }
      return
    }
    setIsPeer(false)
    setOppName(RIVAL_CLANS[myNonceRef.current % RIVAL_CLANS.length].name)
    beginCountdown()
  }, [isPeer, beginCountdown])

  const outcome: Outcome = left ? 'win' : resolveOutcome(myScore, oppScore)
  const won = outcome === 'win'

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.brand}>Duel</Text>
          <TouchableOpacity style={styles.close} onPress={quit}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        {mode === 'lobby' ? (
          <Animated.View entering={FadeInUp} style={styles.lobby}>
            <View style={styles.crest}>
              <Swords color={colors.primary} size={40} />
            </View>
            <Text style={styles.title}>Territory Duel</Text>
            <Text style={styles.sub}>Out-tap your rival in 5 seconds. Winner takes the XP.</Text>

            <TouchableOpacity
              style={styles.option}
              activeOpacity={0.9}
              onPress={() => {
                setIsPeer(false)
                setOppName(RIVAL_CLANS[Math.floor(count) % RIVAL_CLANS.length].name)
                beginCountdown()
              }}
            >
              <Zap color="#04110C" size={20} />
              <Text style={styles.optionText}>Quick Match</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.optionAlt]}
              activeOpacity={0.9}
              onPress={() => nearby.start()}
            >
              <Bluetooth color={colors.text} size={20} />
              <Text style={[styles.optionText, { color: colors.text }]}>
                {nearby.scanning ? 'Searching nearby…' : 'Find nearby player'}
              </Text>
            </TouchableOpacity>

            {nearby.scanning ? (
              <View style={styles.peers}>
                {nearby.peers.length === 0 ? (
                  <Text style={styles.peerHint}>Looking for Zorr players around you…</Text>
                ) : (
                  nearby.peers.map((p) => (
                    <TouchableOpacity key={p.peerId} style={styles.peerRow} onPress={() => nearby.connect(p.peerId)}>
                      <View style={styles.peerDot} />
                      <Text style={styles.peerName}>{p.name}</Text>
                      <Text style={styles.peerJoin}>Challenge</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            {nearby.error ? <Text style={styles.errorLine}>{nearby.error}</Text> : null}
          </Animated.View>
        ) : mode === 'countdown' ? (
          <View style={styles.center}>
            <Text style={styles.vs}>
              {game.name} vs {oppName}
            </Text>
            <Text style={styles.count}>{count === 0 ? 'GO' : count}</Text>
          </View>
        ) : mode === 'fight' ? (
          <View style={styles.fight}>
            <View style={styles.scoreRow}>
              <Score name={game.name} score={myScore} color={game.color} />
              <Text style={styles.timer}>{(timeLeft / 1000).toFixed(1)}</Text>
              <Score name={oppName} score={oppScore} color={colors.enemy} align="flex-end" />
            </View>
            <Pressable onPress={onTap} style={styles.tapZone}>
              <Animated.View style={[styles.tapBtn, tapStyle, { borderColor: game.color }]}>
                <Text style={styles.tapText}>TAP!</Text>
              </Animated.View>
            </Pressable>
          </View>
        ) : (
          <Animated.View entering={FadeIn} style={styles.center}>
            <View style={[styles.resultCrest, { borderColor: won ? colors.gold : colors.border }]}>
              <Trophy color={won ? colors.gold : colors.textDim} size={44} />
            </View>
            <Text style={styles.resultTitle}>{outcomeLabel(outcome)}</Text>
            {left ? <Text style={styles.forfeit}>Opponent left the duel</Text> : null}
            <Text style={styles.resultScore}>
              {myScore} — {oppScore}
            </Text>
            <Text style={styles.resultXp}>+{xpForOutcome(outcome)} XP</Text>
            <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={onRematch}>
              <Text style={styles.optionText}>Rematch</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={quit}>
              <Text style={styles.leave}>Leave</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  )
}

function Score({ name, score, color, align }: { name: string; score: number; color: string; align?: 'flex-start' | 'flex-end' }) {
  return (
    <View style={{ alignItems: align ?? 'flex-start', flex: 1 }}>
      <Text style={styles.scoreName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.scoreValue, { color }]}>{score}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobby: { flex: 1, alignItems: 'center', paddingTop: 30 },
  crest: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  sub: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 26, lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.territory,
    paddingVertical: 16,
    borderRadius: radius.lg,
    width: '100%',
    marginBottom: 12,
  },
  optionAlt: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  optionText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
  peers: { width: '100%', marginTop: 10 },
  peerHint: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  peerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.territory },
  peerName: { color: colors.text, fontSize: 15, flex: 1 },
  peerJoin: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vs: { color: colors.textDim, fontSize: 15, marginBottom: 20 },
  count: { color: colors.text, fontFamily: fonts.display, fontSize: 96 },
  fight: { flex: 1, paddingTop: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  timer: { color: colors.text, fontFamily: fonts.mono, fontSize: 28, width: 80, textAlign: 'center' },
  scoreName: { color: colors.textDim, fontSize: 12 },
  scoreValue: { fontFamily: fonts.display, fontSize: 40 },
  tapZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tapBtn: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    backgroundColor: 'rgba(124,58,237,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapText: { color: colors.text, fontFamily: fonts.display, fontSize: 40 },
  resultCrest: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 34 },
  resultScore: { color: colors.textMuted, fontSize: 20, fontFamily: fonts.mono, marginTop: 8 },
  resultXp: { color: colors.gold, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 24 },
  leave: { color: colors.textDim, fontSize: 14, marginTop: 14 },
  forfeit: { color: colors.territory, fontSize: 13, marginTop: 8 },
  errorLine: { color: colors.enemy, fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 18 },
})
