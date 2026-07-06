import { Crown } from 'lucide-react-native'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useGame } from '../../features/game/game-store'
import { buildLeaderboard, Runner } from '../../features/leaderboard/leaderboard'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

const RANK_ACCENT = ['#FBBF24', '#CBD5E1', '#B45309'] // gold / silver / bronze

function Row({ rank, r, delay }: { rank: number; r: Runner; delay: number }) {
  const accent = rank <= 3 ? RANK_ACCENT[rank - 1] : undefined
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={[styles.row, r.you && styles.rowYou]}>
      <Text style={[styles.rank, accent ? { color: accent } : null]}>{rank}</Text>
      <View style={[styles.chip, { backgroundColor: r.color, shadowColor: r.color }]} />
      <Text style={[styles.name, r.you && { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
        {r.name}
        {r.you ? '  (you)' : ''}
      </Text>
      <Text style={styles.km2}>{r.km2.toFixed(2)} km²</Text>
    </Animated.View>
  )
}

export default function LeaderboardScreen() {
  const game = useGame()
  const youKm2 = game.tiles.size * tileAreaKm2(17.4239)
  const board = useMemo(
    () => buildLeaderboard({ name: game.name, color: game.color, km2: youKm2 }),
    [game.name, game.color, youKm2],
  )
  const yourRank = board.findIndex((r) => r.you) + 1

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Leaderboard</Text>
        <Text style={styles.sub}>THIS WEEK · TERRITORY CAPTURED</Text>

        {/* Your standing */}
        <Animated.View entering={FadeInDown.delay(40)} style={styles.youCard}>
          <View style={styles.youLeft}>
            <Crown color={colors.gold} size={18} />
            <View>
              <Text style={styles.youRank}>#{yourRank}</Text>
              <Text style={styles.youLabel}>YOUR RANK</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.youKm2}>{youKm2.toFixed(2)} km²</Text>
            <Text style={styles.youLabel}>{game.tiles.size} TILES HELD</Text>
          </View>
        </Animated.View>

        <View style={styles.list}>
          {board.map((r, i) => (
            <Row key={r.name + i} rank={i + 1} r={r} delay={60 + i * 22} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  sub: { color: colors.textDim, fontSize: 11, letterSpacing: 1.4, marginTop: 4, marginBottom: 18 },
  youCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 18,
  },
  youLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  youRank: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  youLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1 },
  youKm2: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  list: { gap: 8 },
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
})
