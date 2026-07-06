import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Bell, Coins, Flame, Play, Swords, Trophy } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { levelForXp, useGame } from '../../features/game/game-store'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

function MiniStat({ icon, value, label, delay }: { icon: ReactNode; value: string; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.miniStat}>
      {icon}
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const game = useGame()
  const { level, into, need } = levelForXp(game.xp)
  const pct = Math.min(100, Math.round((into / need) * 100))
  const areaKm2 = game.tiles.size * tileAreaKm2(17.4239)

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

        {/* Territory hero */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <View style={styles.hero}>
            <LinearGradient
              colors={[game.color + '2E', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroArea}>
                  {areaKm2.toFixed(3)} <Text style={styles.heroUnit}>km²</Text>
                </Text>
                <Text style={styles.heroLabel}>YOUR TERRITORY · {game.tiles.size} TILES</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: game.color, shadowColor: game.color }]} />
            </View>

            {/* Level progress */}
            <View style={styles.levelRow}>
              <Text style={styles.levelText}>LVL {level}</Text>
              <Text style={styles.levelXp}>
                {into}/{need} XP
              </Text>
            </View>
            <View style={styles.track}>
              <LinearGradient
                colors={['#22D3A6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.fill, { width: `${pct}%` }]}
              />
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

        <Animated.View entering={FadeInDown.delay(180)}>
          <TouchableOpacity style={styles.duel} activeOpacity={0.85} onPress={() => router.push('/battle')}>
            <Swords color={colors.enemy} size={18} />
            <Text style={styles.duelText}>Duel a rival</Text>
            <Text style={styles.duelHint}>Bluetooth or quick match</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Mini stats */}
        <View style={styles.statRow}>
          <MiniStat icon={<Trophy color={colors.gold} size={20} />} value={`${level}`} label="LEVEL" delay={220} />
          <MiniStat icon={<Coins color={colors.primary} size={20} />} value={`${game.xp}`} label="$ZORR" delay={280} />
          <MiniStat icon={<Flame color={colors.enemy} size={20} />} value={`${game.bestStreak}`} label="BEST COMBO" delay={340} />
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
    padding: 22,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  heroArea: { color: colors.text, fontSize: 40, fontFamily: fonts.display },
  heroUnit: { fontSize: 20, color: colors.textDim },
  heroLabel: { color: colors.textDim, fontSize: 11, marginTop: 6, letterSpacing: 1.2 },
  chip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelText: { color: colors.text, fontSize: 12, fontFamily: fonts.mono, letterSpacing: 1 },
  levelXp: { color: colors.textDim, fontSize: 12, fontFamily: fonts.mono },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
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
  duel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  duelText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  duelHint: { color: colors.textDim, fontSize: 12, marginLeft: 'auto' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  miniStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  miniValue: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  miniLabel: { color: colors.textFaint, fontSize: 10, letterSpacing: 1 },
})
