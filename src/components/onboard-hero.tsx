import type { LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import Svg, { Circle, Defs, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg'

import { colors } from '../theme'

// Deterministic "captured territory" tiles scattered inside the ring — the map
// motif that runs through the app, instead of stock illustration art.
const TILES = [
  { x: 126, y: 54, o: 0.9 },
  { x: 141, y: 66, o: 0.45 },
  { x: 128, y: 70, o: 0.7 },
  { x: 48, y: 124, o: 0.55 },
  { x: 60, y: 136, o: 0.85 },
  { x: 46, y: 140, o: 0.35 },
]

const TICKS = Array.from({ length: 24 })

/**
 * On-brand onboarding hero: a glowing radar/territory ring with the slide's
 * icon at its core. Pure react-native-svg + theme tints — no external art.
 */
export function OnboardHero({ Icon, tint, size = 240 }: { Icon: LucideIcon; tint: string; size?: number }) {
  const c = 100
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="ob-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={0.06} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* ambient glow */}
        <Circle cx={c} cy={c} r={99} fill="url(#ob-glow)" />

        {/* compass ticks */}
        <G>
          {TICKS.map((_, i) => {
            const a = (i / TICKS.length) * Math.PI * 2
            const r2 = i % 6 === 0 ? 77 : 82
            return (
              <Line
                key={i}
                x1={c + Math.cos(a) * 87}
                y1={c + Math.sin(a) * 87}
                x2={c + Math.cos(a) * r2}
                y2={c + Math.sin(a) * r2}
                stroke={tint}
                strokeOpacity={0.28}
                strokeWidth={1}
              />
            )
          })}
        </G>

        {/* rings */}
        <Circle cx={c} cy={c} r={87} stroke={tint} strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={67}
          stroke={tint}
          strokeOpacity={0.5}
          strokeWidth={1}
          fill="none"
          strokeDasharray="3 7"
        />

        {/* captured-territory tiles */}
        {TILES.map((t, i) => (
          <Rect key={i} x={t.x} y={t.y} width={12} height={12} rx={2.5} fill={tint} fillOpacity={t.o} />
        ))}

        {/* core disc + icon backing */}
        <Circle cx={c} cy={c} r={35} fill={colors.background} />
        <Circle cx={c} cy={c} r={35} fill={tint} fillOpacity={0.12} />
        <Circle cx={c} cy={c} r={35} stroke={tint} strokeOpacity={0.6} strokeWidth={1.5} fill="none" />
      </Svg>

      {/* the slide's icon, centered over the core */}
      <View style={{ position: 'absolute' }}>
        <Icon size={Math.round(size * 0.19)} color={tint} />
      </View>
    </View>
  )
}
