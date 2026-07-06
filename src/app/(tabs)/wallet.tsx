import { address as toAddress, createSolanaRpc, lamports } from '@solana/kit'
import { useMutation } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Coins, Droplet, Link2, RefreshCw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

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

        {/* Balance hero */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>ZORR WALLET · DEVNET</Text>
              <TouchableOpacity onPress={() => refetch()} hitSlop={10}>
                <RefreshCw color="rgba(255,255,255,0.85)" size={16} style={isRefetching ? { opacity: 0.4 } : undefined} />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroBalance}>{isLoading ? '…' : `${(balance ?? 0).toFixed(4)}`}</Text>
            <Text style={styles.heroUnit}>SOL</Text>
            <Text selectable style={styles.address}>
              {addr ?? '…'}
            </Text>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.fundHint}>
          This wallet signs your on-chain runs. Long-press the address to copy and fund it with devnet SOL.
        </Text>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(120)} style={styles.actions}>
          <TouchableOpacity
            style={[styles.action, (!addr || airdrop.isPending) && { opacity: 0.5 }]}
            activeOpacity={0.85}
            onPress={() => airdrop.mutate()}
            disabled={!addr || airdrop.isPending}
          >
            <Droplet color={colors.territory} size={18} />
            <Text style={styles.actionLabel}>{airdrop.isPending ? 'Requesting…' : 'Request 1 SOL'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.85}
            onPress={() => addr && Linking.openURL(`https://explorer.solana.com/address/${addr}?cluster=devnet`)}
          >
            <Link2 color={colors.primary} size={18} />
            <Text style={styles.actionLabel}>View on Explorer</Text>
          </TouchableOpacity>
        </Animated.View>
        {airdrop.isError ? <Text style={styles.err}>Faucet rate-limited — fund the address manually.</Text> : null}
        {airdrop.isSuccess ? <Text style={styles.ok}>Airdrop requested — balance updates shortly.</Text> : null}

        {/* Assets */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <View style={styles.cardHead}>
            <Coins color={colors.gold} size={16} />
            <Text style={styles.cardTitle}>ASSETS</Text>
          </View>
          <View style={styles.assetRow}>
            <View style={[styles.assetBadge, { borderColor: colors.primary }]}>
              <Text style={[styles.assetSymbol, { color: colors.primary }]}>◎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName}>Solana</Text>
              <Text style={styles.assetSym}>SOL · DEVNET</Text>
            </View>
            <Text style={styles.assetAmount}>{(balance ?? 0).toFixed(4)}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24, marginBottom: 16 },
  hero: { borderRadius: radius.xl, padding: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1.4 },
  heroBalance: { color: colors.text, fontSize: 46, fontFamily: fonts.display, marginTop: 8 },
  heroUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: fonts.mono, marginTop: -4 },
  address: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.mono, marginTop: 16 },
  fundHint: { color: colors.textDim, fontSize: 13, marginTop: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  err: { color: colors.enemy, fontSize: 12, marginTop: 10 },
  ok: { color: colors.territory, fontSize: 12, marginTop: 10 },
  card: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  assetSymbol: { fontSize: 20 },
  assetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assetSym: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono, letterSpacing: 0.5 },
  assetAmount: { color: colors.text, fontSize: 16, fontFamily: fonts.mono },
})
