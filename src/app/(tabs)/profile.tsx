import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Award, Flame, Footprints, HelpCircle, LogOut, Mail, MapPin, Route, Shield, Swords } from 'lucide-react-native'
import { ReactNode, useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getSignerAddress } from '../../features/chain/claim'
import { levelForXp, useGame } from '../../features/game/game-store'
import { duelCount, formatKm, rankForLevel } from '../../features/game/stats'
import { tileAreaKm2 } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

function short(a?: string) {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '…'
}

/** Best-effort email from the Privy user object (guest sessions have none). */
function privyEmail(user: unknown): string | null {
  const accounts = (user as { linked_accounts?: { type?: string; address?: string }[] } | null)?.linked_accounts
  return accounts?.find((a) => a.type === 'email')?.address ?? null
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function Badge({ label, unlocked }: { label: string; unlocked: boolean }) {
  return (
    <View style={[styles.badge, !unlocked && styles.badgeLocked]}>
      <Award color={unlocked ? colors.gold : colors.textFaint} size={18} />
      <Text style={[styles.badgeLabel, !unlocked && { color: colors.textFaint }]}>{label}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const game = useGame()
  const { user, logout } = usePrivy()
  const { level } = levelForXp(game.xp)
  const rank = rankForLevel(level)
  const [addr, setAddr] = useState<string>()
  const tiles = game.tiles.size
  const km2 = tiles * tileAreaKm2(17.4239)
  const s = game.stats
  const email = privyEmail(user)

  useEffect(() => {
    getSignerAddress().then(setAddr).catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await SecureStore.deleteItemAsync('zorr.entered')
    try {
      await logout()
    } catch {
      // guest session — nothing to log out of
    }
    router.replace('/login')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown} style={styles.headerRow}>
          <Text style={styles.brand}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <HelpCircle color={colors.text} size={20} />
          </TouchableOpacity>
        </Animated.View>

        {/* Identity card */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: game.color + '26', borderColor: game.color, shadowColor: game.color }]}>
                <Text style={[styles.avatarText, { color: game.color }]}>{game.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{game.name}</Text>
                <Text style={[styles.levelLine, { color: rank.color }]}>
                  {rank.title} · LVL {level}
                </Text>
                <TouchableOpacity
                  style={styles.rankRow}
                  onPress={() => addr && Linking.openURL(`https://explorer.solana.com/address/${addr}?cluster=devnet`)}
                >
                  <Shield color={colors.territory} size={13} />
                  <Text style={styles.rank}>{short(addr)} ↗</Text>
                </TouchableOpacity>
                <View style={styles.rankRow}>
                  <Mail color={email ? colors.primary : colors.textFaint} size={13} />
                  <Text style={[styles.rank, !email && { color: colors.textFaint }]}>
                    {email ?? 'Guest account — link email to keep it'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <Stat icon={<MapPin color={colors.territory} size={17} />} value={km2.toFixed(2)} label="KM²" />
              <Stat icon={<Footprints color={colors.primary} size={17} />} value={`${tiles}`} label="TILES" />
              <Stat icon={<Flame color={colors.gold} size={17} />} value={`${game.bestStreak}`} label="COMBO" />
            </View>
            <View style={[styles.statsRow, { marginTop: 12, paddingTop: 12 }]}>
              <Stat icon={<Route color={colors.territory} size={17} />} value={formatKm(s.distanceKm)} label="KM RUN" />
              <Stat icon={<Footprints color={colors.primary} size={17} />} value={`${s.runs}`} label="RUNS" />
              <Stat icon={<Swords color={colors.enemy} size={17} />} value={`${s.duelsWon}–${s.duelsLost}`} label="DUELS" />
            </View>
          </View>
        </Animated.View>

        {/* Achievements */}
        <Animated.View entering={FadeInDown.delay(140)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ACHIEVEMENTS</Text>
            <View style={styles.badgeGrid}>
              <Badge label="First Capture" unlocked={tiles >= 1} />
              <Badge label="Land Baron" unlocked={tiles >= 10} />
              <Badge label="Combo Master" unlocked={game.bestStreak >= 5} />
              <Badge label="Warlord" unlocked={tiles >= 25} />
              <Badge label="Territory King" unlocked={km2 >= 0.1} />
              <Badge label="First Blood" unlocked={s.duelsWon >= 1} />
              <Badge label="Duelist" unlocked={duelCount(s) >= 10} />
              <Badge label="Pathmaker" unlocked={s.distanceKm >= 10} />
              <Badge label="Marathoner" unlocked={s.distanceKm >= 42.2} />
              <Badge label="Summoner" unlocked={s.summons >= 3} />
              <Badge label="Level 5" unlocked={level >= 5} />
              <Badge label="Sovereign" unlocked={level >= 25} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220)}>
          <TouchableOpacity style={styles.signOut} activeOpacity={0.8} onPress={handleSignOut}>
            <LogOut color={colors.enemy} size={18} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 16,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 28 },
  name: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  levelLine: { fontSize: 11, fontFamily: fonts.mono, letterSpacing: 1.5, marginTop: 3 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rank: { color: colors.textDim, fontSize: 12, fontFamily: fonts.data },
  statsRow: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  statLabel: { color: colors.textFaint, fontSize: 10, letterSpacing: 1 },
  cardTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 16 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  badgeLocked: { opacity: 0.45 },
  badgeLabel: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  signOutText: { color: colors.enemy, fontSize: 15, fontWeight: '600' },
})
