import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { colors } from '../theme'

export default function Index() {
  const { user, isReady } = usePrivy()
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync('onboardingCompleted').then((v) => setOnboarded(!!v))
  }, [])

  useEffect(() => {
    // Don't block the whole app on Privy's slow cold-start `isReady` — only wait
    // on the fast SecureStore read. Login/home is decided from `user` as it resolves.
    if (onboarded === null) return
    if (!onboarded) {
      router.replace('/onboarding')
    } else if (isReady && user) {
      router.replace('/home')
    } else {
      router.replace('/home') // TEMP dev bypass (revert)
    }
  }, [isReady, onboarded, user])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}
