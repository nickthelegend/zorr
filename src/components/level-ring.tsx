import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'

import { colors, fonts } from '../theme'

/**
 * Zorr's signature instrument: a compass-rose level ring. 60 bearing ticks
 * (cardinals emphasized) around a progress sweep — your level rendered like a
 * heading on a navigation dial.
 */
export function LevelRing({
  size = 116,
  progress,
  level,
  color = colors.primary,
}: {
  size?: number
  progress: number // 0..1 into the current level
  level: number
  color?: string
}) {
  const c = size / 2
  const rTicks = c - 2
  const rArc = c - 11
  const circumference = 2 * Math.PI * rArc
  const clamped = Math.max(0, Math.min(1, progress))

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const cardinal = i % 15 === 0
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2
    const len = cardinal ? 7 : 3.5
    return {
      key: i,
      x1: c + Math.cos(a) * (rTicks - len),
      y1: c + Math.sin(a) * (rTicks - len),
      x2: c + Math.cos(a) * rTicks,
      y2: c + Math.sin(a) * rTicks,
      cardinal,
    }
  })

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {ticks.map((t) => (
          <Line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.cardinal ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)'}
            strokeWidth={t.cardinal ? 2 : 1}
          />
        ))}
        {/* Track */}
        <Circle cx={c} cy={c} r={rArc} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
        {/* Progress sweep, from due north */}
        <Circle
          cx={c}
          cy={c}
          r={rArc}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.level, { fontSize: size * 0.28 }]}>{level}</Text>
        <Text style={styles.label}>LVL</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  level: { color: colors.text, fontFamily: fonts.display, lineHeight: undefined },
  label: { color: colors.textFaint, fontSize: 9, letterSpacing: 2, marginTop: -2 },
})
