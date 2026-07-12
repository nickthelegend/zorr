import { address as toAddress, createSolanaRpc, lamports } from '@solana/kit'
import { useMutation } from '@tanstack/react-query'
import { BlurView } from 'expo-blur'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import {
  ArrowDownLeft,
  Check,
  Coins,
  Copy,
  Droplet,
  KeyRound,
  Link2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet as WalletIcon,
} from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import QRCodeStyled from 'react-native-qrcode-styled'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BeastCard } from '../../components/beast-card'
import { GlowCard, Press } from '../../components/ui'
import { fetchOwned, fetchZorrBalance, getOwnerAddress, type OwnedBeast } from '../../features/nft/nft'
import { DEVNET_RPC, useDevnetBalance } from '../../features/wallet/use-devnet-balance'
import { useSolanaAccount } from '../../features/wallet/use-solana-account'
import { colors, fonts, radius } from '../../theme'

const rpc = createSolanaRpc(DEVNET_RPC)

function short(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-6)}` : '…'
}

export default function WalletScreen() {
  const privy = useSolanaAccount()
  const [signerAddr, setSignerAddr] = useState<string>()
  // Your wallet IS your Privy embedded wallet once signed in. The shared game
  // signer (from .env) is only a fallback until the embedded wallet is ready.
  const addr = privy.address ?? signerAddr
  const { data: balance, isLoading, refetch, isRefetching } = useDevnetBalance(addr)
  const [zorr, setZorr] = useState<number | null>(null)
  const [beasts, setBeasts] = useState<OwnedBeast[] | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadAssets = useCallback(() => {
    fetchZorrBalance()
      .then(setZorr)
      .catch(() => setZorr(null))
    getOwnerAddress()
      .then(fetchOwned)
      .then(setBeasts)
      .catch(() => setBeasts([]))
  }, [])

  useEffect(() => {
    getOwnerAddress().then(setSignerAddr).catch(() => {})
  }, [])

  // Reconnect the Privy embedded wallet after a cold start (it comes back as
  // 'needs-recovery' / 'not-created') so YOUR address actually shows, not the
  // shared game signer fallback.
  useEffect(() => {
    if (!privy.isLoggedIn) return
    if (privy.status === 'needs-recovery' && privy.recover) privy.recover()?.catch?.(() => {})
    else if (privy.status === 'not-created' && privy.create) privy.create()?.catch?.(() => {})
  }, [privy.isLoggedIn, privy.status, privy.recover, privy.create])

  // Refresh $ZORR + owned Guardians every time the tab regains focus — so a
  // Guardian claimed or a swap made on another screen shows up immediately.
  useFocusEffect(
    useCallback(() => {
      loadAssets()
    }, [loadAssets]),
  )

  const airdrop = useMutation({
    mutationFn: async () => {
      if (!addr) throw new Error('No wallet')
      await rpc.requestAirdrop(toAddress(addr), lamports(1_000_000_000n)).send()
    },
    onSuccess: () => setTimeout(() => refetch(), 2500),
  })

  const refreshAll = () => {
    refetch()
    loadAssets()
  }

  const copyAddr = async () => {
    if (!addr) return
    await Clipboard.setStringAsync(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const signedIn = privy.isLoggedIn

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Wallet</Text>

        {/* Balance hero — SOL + $ZORR + quick actions */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroTopL}>
                <WalletIcon color="#fff" size={18} />
                <Text style={styles.heroLabel}>{signedIn ? 'YOUR WALLET · DEVNET' : 'GAME WALLET · DEVNET'}</Text>
              </View>
              <TouchableOpacity onPress={refreshAll} hitSlop={10}>
                <RefreshCw color="rgba(255,255,255,0.85)" size={16} style={isRefetching ? { opacity: 0.4 } : undefined} />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroBalance}>
              {isLoading ? '…' : (balance ?? 0).toFixed(4)}
              <Text style={styles.heroUnit}> SOL</Text>
            </Text>

            {/* $ZORR */}
            <View style={styles.zorrPill}>
              <View style={styles.zorrLeft}>
                <View style={styles.zorrCoin}>
                  <Text style={styles.zorrCoinTxt}>Z</Text>
                </View>
                <Text style={styles.zorrLabel}>$ZORR</Text>
              </View>
              <Text style={styles.zorrVal}>{zorr === null ? '…' : zorr.toLocaleString('en-US')}</Text>
            </View>

            {/* address */}
            <TouchableOpacity onPress={copyAddr} style={styles.addrRow} activeOpacity={0.7}>
              <Text style={styles.address}>{short(addr)}</Text>
              {copied ? <Check color="#6EE7B7" size={13} /> : <Copy color="rgba(255,255,255,0.7)" size={13} />}
            </TouchableOpacity>

            {/* actions */}
            <View style={styles.actionsRow}>
              <ActionCircle icon={<ArrowDownLeft color="#fff" size={22} />} label="Receive" onPress={() => setShowQR((v) => !v)} />
              <ActionCircle icon={<Send color="#fff" size={20} />} label="Pay" onPress={() => router.push('/payments')} />
              <ActionCircle
                icon={airdrop.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Droplet color="#fff" size={20} />}
                label="Get SOL"
                onPress={() => airdrop.mutate()}
                disabled={!addr || airdrop.isPending}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {airdrop.isError ? <Text style={styles.err}>Faucet rate-limited — fund the address manually.</Text> : null}
        {airdrop.isSuccess ? <Text style={styles.ok}>Airdrop requested — balance updates shortly.</Text> : null}

        {/* Receive QR */}
        {showQR && addr ? (
          <Animated.View entering={FadeInDown.duration(240)} style={{ marginTop: 14 }}>
            <BlurView intensity={40} tint="dark" style={styles.qrModal}>
              <View style={styles.qrHead}>
                <Text style={styles.qrTitle}>Receive · scan to send SOL or $ZORR</Text>
              </View>
              <View style={styles.qrWrap}>
                <QRCodeStyled data={addr} size={196} pieceBorderRadius={2} isPiecesGlued padding={10} color="#0B0B13" />
              </View>
              <TouchableOpacity onPress={copyAddr} style={styles.qrAddrRow} activeOpacity={0.8}>
                <Text style={styles.qrAddr} numberOfLines={1}>
                  {addr}
                </Text>
                {copied ? <Check color="#6EE7B7" size={16} /> : <Copy color={colors.textMuted} size={16} />}
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        ) : null}

        {/* Assets */}
        <Animated.View entering={FadeInDown.delay(120)} style={{ marginTop: 18 }}>
          <GlowCard contentStyle={styles.assetsCard}>
            <View style={styles.cardHead}>
              <Coins color={colors.gold} size={16} />
              <Text style={styles.cardTitle}>ASSETS</Text>
            </View>
            <AssetRow symbol="◎" color={colors.primary} name="Solana" sub="SOL · DEVNET" amount={(balance ?? 0).toFixed(4)} />
            <AssetRow symbol="Z" color={colors.gold} name="$ZORR" sub="SPL · SPENDABLE" amount={zorr === null ? '—' : zorr.toLocaleString('en-US')} divider />
          </GlowCard>
        </Animated.View>

        {/* Guardians */}
        <Animated.View entering={FadeInDown.delay(180)} style={{ marginTop: 18 }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your Guardians</Text>
            <TouchableOpacity onPress={() => router.push('/guardians')} hitSlop={8}>
              <Text style={styles.viewAll}>{beasts && beasts.length ? `${beasts.length} · Manage ›` : 'Claim ›'}</Text>
            </TouchableOpacity>
          </View>
          {beasts === null ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 22 }} />
          ) : beasts.length === 0 ? (
            <Press onPress={() => router.push('/guardians')}>
              <GlowCard tint={colors.primary} contentStyle={styles.emptyBeasts}>
                <Sparkles color={colors.primary} size={24} />
                <Text style={styles.emptyTitle}>No Guardians yet</Text>
                <Text style={styles.emptySub}>Claim your first from the Genesis 48 drop — a real Metaplex Core NFT, drawn by VRF.</Text>
              </GlowCard>
            </Press>
          ) : (
            <View style={{ gap: 10 }}>
              {beasts.map((b) => (
                <BeastCard key={b.asset || b.id} seed={b.seed} compact onPress={() => router.push('/guardians')} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* Private Payments */}
        <Animated.View entering={FadeInDown.delay(240)} style={{ marginTop: 18 }}>
          <Press onPress={() => router.push('/payments')}>
            <GlowCard tint={colors.primary} glow={colors.primary} contentStyle={styles.ppCard}>
              <View style={styles.ppIcon}>
                <ShieldCheck color={colors.primary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ppTitle}>Private Payments</Text>
                <Text style={styles.ppSub}>Shield $ZORR on MagicBlock rollups · send private</Text>
              </View>
              <ArrowDownLeft color={colors.textMuted} size={18} style={{ transform: [{ rotate: '135deg' }] }} />
            </GlowCard>
          </Press>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ActionCircle({ icon, label, onPress, disabled }: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionCol} activeOpacity={0.8} onPress={onPress} disabled={disabled}>
      <View style={[styles.actionCircle, disabled && { opacity: 0.5 }]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function AssetRow({ symbol, color, name, sub, amount, divider }: { symbol: string; color: string; name: string; sub: string; amount: string; divider?: boolean }) {
  return (
    <View style={[styles.assetRow, divider && styles.assetRowDivider]}>
      <View style={[styles.assetBadge, { borderColor: color }]}>
        <Text style={[styles.assetSymbol, { color }]}>{symbol}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.assetName}>{name}</Text>
        <Text style={styles.assetSym}>{sub}</Text>
      </View>
      <Text style={styles.assetAmount}>{amount}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 24, marginBottom: 16 },

  hero: { borderRadius: radius.xl, padding: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTopL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' },
  heroBalance: { color: colors.text, fontSize: 44, fontFamily: fonts.display, marginTop: 12 },
  heroUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: fonts.mono },
  zorrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  zorrLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zorrCoin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zorrCoinTxt: { color: '#5a3d06', fontWeight: '900', fontSize: 16 },
  zorrLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  zorrVal: { color: '#FDE68A', fontSize: 20, fontFamily: fonts.mono, fontWeight: '700' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, alignSelf: 'flex-start' },
  address: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: fonts.data },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  actionCol: { alignItems: 'center', gap: 8 },
  actionCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },

  qrModal: { borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', overflow: 'hidden' },
  qrHead: { marginBottom: 16 },
  qrTitle: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  qrWrap: { backgroundColor: '#fff', padding: 12, borderRadius: 18, marginBottom: 16 },
  qrCode: { backgroundColor: '#fff', borderRadius: 12 },
  qrAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, width: '100%' },
  qrAddr: { flex: 1, color: colors.textMuted, fontSize: 12, fontFamily: fonts.data },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  assetsCard: { padding: 18 },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetRowDivider: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.hairline },
  assetBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  assetSymbol: { fontSize: 17, fontWeight: '800' },
  assetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assetSym: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  assetAmount: { color: colors.text, fontSize: 16, fontFamily: fonts.mono },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  viewAll: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  emptyBeasts: { padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  ppCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  ppIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  ppTitle: { color: colors.text, fontSize: 15.5, fontWeight: '700' },
  ppSub: { color: colors.textDim, fontSize: 11.5, marginTop: 2 },

  privyCard: { padding: 18 },
  privyHint: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  privyAddr: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.data },
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

  err: { color: colors.enemy, fontSize: 12, marginTop: 10 },
  ok: { color: colors.territory, fontSize: 12, marginTop: 10 },
})
