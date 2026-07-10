import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight, Coins, Gift, X } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { claimZorrFaucet, fetchZorrBalance, fetchZorrConfig, swapZorr, withdrawZorr, type ZorrConfig } from '../features/nft/nft'
import { colors, fonts, radius } from '../theme'
import { GlowCard, Press } from './ui'

const SOL_STEPS = [0.5, 1, 5]
const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * $ZORR wallet strip for the home screen: shows the device's spendable balance
 * and opens a swap sheet (SOL → $ZORR). New wallets can claim a one-time starter
 * grant; any balance can be withdrawn to the real on-chain token account.
 */
export function ZorrCard() {
  const [config, setConfig] = useState<ZorrConfig | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setBalance(await fetchZorrBalance())
    } catch {
      /* relay offline — leave prior value */
    }
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      const c = await fetchZorrConfig()
      if (live) setConfig(c)
      if (live) refresh()
    })()
    return () => {
      live = false
    }
  }, [refresh])

  if (!config) return null // token not launched / relay offline → hide the strip entirely

  return (
    <>
      <Press onPress={() => setOpen(true)}>
        <GlowCard tint={colors.gold} contentStyle={styles.card}>
          <View style={styles.iconWrap}>
            <Coins color={colors.gold} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>$ZORR BALANCE</Text>
            <Text style={styles.balance}>{balance == null ? '—' : fmt(balance)}</Text>
          </View>
          <View style={styles.swapBtn}>
            <Text style={styles.swapText}>Swap</Text>
            <ArrowRight color={colors.gold} size={15} />
          </View>
        </GlowCard>
      </Press>

      <SwapSheet
        visible={open}
        config={config}
        balance={balance}
        onClose={() => setOpen(false)}
        onChanged={refresh}
      />
    </>
  )
}

function SwapSheet({
  visible,
  config,
  balance,
  onClose,
  onChanged,
}: {
  visible: boolean
  config: ZorrConfig
  balance: number | null
  onClose: () => void
  onChanged: () => void
}) {
  const [sol, setSol] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const get = Math.floor(sol * config.rate)

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    setMsg(null)
    try {
      setMsg(await fn())
      onChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Swap to $ZORR</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <X color={colors.text} size={18} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetSub}>Trade SOL for $ZORR — the token you stake and win in duels. Balance: {balance == null ? '—' : fmt(balance)} ZORR</Text>

          <View style={styles.steps}>
            {SOL_STEPS.map((v) => (
              <TouchableOpacity key={v} onPress={() => setSol(v)} activeOpacity={0.85} style={[styles.step, sol === v && styles.stepOn]}>
                <Text style={[styles.stepText, sol === v && styles.stepTextOn]}>{v} SOL</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewSol}>{sol} SOL</Text>
            <ArrowRight color={colors.textDim} size={18} />
            <Text style={styles.previewZorr}>{fmt(get)} ZORR</Text>
          </View>

          <TouchableOpacity activeOpacity={0.9} disabled={busy} onPress={() => run(async () => {
            const r = await swapZorr(sol)
            return `Swapped — +${fmt(r.got)} ZORR`
          })}>
            <LinearGradient colors={['#FBBF24', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              {busy ? <ActivityIndicator color="#1a1206" /> : <Text style={styles.ctaText}>Swap {sol} SOL → {fmt(get)} ZORR</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity disabled={busy} style={styles.secondary} onPress={() => run(async () => {
              const r = await claimZorrFaucet()
              return r.granted ? `Claimed ${r.granted} starter ZORR` : 'Starter grant already claimed'
            })}>
              <Gift color={colors.territory} size={15} />
              <Text style={styles.secondaryText}>Starter 500</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} style={styles.secondary} onPress={() => run(async () => {
              const r = await withdrawZorr()
              return `Withdrew ${fmt(r.amount)} ZORR on-chain ⚡`
            })}>
              <ArrowRight color={colors.primary} size={15} />
              <Text style={styles.secondaryText}>Withdraw on-chain</Text>
            </TouchableOpacity>
          </View>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <Text style={styles.foot}>Devnet · $ZORR is a real SPL token. Balances settle instantly on the Zorr relay and withdraw to your Solana wallet.</Text>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.textDim, fontSize: 10, letterSpacing: 1.4 },
  balance: { color: colors.text, fontSize: 24, fontFamily: fonts.display, marginTop: 1 },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: 'rgba(251,191,36,0.1)',
  },
  swapText: { color: colors.gold, fontSize: 13, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  sheetSub: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  steps: { flexDirection: 'row', gap: 10 },
  step: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  stepOn: { borderColor: colors.gold, backgroundColor: 'rgba(251,191,36,0.12)' },
  stepText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  stepTextOn: { color: colors.gold },
  preview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 6 },
  previewSol: { color: colors.textMuted, fontSize: 18, fontFamily: fonts.display },
  previewZorr: { color: colors.gold, fontSize: 20, fontFamily: fonts.display },
  cta: { paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#1a1206', fontSize: 15, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  secondaryText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  msg: { color: colors.territory, fontSize: 13, textAlign: 'center' },
  foot: { color: colors.textFaint, fontSize: 11, textAlign: 'center', lineHeight: 16 },
})
