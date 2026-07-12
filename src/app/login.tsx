import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { useLogin } from '@privy-io/expo/ui'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { ArrowRight, Check, Mail, Sparkles, Wallet } from 'lucide-react-native'
import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { GradientBorderCard } from '../components/gradient-border-card'
import { EXPLORER_COLORS, useGame } from '../features/game/game-store'
import { colors, fonts, radius } from '../theme'

type Step = 'welcome' | 'identity'
// Privy UI login methods (email + OAuth); external Solana wallets go through MWA.
type PrivyMethod = 'email' | 'google'

export default function LoginScreen() {
  const { user } = usePrivy()
  const { login } = useLogin() // Privy's official login modal (email + Google OAuth)
  const solana = useEmbeddedSolanaWallet()
  const { connect } = useMobileWallet() // external Solana wallets (Solflare, Phantom…) via Mobile Wallet Adapter
  const game = useGame()

  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState(game.name === 'Explorer' ? '' : game.name)
  const [color, setColor] = useState<string>(game.color)
  const [busy, setBusy] = useState<null | PrivyMethod | 'wallet'>(null)
  const [error, setError] = useState<string | null>(null)
  const [walletFailed, setWalletFailed] = useState(false)
  const flowStarted = useRef(false)

  // Returning user already has a Privy session → skip straight to the app.
  useEffect(() => {
    if (user && !flowStarted.current) {
      router.replace('/home')
    }
  }, [user])

  const isCancel = (msg: string) => /closed|cancel|dismiss|reject|declin/i.test(msg)

  // Privy modal — restrict to the chosen method so the button goes straight there.
  const loginWithPrivy = async (method: PrivyMethod) => {
    flowStarted.current = true
    setError(null)
    setBusy(method)
    try {
      await login({ loginMethods: [method] })
      setStep('identity')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isCancel(msg)) setError(msg)
    } finally {
      setBusy(null)
    }
  }

  // External Solana wallet (Solflare / Phantom / any MWA-compatible wallet — Solana only).
  const connectSolanaWallet = async () => {
    flowStarted.current = true
    setError(null)
    setBusy('wallet')
    try {
      await connect()
      setStep('identity')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isCancel(msg)) setError(msg)
    } finally {
      setBusy(null)
    }
  }

  const finishEntry = async () => {
    game.setIdentity(name, color)
    await SecureStore.setItemAsync('zorr.entered', '1')
    router.replace('/home')
  }

  // Entering the app. A Privy sign-in provisions their embedded Solana wallet in
  // the effect below (the provider only exposes create()/recover() the render
  // after the user appears). An external MWA wallet is already connected, so we
  // enter straight away with it. Wallet failures are SHOWN, never swallowed.
  const [entering, setEntering] = useState(false)
  const walletAttempted = useRef(false)

  const handleEnter = async () => {
    setBusy('email')
    setError(null)
    walletAttempted.current = false
    if (!user) {
      await finishEntry() // external MWA wallet already connected — enter with it
      return
    }
    setEntering(true) // Privy user — provision the embedded wallet in the effect
  }

  useEffect(() => {
    if (!entering || !user || walletAttempted.current) return
    if (solana?.wallets?.length) {
      walletAttempted.current = true
      finishEntry()
      return
    }
    const canRecover = solana?.status === 'needs-recovery' && !!solana.recover
    if (!canRecover && !solana?.create) return // provider not ready yet — next render
    walletAttempted.current = true
    ;(async () => {
      try {
        if (canRecover) await solana.recover!()
        else await solana.create!()
        await finishEntry()
      } catch (e) {
        walletAttempted.current = false
        setEntering(false)
        setBusy(null)
        setWalletFailed(true)
        setError(`Wallet setup failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering, user, solana])

  const anyBusy = busy !== null

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.content}>
            <Animated.View entering={FadeIn.duration(600)} style={styles.hero}>
              <View style={styles.lottieWrap}>
                <LottieView source={require('../../assets/lottie/wallet.json')} autoPlay loop style={styles.lottie} />
              </View>
              <Text style={styles.brand}>ZORR</Text>
              <Text style={styles.tagline}>Walk. Capture. Own the map.</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(120)} key={step}>
              <GradientBorderCard>
                {step === 'welcome' ? (
                  <Animated.View entering={FadeInDown.duration(300)}>
                    <Text style={styles.title}>Sign in to play</Text>
                    <Text style={styles.sub}>
                      Continue with Google or email — Privy spins up a self-custodial Solana wallet, no seed phrase. Or
                      connect a Solana wallet you already own.
                    </Text>

                    <GoogleButton busy={busy === 'google'} disabled={anyBusy} onPress={() => loginWithPrivy('google')} />

                    <OutlineButton
                      icon={<Mail color={colors.text} size={20} />}
                      label="Continue with email"
                      busy={busy === 'email'}
                      disabled={anyBusy}
                      onPress={() => loginWithPrivy('email')}
                    />

                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={styles.dividerText}>or</Text>
                      <View style={styles.line} />
                    </View>

                    <OutlineButton
                      icon={<Wallet color={colors.primary} size={20} />}
                      label="Connect a Solana wallet"
                      sub="Solflare, Phantom & more — Solana only"
                      busy={busy === 'wallet'}
                      disabled={anyBusy}
                      onPress={connectSolanaWallet}
                    />
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeInDown.duration(300)}>
                    <View style={styles.iconWrap}>
                      <Sparkles color={colors.gold} size={26} />
                    </View>
                    <Text style={styles.title}>Create your Explorer</Text>
                    <Text style={styles.sub}>Pick a name and colors — your captured land shows your color on the map.</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Explorer name"
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="words"
                      value={name}
                      onChangeText={setName}
                      editable={!anyBusy}
                    />
                    <View style={styles.swatchRow}>
                      {EXPLORER_COLORS.map((c) => (
                        <TouchableOpacity key={c} onPress={() => setColor(c)} activeOpacity={0.8}>
                          <View style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}>
                            {color === c ? <Check color="#000" size={16} /> : null}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <PrimaryButton label={anyBusy ? 'Setting up wallet…' : 'Enter Zorr'} busy={anyBusy} onPress={handleEnter} />
                    {walletFailed ? (
                      <TouchableOpacity onPress={finishEntry} disabled={anyBusy}>
                        <Text style={styles.link}>Enter without a wallet for now</Text>
                      </TouchableOpacity>
                    ) : null}
                  </Animated.View>
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </GradientBorderCard>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={busy} style={{ marginTop: 20 }}>
      <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Text style={styles.buttonText}>{label}</Text>
            <ArrowRight color={colors.text} size={20} />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
}

function GoogleButton({ busy, disabled, onPress }: { busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={disabled} style={[styles.googleBtn, disabled && styles.dim]}>
      {busy ? (
        <ActivityIndicator color="#1f1f1f" />
      ) : (
        <>
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

function OutlineButton({
  icon,
  label,
  sub,
  busy,
  disabled,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  busy: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={disabled} style={[styles.outlineBtn, disabled && styles.dim]}>
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <View style={styles.outlineIcon}>{icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.outlineText}>{label}</Text>
            {sub ? <Text style={styles.outlineSub}>{sub}</Text> : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 22 },
  hero: { alignItems: 'center', marginBottom: 26 },
  lottieWrap: { width: 130, height: 130, marginBottom: 4 },
  lottie: { width: '100%', height: '100%' },
  brand: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 44, letterSpacing: 5 },
  tagline: { color: colors.textMuted, fontSize: 15, marginTop: 6 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 21, fontFamily: fonts.display, textAlign: 'center' },
  sub: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  googleBtn: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  googleG: { color: '#4285F4', fontSize: 20, fontWeight: '900' },
  googleText: { color: '#1f1f1f', fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    minHeight: 56,
  },
  outlineIcon: { width: 28, alignItems: 'center' },
  outlineText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  outlineSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  dim: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  swatchRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: '#fff' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  link: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 16 },
  error: { color: colors.enemy, fontSize: 13, textAlign: 'center', marginTop: 14 },
})
