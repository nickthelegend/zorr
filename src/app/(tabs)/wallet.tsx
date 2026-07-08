import { address as toAddress, createSolanaRpc, lamports } from '@solana/kit'
import { useMutation } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Coins, Droplet, KeyRound, Link2, RefreshCw, UserRound } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getSignerAddress } from '../../features/chain/claim'
import { DEVNET_RPC, useDevnetBalance } from '../../features/wallet/use-devnet-balance'
import { useSolanaAccount } from '../../features/wallet/use-solana-account'
import { colors, fonts, radius } from '../../theme'

const rpc = createSolanaRpc(DEVNET_RPC)

function short(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-6)}` : '…'
}

export default function WalletScreen() {
  const [addr, setAddr] = useState<string>()
  const { data: balance, isLoading, refetch, isRefetching } = useDevnetBalance(addr)
  const privy = useSolanaAccount()
  const [creating, setCreating] = useState(false)

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

  const createEmbedded = async () => {
    if (!privy.create) return
    setCreating(true)
    try {
      await privy.create()
    } catch {
      // surfaced by status below
    } finally {
      setCreating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Wallet</Text>

        {/* Game wallet — signs on-chain runs, VRF requests, ER captures */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>GAME WALLET · SIGNS RUNS + VRF · DEVNET</Text>
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

        {/* Privy embedded wallet — your identity wallet from email login */}
        <Animated.View entering={FadeInDown.delay(120)} style={styles.privyCard}>
          <View style={styles.cardHead}>
            <KeyRound color={colors.primary} size={16} />
            <Text style={styles.cardTitle}>PRIVY EMBEDDED WALLET</Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: !privy.isReady ? colors.gold : privy.isLoggedIn ? colors.territory : colors.textFaint },
              ]}
            />
          </View>

          {!privy.isReady ? (
            <Text style={styles.privyHint}>Connecting to Privy…</Text>
          ) : !privy.isLoggedIn ? (
            <>
              <Text style={styles.privyHint}>
                Playing as guest. Sign in with email and Privy spins up a self-custodial Solana wallet — no seed phrase.
              </Text>
              <TouchableOpacity style={styles.privyBtn} activeOpacity={0.85} onPress={() => router.replace('/login')}>
                <UserRound color={colors.text} size={16} />
                <Text style={styles.privyBtnText}>Sign in with email</Text>
              </TouchableOpacity>
            </>
          ) : privy.address ? (
            <>
              <Text selectable style={styles.privyAddr}>
                {privy.address}
              </Text>
              <TouchableOpacity
                style={styles.privyLink}
                onPress={() => Linking.openURL(`https://explorer.solana.com/address/${privy.address}?cluster=devnet`)}
              >
                <Link2 color={colors.primary} size={14} />
                <Text style={styles.privyLinkText}>View {short(privy.address)} on Explorer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.privyHint}>Signed in — create your embedded Solana wallet.</Text>
              <TouchableOpacity style={styles.privyBtn} activeOpacity={0.85} onPress={createEmbedded} disabled={creating}>
                {creating ? <ActivityIndicator color={colors.text} size="small" /> : <KeyRound color={colors.text} size={16} />}
                <Text style={styles.privyBtnText}>{creating ? 'Creating…' : 'Create wallet'}</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Text style={styles.fundHint}>
          The game wallet signs your on-chain runs, ER captures and VRF summons. Long-press its address to copy and fund
          it with devnet SOL.
        </Text>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.actions}>
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
        <Animated.View entering={FadeInDown.delay(260)} style={styles.card}>
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
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, letterSpacing: 1.4 },
  heroBalance: { color: colors.text, fontSize: 46, fontFamily: fonts.display, marginTop: 8 },
  heroUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: fonts.mono, marginTop: -4 },
  address: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.mono, marginTop: 16 },
  privyCard: {
    marginTop: 14,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.xl,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  privyHint: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  privyAddr: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.mono },
  privyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  privyLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  privyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  privyBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
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
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetSymbol: { fontSize: 18, fontWeight: '700' },
  assetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assetSym: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  assetAmount: { color: colors.text, fontSize: 16, fontFamily: fonts.mono },
})
