import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { colors, radius } from '../theme'

/** Glass card wrapped in a soft violet→emerald gradient hairline border. */
export function GradientBorderCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['rgba(124,58,237,0.9)', 'rgba(34,211,166,0.5)', 'rgba(124,58,237,0.3)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.border, style]}
    >
      <BlurView intensity={50} tint="dark" style={styles.inner}>
        <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} />
        <View style={styles.content}>{children}</View>
      </BlurView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  border: { borderRadius: radius.xl + 1, padding: 1.5 },
  inner: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: 'rgba(10,10,15,0.6)' },
  content: { padding: 24 },
})
