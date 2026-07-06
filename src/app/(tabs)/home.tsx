import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Bell, Coins, Flag, Footprints, TrendingUp, Trophy, Zap } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../../components/glass-card'
import { levelForXp, useGame } from '../../features/game/game-store'
import { colors, fonts, radius } from '../../theme'

function StatCard({ icon, label, value, delay }: { icon: ReactNode; label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.statWrap}>
      <GlassCard style={styles.statCard}>
        <View style={styles.statIcon}>{icon}</View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </GlassCard>
    </Animated.View>
  )
}

function Milestone({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <View style={styles.milestone}>
      <View style={styles.milestoneRow}>
        <Text style={styles.milestoneLabel}>{label}</Text>
        <Text style={styles.milestoneValue}>
          {value}/{total}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const game = useGame()
  const { level, into, need } = levelForXp(game.xp)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Level {level} Explorer</Text>
            <Text style={styles.brand}>ZORR</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Bell color={colors.text} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <StatCard icon={<Flag color={colors.territory} size={22} />} label="Tiles held" value={`${game.tiles.size}`} delay={80} />
          <StatCard icon={<Trophy color={colors.gold} size={22} />} label="Level" value={`${level}`} delay={160} />
          <StatCard icon={<Coins color={colors.primary} size={22} />} label="$ZORR" value={`${game.xp}`} delay={240} />
        </View>

        <Animated.View entering={FadeInDown.delay(320)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/capture')}>
            <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <View style={styles.ctaIcon}>
                <Footprints color={colors.text} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Walk &amp; Capture the Land</Text>
                <Text style={styles.ctaSub}>Move to claim tiles. Each claim is a real on-chain tx.</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)}>
          <GlassCard style={{ marginTop: 20 }}>
            <View style={styles.cardHead}>
              <TrendingUp color={colors.territory} size={18} />
              <Text style={styles.cardTitle}>Progress</Text>
            </View>
            <Milestone label={`XP to level ${level + 1}`} value={into} total={need} color={colors.primary} />
            <Milestone label="Tiles captured" value={game.tiles.size} total={Math.max(10, Math.ceil((game.tiles.size + 1) / 10) * 10)} color={colors.territory} />
            <Milestone label="Best combo" value={game.bestStreak} total={Math.max(5, game.bestStreak + 1)} color={colors.gold} />
          </GlassCard>
        </Animated.View>

        {game.bestStreak > 1 ? (
          <Animated.View entering={FadeInDown.delay(480)} style={styles.streakRow}>
            <Zap color={colors.gold} size={16} />
            <Text style={styles.streakText}>Best combo streak: {game.bestStreak}×</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: colors.textDim, fontSize: 14 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 26, letterSpacing: 2 },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', gap: 10 },
  statWrap: { flex: 1 },
  statCard: { borderRadius: radius.lg },
  statIcon: { marginBottom: 8 },
  statValue: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  cta: {
    marginTop: 20,
    borderRadius: radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ctaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  milestone: { marginBottom: 16 },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  milestoneLabel: { color: colors.textMuted, fontSize: 14 },
  milestoneValue: { color: colors.textDim, fontSize: 14, fontFamily: fonts.mono },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 20 },
  streakText: { color: colors.gold, fontSize: 14, fontFamily: fonts.display },
})
