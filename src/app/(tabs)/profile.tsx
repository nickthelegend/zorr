import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'
import { Award, Flag, Footprints, LogOut, MapPin, Settings, Shield } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../../components/glass-card'
import { useSolanaAccount } from '../../features/wallet/use-solana-account'
import { colors, fonts, radius } from '../../theme'

function short(addr?: string) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : 'No wallet yet'
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
      <Award color={unlocked ? colors.gold : colors.textFaint} size={20} />
      <Text style={[styles.badgeLabel, !unlocked && { color: colors.textFaint }]}>{label}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { address } = useSolanaAccount()
  const { logout } = usePrivy()

  const handleSignOut = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.headerRow}>
          <Text style={styles.brand}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Settings color={colors.text} size={20} />
          </TouchableOpacity>
        </Animated.View>

        {/* Avatar card */}
        <Animated.View entering={FadeInDown.delay(80)}>
          <GlassCard>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>Z</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Explorer</Text>
                <View style={styles.rankRow}>
                  <Shield color={colors.territory} size={14} />
                  <Text style={styles.rank}>{short(address)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <Stat icon={<Flag color={colors.territory} size={18} />} value="0" label="Tiles" />
              <Stat icon={<MapPin color={colors.primary} size={18} />} value="0" label="Zones" />
              <Stat icon={<Footprints color={colors.gold} size={18} />} value="0" label="km walked" />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Achievements */}
        <Animated.View entering={FadeInDown.delay(160)}>
          <GlassCard style={{ marginTop: 20 }}>
            <Text style={styles.cardTitle}>Achievements</Text>
            <View style={styles.badgeGrid}>
              <Badge label="First Capture" unlocked={false} />
              <Badge label="Land Baron" unlocked={false} />
              <Badge label="Marathoner" unlocked={false} />
              <Badge label="Defender" unlocked={false} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Sign out */}
        <Animated.View entering={FadeInDown.delay(240)}>
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
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontFamily: fonts.display, fontSize: 28 },
  name: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rank: { color: colors.textDim, fontSize: 13 },
  statsRow: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  statLabel: { color: colors.textDim, fontSize: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
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
  badgeLocked: { opacity: 0.5 },
  badgeLabel: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  signOutText: { color: colors.enemy, fontSize: 15, fontWeight: '600' },
})
