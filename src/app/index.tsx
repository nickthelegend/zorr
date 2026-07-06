import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { colors } from '../theme'

export default function Index() {
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const done = await SecureStore.getItemAsync('onboardingCompleted')
      if (mounted) {
        router.replace(done ? '/home' : '/onboarding')
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}
