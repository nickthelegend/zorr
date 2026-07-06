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

export type Peer = { peerId: string; name: string }

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
        setPeers((cur) => (cur.some((x) => x.peerId === p.peerId) ? cur : [...cur, { peerId: p.peerId, name: p.name || 'Explorer' }])),
      ),
      NC.onPeerLost((p) => setPeers((cur) => cur.filter((x) => x.peerId !== p.peerId))),
      NC.onInvitationReceived((inv) => {
        NC?.acceptConnection(inv.peerId).catch(() => {})
      }),
      NC.onConnected((c) => setConnected({ peerId: c.peerId, name: c.name || 'Explorer' })),
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
      await NC.startAdvertise(myName)
      await NC.startDiscovery(myName)
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

  return { peers, connected, scanning, error, available: nearbyAvailable, start, stop, connect, send }
}
