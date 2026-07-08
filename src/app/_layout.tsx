import '../global.css'

import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

import { AppProviders } from '../features/core/data-access/app-providers'
import { colors } from '../theme'

SplashScreen.preventAutoHideAsync()

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Audiowide: require('../../assets/fonts/Audiowide-Regular.ttf'),
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    // Quest-cabinet faces, shared from the author's Kickpact project.
    ZorrPixel: require('../../assets/fonts/pixel.ttf'),
    ZorrDisplay: require('../../assets/fonts/landing.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return null
  }

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </AppProviders>
  )
}
