// Socket integration test: spawns the real relay (server/relay.mjs) and drives
// three WebSocket clients through it to prove the online duel transport works —
// two peers in a room exchange the exact protocol messages in order, and a
// third client in a different room sees none of them (room isolation).
//
// The battle engine's determinism is proven separately by the Jest loopback
// test; this covers the wire between two phones.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import WebSocket from 'ws'

const PORT = 8799
const here = path.dirname(fileURLToPath(import.meta.url))
const relayPath = path.join(here, '..', 'server', 'relay.mjs')

let failures = 0
const check = (name, cond, detail = '') => {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function open(room) {
  const ws = new WebSocket(`ws://localhost:${PORT}/?room=${room}`)
  ws.received = []
  ws.on('message', (d) => ws.received.push(d.toString()))
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

console.log('Zorr duel relay — socket integration\n')

const relay = spawn(process.execPath, [relayPath], { env: { ...process.env, PORT: String(PORT) } })
relay.stderr.on('data', (d) => process.stderr.write(d))

try {
  // Wait for the relay to announce it is listening.
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('relay did not start')), 5000)
    relay.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) {
        clearTimeout(to)
        resolve()
      }
    })
  })

  const a = await open('duel-1')
  const b = await open('duel-1')
  const outsider = await open('duel-2')
  await sleep(150)

  // Both room members learn a second peer arrived.
  check('peers reach 2 in the room', a.received.some((m) => m === 'SYS:peers:2') || b.received.some((m) => m === 'SYS:peers:2'))

  a.received.length = 0
  b.received.length = 0
  outsider.received.length = 0

  // A full handshake + first moves, exactly as the app would send them.
  const fromA = ['H:10', 'B:hero-a:1', 'G', 'M:1:0']
  const fromB = ['H:20', 'B:hero-b:1', 'M:2:1']
  for (const m of fromA) a.send(m)
  for (const m of fromB) b.send(m)
  await sleep(250)

  check('B received A’s messages in order', JSON.stringify(b.received.filter((m) => !m.startsWith('SYS:'))) === JSON.stringify(fromA), b.received.join(' '))
  check('A received B’s messages in order', JSON.stringify(a.received.filter((m) => !m.startsWith('SYS:'))) === JSON.stringify(fromB), a.received.join(' '))
  check('outsider room is isolated (received nothing)', outsider.received.filter((m) => !m.startsWith('SYS:')).length === 0)

  // Disconnect notifies the remaining peer.
  b.close()
  await sleep(150)
  check('A is told the peer left (peers:1)', a.received.some((m) => m === 'SYS:peers:1'))

  a.close()
  outsider.close()
} catch (e) {
  console.log(`  ❌ ${e.message}`)
  failures++
} finally {
  relay.kill()
}

console.log(failures === 0 ? '\n🎉 ALL SOCKET CHECKS PASSED\n' : `\n❌ ${failures} CHECK(S) FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
