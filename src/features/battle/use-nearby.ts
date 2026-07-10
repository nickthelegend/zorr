import { useCallback, useEffect, useRef, useState } from 'react'

import { requestNearbyPermissions } from './permissions'

// Load the native module defensively. If the dev-client build doesn't include
// expo-nearby-connections (or it fails to link), we fall back to a no-op shim
// so the Duel screen still works in single-player instead of crashing.
type NearbyModule = typeof import('expo-nearby-connections')
let NC: NearbyModule | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NC = require('expo-nearby-connections') as NearbyModule
} catch {
  NC = null
}

export const nearbyAvailable = !!NC

export type Peer = { peerId: string; name: string; rawName: string }

// A unique token generated once per app launch. Two phones therefore advertise
// DIFFERENT strings even when both players are the default "Explorer", which
// (a) lets Nearby Connections tell the two endpoints apart and (b) lets the app
// deterministically elect ONE initiator by string order (see battle-arena's
// auto-connect). Without this, both phones call requestConnection at the same
// instant — the symmetric collision where the BLE link forms then immediately
// drops (ACL_DISCONNECTED) and both sides stay stuck on "Searching…".
const SESSION_TAG = Math.random().toString(36).slice(2, 8)
// Advertised name is "<player>~<tag>"; strip the tag for anything user-facing.
const displayName = (raw: string) => (raw ? raw.split('~')[0] : '') || 'Explorer'

/**
 * Bluetooth/Wi-Fi peer discovery for IRL duels (Google Nearby Connections).
 * Advertises + discovers other Zorr players, auto-accepts invitations, and
 * relays short text messages (used to sync duel state). Safe to use even when
 * the native module is absent — it simply never finds peers.
 */
export function useNearby(myName: string, onText?: (text: string) => void) {
  const [peers, setPeers] = useState<Peer[]>([])
  const [connected, setConnected] = useState<Peer | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const textCb = useRef(onText)
  textCb.current = onText

  useEffect(() => {
    if (!NC) return
    const subs = [
      NC.onPeerFound((p) =>
        setPeers((cur) =>
          cur.some((x) => x.peerId === p.peerId)
            ? cur
            : [...cur, { peerId: p.peerId, name: displayName(p.name), rawName: p.name || '' }],
        ),
      ),
      NC.onPeerLost((p) => setPeers((cur) => cur.filter((x) => x.peerId !== p.peerId))),
      NC.onInvitationReceived((inv) => {
        NC?.acceptConnection(inv.peerId).catch(() => {})
      }),
      NC.onConnected((c) => setConnected({ peerId: c.peerId, name: displayName(c.name), rawName: c.name || '' })),
      NC.onDisconnected(() => setConnected(null)),
      NC.onTextReceived((t) => textCb.current?.(t.text)),
    ]
    return () =>
      subs.forEach((u) => {
        try {
          u?.()
        } catch {
          /* noop */
        }
      })
  }, [])

  const start = useCallback(async () => {
    if (running.current) return
    setError(null)
    if (!NC) {
      setError('Nearby play needs a device build with Bluetooth support.')
      return
    }
    const ok = await requestNearbyPermissions()
    if (!ok) {
      setError('Bluetooth & location permission are needed to find players.')
      return
    }
    running.current = true
    setScanning(true)
    try {
      // P2P_CLUSTER (not the module's P2P_STAR default): both phones advertise
      // AND discover, so they need the M-to-N cluster strategy to find each
      // other's endpoint. P2P_STAR's hub/spoke split never matches symmetrically.
      // (expo-nearby-connections 1.1.0 introduced the P2P_STAR default; 1.0.0 —
      // the version AlgoQuest ships and that works — did not.) Value 1 ===
      // Strategy.P2P_CLUSTER; use the enum when present, else the raw value so it
      // can't throw if the enum object isn't emitted at runtime.
      const P2P_CLUSTER = (NC.Strategy && NC.Strategy.P2P_CLUSTER) || 1
      // Advertise the unique tag (not the bare name) so the peer can tell us
      // apart and elect a single initiator; see SESSION_TAG above.
      const myTag = `${myName}~${SESSION_TAG}`
      await NC.startAdvertise(myTag, P2P_CLUSTER)
      // Let advertising settle before discovery starts (matches AlgoQuest's
      // proven sequencing — starting both in the same tick can miss the peer).
      await new Promise((resolve) => setTimeout(resolve, 600))
      await NC.startDiscovery(myTag, P2P_CLUSTER)
    } catch {
      setScanning(false)
      running.current = false
      setError('Could not start Bluetooth discovery.')
    }
  }, [myName])

  const stop = useCallback(async () => {
    running.current = false
    setScanning(false)
    setPeers([])
    setConnected(null)
    if (!NC) return
    try {
      await NC.stopAdvertise()
      await NC.stopDiscovery()
    } catch {
      /* noop */
    }
  }, [])

  const connect = useCallback((peerId: string) => {
    NC?.requestConnection(peerId).catch(() => {})
  }, [])

  const send = useCallback(
    (text: string) => {
      if (NC && connected) NC.sendText(connected.peerId, text).catch(() => {})
    },
    [connected],
  )

  return { peers, connected, scanning, error, available: nearbyAvailable, start, stop, connect, send, myTag: `${myName}~${SESSION_TAG}` }
}
