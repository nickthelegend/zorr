// Zorr duel relay — a tiny room-based WebSocket forwarder so two players can
// battle over the internet (the "socket" path, alongside Bluetooth Nearby).
//
// It is deliberately dumb: clients connect with ?room=<code>, and every message
// is forwarded verbatim to the other members of that room. The battle logic and
// determinism live entirely in the app, so the relay never inspects a move — it
// just moves bytes. Run:  node server/relay.mjs   (PORT env, default 8787)
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT) || 8787
const wss = new WebSocketServer({ port: PORT })
const rooms = new Map() // code -> Set<ws>

function roomOf(req) {
  try {
    return new URL(req.url, 'http://x').searchParams.get('room') || 'lobby'
  } catch {
    return 'lobby'
  }
}

function broadcast(code, msg, except) {
  const set = rooms.get(code)
  if (!set) return
  for (const c of set) if (c !== except && c.readyState === 1) c.send(msg)
}

wss.on('connection', (ws, req) => {
  const code = roomOf(req)
  let set = rooms.get(code)
  if (!set) {
    set = new Set()
    rooms.set(code, set)
  }
  if (set.size >= 2) {
    // A duel is 1v1 — turn away a third.
    ws.send('SYS:full')
    ws.close()
    return
  }
  set.add(ws)
  broadcast(code, `SYS:peers:${set.size}`, null)

  ws.on('message', (data) => broadcast(code, data.toString(), ws))
  ws.on('close', () => {
    set.delete(ws)
    if (set.size === 0) rooms.delete(code)
    else broadcast(code, `SYS:peers:${set.size}`, null)
  })
  ws.on('error', () => {})
})

wss.on('listening', () => console.log(`Zorr duel relay listening on ws://localhost:${PORT}`))
