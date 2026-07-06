import { address as toAddress, createSolanaRpc, lamports } from '@solana/kit'
import { useMutation } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Coins, Droplet, RefreshCw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../../components/glass-card'
import { getSignerAddress } from '../../features/chain/claim'
import { DEVNET_RPC, useDevnetBalance } from '../../features/wallet/use-devnet-balance'
import { colors, fonts, radius } from '../../theme'

const rpc = createSolanaRpc(DEVNET_RPC)

export default function WalletScreen() {
  const [addr, setAddr] = useState<string>()
  const { data: balance, isLoading, refetch, isRefetching } = useDevnetBalance(addr)

  useEffect(() => {
    getSignerAddress().then(setAddr).catch(() => {})
  }, [])

  const airdrop = useMutation({
    mutationFn: async () => {
      if (!addr) throw new Error('No wallet')
      await rpc.requestAirdrop(toAddress(addr), lamports(1_000_000_000n)).send()
    },
    onSuccess: () => setTimeout(() => refetch(), 2500),
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Wallet</Text>

        <Animated.View entering={FadeInDown.delay(60)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
            <View style={styles.balanceHead}>
              <Text style={styles.balanceLabel}>Zorr game wallet · devnet</Text>
              <TouchableOpacity onPress={() => refetch()} hitSlop={10}>
                <RefreshCw color="rgba(255,255,255,0.8)" size={16} style={isRefetching ? { opacity: 0.4 } : undefined} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>{isLoading ? '…' : `${(balance ?? 0).toFixed(4)} SOL`}</Text>
            <Text selectable style={styles.address}>
              {addr ?? '…'}
            </Text>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.fundHint}>
          Fund this address with devnet SOL (long-press to copy) to sign on-chain tile claims.
        </Text>

        <Animated.View entering={FadeInDown.delay(140)}>
          <TouchableOpacity
            style={[styles.action, (!addr || airdrop.isPending) && { opacity: 0.5 }]}
            activeOpacity={0.85}
            onPress={() => airdrop.mutate()}
            disabled={!addr || airdrop.isPending}
          >
            <Droplet color={colors.territory} size={20} />
            <Text style={styles.actionLabel}>{airdrop.isPending ? 'Requesting airdrop…' : 'Request 1 devnet SOL'}</Text>
          </TouchableOpacity>
        </Animated.View>
        {airdrop.isError ? <Text style={styles.err}>Faucet rate-limited — fund the address manually.</Text> : null}
        {airdrop.isSuccess ? <Text style={styles.ok}>Airdrop requested — balance updates shortly.</Text> : null}

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
  address: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.mono, marginTop: 14 },
  fundHint: { color: colors.textDim, fontSize: 13, marginTop: 12, lineHeight: 18 },
  action: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionLabel: { color: colors.textMuted, fontSize: 14 },
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
