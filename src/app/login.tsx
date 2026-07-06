import { useEmbeddedSolanaWallet, useLoginWithEmail, usePrivy } from '@privy-io/expo'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react-native'
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassCard } from '../components/glass-card'
import { colors, fonts, radius } from '../theme'

export default function LoginScreen() {
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const provisioning = useRef(false)

  // Once logged in, make sure an embedded Solana wallet exists, then enter the app.
  useEffect(() => {
    if (!user || provisioning.current) return
    provisioning.current = true
    ;(async () => {
      try {
        if (!solana?.wallets?.length && solana?.create) {
          await solana.create()
        }
      } catch {
        // wallet may already exist; ignore
      } finally {
        router.replace('/home')
      }
    })()
  }, [user, solana])

  const handleSendCode = async () => {
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
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
      // navigation happens in the effect above once `user` is set
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Animated.View entering={FadeIn} style={styles.hero}>
            <Text style={styles.brand}>ZORR</Text>
            <Text style={styles.tagline}>Create your Explorer</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <GlassCard>
              {step === 'email' ? (
                <>
                  <View style={styles.iconWrap}>
                    <Mail color={colors.primary} size={26} />
                  </View>
                  <Text style={styles.title}>Sign in with email</Text>
                  <Text style={styles.sub}>We&apos;ll create a Solana wallet for you — no seed phrase to manage.</Text>
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
                </>
              ) : (
                <>
                  <View style={styles.iconWrap}>
                    <ShieldCheck color={colors.territory} size={26} />
                  </View>
                  <Text style={styles.title}>Enter the code</Text>
                  <Text style={styles.sub}>Sent to {email}</Text>
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
                  <PrimaryButton label="Verify & enter" busy={busy} onPress={handleVerify} />
                  <TouchableOpacity onPress={() => setStep('email')} disabled={busy}>
                    <Text style={styles.link}>Use a different email</Text>
                  </TouchableOpacity>
                </>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </GlassCard>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  hero: { alignItems: 'center', marginBottom: 28 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 40, letterSpacing: 4 },
  tagline: { color: colors.textDim, fontSize: 15, marginTop: 6 },
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
  title: { color: colors.text, fontSize: 20, fontFamily: fonts.display, textAlign: 'center' },
  sub: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  input: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontFamily: fonts.mono, fontSize: 22 },
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
