import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode, useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

import { tapHaptic } from '../features/core/haptics'
import { colors, fonts, gradients, radius } from '../theme'

/**
 * Zorr premium UI kit — the shared primitives every screen composes:
 *   Press      spring scale-down feedback for anything tappable
 *   GlowCard   glass surface with a light-catching gradient hairline + tint/glow
 *   CTA        gradient action button (loading/disabled aware)
 *   GhostBtn   quiet bordered sibling of CTA
 *   Eyebrow    uppercase tracked section label with hairline rule
 *   MeterBar   animated stat bar (HP/energy) with gradient fill
 */

// ---- Press ------------------------------------------------------------------
const SPRING = { damping: 16, stiffness: 320, mass: 0.6 }
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Press({
  children,
  onPress,
  disabled,
  style,
  hitSlop,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  hitSlop?: number
}) {
  const scale = useSharedValue(1)
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  // One node carries layout + gesture + transform, so flex styles (e.g. flex: 1
  // in a row) apply to the actual flex child.
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withSpring(0.965, SPRING)
        tapHaptic()
      }}
      onPressOut={() => (scale.value = withSpring(1, SPRING))}
      style={[aStyle, style]}
    >
      {children}
    </AnimatedPressable>
  )
}

// ---- GlowCard ---------------------------------------------------------------
export function GlowCard({
  children,
  tint,
  glow,
  borderTint,
  style,
  contentStyle,
  radiusSize = radius.xl,
}: {
  children: ReactNode
  /** soft color wash inside the card (e.g. player color) */
  tint?: string
  /** shadow color that lifts the card off the black */
  glow?: string
  /** colors the hairline edge (e.g. violet for featured cards) */
  borderTint?: string
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  radiusSize?: number
}) {
  const edge = borderTint
    ? ([`${borderTint}88`, `${borderTint}22`, `${borderTint}55`] as const)
    : gradients.hairline
  return (
    <View
      style={[
        glow
          ? {
              shadowColor: glow,
              shadowOpacity: 0.45,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }
          : null,
        style,
      ]}
    >
      <LinearGradient colors={edge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radiusSize, padding: 1 }}>
        <View style={{ borderRadius: radiusSize - 1, backgroundColor: colors.surface2, overflow: 'hidden' }}>
          {tint ? (
            <LinearGradient
              colors={[`${tint}24`, 'rgba(0,0,0,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={contentStyle}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  )
}

// ---- Buttons ------------------------------------------------------------------
export function CTA({
  label,
  icon,
  onPress,
  palette = gradients.territory,
  textColor = '#04110C',
  loading,
  disabled,
  compact,
  style,
}: {
  label: string
  icon?: ReactNode
  onPress?: () => void
  palette?: readonly [string, string] | readonly string[]
  textColor?: string
  loading?: boolean
  disabled?: boolean
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const off = disabled || loading
  return (
    <Press onPress={onPress} disabled={off} style={style}>
      <View
        style={
          off
            ? null
            : {
                shadowColor: palette[0] as string,
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 10,
              }
        }
      >
        <LinearGradient
          colors={palette as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.cta, compact && styles.ctaCompact, off && { opacity: 0.55 }]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <>
              {icon}
              <Text style={[styles.ctaText, compact && { fontSize: 15 }, { color: textColor }]}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </View>
    </Press>
  )
}

export function GhostBtn({
  label,
  icon,
  onPress,
  disabled,
  style,
}: {
  label: string
  icon?: ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Press onPress={onPress} disabled={disabled} style={style}>
      <LinearGradient colors={gradients.hairline} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: 1 }}>
        <View style={[styles.ghost, disabled && { opacity: 0.5 }]}>
          {icon}
          <Text style={styles.ghostText}>{label}</Text>
        </View>
      </LinearGradient>
    </Press>
  )
}

// ---- Eyebrow ------------------------------------------------------------------
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.eyebrowRow, style]}>
      <Text style={styles.eyebrowText}>{children}</Text>
      <View style={styles.eyebrowRule} />
    </View>
  )
}

// ---- MeterBar -----------------------------------------------------------------
export function MeterBar({
  value,
  max,
  palette,
  height = 8,
  track = 'rgba(255,255,255,0.08)',
}: {
  value: number
  max: number
  palette: readonly [string, string]
  height?: number
  track?: string
}) {
  const pct = useSharedValue(max > 0 ? value / max : 0)
  useEffect(() => {
    pct.value = withTiming(Math.max(0, Math.min(1, max > 0 ? value / max : 0)), { duration: 420 })
  }, [value, max, pct])
  const fill = useAnimatedStyle(() => ({ width: `${pct.value * 100}%` }))
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, overflow: 'hidden' }, fill]}>
        <LinearGradient colors={palette as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: radius.lg,
  },
  ctaCompact: { paddingVertical: 13 },
  ctaText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.lg - 1,
    backgroundColor: colors.surface2,
  },
  ghostText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowText: { color: colors.textFaint, fontSize: 11, letterSpacing: 2.5, fontFamily: fonts.mono },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
})
