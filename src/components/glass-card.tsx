import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { colors, radius } from '../theme'

export function GlassCard({
  children,
  style,
  glow = true,
  intensity = 40,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  glow?: boolean
  intensity?: number
}) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.card, style]}>
      {glow ? (
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.10)', 'rgba(0, 0, 0, 0)']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.inner}>{children}</View>
    </BlurView>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inner: { padding: 20 },
})
