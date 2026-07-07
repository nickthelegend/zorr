import { useCallback, useEffect, useRef, useState } from 'react'

// Online duel transport: a WebSocket to the Zorr relay, joined by room code.
// React Native ships a global WebSocket, so no native module is needed. Point
// EXPO_PUBLIC_RELAY_URL at a running `server/relay.mjs` (for an emulator use
// ws://10.0.2.2:8787; for real devices, a deployed wss:// URL).
export const RELAY_URL = process.env.EXPO_PUBLIC_RELAY_URL || 'ws://10.0.2.2:8787'

export type SocketStatus = 'idle' | 'connecting' | 'waiting' | 'ready' | 'error'

/**
 * Join `room` on the relay and relay text both ways. `connected` flips true once
 * a second player is present (SYS:peers:2), mirroring Bluetooth's onConnected so
 * the duel handshake can begin the same way on either transport.
 */
export function useSocket(onText?: (text: string) => void) {
  const [status, setStatus] = useState<SocketStatus>('idle')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const cb = useRef(onText)
  cb.current = onText

  const join = useCallback((room: string) => {
    if (wsRef.current) return
    setStatus('connecting')
    setError(null)
    let ws: WebSocket
    try {
      ws = new WebSocket(`${RELAY_URL}/?room=${encodeURIComponent(room)}`)
    } catch {
      setStatus('error')
      setError('Could not open a connection.')
      return
    }
    wsRef.current = ws
    ws.onopen = () => setStatus('waiting')
    ws.onmessage = (e) => {
      const text = typeof e.data === 'string' ? e.data : String(e.data)
      if (text.startsWith('SYS:')) {
        if (text === 'SYS:peers:2') {
          setConnected(true)
          setStatus('ready')
        } else if (text === 'SYS:peers:1') {
          setConnected(false)
          setStatus('waiting')
        } else if (text === 'SYS:full') {
          setError('That room is full.')
          setStatus('error')
        }
        return
      }
      cb.current?.(text)
    }
    ws.onerror = () => {
      setStatus('error')
      setError('Connection error — is the relay reachable?')
    }
    ws.onclose = () => {
      setConnected(false)
      if (wsRef.current === ws) wsRef.current = null
    }
  }, [])

  const send = useCallback((text: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(text)
  }, [])

  const leave = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
    setStatus('idle')
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  return { status, connected, error, join, send, leave }
}
