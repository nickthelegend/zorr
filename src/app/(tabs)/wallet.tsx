import { LinearGradient } from 'expo-linear-gradient'
import { ArrowDownLeft, ArrowUpRight, Coins, Copy, Repeat } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../../components/glass-card'
import { colors, fonts, radius } from '../../theme'

function Action({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <TouchableOpacity style={styles.action} activeOpacity={0.85}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function AssetRow({ symbol, name, amount, color }: { symbol: string; name: string; amount: string; color: string }) {
  return (
    <View style={styles.assetRow}>
      <View style={[styles.assetBadge, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[styles.assetSymbol, { color }]}>{symbol[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.assetName}>{name}</Text>
        <Text style={styles.assetSym}>{symbol}</Text>
      </View>
      <Text style={styles.assetAmount}>{amount}</Text>
    </View>
  )
}

export default function WalletScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Wallet</Text>

        {/* Balance card */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Text style={styles.balanceValue}>0.00 SOL</Text>
            <TouchableOpacity style={styles.addressRow} activeOpacity={0.7}>
              <Text style={styles.address}>Connect to reveal address</Text>
              <Copy color="rgba(255,255,255,0.8)" size={14} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(140)} style={styles.actionsRow}>
          <Action icon={<ArrowDownLeft color={colors.territory} size={20} />} label="Receive" />
          <Action icon={<ArrowUpRight color={colors.primary} size={20} />} label="Send" />
          <Action icon={<Repeat color={colors.gold} size={20} />} label="Swap" />
        </Animated.View>

        {/* Assets */}
        <Animated.View entering={FadeInDown.delay(220)}>
          <GlassCard style={{ marginTop: 20 }}>
            <View style={styles.cardHead}>
              <Coins color={colors.gold} size={18} />
              <Text style={styles.cardTitle}>Assets</Text>
            </View>
            <AssetRow symbol="SOL" name="Solana" amount="0.00" color={colors.primary} />
            <AssetRow symbol="ZORR" name="Zorr Token" amount="0" color={colors.territory} />
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24, marginBottom: 16 },
  balanceCard: { borderRadius: radius.xl, padding: 22 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balanceValue: { color: colors.text, fontSize: 36, fontFamily: fonts.display, marginTop: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  address: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: fonts.mono },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.textMuted, fontSize: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  assetBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetSymbol: { fontFamily: fonts.display, fontSize: 16 },
  assetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assetSym: { color: colors.textDim, fontSize: 12, fontFamily: fonts.mono },
  assetAmount: { color: colors.text, fontSize: 16, fontFamily: fonts.mono },
})
