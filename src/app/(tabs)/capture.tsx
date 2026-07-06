import * as Location from 'expo-location'
import { LinearGradient } from 'expo-linear-gradient'
import { Activity, Flag, Footprints, Gauge, MapPin } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MapView, { Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps'
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { darkMapStyle } from '../../features/capture/map-style'
import { tileKey, tilePolygon, tilesAround } from '../../features/capture/tiles'
import { colors, fonts, radius } from '../../theme'

type Fix = { lat: number; lng: number; speed: number; accuracy: number }

const MAX_WALK_MS = 8 // ~28.8 km/h — above this we flag a vehicle
function activityFor(speed: number) {
  if (speed < 0.3) return { label: 'Idle', ok: true }
  if (speed < 2.2) return { label: 'Walking', ok: true }
  if (speed < MAX_WALK_MS) return { label: 'Running', ok: true }
  return { label: 'Vehicle', ok: false }
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
  const mapRef = useRef<MapView>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [denied, setDenied] = useState(false)
  const [captured, setCaptured] = useState<Set<string>>(new Set())
  const centered = useRef(false)

  // Real device GPS.
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined
    let active = true
    const apply = (p: Location.LocationObject) => {
      if (!active) return
      setFix({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        speed: Math.max(0, p.coords.speed ?? 0),
        accuracy: p.coords.accuracy ?? 0,
      })
    }
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setDenied(true)
          return
        }
        try {
          apply(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
        } catch {
          // watcher will deliver one
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1500 },
          apply,
        )
      } catch {
        setDenied(true)
      }
    })()
    return () => {
      active = false
      sub?.remove()
    }
  }, [])

  // Recenter the camera the first time we get a fix.
  useEffect(() => {
    if (fix && !centered.current) {
      centered.current = true
      mapRef.current?.animateToRegion(
        { latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
        600,
      )
    }
  }, [fix])

  const activity = useMemo(() => activityFor(fix?.speed ?? 0), [fix?.speed])
  const currentKey = fix ? tileKey(fix.lat, fix.lng) : null
  const onCurrentTile = currentKey ? !captured.has(currentKey) : false

  const gridKeys = useMemo(() => (fix ? tilesAround(fix.lat, fix.lng, 4) : []), [fix])

  const capture = useCallback(() => {
    if (!currentKey || !activity.ok) return
    setCaptured((prev) => new Set(prev).add(currentKey))
    // TODO: submit tile claim to the MagicBlock Ephemeral Rollup (session key).
  }, [currentKey, activity.ok])

  const speedKmh = ((fix?.speed ?? 0) * 3.6).toFixed(1)

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        initialRegion={{ latitude: 17.4239, longitude: 78.4738, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        {/* Territory grid around the player */}
        {gridKeys.map((key) => {
          const mine = captured.has(key)
          const isCurrent = key === currentKey
          return (
            <Polygon
              key={key}
              coordinates={tilePolygon(key)}
              strokeColor={mine ? colors.territory : isCurrent ? colors.primary : 'rgba(255,255,255,0.14)'}
              strokeWidth={mine || isCurrent ? 2 : 1}
              fillColor={mine ? 'rgba(34,211,166,0.30)' : isCurrent ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.03)'}
            />
          )
        })}
        {fix ? (
          <Circle
            center={{ latitude: fix.lat, longitude: fix.lng }}
            radius={Math.max(15, fix.accuracy)}
            strokeColor="rgba(124,58,237,0.5)"
            fillColor="rgba(124,58,237,0.10)"
          />
        ) : null}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <Animated.View entering={FadeIn} style={styles.hud} pointerEvents="none">
          <HudChip icon={<Gauge color={activity.ok ? colors.territory : colors.enemy} size={18} />} value={`${speedKmh} km/h`} label="Speed" />
          <HudChip icon={<Flag color={colors.gold} size={18} />} value={`${captured.size}`} label="Tiles" />
          <HudChip icon={<Activity color={activity.ok ? colors.gold : colors.enemy} size={18} />} value={activity.label} label="Activity" />
        </Animated.View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        <Animated.View entering={FadeInUp} style={styles.sheet}>
          {denied ? (
            <Text style={styles.zoneHint}>Location permission is required to capture land. Enable it in settings.</Text>
          ) : !fix ? (
            <Text style={styles.zoneHint}>Acquiring GPS…</Text>
          ) : (
            <>
              <View style={styles.zoneRow}>
                <MapPin color={colors.territory} size={18} />
                <Text style={styles.zoneName}>{onCurrentTile ? 'Unclaimed tile' : 'Your tile'}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>+50 $ZORR</Text>
                </View>
              </View>
              <Text style={styles.zoneHint}>
                {activity.ok
                  ? 'Stand on a tile and capture it. Accuracy ±' + Math.round(fix.accuracy) + 'm'
                  : '🚫 Moving too fast — vehicles can’t capture land.'}
              </Text>

              <TouchableOpacity activeOpacity={0.9} onPress={capture} disabled={!onCurrentTile || !activity.ok}>
                <LinearGradient
                  colors={onCurrentTile && activity.ok ? ['#22D3A6', '#0F766E'] : ['#333', '#222']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.captureBtn}
                >
                  <Footprints color={onCurrentTile && activity.ok ? '#04110C' : colors.textFaint} size={20} />
                  <Text style={[styles.captureText, (!onCurrentTile || !activity.ok) && { color: colors.textFaint }]}>
                    {onCurrentTile ? 'Capture this tile' : 'Tile already yours'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 16 },
  hud: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipValue: { color: colors.text, fontSize: 14, fontFamily: fonts.mono },
  chipLabel: { color: colors.textDim, fontSize: 11 },
  sheet: {
    backgroundColor: 'rgba(10,10,15,0.94)',
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
