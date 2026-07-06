import {
  acceptConnection,
  onConnected,
  onDisconnected,
  onInvitationReceived,
  onPeerFound,
  onPeerLost,
  onTextReceived,
  requestConnection,
  sendText,
  startAdvertise,
  startDiscovery,
  stopAdvertise,
  stopDiscovery,
} from 'expo-nearby-connections'
import { useCallback, useEffect, useRef, useState } from 'react'

export type Peer = { peerId: string; name: string }

/**
 * Bluetooth/Wi-Fi peer discovery for IRL duels (Google Nearby Connections).
 * Advertises + discovers other Zorr players, auto-accepts invitations, and
 * relays short text messages (used to sync duel scores).
 */
export function useNearby(myName: string, onText?: (text: string) => void) {
  const [peers, setPeers] = useState<Peer[]>([])
  const [connected, setConnected] = useState<Peer | null>(null)
  const [scanning, setScanning] = useState(false)
  const running = useRef(false)
  const textCb = useRef(onText)
  textCb.current = onText

  useEffect(() => {
    const subs = [
      onPeerFound((p) => setPeers((cur) => (cur.some((x) => x.peerId === p.peerId) ? cur : [...cur, { peerId: p.peerId, name: p.name || 'Explorer' }]))),
      onPeerLost((p) => setPeers((cur) => cur.filter((x) => x.peerId !== p.peerId))),
      onInvitationReceived((inv) => {
        acceptConnection(inv.peerId).catch(() => {})
      }),
      onConnected((c) => setConnected({ peerId: c.peerId, name: c.name || 'Explorer' })),
      onDisconnected(() => setConnected(null)),
      onTextReceived((t) => textCb.current?.(t.text)),
    ]
    return () => subs.forEach((u) => { try { u() } catch { /* noop */ } })
  }, [])

  const start = useCallback(async () => {
    if (running.current) return
    running.current = true
    setScanning(true)
    try {
      await startAdvertise(myName)
      await startDiscovery(myName)
    } catch {
      setScanning(false)
      running.current = false
    }
  }, [myName])

  const stop = useCallback(async () => {
    running.current = false
    setScanning(false)
    setPeers([])
    setConnected(null)
    try {
      await stopAdvertise()
      await stopDiscovery()
    } catch {
      /* noop */
    }
  }, [])

  const connect = useCallback((peerId: string) => {
    requestConnection(peerId).catch(() => {})
  }, [])

  const send = useCallback(
    (text: string) => {
      if (connected) sendText(connected.peerId, text).catch(() => {})
    },
    [connected],
  )

  return { peers, connected, scanning, start, stop, connect, send }
}
