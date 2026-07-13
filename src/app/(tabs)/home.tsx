import { router } from 'expo-router'
import { Bell, HelpCircle, Play, Shield, Swords, Trophy } from 'lucide-react-native'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LevelRing } from '../../components/level-ring'
import { CTA, Eyebrow, GlowCard, Press } from '../../components/ui'
import { ZorrCard } from '../../components/zorr-card'
import { useNotifications } from '../../features/core/notifications-store'
import { levelForXp, useGame } from '../../features/game/game-store'
import { formatKm, formatWinRate, nextRank, rankForLevel } from '../../features/game/stats'
import { fetchOwned, getOwnerAddress } from '../../features/nft/nft'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

function LogCell({
  value,
  label,
  delay,
  accent,
  to,
}: {
  value: string
  label: string
  delay: number
  accent?: string
  to: string
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.logCell}>
      <Press onPress={() => router.push(to as never)}>
        <GlowCard radiusSize={radius.lg} contentStyle={styles.logInner}>
          <Text style={[styles.logValue, accent ? { color: accent } : null]}>{value}</Text>
          <Text style={styles.logLabel}>{label}</Text>
        </GlowCard>
      </Press>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const game = useGame()
  const { unread } = useNotifications()
  const { level, into, need } = levelForXp(game.xp)
  const rank = rankForLevel(level)
  const promo = nextRank(level)
  const areaKm2 = game.tiles.size * tileAreaKm2(17.4239)
  const s = game.stats

  // Sync the roster to the player's real owned Guardian NFTs (relay-backed).
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const owned = await fetchOwned(await getOwnerAddress())
        if (live && owned.length) game.setRoster(owned.map((b) => b.seed))
      } catch {
        // relay offline — keep the current roster
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Press style={styles.headerLeft} onPress={() => router.push('/profile')}>
            <View style={[styles.avatar, { borderColor: game.color, shadowColor: game.color }]}>
              <Text style={[styles.avatarText, { color: game.color }]}>{game.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.hi}>GM, {game.name}</Text>
              <Text style={styles.brand}>ZORR</Text>
            </View>
          </Press>
          <View style={styles.headerActions}>
            <Press onPress={() => router.push('/notifications')}>
              <View style={styles.bell}>
                <Bell color={colors.text} size={19} />
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </View>
            </Press>
            <Press onPress={() => router.push('/leaderboard')}>
              <View style={styles.bell}>
                <Trophy color={colors.gold} size={19} />
              </View>
            </Press>
            <Press onPress={() => router.push('/settings')}>
              <View style={styles.bell}>
                <HelpCircle color={colors.textMuted} size={19} />
              </View>
            </Press>
          </View>
        </View>

        {/* Command hero → the map */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <Press onPress={() => router.push('/capture')}>
            <GlowCard tint={game.color} glow={game.color} contentStyle={styles.heroContent}>
              <View style={styles.heroRow}>
                <View style={styles.heroLeft}>
                  <View style={[styles.rankPill, { borderColor: rank.color + '66', backgroundColor: rank.color + '14' }]}>
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
            </GlowCard>
          </Press>
        </Animated.View>

        {/* $ZORR wallet + swap */}
        <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 14 }}>
          <ZorrCard />
        </Animated.View>

        {/* Start run CTA */}
        <Animated.View entering={FadeInDown.delay(140)} style={{ marginTop: 18 }}>
          <CTA label="Start a Run" icon={<Play color="#04110C" size={20} fill="#04110C" />} onPress={() => router.push('/capture')} />
          <Text style={styles.ctaHint}>Capture territory as you move. Every run logs on-chain.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180)} style={styles.actionRow}>
          <Press style={styles.actionFlex} onPress={() => router.push('/guardians')}>
            <GlowCard radiusSize={radius.lg} contentStyle={styles.action}>
              <Shield color={colors.primary} size={18} />
              <Text style={styles.actionText}>Guardians</Text>
              <Text style={styles.actionHint}>{game.beasts.length} in roster</Text>
            </GlowCard>
          </Press>
          <Press style={styles.actionFlex} onPress={() => router.push('/battle')}>
            <GlowCard radiusSize={radius.lg} contentStyle={styles.action}>
              <Swords color={colors.enemy} size={18} />
              <Text style={styles.actionText}>Duel</Text>
              <Text style={styles.actionHint}>BT · online · AI</Text>
            </GlowCard>
          </Press>
        </Animated.View>

        {/* Mission log — lifetime metrics */}
        <Eyebrow style={styles.section}>MISSION LOG</Eyebrow>
        <View style={styles.logGrid}>
          <LogCell value={`${s.runs}`} label="RUNS" delay={220} to="/capture" />
          <LogCell value={formatKm(s.distanceKm)} label="KM COVERED" delay={250} to="/capture" />
          <LogCell value={formatKm(s.longestRunKm)} label="LONGEST KM" delay={280} to="/capture" />
          <LogCell value={formatWinRate(s)} label="DUEL WIN %" accent={colors.territory} delay={310} to="/battle" />
          <LogCell value={`${s.duelsWon}–${s.duelsLost}`} label="DUEL RECORD" delay={340} to="/battle" />
          <LogCell value={`${game.xp}`} label="XP" accent={colors.gold} delay={370} to="/wallet" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18 },
  hi: { color: colors.textDim, fontSize: 12.5, letterSpacing: 0.4 },
  brand: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: 2, marginTop: 1 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.enemy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  heroContent: { padding: 20 },
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
  ctaHint: { color: colors.textDim, fontSize: 12.5, textAlign: 'center', marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionFlex: { flex: 1 },
  action: { alignItems: 'flex-start', gap: 6, paddingVertical: 16, paddingHorizontal: 16 },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionHint: { color: colors.textDim, fontSize: 12 },
  section: { marginTop: 24, marginBottom: 12 },
  logGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  logCell: { width: '31.5%', flexGrow: 1 },
  logInner: { paddingVertical: 16, alignItems: 'center', gap: 6 },
  logValue: { color: colors.text, fontSize: 19, fontFamily: fonts.display },
  logLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1 },
})
