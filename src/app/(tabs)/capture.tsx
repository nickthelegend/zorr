import { LinearGradient } from 'expo-linear-gradient'
import { Activity, Flag, Footprints, Gauge, MapPin } from 'lucide-react-native'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, fonts, radius } from '../../theme'

const GRID_COLS = 6
const GRID_ROWS = 10

// Placeholder "captured" tiles until the live map + on-chain territory is wired.
const CAPTURED = new Set([8, 9, 14, 15, 20])
const RIVAL = new Set([3, 4, 33, 39])

function TileGrid() {
  const tiles = Array.from({ length: GRID_COLS * GRID_ROWS })
  return (
    <View style={styles.grid}>
      {tiles.map((_, i) => {
        const mine = CAPTURED.has(i)
        const rival = RIVAL.has(i)
        return (
          <View
            key={i}
            style={[
              styles.tile,
              mine && { backgroundColor: colors.territorySoft, borderColor: colors.territory },
              rival && { backgroundColor: 'rgba(244,63,94,0.10)', borderColor: colors.enemy },
            ]}
          />
        )
      })}
    </View>
  )
}

function HudChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.chip}>
      {icon}
      <View>
        <Text style={styles.chipValue}>{value}</Text>
        <Text style={styles.chipLabel}>{label}</Text>
      </View>
    </View>
  )
}

export default function CaptureScreen() {
  return (
    <View style={styles.container}>
      {/* Territory map (stylized grid for now) */}
      <TileGrid />
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Top HUD — anti-cheat status */}
        <Animated.View entering={FadeIn} style={styles.hud}>
          <HudChip icon={<Gauge color={colors.territory} size={18} />} value="0.0 km/h" label="Speed" />
          <HudChip icon={<Footprints color={colors.primary} size={18} />} value="0" label="Steps/min" />
          <HudChip icon={<Activity color={colors.gold} size={18} />} value="Idle" label="Activity" />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Current zone + capture */}
        <Animated.View entering={FadeInUp} style={styles.sheet}>
          <View style={styles.zoneRow}>
            <MapPin color={colors.territory} size={18} />
            <Text style={styles.zoneName}>Unclaimed Zone</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+50 $ZORR</Text>
            </View>
          </View>
          <Text style={styles.zoneHint}>Walk into a tile to capture it. Hold ground to keep it.</Text>

          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={['#22D3A6', '#0F766E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.captureBtn}
            >
              <Flag color="#04110C" size={20} />
              <Text style={styles.captureText}>Capture Tile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  tile: {
    width: `${100 / GRID_COLS}%`,
    height: `${100 / GRID_ROWS}%`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  overlay: { flex: 1, paddingHorizontal: 16 },
  hud: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipValue: { color: colors.text, fontSize: 14, fontFamily: fonts.mono },
  chipLabel: { color: colors.textDim, fontSize: 11 },
  sheet: {
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 90,
  },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneName: { color: colors.text, fontSize: 18, fontFamily: fonts.display, flex: 1 },
  badge: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  zoneHint: { color: colors.textDim, fontSize: 13, marginTop: 8, marginBottom: 16 },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
  },
  captureText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
