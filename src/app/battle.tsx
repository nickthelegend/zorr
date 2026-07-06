import { router } from 'expo-router'
import { Bluetooth, Swords, Trophy, X, Zap } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { useGame } from '../features/game/game-store'
import { RIVAL_CLANS } from '../features/game/rivals'
import { useNearby } from '../features/battle/use-nearby'
import { colors, fonts, radius } from '../theme'

type Mode = 'lobby' | 'countdown' | 'fight' | 'result'
const FIGHT_MS = 5000
const WIN_XP = 300
const LOSE_XP = 60

export default function BattleScreen() {
  const game = useGame()
  const [mode, setMode] = useState<Mode>('lobby')
  const [oppName, setOppName] = useState('Rival')
  const [isPeer, setIsPeer] = useState(false)
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [count, setCount] = useState(3)
  const [timeLeft, setTimeLeft] = useState(FIGHT_MS)

  const myScoreRef = useRef(0)
  const oppScoreRef = useRef(0)

  // Peer duel: opponent taps arrive as "S:<n>".
  const nearby = useNearby(game.name, (text) => {
    if (text.startsWith('S:')) {
      const n = parseInt(text.slice(2), 10)
      if (!Number.isNaN(n)) {
        oppScoreRef.current = n
        setOppScore(n)
      }
    }
  })

  // Always point at the latest transport without making effects depend on it.
  const nearbyRef = useRef(nearby)
  nearbyRef.current = nearby

  // Start the moment a peer connects.
  useEffect(() => {
    if (nearby.connected && mode === 'lobby') {
      setOppName(nearby.connected.name)
      setIsPeer(true)
      beginCountdown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby.connected])

  const beginCountdown = useCallback(() => {
    setMyScore(0)
    setOppScore(0)
    myScoreRef.current = 0
    oppScoreRef.current = 0
    setCount(3)
    setMode('countdown')
  }, [])

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

  // Fight timer + bot ticker.
  useEffect(() => {
    if (mode !== 'fight') return
    const started = Date.now()
    const timer = setInterval(() => {
      const left = FIGHT_MS - (Date.now() - started)
      setTimeLeft(Math.max(0, left))
      if (left <= 0) {
        clearInterval(timer)
        botTick && clearInterval(botTick)
        if (isPeer) nearbyRef.current.send(`R:${myScoreRef.current}`)
        setMode('result')
      }
    }, 100)
    let botTick: ReturnType<typeof setInterval> | undefined
    if (!isPeer) {
      botTick = setInterval(() => {
        oppScoreRef.current += 1
        setOppScore(oppScoreRef.current)
      }, 150 + Math.floor(60 * (0.5))) // ~5-6 taps/s bot
    }
    return () => {
      clearInterval(timer)
      if (botTick) clearInterval(botTick)
    }
  }, [mode, isPeer])

  // Reward once, on entering result.
  const rewarded = useRef(false)
  useEffect(() => {
    if (mode === 'result' && !rewarded.current) {
      rewarded.current = true
      game.award(myScoreRef.current > oppScoreRef.current ? WIN_XP : LOSE_XP)
    }
    if (mode !== 'result') rewarded.current = false
  }, [mode, game])

  const tapScale = useSharedValue(1)
  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scale: tapScale.value }] }))
  const onTap = () => {
    myScoreRef.current += 1
    setMyScore(myScoreRef.current)
    if (isPeer) nearby.send(`S:${myScoreRef.current}`)
    tapScale.value = withSpring(0.94, { damping: 8 }, () => {
      tapScale.value = withTiming(1, { duration: 90 })
    })
  }

  const quit = useCallback(() => {
    nearby.stop()
    router.back()
  }, [nearby])

  const won = myScore > oppScore
  const tie = myScore === oppScore

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
            <Text style={styles.resultTitle}>{tie ? 'Draw' : won ? 'Victory' : 'Defeated'}</Text>
            <Text style={styles.resultScore}>
              {myScore} — {oppScore}
            </Text>
            <Text style={styles.resultXp}>+{won ? WIN_XP : LOSE_XP} XP</Text>
            <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={beginCountdown}>
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
})
