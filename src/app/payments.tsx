import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { playSfx } from '../features/core/audio'
import { pushNote } from '../features/core/notifications-store'
import {
  deposit,
  explorerTx,
  fetchBaseBalance,
  fetchPrivateBalance,
  fromBaseUnits,
  fundPaymentsWallet,
  paymentsOwner,
  toBaseUnits,
  transfer,
  withdraw,
} from '../features/payments/magicblock'
import { colors, fonts, radius } from '../theme'

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 })

type Mode = 'shield' | 'send' | 'withdraw'
type Result = { ok: boolean; text: string; sig?: string } | null

export default function PaymentsScreen() {
  const [owner, setOwner] = useState<string>()
  const [base, setBase] = useState<number | null>(null)
  const [priv, setPriv] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('shield')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [funding, setFunding] = useState(false)
  const [result, setResult] = useState<Result>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [b, p] = await Promise.allSettled([fetchBaseBalance(), fetchPrivateBalance()])
      if (b.status === 'fulfilled') setBase(fromBaseUnits(b.value.balance))
      if (p.status === 'fulfilled') setPriv(fromBaseUnits(p.value.balance))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    paymentsOwner().then(setOwner).catch(() => {})
    refresh()
  }, [refresh])

  const amt = Number(amount)
  const amtValid = Number.isFinite(amt) && amt > 0

  // Which balance funds the current action → drives Max + validation.
  const sourceBal = mode === 'shield' ? base : mode === 'withdraw' ? priv : visibility === 'private' ? priv : base
  const sendReady = mode !== 'send' || to.trim().length >= 32
  const overBalance = sourceBal != null && amt > sourceBal + 1e-9
  const canSubmit = amtValid && sendReady && !overBalance && !busy

  const run = async () => {
    if (!canSubmit) return
    setBusy(true)
    setResult(null)
    const units = toBaseUnits(amt)
    try {
      let sig: string
      let label: string
      if (mode === 'shield') {
        label = 'Shield'
        sig = await deposit(units)
      } else if (mode === 'withdraw') {
        label = 'Withdraw'
        sig = await withdraw(units)
      } else if (visibility === 'private') {
        label = 'Private send'
        sig = await transfer({ to: to.trim(), amount: units, visibility: 'private', fromBalance: 'ephemeral', toBalance: 'ephemeral' })
      } else {
        label = 'Public send'
        sig = await transfer({ to: to.trim(), amount: units, visibility: 'public', fromBalance: 'base', toBalance: 'base' })
      }
      // Private sends settle off-chain (no on-chain signature) — don't offer a broken explorer link.
      const onchainSig = sig.startsWith('private:') ? undefined : sig
      setResult({ ok: true, text: `${label} confirmed`, sig: onchainSig })
      playSfx(mode === 'shield' ? 'shield' : 'coin')
      pushNote({ kind: 'swap', title: `${label} confirmed`, body: `${fmt(amt)} $ZORR` })
      setAmount('')
      setTimeout(refresh, 2500)
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const fund = async () => {
    setFunding(true)
    setResult(null)
    try {
      const r = await fundPaymentsWallet(50)
      if (r.funded) {
        setResult({ ok: true, text: `Funded ${r.amount} $ZORR on-chain`, sig: r.signature })
        playSfx('coin')
        pushNote({ kind: 'swap', title: 'Test $ZORR funded', body: `${r.amount} $ZORR ready to shield` })
      } else {
        setResult({ ok: !r.error, text: r.note || r.error || 'Wallet already funded' })
      }
      setTimeout(refresh, 2500)
    } finally {
      setFunding(false)
    }
  }

  // Offer real on-chain funding once balances have loaded and the base wallet is empty.
  const needsFunds = !loading && (base == null || base < 1)

  const setPct = (pct: number) => {
    if (sourceBal == null) return
    const v = Math.max(0, sourceBal * pct)
    setAmount(pct === 1 ? String(sourceBal) : v.toFixed(2))
  }

  const cta =
    mode === 'shield' ? 'Shield $ZORR' : mode === 'withdraw' ? 'Withdraw to base' : visibility === 'private' ? 'Send privately' : 'Send public'
  const ctaBusy = mode === 'shield' ? 'Shielding…' : mode === 'withdraw' ? 'Withdrawing…' : 'Sending…'

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <View style={styles.titleIcon}>
              <ShieldCheck color={colors.primary} size={19} />
            </View>
            <Text style={styles.title}>Private Payments</Text>
          </View>
          <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={8}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Shielded balance hero */}
          <Animated.View entering={FadeInDown.delay(40)}>
            <LinearGradient colors={['#241a4d', '#120c2e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <EyeOff color={colors.primary} size={13} />
                  <Text style={styles.heroBadgeText}>SHIELDED · PRIVATE VAULT</Text>
                </View>
                <TouchableOpacity onPress={refresh} hitSlop={10}>
                  <RefreshCw color={colors.textMuted} size={15} style={loading ? { opacity: 0.4 } : undefined} />
                </TouchableOpacity>
              </View>
              <Text style={styles.heroBalance}>
                {loading && priv == null ? '…' : priv == null ? '—' : fmt(priv)}
                <Text style={styles.heroUnit}> $ZORR</Text>
              </Text>
              <View style={styles.heroBase}>
                <Eye color={colors.textDim} size={13} />
                <Text style={styles.heroBaseText}>Public · base</Text>
                <Text style={styles.heroBaseVal}>{loading && base == null ? '…' : base == null ? '—' : fmt(base)} $ZORR</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Fund the shielded wallet with real on-chain $ZORR when it's empty */}
          {needsFunds ? (
            <Animated.View entering={FadeIn}>
              <TouchableOpacity activeOpacity={0.9} onPress={fund} disabled={funding} style={styles.fundCard}>
                {funding ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <ArrowDownToLine color={colors.primary} size={17} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.fundTitle}>{funding ? 'Funding wallet…' : 'Get test $ZORR'}</Text>
                  <Text style={styles.fundSub}>Mint 50 real on-chain $ZORR to this wallet to shield.</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Mode segmented control */}
          <View style={styles.segment}>
            <Seg active={mode === 'shield'} icon={<ArrowDownToLine size={16} color={mode === 'shield' ? '#04110C' : colors.textMuted} />} label="Shield" onPress={() => setMode('shield')} />
            <Seg active={mode === 'send'} icon={<Send size={15} color={mode === 'send' ? '#04110C' : colors.textMuted} />} label="Send" onPress={() => setMode('send')} />
            <Seg active={mode === 'withdraw'} icon={<ArrowUpFromLine size={16} color={mode === 'withdraw' ? '#04110C' : colors.textMuted} />} label="Withdraw" onPress={() => setMode('withdraw')} />
          </View>

          <Text style={styles.flowHint}>
            {mode === 'shield'
              ? 'Move on-chain $ZORR into your private vault — a real transfer, redeemable anytime.'
              : mode === 'withdraw'
                ? 'Redeem shielded $ZORR back to your public on-chain balance (real transfer).'
                : 'Send shielded $ZORR — privately (instant, off-chain) or as a real on-chain payout.'}
          </Text>

          {/* Amount */}
          <View style={styles.amountCard}>
            <View style={styles.amountTop}>
              <Text style={styles.fieldLabel}>AMOUNT</Text>
              <Text style={styles.availText}>Avail {sourceBal == null ? '…' : fmt(sourceBal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                editable={!busy}
              />
              <Text style={styles.amountUnit}>$ZORR</Text>
            </View>
            <View style={styles.chips}>
              {[0.25, 0.5, 1].map((p) => (
                <TouchableOpacity key={p} style={styles.chip} onPress={() => setPct(p)} disabled={sourceBal == null}>
                  <Text style={styles.chipText}>{p === 1 ? 'MAX' : `${p * 100}%`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {overBalance ? <Text style={styles.warn}>Amount exceeds your available balance.</Text> : null}
          </View>

          {/* Send-only: recipient + visibility toggle */}
          {mode === 'send' ? (
            <Animated.View entering={FadeIn} style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>RECIPIENT</Text>
              <TextInput
                style={styles.addrInput}
                placeholder="Wallet address (base58)"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                value={to}
                onChangeText={setTo}
                editable={!busy}
              />
              <View style={styles.visRow}>
                <VisPill active={visibility === 'private'} icon={<EyeOff size={15} color={visibility === 'private' ? '#04110C' : colors.textMuted} />} title="Private" sub="delayed + split" onPress={() => setVisibility('private')} />
                <VisPill active={visibility === 'public'} icon={<Eye size={15} color={visibility === 'public' ? colors.text : colors.textMuted} />} title="Public" sub="visible transfer" onPress={() => setVisibility('public')} />
              </View>
            </Animated.View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity activeOpacity={0.9} onPress={run} disabled={!canSubmit} style={{ marginTop: 20 }}>
            <View style={[styles.cta, !canSubmit && styles.ctaOff]}>
              {busy ? (
                <ActivityIndicator color="#04110C" />
              ) : (
                <>
                  {mode === 'shield' ? <ArrowDownToLine color="#04110C" size={19} /> : mode === 'withdraw' ? <ArrowUpFromLine color="#04110C" size={19} /> : <ShieldCheck color="#04110C" size={19} />}
                  <Text style={styles.ctaText}>{cta}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
          {busy ? <Text style={styles.busyText}>{ctaBusy}</Text> : null}

          {/* Result */}
          {result ? (
            <Animated.View entering={FadeInDown} style={[styles.result, { borderColor: result.ok ? colors.territory : colors.enemy }]}>
              <View style={styles.resultHead}>
                {result.ok ? <Check color={colors.territory} size={16} /> : <X color={colors.enemy} size={16} />}
                <Text style={[styles.resultText, { color: result.ok ? colors.territory : colors.enemy }]}>{result.text}</Text>
              </View>
              {result.sig ? (
                <TouchableOpacity onPress={() => Linking.openURL(explorerTx(result.sig!))}>
                  <Text style={styles.resultLink}>View on Solana Explorer ↗</Text>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          ) : null}

          <Text style={styles.foot}>
            Real on-chain $ZORR vault · Solana devnet · redeemable anytime.{owner ? `\n${owner.slice(0, 6)}…${owner.slice(-6)}` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function Seg({ active, icon, label, onPress }: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.seg, active && styles.segActive]} activeOpacity={0.85} onPress={onPress}>
      {icon}
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function VisPill({ active, icon, title, sub, onPress }: { active: boolean; icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.visPill, active && (title === 'Private' ? styles.visPillPrivate : styles.visPillPublic)]} activeOpacity={0.85} onPress={onPress}>
      {icon}
      <View>
        <Text style={[styles.visTitle, active && title === 'Private' && { color: '#04110C' }]}>{title}</Text>
        <Text style={[styles.visSub, active && title === 'Private' && { color: 'rgba(4,17,12,0.6)' }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 21 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 40 },

  hero: { borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { color: colors.primary, fontSize: 10.5, letterSpacing: 1.1, fontWeight: '800' },
  heroBalance: { color: colors.text, fontSize: 40, fontFamily: fonts.display, marginTop: 12 },
  heroUnit: { color: colors.textMuted, fontSize: 18, fontFamily: fonts.mono },
  heroBase: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  heroBaseText: { color: colors.textDim, fontSize: 12.5, flex: 1 },
  heroBaseVal: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.mono },

  fundCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, padding: 14, marginTop: 16 },
  fundTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  fundSub: { color: colors.textDim, fontSize: 11.5, marginTop: 2, lineHeight: 16 },

  segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.surface2, borderRadius: 14, padding: 5, marginTop: 18 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  segActive: { backgroundColor: colors.territory },
  segText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '700' },
  segTextActive: { color: '#04110C' },
  flowHint: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  amountCard: { backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 14 },
  amountTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { color: colors.textFaint, fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' },
  availText: { color: colors.textDim, fontSize: 11.5, fontFamily: fonts.mono },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  amountInput: { flex: 1, color: colors.text, fontSize: 34, fontFamily: fonts.display, padding: 0 },
  amountUnit: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.mono },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  warn: { color: colors.gold, fontSize: 11.5, marginTop: 10 },

  addrInput: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 13, fontFamily: fonts.mono, marginTop: 8 },
  visRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  visPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  visPillPrivate: { backgroundColor: colors.territory, borderColor: colors.territory },
  visPillPublic: { borderColor: colors.primaryBorder, backgroundColor: 'rgba(124,58,237,0.12)' },
  visTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  visSub: { color: colors.textDim, fontSize: 10.5, marginTop: 1 },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.territory, paddingVertical: 17, borderRadius: radius.lg },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
  busyText: { color: colors.textDim, fontSize: 12.5, textAlign: 'center', marginTop: 10 },

  result: { marginTop: 18, padding: 15, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.card, gap: 8 },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resultText: { fontSize: 14, fontWeight: '700' },
  resultLink: { color: colors.primary, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  foot: { color: colors.textFaint, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 26, fontFamily: fonts.mono },
})
