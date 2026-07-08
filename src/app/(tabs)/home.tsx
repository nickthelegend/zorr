import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Bell, Play, Shield, Swords } from 'lucide-react-native'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LevelRing } from '../../components/level-ring'
import { levelForXp, useGame } from '../../features/game/game-store'
import { formatKm, formatWinRate, nextRank, rankForLevel } from '../../features/game/stats'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

function LogCell({ value, label, delay, accent }: { value: string; label: string; delay: number; accent?: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.logCell}>
      <Text style={[styles.logValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.logLabel}>{label}</Text>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const game = useGame()
  const { level, into, need } = levelForXp(game.xp)
  const rank = rankForLevel(level)
  const promo = nextRank(level)
  const areaKm2 = game.tiles.size * tileAreaKm2(17.4239)
  const s = game.stats

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>GM, {game.name}</Text>
            <Text style={styles.brand}>ZORR</Text>
          </View>
          <TouchableOpacity style={styles.bell}>
            <Bell color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        {/* Command hero: territory + compass level ring */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <View style={styles.hero}>
            <LinearGradient
              colors={[game.color + '2E', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <View style={[styles.rankPill, { borderColor: rank.color + '66' }]}>
                  <Text style={[styles.rankText, { color: rank.color }]}>{rank.title}</Text>
                </View>
                <Text style={styles.heroArea}>
                  {areaKm2.toFixed(3)} <Text style={styles.heroUnit}>km²</Text>
                </Text>
                <Text style={styles.heroLabel}>TERRITORY HELD · {game.tiles.size} TILES</Text>
                <Text style={styles.xpLine}>
                  {into}/{need} XP{promo ? `  ·  ${promo.title} AT LVL ${promo.minLevel}` : '  ·  TOP OF THE LADDER'}
                </Text>
              </View>
              <LevelRing progress={into / need} level={level} color={rank.color} />
            </View>
          </View>
        </Animated.View>

        {/* Start run CTA */}
        <Animated.View entering={FadeInDown.delay(140)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/capture')}>
            <LinearGradient colors={['#22D3A6', '#0F766E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Play color="#04110C" size={20} fill="#04110C" />
              <Text style={styles.ctaText}>Start a Run</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.ctaHint}>Capture territory as you move. Every run logs on-chain.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180)} style={styles.actionRow}>
          <TouchableOpacity style={styles.action} activeOpacity={0.85} onPress={() => router.push('/guardians')}>
            <Shield color={colors.primary} size={18} />
            <Text style={styles.duelText}>Guardians</Text>
            <Text style={styles.duelHint}>{game.beasts.length} in roster</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} activeOpacity={0.85} onPress={() => router.push('/battle')}>
            <Swords color={colors.enemy} size={18} />
            <Text style={styles.duelText}>Duel</Text>
            <Text style={styles.duelHint}>BT · online · AI</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Mission log — lifetime metrics */}
        <Text style={styles.section}>MISSION LOG</Text>
        <View style={styles.logGrid}>
          <LogCell value={`${s.runs}`} label="RUNS" delay={220} />
          <LogCell value={formatKm(s.distanceKm)} label="KM COVERED" delay={250} />
          <LogCell value={formatKm(s.longestRunKm)} label="LONGEST KM" delay={280} />
          <LogCell value={formatWinRate(s)} label="DUEL WIN %" accent={colors.territory} delay={310} />
          <LogCell value={`${s.duelsWon}–${s.duelsLost}`} label="DUEL RECORD" delay={340} />
          <LogCell value={`${game.xp}`} label="$ZORR" accent={colors.gold} delay={370} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  hi: { color: colors.textDim, fontSize: 13, letterSpacing: 0.5 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 26, letterSpacing: 2, marginTop: 2 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 20,
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroLeft: { flex: 1 },
  rankPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  rankText: { fontSize: 10, fontFamily: fonts.mono, letterSpacing: 2 },
  heroArea: { color: colors.text, fontSize: 36, fontFamily: fonts.display },
  heroUnit: { fontSize: 18, color: colors.textDim },
  heroLabel: { color: colors.textDim, fontSize: 11, marginTop: 6, letterSpacing: 1.2 },
  xpLine: { color: colors.textFaint, fontSize: 10, fontFamily: fonts.mono, letterSpacing: 0.5, marginTop: 10 },
  cta: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },
  ctaText: { color: '#04110C', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  ctaHint: { color: colors.textDim, fontSize: 12.5, textAlign: 'center', marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  action: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  duelText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  duelHint: { color: colors.textDim, fontSize: 12, marginLeft: 'auto' },
  section: { color: colors.textFaint, fontSize: 11, letterSpacing: 2, marginTop: 24, marginBottom: 10 },
  logGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  logCell: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  logValue: { color: colors.text, fontSize: 19, fontFamily: fonts.display },
  logLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1 },
})
