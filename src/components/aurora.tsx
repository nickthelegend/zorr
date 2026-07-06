import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

const { width, height } = Dimensions.get('window')

/** Slow-drifting colored glow blobs — premium animated ambiance behind dark UI. */
function Blob({
  colors,
  size,
  from,
  to,
  duration,
}: {
  colors: readonly [string, string, ...string[]]
  size: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  duration: number
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
  }, [t, duration])
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: from.x + (to.x - from.x) * t.value },
      { translateY: from.y + (to.y - from.y) * t.value },
    ],
  }))
  return (
    <Animated.View style={[styles.blob, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.8, y: 0.8 }} />
    </Animated.View>
  )
}

export function Aurora() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Blob
        colors={['rgba(124,58,237,0.55)', 'rgba(124,58,237,0)']}
        size={width * 1.1}
        from={{ x: -width * 0.3, y: -height * 0.1 }}
        to={{ x: width * 0.1, y: height * 0.05 }}
        duration={9000}
      />
      <Blob
        colors={['rgba(34,211,166,0.35)', 'rgba(34,211,166,0)']}
        size={width}
        from={{ x: width * 0.4, y: height * 0.5 }}
        to={{ x: width * 0.1, y: height * 0.7 }}
        duration={11000}
      />
      <Blob
        colors={['rgba(244,63,94,0.22)', 'rgba(244,63,94,0)']}
        size={width * 0.9}
        from={{ x: width * 0.5, y: -height * 0.05 }}
        to={{ x: width * 0.2, y: height * 0.15 }}
        duration={13000}
      />
      {/* Melt the blob edges into soft glows. */}
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', opacity: 0.9 },
})
