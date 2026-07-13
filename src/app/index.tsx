import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { colors } from '../theme'

type Gate = { onboarded: boolean; entered: boolean }

export default function Index() {
  const { user, isReady } = usePrivy()
  const [gate, setGate] = useState<Gate | null>(null)

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('onboardingCompleted'),
      SecureStore.getItemAsync('zorr.entered'),
    ]).then(([o, e]) => setGate({ onboarded: !!o, entered: !!e }))
  }, [])

  useEffect(() => {
    if (!gate) return
    if (!gate.onboarded) {
      router.replace('/onboarding')
      return
    }
    // Require a real signed-in Privy account — no device-session bypass (that's
    // what showed "Explorer · sign in to save your progress"). Wait for Privy to
    // finish restoring the session (the splash spinner keeps showing) before
    // deciding, so a logged-in user never flashes the login screen on cold start.
    if (!isReady) return
    router.replace(user ? '/home' : '/login')
  }, [isReady, user, gate])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}
