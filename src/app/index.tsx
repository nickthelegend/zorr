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
    // Only wait on the fast SecureStore read, not Privy's slow cold-start.
    if (!gate.onboarded) {
      router.replace('/onboarding')
    } else if ((isReady && user) || gate.entered) {
      router.replace('/home')
    } else {
      router.replace('/login')
    }
  }, [isReady, user, gate])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}
