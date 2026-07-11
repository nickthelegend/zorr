import { router } from 'expo-router'
import { ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff, RefreshCw, Send, ShieldCheck, X } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { GlowCard, Press } from '../components/ui'
import {
  deposit,
  explorerTx,
  fetchBaseBalance,
  fetchPrivateBalance,
  fromBaseUnits,
  paymentsOwner,
  toBaseUnits,
  transfer,
  withdraw,
} from '../features/payments/magicblock'
import { colors, fonts, radius } from '../theme'

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 })

type Result = { ok: boolean; text: string; sig?: string } | null

export default function PaymentsScreen() {
  const [owner, setOwner] = useState<string>()
  const [base, setBase] = useState<number | null>(null)
  const [priv, setPriv] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
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

  const run = async (label: string, fn: () => Promise<string>) => {
    if (busy) return
    setBusy(label)
    setResult(null)
    try {
      const sig = await fn()
      setResult({ ok: true, text: `${label} confirmed`, sig })
      setTimeout(refresh, 2500)
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <ShieldCheck color={colors.primary} size={22} />
            <Text style={styles.title}>Private Payments</Text>
          </View>
          <TouchableOpacity style={styles.close} onPress={() => router.back()}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            Shield $ZORR into a MagicBlock ephemeral rollup, send it privately (delayed + split), and withdraw back to
            Solana — on devnet.
          </Text>

          {/* Balances */}
          <View style={styles.balRow}>
            <BalanceCard icon={<Eye color={colors.textDim} size={16} />} label="PUBLIC · base" value={base} loading={loading} tint={colors.textDim} />
            <BalanceCard icon={<EyeOff color={colors.primary} size={16} />} label="PRIVATE · rollup" value={priv} loading={loading} tint={colors.primary} />
          </View>
          <Press onPress={refresh} style={styles.refreshRow}>
            <RefreshCw color={colors.textMuted} size={13} />
            <Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh balances'}</Text>
          </Press>

          {/* Amount */}
          <Text style={styles.fieldLabel}>AMOUNT ($ZORR)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            editable={!busy}
          />

          {/* Shield / Unshield */}
          <View style={styles.actionRow}>
            <ActionButton
              label={busy === 'Deposit' ? 'Shielding…' : 'Shield'}
              hint="base → private"
              icon={<ArrowDownToLine color="#04110C" size={18} />}
              primary
              disabled={!amtValid || !!busy}
              onPress={() => run('Deposit', () => deposit(toBaseUnits(amt)))}
            />
            <ActionButton
              label={busy === 'Withdraw' ? 'Withdrawing…' : 'Withdraw'}
              hint="private → base"
              icon={<ArrowUpFromLine color={colors.text} size={18} />}
              disabled={!amtValid || !!busy}
              onPress={() => run('Withdraw', () => withdraw(toBaseUnits(amt)))}
            />
          </View>

          {/* Transfer */}
          <Text style={styles.fieldLabel}>SEND TO (wallet address)</Text>
          <TextInput
            style={[styles.input, styles.addrInput]}
            placeholder="Recipient base58 address"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={to}
            onChangeText={setTo}
            editable={!busy}
          />
          <View style={styles.actionRow}>
            <ActionButton
              label={busy === 'Public send' ? 'Sending…' : 'Send public'}
              hint="visible transfer"
              icon={<Send color={colors.text} size={17} />}
              disabled={!amtValid || to.length < 32 || !!busy}
              onPress={() =>
                run('Public send', () => transfer({ to: to.trim(), amount: toBaseUnits(amt), visibility: 'public', fromBalance: 'base', toBalance: 'base' }))
              }
            />
            <ActionButton
              label={busy === 'Private send' ? 'Sending…' : 'Send private'}
              hint="delayed + split"
              icon={<ShieldCheck color="#04110C" size={17} />}
              primary
              disabled={!amtValid || to.length < 32 || !!busy}
              onPress={() =>
                run('Private send', () => transfer({ to: to.trim(), amount: toBaseUnits(amt), visibility: 'private', fromBalance: 'ephemeral', toBalance: 'ephemeral' }))
              }
            />
          </View>

          {/* Result */}
          {result ? (
            <Animated.View entering={FadeInDown} style={[styles.result, { borderColor: result.ok ? colors.territory : colors.enemy }]}>
              <Text style={[styles.resultText, { color: result.ok ? colors.territory : colors.enemy }]}>{result.text}</Text>
              {result.sig ? (
                <TouchableOpacity onPress={() => Linking.openURL(explorerTx(result.sig!))}>
                  <Text style={styles.resultLink}>View on Solana Explorer ↗</Text>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          ) : null}

          <Text style={styles.foot}>
            Powered by MagicBlock Private Ephemeral Rollups. Your device wallet signs every transaction; balances and
            transfers settle on-chain. {owner ? `\n${owner.slice(0, 6)}…${owner.slice(-6)}` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function BalanceCard({ icon, label, value, loading, tint }: { icon: React.ReactNode; label: string; value: number | null; loading: boolean; tint: string }) {
  return (
    <GlowCard tint={tint} contentStyle={styles.balCard}>
      <View style={styles.balHead}>
        {icon}
        <Text style={styles.balLabel}>{label}</Text>
      </View>
      <Text style={styles.balValue}>{loading && value == null ? '…' : value == null ? '—' : fmt(value)}</Text>
      <Text style={styles.balUnit}>$ZORR</Text>
    </GlowCard>
  )
}

function ActionButton({ label, hint, icon, onPress, disabled, primary }: { label: string; hint: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionFlex} activeOpacity={0.85} onPress={onPress} disabled={disabled}>
      <View style={[styles.action, primary ? styles.actionPrimary : styles.actionGhost, disabled && styles.actionOff]}>
        {icon}
        <Text style={[styles.actionLabel, primary && { color: '#04110C' }]}>{label}</Text>
        <Text style={[styles.actionHint, primary && { color: 'rgba(4,17,12,0.6)' }]}>{hint}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 60 },
  sub: { color: colors.textDim, fontSize: 13.5, lineHeight: 20, marginBottom: 18 },

  balRow: { flexDirection: 'row', gap: 12 },
  balCard: { padding: 16, gap: 3 },
  balHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  balLabel: { color: colors.textFaint, fontSize: 9.5, letterSpacing: 1 },
  balValue: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  balUnit: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },
  refreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  refreshText: { color: colors.textMuted, fontSize: 12.5 },

  fieldLabel: { color: colors.textFaint, fontSize: 10.5, letterSpacing: 1.4, marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 20, fontFamily: fonts.display,
  },
  addrInput: { fontSize: 13, fontFamily: fonts.mono },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionFlex: { flex: 1 },
  action: { alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: radius.md, borderWidth: 1 },
  actionPrimary: { backgroundColor: colors.territory, borderColor: colors.territory },
  actionGhost: { backgroundColor: colors.surface2, borderColor: colors.border },
  actionOff: { opacity: 0.4 },
  actionLabel: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
  actionHint: { color: colors.textDim, fontSize: 10.5 },

  result: { marginTop: 20, padding: 14, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.card, gap: 6 },
  resultText: { fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  resultLink: { color: colors.primary, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  foot: { color: colors.textFaint, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 24, fontFamily: fonts.mono },
})
