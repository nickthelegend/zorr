import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

/**
 * The Solana wordmark (the three slanted bars) with the official teal→magenta
 * brand gradient — used for the SOL row in the wallet so assets read at a glance.
 */
export function SolanaMark({ size = 22 }: { size?: number }) {
  const h = (size * 312) / 398
  return (
    <Svg width={size} height={h} viewBox="0 0 398 312">
      <Defs>
        <LinearGradient id="solGrad" x1="360.879" y1="-37.455" x2="141.213" y2="383.294" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#00FFA3" />
          <Stop offset="1" stopColor="#DC1FFF" />
        </LinearGradient>
      </Defs>
      <Path
        fill="url(#solGrad)"
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H5.9c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      />
      <Path
        fill="url(#solGrad)"
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H5.9c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      />
      <Path
        fill="url(#solGrad)"
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      />
    </Svg>
  )
}
