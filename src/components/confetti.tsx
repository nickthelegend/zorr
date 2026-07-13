import { useEffect, useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const WIN_COLORS = ['#FBBF24', '#34E3B8', '#7C3AED', '#F472B6', '#60A5FA', '#FDE68A']
const LOSE_COLORS = ['#64748B', '#94A3B8', '#F43F5E', '#475569', '#334155']

type Piece = { x: number; y0: number; sway: number; freq: number; spin: number; color: string; w: number; h: number }

function makePieces(n: number, colors: string[], W: number, H: number): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    const w = 6 + Math.random() * 7
    return {
      x: Math.random() * W,
      y0: -20 - Math.random() * H * 0.6, // staggered entry from above the top edge
      sway: (Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 70),
      freq: 1 + Math.random() * 2.2,
      spin: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 3),
      color: colors[i % colors.length],
      w,
      h: w * (0.45 + Math.random() * 0.5),
    }
  })
}

function Flake({ p, progress, H }: { p: Piece; progress: Animated.SharedValue<number>; H: number }) {
  const style = useAnimatedStyle(() => {
    'worklet'
    const pr = progress.value
    const y = p.y0 + (H + 100 - p.y0) * pr
    const x = p.x + p.sway * Math.sin(pr * Math.PI * p.freq)
    const opacity = pr < 0.82 ? 1 : Math.max(0, 1 - (pr - 0.82) / 0.18)
    return { opacity, transform: [{ translateX: x }, { translateY: y }, { rotate: `${p.spin * pr * 720}deg` }] }
  })
  return <Animated.View style={[styles.flake, { width: p.w, height: p.h, backgroundColor: p.color }, style]} />
}

/**
 * A one-shot confetti burst that rains across the screen. `variant="win"` is a
 * bright celebration; `variant="lose"` is a muted grey/red fall. Renders nothing
 * interactive (pointerEvents none) — drop it over any screen.
 */
export function Confetti({ variant = 'win', count, duration = 2800 }: { variant?: 'win' | 'lose'; count?: number; duration?: number }) {
  const { width: W, height: H } = useWindowDimensions()
  const n = count ?? (variant === 'win' ? 90 : 44)
  const progress = useSharedValue(0)
  const pieces = useMemo(() => makePieces(n, variant === 'win' ? WIN_COLORS : LOSE_COLORS, W, H), [n, variant, W, H])

  useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.out(Easing.quad) })
  }, [duration, progress])

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Flake key={i} p={p} progress={progress} H={H} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flake: { position: 'absolute', left: 0, top: 0, borderRadius: 1.5 },
})
