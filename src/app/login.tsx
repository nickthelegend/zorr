import { useEmbeddedSolanaWallet, useLoginWithEmail, usePrivy } from '@privy-io/expo'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ArrowRight, Check, Mail, ShieldCheck, Sparkles } from 'lucide-react-native'
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

type Step = 'email' | 'code' | 'identity'

export default function LoginScreen() {
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const game = useGame()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(game.name === 'Explorer' ? '' : game.name)
  const [color, setColor] = useState<string>(game.color)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flowStarted = useRef(false)

  // Returning user already has a Privy session → skip straight to the app.
  useEffect(() => {
    if (user && !flowStarted.current) {
      router.replace('/home')
    }
  }, [user])

  const handleSendCode = async () => {
    flowStarted.current = true
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address')
    setBusy(true)
    try {
      await sendCode({ email })
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code')
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    setError(null)
    setBusy(true)
    try {
      await loginWithCode({ code, email })
      setStep('identity')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      setBusy(false)
    }
  }

  const handleEnter = async () => {
    setBusy(true)
    try {
      if (!solana?.wallets?.length && solana?.create) {
        await solana.create()
      }
    } catch {
      // wallet may already exist
    } finally {
      game.setIdentity(name, color)
      router.replace('/home')
    }
  }

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
                {step === 'email' ? (
                  <StepBody
                    icon={<Mail color={colors.primary} size={26} />}
                    title="Sign in with email"
                    sub="We spin up a Solana wallet for you — no seed phrase to manage."
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="you@email.com"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                      editable={!busy}
                    />
                    <PrimaryButton label="Send code" busy={busy} onPress={handleSendCode} />
                  </StepBody>
                ) : step === 'code' ? (
                  <StepBody
                    icon={<ShieldCheck color={colors.territory} size={26} />}
                    title="Enter the code"
                    sub={`Sent to ${email}`}
                  >
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder="000000"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={setCode}
                      editable={!busy}
                    />
                    <PrimaryButton label="Verify" busy={busy} onPress={handleVerify} />
                    <TouchableOpacity onPress={() => setStep('email')} disabled={busy}>
                      <Text style={styles.link}>Use a different email</Text>
                    </TouchableOpacity>
                  </StepBody>
                ) : (
                  <StepBody
                    icon={<Sparkles color={colors.gold} size={26} />}
                    title="Create your Explorer"
                    sub="Pick a name and colors — your captured land shows your color on the map."
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Explorer name"
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="words"
                      value={name}
                      onChangeText={setName}
                      editable={!busy}
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
                    <PrimaryButton label="Enter Zorr" busy={busy} onPress={handleEnter} />
                  </StepBody>
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

function StepBody({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      {children}
    </Animated.View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 22 },
  hero: { alignItems: 'center', marginBottom: 26 },
  lottieWrap: { width: 130, height: 130, marginBottom: 4 },
  lottie: { width: '100%', height: '100%' },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 44, letterSpacing: 5 },
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
  codeInput: { textAlign: 'center', letterSpacing: 8, fontFamily: fonts.mono, fontSize: 22 },
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
