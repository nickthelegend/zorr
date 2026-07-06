import * as Location from 'expo-location'
import { LinearGradient } from 'expo-linear-gradient'
import { Linking } from 'react-native'
import { Activity, Check, ExternalLink, Footprints, Play, Square, X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { explorerTxUrl, logRunOnChain, UnfundedError } from '../../features/chain/claim'
import { darkMapStyle } from '../../features/capture/map-style'
import { tilePolygon } from '../../features/capture/tiles'
import { useGame } from '../../features/game/game-store'
import { formatDuration, formatPace, RunSummary, tileAreaKm2, useRunSession } from '../../features/run/use-run-session'
import { colors, fonts, radius } from '../../theme'

type Fix = { lat: number; lng: number; speed: number; accuracy: number }
type Toast = { kind: 'ok' | 'err'; msg: string; url?: string } | null

const MAX_WALK_MS = 8
function activityFor(speed: number) {
  if (speed < 0.3) return { label: 'Idle', ok: true }
  if (speed < 2.2) return { label: 'Walking', ok: true }
  if (speed < MAX_WALK_MS) return { label: 'Running', ok: true }
  return { label: 'Vehicle', ok: false }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function RunScreen() {
  const mapRef = useRef<MapView>(null)
  const game = useGame()
  const [fix, setFix] = useState<Fix | null>(null)
  const [denied, setDenied] = useState(false)
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [logging, setLogging] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const centered = useRef(false)

  const run = useRunSession({ onCapture: (key) => game.addCapture(key, 1) })

  // Keep the latest callbacks in refs so the GPS effect never runs on stale closures.
  const onFixRef = useRef(run.onFix)
  onFixRef.current = run.onFix
  const hasTileRef = useRef(game.hasTile)
  hasTileRef.current = game.hasTile

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
        if (status !== 'granted') return setDenied(true)
        try {
          apply(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
        } catch {
          /* watcher delivers one */
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

  // Feed each fix into the run session (captures ground you cover).
  useEffect(() => {
    if (!fix) return
    onFixRef.current(
      { latitude: fix.lat, longitude: fix.lng },
      activityFor(fix.speed).ok,
      hasTileRef.current,
    )
  }, [fix])

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
  const nominalLat = fix?.lat ?? 17.4239
  const totalAreaKm2 = game.tiles.size * tileAreaKm2(nominalLat)

  const endRun = useCallback(() => setSummary(run.stop()), [run])

  const logRun = useCallback(
    async (s: RunSummary) => {
      setLogging(true)
      try {
        const sig = await logRunOnChain(s.distanceKm, s.areaKm2, s.tiles.length)
        setToast({ kind: 'ok', msg: 'Run logged on-chain ✓', url: explorerTxUrl(sig) })
        setSummary(null)
      } catch (e) {
        setToast({
          kind: 'err',
          msg: e instanceof UnfundedError ? 'Fund your Zorr wallet with devnet SOL.' : 'Log failed — try again.',
        })
      } finally {
        setLogging(false)
      }
    },
    [],
  )

  const ownedTiles = useMemo(() => [...game.tiles], [game.tiles])

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
        {ownedTiles.map((key) => (
          <Polygon
            key={key}
            coordinates={tilePolygon(key)}
            strokeColor={game.color}
            strokeWidth={1.5}
            fillColor={game.color + '4D'}
          />
        ))}
        {run.path.length > 1 ? (
          <Polyline coordinates={run.path} strokeColor={game.color} strokeWidth={6} />
        ) : null}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        {/* Top: activity / running badge */}
        <Animated.View entering={FadeIn} style={styles.topRow} pointerEvents="none">
          {run.running ? (
            <View style={[styles.badge, { borderColor: colors.enemy }]}>
              <View style={styles.recDot} />
              <Text style={styles.badgeText}>Recording run</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Activity color={activity.ok ? colors.territory : colors.enemy} size={14} />
              <Text style={styles.badgeText}>{activity.label}</Text>
            </View>
          )}
        </Animated.View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {toast ? (
          <Animated.View entering={FadeInUp} exiting={FadeOut} style={styles.toastWrap}>
            <TouchableOpacity
              activeOpacity={toast.url ? 0.8 : 1}
              onPress={() => toast.url && Linking.openURL(toast.url)}
              style={[styles.toast, { borderColor: toast.kind === 'ok' ? colors.territory : colors.enemy }]}
            >
              {toast.kind === 'ok' ? <Check color={colors.territory} size={18} /> : <X color={colors.enemy} size={18} />}
              <Text style={styles.toastText}>{toast.msg}</Text>
              {toast.url ? <ExternalLink color={colors.textDim} size={16} /> : null}
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Bottom control panel */}
        {summary ? (
          <RunSummaryCard summary={summary} xp={summary.tiles.length * 50} logging={logging} onLog={logRun} onDiscard={() => setSummary(null)} />
        ) : run.running ? (
          <Animated.View entering={FadeInUp} style={styles.sheet}>
            <View style={styles.statsRow}>
              <Stat value={`${run.areaKm2.toFixed(3)}`} label="km² captured" />
              <Stat value={`${run.distanceKm.toFixed(2)}`} label="km" />
              <Stat value={formatDuration(run.durationSec)} label="time" />
              <Stat value={formatPace(run.distanceKm, run.durationSec)} label="pace" />
            </View>
            <TouchableOpacity activeOpacity={0.9} onPress={endRun}>
              <View style={[styles.bigBtn, { backgroundColor: colors.enemy }]}>
                <Square color="#fff" size={18} fill="#fff" />
                <Text style={styles.bigBtnText}>End Run</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp} style={styles.sheet}>
            <View style={styles.idleRow}>
              <View>
                <Text style={styles.idleArea}>{totalAreaKm2.toFixed(3)} km²</Text>
                <Text style={styles.idleLabel}>your territory · {game.tiles.size} tiles</Text>
              </View>
              <View style={[styles.dot, { backgroundColor: game.color }]} />
            </View>
            {denied ? (
              <Text style={styles.hint}>Location permission is required to run. Enable it in settings.</Text>
            ) : !fix ? (
              <Text style={styles.hint}>Acquiring GPS…</Text>
            ) : (
              <TouchableOpacity activeOpacity={0.9} onPress={run.start}>
                <LinearGradient colors={['#22D3A6', '#0F766E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
                  <Play color="#04110C" size={18} fill="#04110C" />
                  <Text style={[styles.bigBtnText, { color: '#04110C' }]}>Start Run</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  )
}

function RunSummaryCard({
  summary,
  xp,
  logging,
  onLog,
  onDiscard,
}: {
  summary: RunSummary
  xp: number
  logging: boolean
  onLog: (s: RunSummary) => void
  onDiscard: () => void
}) {
  return (
    <Animated.View entering={FadeInUp} style={styles.summary}>
      <Text style={styles.summaryTitle}>Run complete</Text>
      <View style={styles.summaryHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryBig}>{summary.areaKm2.toFixed(3)}</Text>
          <Text style={styles.summarySub}>km² captured</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryBig, { color: colors.gold }]}>{xp}</Text>
          <Text style={styles.summarySub}>XP earned</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Stat value={summary.distanceKm.toFixed(2)} label="km" />
        <Stat value={formatDuration(summary.durationSec)} label="time" />
        <Stat value={formatPace(summary.distanceKm, summary.durationSec)} label="pace" />
        <Stat value={`${summary.tiles.length}`} label="tiles" />
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onLog(summary)} disabled={logging}>
        <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
          <Text style={styles.bigBtnText}>{logging ? 'Logging on-chain…' : 'Log run on-chain'}</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDiscard} disabled={logging}>
        <Text style={styles.discard}>Skip</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 16 },
  topRow: { alignItems: 'center', marginTop: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.enemy },
  badgeText: { color: colors.text, fontSize: 13, fontFamily: fonts.mono },
  toastWrap: { marginBottom: 10 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(10,10,15,0.96)',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastText: { color: colors.text, fontSize: 13, flex: 1 },
  sheet: {
    backgroundColor: 'rgba(10,10,15,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 90,
  },
  idleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  idleArea: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  idleLabel: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  hint: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
  },
  bigBtnText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  summary: {
    backgroundColor: 'rgba(10,10,15,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 90,
  },
  summaryTitle: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  summaryHeadRow: { flexDirection: 'row', marginBottom: 18 },
  summaryBig: { color: colors.text, fontSize: 34, fontFamily: fonts.display, textAlign: 'center' },
  summarySub: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 2 },
  discard: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 14 },
})
