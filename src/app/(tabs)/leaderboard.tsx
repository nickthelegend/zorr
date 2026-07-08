import { Crown, RefreshCw, WifiOff } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlowCard, Press } from '../../components/ui'
import { useGame } from '../../features/game/game-store'
import { rankBoard, type Runner } from '../../features/leaderboard/leaderboard'
import { fetchLeaderboard, getOwnerAddress, submitStats } from '../../features/nft/nft'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

const RANK_ACCENT = ['#FBBF24', '#CBD5E1', '#B45309'] // gold / silver / bronze

function Row({ rank, r, delay }: { rank: number; r: Runner; delay: number }) {
  const accent = rank <= 3 ? RANK_ACCENT[rank - 1] : undefined
  const open = () => r.owner && Linking.openURL(`https://explorer.solana.com/address/${r.owner}?cluster=devnet`)
  return (
    <Animated.View entering={FadeInDown.delay(delay)}>
      <Press onPress={r.owner ? open : undefined} style={[styles.row, r.you && styles.rowYou]}>
        <Text style={[styles.rank, accent ? { color: accent } : null]}>{rank}</Text>
        <View style={[styles.chip, { backgroundColor: r.color, shadowColor: r.color }]} />
        <Text style={[styles.name, r.you && { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
          {r.name}
          {r.you ? '  (you)' : ''}
        </Text>
        <Text style={styles.km2}>{r.km2.toFixed(2)} km²</Text>
      </Press>
    </Animated.View>
  )
}

export default function LeaderboardScreen() {
  const game = useGame()
  const youKm2 = game.tiles.size * tileAreaKm2(17.4239)
  const [others, setOthers] = useState<Runner[]>([])
  const [owner, setOwner] = useState<string>()
  const [online, setOnline] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Publish my real stats, then pull every real player from the relay.
  const sync = useCallback(async () => {
    setRefreshing(true)
    try {
      const addr = await getOwnerAddress()
      setOwner(addr)
      await submitStats({
        name: game.name,
        color: game.color,
        km2: youKm2,
        tiles: game.tiles.size,
        xp: game.xp,
        runs: game.stats.runs,
        wins: game.stats.duelsWon,
      }).catch(() => {})
      const players = await fetchLeaderboard()
      setOthers(players.map((p) => ({ owner: p.owner, name: p.name, color: p.color, km2: p.km2 })))
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setRefreshing(false)
    }
  }, [game.name, game.color, game.xp, game.tiles.size, game.stats.runs, game.stats.duelsWon, youKm2])

  useEffect(() => {
    sync()
  }, [sync])

  const board = rankBoard({ owner, name: game.name, color: game.color, km2: youKm2 }, others)
  const yourRank = board.findIndex((r) => r.you) + 1

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <View>
            <Text style={styles.brand}>Leaderboard</Text>
            <Text style={styles.sub}>LIVE · REAL PLAYERS · TERRITORY HELD</Text>
          </View>
          <Press onPress={sync} hitSlop={8}>
            <View style={styles.refresh}>
              <RefreshCw color={refreshing ? colors.textFaint : colors.textMuted} size={17} />
            </View>
          </Press>
        </View>

        {/* Your standing */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <GlowCard borderTint={colors.primary} tint={colors.primary} contentStyle={styles.youCard}>
            <View style={styles.youLeft}>
              <Crown color={colors.gold} size={18} />
              <View>
                <Text style={styles.youRank}>#{yourRank}</Text>
                <Text style={styles.youLabel}>YOUR RANK{online ? '' : ' · OFFLINE'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.youKm2}>{youKm2.toFixed(2)} km²</Text>
              <Text style={styles.youLabel}>{game.tiles.size} TILES HELD</Text>
            </View>
          </GlowCard>
        </Animated.View>

        {!online ? (
          <View style={styles.offlineRow}>
            <WifiOff color={colors.gold} size={14} />
            <Text style={styles.offlineText}>
              Global standings need the relay — start it with npm run relay and pull to refresh.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {board.map((r, i) => (
            <Row key={(r.owner ?? r.name) + i} rank={i + 1} r={r} delay={60 + i * 22} />
          ))}
        </View>

        {online && board.length === 1 ? (
          <Text style={styles.soloHint}>You’re the first explorer on the board — every row here is a real player.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  sub: { color: colors.textDim, fontSize: 11, letterSpacing: 1.4, marginTop: 4 },
  refresh: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  youLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  youRank: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  youLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1 },
  youKm2: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  offlineText: { color: colors.textDim, fontSize: 12, flex: 1, lineHeight: 17 },
  list: { gap: 8, marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowYou: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rank: { color: colors.textDim, fontSize: 15, fontFamily: fonts.mono, width: 26 },
  chip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  name: { color: colors.textMuted, fontSize: 15, flex: 1 },
  km2: { color: colors.text, fontSize: 14, fontFamily: fonts.mono },
  soloHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 17 },
})
