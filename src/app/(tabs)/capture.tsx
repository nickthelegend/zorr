import * as Location from 'expo-location'
import { LinearGradient } from 'expo-linear-gradient'
import { Activity, Check, ExternalLink, LocateFixed, Play, Square, X } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MapView, { Circle, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { explorerTxUrl, logRunOnChain, UnfundedError } from '../../features/chain/claim'
import { captureTileOnER, commitTerritoryFromER, ZORR_PROGRAM } from '../../features/chain/er'
import { darkMapStyle } from '../../features/capture/map-style'
import { tilePolygon } from '../../features/capture/tiles'
import { useGame } from '../../features/game/game-store'
import { EMPIRE_DEG, empiresAround, rivalForTile } from '../../features/game/rivals'
import { playSfx } from '../../features/core/audio'
import { hitHaptic, winHaptic, failHaptic } from '../../features/core/haptics'
import { pushNote } from '../../features/core/notifications-store'
import { submitStats } from '../../features/nft/nft'
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

function PulseDot() {
  const s = useSharedValue(0)
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [s])
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + s.value * 0.6, transform: [{ scale: 0.8 + s.value * 0.5 }] }))
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, style]} />
      <View style={styles.pulseCore} />
    </View>
  )
}

/** Big mono stat, like a running computer. */
function StatCell({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
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

  // Stealing a rival tile is worth double.
  const run = useRunSession({
    onCapture: (key) => {
      hitHaptic()
      playSfx('capture')
      game.addCapture(key, rivalForTile(key) ? 2 : 1)
    },
  })

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  const onFixRef = useRef(run.onFix)
  onFixRef.current = run.onFix
  const hasTileRef = useRef(game.hasTile)
  hasTileRef.current = game.hasTile

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

  useEffect(() => {
    if (!fix) return
    onFixRef.current({ latitude: fix.lat, longitude: fix.lng }, activityFor(fix.speed).ok, hasTileRef.current)
  }, [fix])

  useEffect(() => {
    if (!fix) return
    // Snap hard to the runner on the first fix (tight, street-level zoom), then
    // keep them centered while a run is live so the board tracks their movement.
    if (!centered.current) {
      centered.current = true
      mapRef.current?.animateToRegion({ latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 650)
    } else if (run.running) {
      mapRef.current?.animateCamera({ center: { latitude: fix.lat, longitude: fix.lng } }, { duration: 500 })
    }
  }, [fix, run.running])

  const activity = useMemo(() => activityFor(fix?.speed ?? 0), [fix?.speed])
  const nominalLat = fix?.lat ?? 17.4239
  const totalAreaKm2 = game.tiles.size * tileAreaKm2(nominalLat)

  const endRun = useCallback(() => {
    const s = run.stop()
    game.recordRun(s.distanceKm)
    setSummary(s)
    // Publish fresh, real stats to the global leaderboard (fire-and-forget).
    submitStats({
      name: game.name,
      color: game.color,
      km2: game.tiles.size * tileAreaKm2(s.path[0]?.latitude ?? 17.4239),
      tiles: game.tiles.size,
      xp: game.xp,
      runs: game.stats.runs + 1,
      wins: game.stats.duelsWon,
    }).catch(() => {})
  }, [run, game])

  const logRun = useCallback(async (s: RunSummary) => {
    setLogging(true)
    // Settle this run's tiles on the MagicBlock Ephemeral Rollup — gasless and
    // ~sub-second each (the territory PDA is delegated once, see
    // onchain/tests/zorr-er.ts). Bounded to the most recent tiles so a long run
    // doesn't stall the summary; on-chain territory then reflects the run, not a
    // single representative tile.
    const ER_BATCH = 10
    const batch = s.tiles.slice(-ER_BATCH)
    try {
      if (batch.length === 0) throw new Error('empty run — use the run-log fallback')
      // Headline: capture on the MagicBlock Ephemeral Rollup (gasless, instant).
      let captured = 0
      let totalMs = 0
      for (const key of batch) {
        const [ty, tx] = key.split('_').map(Number)
        const { ms } = await captureTileOnER(tx, ty)
        captured += 1
        totalMs += ms
      }
      // Complete the round-trip: commit the ER territory state back to base (best-
      // effort — the captures above already landed on the ER either way).
      const commit = await commitTerritoryFromER()
      winHaptic()
      const extra = s.tiles.length - captured
      setToast({
        kind: 'ok',
        msg: `${captured} ${captured === 1 ? 'tile' : 'tiles'} on MagicBlock ER ⚡ ${totalMs}ms${commit ? ' → committed to base' : ''}${extra > 0 ? ` (+${extra} more)` : ''}`,
        url: `https://explorer.solana.com/address/${ZORR_PROGRAM}?cluster=devnet`,
      })
      pushNote({ kind: 'capture', title: 'Territory captured ⚡', body: `${captured} ${captured === 1 ? 'tile' : 'tiles'} on MagicBlock ER · ${totalMs}ms gasless` })
      setSummary(null)
    } catch {
      // Fall back to a base-layer run log if the ER path is unavailable.
      try {
        const sig = await logRunOnChain(s.distanceKm, s.areaKm2, s.tiles.length)
        winHaptic()
        setToast({ kind: 'ok', msg: 'Run logged on-chain', url: explorerTxUrl(sig) })
        setSummary(null)
      } catch (e) {
        failHaptic()
        setToast({
          kind: 'err',
          msg: e instanceof UnfundedError ? 'Fund your Zorr wallet with devnet SOL.' : 'Log failed — try again.',
        })
      }
    } finally {
      setLogging(false)
    }
  }, [])

  const ownedTiles = useMemo(() => [...game.tiles], [game.tiles])
  const glow = game.color + '26'

  // Rival empires near the player — big organic bordered regions (INTVL-style),
  // recomputed only when you cross into a new empire cell.
  const empireCellKey = fix ? `${Math.floor(fix.lat / EMPIRE_DEG)}:${Math.floor(fix.lng / EMPIRE_DEG)}` : null
  const empires = useMemo(() => {
    if (!fix) return [] as ReturnType<typeof empiresAround>
    return empiresAround(fix.lat, fix.lng, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empireCellKey])

  const recenter = useCallback(() => {
    if (!fix) return
    mapRef.current?.animateToRegion({ latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500)
  }, [fix])

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        // The LATEST Google renderer ignores customMapStyle (it only honors
        // cloud map IDs) — pin LEGACY so the neon-cartography style applies.
        googleRenderer="LEGACY"
        style={StyleSheet.absoluteFill}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        initialRegion={{ latitude: 17.4239, longitude: 78.4738, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        {/* Your live capture zone — a neon ring in your clan colour, centred on you */}
        {fix ? (
          <Circle
            center={{ latitude: fix.lat, longitude: fix.lng }}
            radius={60}
            strokeColor={game.color}
            strokeWidth={2.5}
            fillColor={game.color + '1F'}
          />
        ) : null}
        {/* Rival empires — organic regions with thick glowing borders (tap to scout) */}
        {empires.map((e) => (
          <Polygon
            key={`glow${e.id}`}
            coordinates={e.coords}
            strokeColor={e.clan.color + '3D'}
            strokeWidth={9}
            fillColor="transparent"
          />
        ))}
        {empires.map((e) => (
          <Polygon
            key={e.id}
            coordinates={e.coords}
            strokeColor={e.clan.color}
            strokeWidth={3.5}
            fillColor={e.clan.color + '12'}
            tappable
            onPress={() => setToast({ kind: 'ok', msg: `${e.clan.name} territory — run through it to steal ground (2× XP)` })}
          />
        ))}
        {/* Your territory — captured box by box: one glowing grid cell per tile */}
        {ownedTiles.map((key) => (
          <Polygon
            key={key}
            coordinates={tilePolygon(key)}
            strokeColor={game.color + 'AA'}
            strokeWidth={1.5}
            fillColor={game.color + '3D'}
          />
        ))}
        {run.path.length > 1 ? (
          <>
            <Polyline coordinates={run.path} strokeColor={glow} strokeWidth={16} />
            <Polyline coordinates={run.path} strokeColor={game.color} strokeWidth={5} />
          </>
        ) : null}
      </MapView>

      {/* Top edge fade for legibility */}
      <LinearGradient colors={['rgba(0,0,0,0.75)', 'transparent']} style={styles.topFade} pointerEvents="none" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <Animated.View entering={FadeIn} style={styles.topRow} pointerEvents="none">
          {run.running ? (
            <View style={[styles.badge, styles.badgeRec]}>
              <PulseDot />
              <Text style={styles.badgeText}>REC</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Activity color={activity.ok ? colors.territory : colors.enemy} size={14} />
              <Text style={styles.badgeText}>{activity.label}</Text>
            </View>
          )}
        </Animated.View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {fix ? (
          <View style={styles.fabRow} pointerEvents="box-none">
            <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={recenter}>
              <LocateFixed color={colors.text} size={19} />
            </TouchableOpacity>
          </View>
        ) : null}

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

        {summary ? (
          <RunSummaryCard
            summary={summary}
            runNo={game.stats.runs}
            xp={summary.tiles.length * 50}
            logging={logging}
            onLog={logRun}
            onDiscard={() => setSummary(null)}
          />
        ) : (
          <Animated.View entering={FadeInUp} style={styles.sheet}>
            <View style={styles.handle} />
            {run.running ? (
              <>
                <View style={styles.statsRow}>
                  <StatCell value={run.areaKm2.toFixed(3)} label="KM² TAKEN" accent={game.color} />
                  <StatCell value={run.distanceKm.toFixed(2)} label="KM" />
                  <StatCell value={formatDuration(run.durationSec)} label="TIME" />
                  <StatCell value={formatPace(run.distanceKm, run.durationSec)} label="PACE" />
                </View>
                <TouchableOpacity activeOpacity={0.9} onPress={endRun}>
                  <View style={[styles.bigBtn, styles.stopBtn]}>
                    <Square color="#fff" size={16} fill="#fff" />
                    <Text style={styles.bigBtnText}>End Run</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.idleRow}>
                  <View>
                    <Text style={styles.idleArea}>
                      {totalAreaKm2.toFixed(3)} <Text style={styles.idleUnit}>km²</Text>
                    </Text>
                    <Text style={styles.idleLabel}>YOUR TERRITORY · {game.tiles.size} TILES</Text>
                  </View>
                  <View style={[styles.colorChip, { backgroundColor: game.color, shadowColor: game.color }]} />
                </View>
                {denied ? (
                  <Text style={styles.hint}>Turn on location to run and capture territory.</Text>
                ) : !fix ? (
                  <Text style={styles.hint}>Finding you…</Text>
                ) : (
                  <TouchableOpacity activeOpacity={0.9} onPress={run.start}>
                    <LinearGradient
                      colors={['#22D3A6', '#0F766E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.bigBtn}
                    >
                      <Play color="#04110C" size={18} fill="#04110C" />
                      <Text style={[styles.bigBtnText, { color: '#04110C' }]}>Start Run</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  )
}

const RATINGS = ['Easy', 'Solid', 'Brutal'] as const

function RunSummaryCard({
  summary,
  runNo,
  xp,
  logging,
  onLog,
  onDiscard,
}: {
  summary: RunSummary
  runNo: number
  xp: number
  logging: boolean
  onLog: (s: RunSummary) => void
  onDiscard: () => void
}) {
  const [rating, setRating] = useState<number>(1)
  return (
    <Animated.View entering={FadeInUp} style={styles.summary}>
      <View style={styles.handle} />
      <Text style={styles.summaryEyebrow}>{runNo > 0 ? `RUN #${runNo} · COMPLETE` : 'RUN COMPLETE'}</Text>

      <View style={styles.summaryHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryBig}>{summary.areaKm2.toFixed(3)}</Text>
          <Text style={styles.summarySub}>KM² CAPTURED</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryBig, { color: colors.gold }]}>+{xp}</Text>
          <Text style={styles.summarySub}>XP EARNED</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCell value={summary.distanceKm.toFixed(2)} label="KM" />
        <StatCell value={formatDuration(summary.durationSec)} label="TIME" />
        <StatCell value={formatPace(summary.distanceKm, summary.durationSec)} label="PACE" />
        <StatCell value={`${summary.tiles.length}`} label="TILES" />
      </View>

      <Text style={styles.rateLabel}>HOW DID IT FEEL?</Text>
      <View style={styles.rateRow}>
        {RATINGS.map((r, i) => (
          <TouchableOpacity
            key={r}
            style={[styles.ratePill, rating === i && styles.ratePillActive]}
            onPress={() => setRating(i)}
            activeOpacity={0.85}
          >
            <Text style={[styles.rateText, rating === i && styles.rateTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={() => onLog(summary)} disabled={logging}>
        <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
          <Text style={styles.bigBtnText}>{logging ? 'Claiming on ER…' : 'Claim on MagicBlock ER ⚡'}</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDiscard} disabled={logging}>
        <Text style={styles.discard}>Skip for now</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const SHEET = 'rgba(10,10,14,0.96)'
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  overlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 14 },
  topRow: { alignItems: 'center', marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeRec: { borderColor: 'rgba(244,63,94,0.6)' },
  badgeText: { color: colors.text, fontSize: 12, fontFamily: fonts.mono, letterSpacing: 1 },
  pulseWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.enemy },
  pulseCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.enemy },
  fabRow: { alignItems: 'flex-end', marginBottom: 12 },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10,10,16,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastWrap: { marginBottom: 10 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SHEET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastText: { color: colors.text, fontSize: 14, flex: 1, fontWeight: '600' },
  sheet: {
    backgroundColor: SHEET,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    marginBottom: 84,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 16 },
  idleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  idleArea: { color: colors.text, fontSize: 34, fontFamily: fonts.display },
  idleUnit: { fontSize: 18, color: colors.textDim },
  idleLabel: { color: colors.textDim, fontSize: 11, marginTop: 4, letterSpacing: 1.2 },
  colorChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  hint: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 22, fontFamily: fonts.mono, fontWeight: '700' },
  statLabel: { color: colors.textFaint, fontSize: 10, marginTop: 4, letterSpacing: 1.2 },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },
  stopBtn: { backgroundColor: colors.enemy },
  bigBtnText: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  summary: {
    backgroundColor: SHEET,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    marginBottom: 84,
  },
  summaryEyebrow: { color: colors.textDim, fontSize: 11, textAlign: 'center', letterSpacing: 2, marginBottom: 14 },
  summaryHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  summaryDivider: { width: 1, height: 44, backgroundColor: colors.border },
  summaryBig: { color: colors.text, fontSize: 40, fontFamily: fonts.display, textAlign: 'center' },
  summarySub: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 4, letterSpacing: 1.2 },
  rateLabel: { color: colors.textFaint, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  rateRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  ratePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ratePillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rateText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  rateTextActive: { color: colors.text },
  discard: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 14 },
})
