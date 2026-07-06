import { address as toAddress, createSolanaRpc, lamports } from '@solana/kit'
import { useMutation } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowDownLeft, Coins, Droplet, RefreshCw } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../../components/glass-card'
import { DEVNET_RPC, useDevnetBalance } from '../../features/wallet/use-devnet-balance'
import { useSolanaAccount } from '../../features/wallet/use-solana-account'
import { colors, fonts, radius } from '../../theme'

const rpc = createSolanaRpc(DEVNET_RPC)

function short(addr?: string) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '—'
}

function Action({ icon, label, onPress, disabled }: { icon: ReactNode; label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.action, disabled && { opacity: 0.5 }]} activeOpacity={0.85} onPress={onPress} disabled={disabled}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function WalletScreen() {
  const { address } = useSolanaAccount()
  const { data: balance, isLoading, refetch, isRefetching } = useDevnetBalance(address)

  const airdrop = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('No wallet')
      await rpc.requestAirdrop(toAddress(address), lamports(1_000_000_000n)).send()
    },
    onSuccess: () => setTimeout(() => refetch(), 2500),
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Wallet</Text>

        {/* Balance card */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
            <View style={styles.balanceHead}>
              <Text style={styles.balanceLabel}>Devnet balance</Text>
              <TouchableOpacity onPress={() => refetch()} hitSlop={10}>
                <RefreshCw color="rgba(255,255,255,0.8)" size={16} style={isRefetching ? { opacity: 0.4 } : undefined} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>{isLoading ? '…' : `${(balance ?? 0).toFixed(4)} SOL`}</Text>
            <Text style={styles.address}>{short(address)}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(140)} style={styles.actionsRow}>
          <Action
            icon={<Droplet color={colors.territory} size={20} />}
            label={airdrop.isPending ? 'Requesting…' : 'Airdrop 1 SOL'}
            onPress={() => airdrop.mutate()}
            disabled={!address || airdrop.isPending}
          />
          <Action icon={<ArrowDownLeft color={colors.primary} size={20} />} label="Receive" disabled={!address} />
        </Animated.View>
        {airdrop.isError ? <Text style={styles.err}>Airdrop failed (devnet faucet is rate-limited — try again).</Text> : null}
        {airdrop.isSuccess ? <Text style={styles.ok}>Airdrop requested — balance updates shortly.</Text> : null}

        {/* Assets */}
        <Animated.View entering={FadeInDown.delay(220)}>
          <GlassCard style={{ marginTop: 20 }}>
            <View style={styles.cardHead}>
              <Coins color={colors.gold} size={18} />
              <Text style={styles.cardTitle}>Assets</Text>
            </View>
            <View style={styles.assetRow}>
              <View style={[styles.assetBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
                <Text style={[styles.assetSymbol, { color: colors.primary }]}>S</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assetName}>Solana</Text>
                <Text style={styles.assetSym}>SOL · devnet</Text>
              </View>
              <Text style={styles.assetAmount}>{(balance ?? 0).toFixed(4)}</Text>
            </View>
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
  balanceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balanceValue: { color: colors.text, fontSize: 36, fontFamily: fonts.display, marginTop: 6 },
  address: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: fonts.mono, marginTop: 14 },
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
  err: { color: colors.enemy, fontSize: 12, marginTop: 10 },
  ok: { color: colors.territory, fontSize: 12, marginTop: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  assetBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  assetSymbol: { fontFamily: fonts.display, fontSize: 16 },
  assetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assetSym: { color: colors.textDim, fontSize: 12, fontFamily: fonts.mono },
  assetAmount: { color: colors.text, fontSize: 16, fontFamily: fonts.mono },
})
