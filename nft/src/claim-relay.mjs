// Zorr Beasts VRF claim relay — the "contract that drops the NFTs".
//
// Holds the Genesis 48 (minted to the authority wallet) and lets a player claim
// one: MagicBlock VRF picks a random *unclaimed* beast, then the relay transfers
// that real Core NFT to the player's wallet. A JSON ledger prevents double
// claims. The app calls POST /claim with the player's address.
//
//   POST /claim { owner }  -> { beast }        VRF pick + on-chain transfer
//   GET  /pool             -> { total, remaining, claimed }
//   GET  /health
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import anchorPkg from '@coral-xyz/anchor'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fetchCollection, mplCore, transferV1 } from '@metaplex-foundation/mpl-core'
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi'
import { getOrCreateAssociatedTokenAccount, transfer as splTransfer } from '@solana/spl-token'
import { MongoClient } from 'mongodb'

const { AnchorProvider, Program, Wallet, web3 } = anchorPkg
const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8790

// Load nft/.env (MONGODB_URI etc.) without a dotenv dependency.
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  /* no .env — Mongo mirror disabled */
}
const DEFAULT_QUEUE = new web3.PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh')
const RPC = 'https://api.devnet.solana.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const out = (f) => path.join(here, '..', 'out', f)
const secret = Uint8Array.from(JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/zorr.json`, 'utf8')))
const manifest = JSON.parse(fs.readFileSync(out('manifest.json'), 'utf8'))
const coll = JSON.parse(fs.readFileSync(out('collection.json'), 'utf8'))
const claimsPath = out('claims.json')
const claims = fs.existsSync(claimsPath) ? JSON.parse(fs.readFileSync(claimsPath, 'utf8')) : {}
const saveClaims = () => fs.writeFileSync(claimsPath, JSON.stringify(claims, null, 2))

// Real player registry — devices POST their live game stats; the leaderboard is
// built from every player that has ever reported. No sample data anywhere.
const playersPath = out('players.json')
const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {}
const savePlayers = () => fs.writeFileSync(playersPath, JSON.stringify(players, null, 2))

// ---- $ZORR economy (real SPL token + fast ledger) ---------------------------
// $ZORR is a real devnet SPL token (out/token.json). Spendable balances live in
// a fast ledger here — MagicBlock-ER style: swaps, wagers and payouts settle
// instantly and gaslessly, and /zorr/withdraw redeems a balance to the player's
// real on-chain token account anytime. The ledger is backed 1:1 by the treasury
// supply. No mock balances — every number is earned via swap or wagered play.
const token = fs.existsSync(out('token.json')) ? JSON.parse(fs.readFileSync(out('token.json'), 'utf8')) : null
const SWAP_RATE = 1000 // 1 SOL → 1000 ZORR (devnet demo rate)
const FAUCET_GRANT = 500 // one-time starter ZORR so a new player can wager immediately
const zorrPath = out('zorr.json')
const zorr = fs.existsSync(zorrPath) ? JSON.parse(fs.readFileSync(zorrPath, 'utf8')) : { balances: {}, faucet: {}, wagers: {} }
zorr.balances ||= {}
zorr.faucet ||= {}
zorr.wagers ||= {}
const saveZorr = () => fs.writeFileSync(zorrPath, JSON.stringify(zorr, null, 2))
const isPubkey = (o) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(o || ''))
const zBal = (o) => Math.max(0, Math.floor(zorr.balances[o] || 0))
const zSet = (o, v) => {
  zorr.balances[o] = Math.max(0, Math.floor(v))
  saveZorr()
  if (mongo?.zorr) mongo.zorr.updateOne({ owner: o }, { $set: { owner: o, balance: zorr.balances[o] } }, { upsert: true }).catch(() => {})
}

// ---- MongoDB mirror (off-chain durable store) -------------------------------
// The relay's source of truth stays the in-memory maps + JSON files (zero-dep
// fallback), but everything is hydrated from and mirrored to MongoDB Atlas so
// claims, players and the leaderboard survive across hosts. URI via nft/.env.
let mongo = null // { players, claims } collections when connected

async function initMongo() {
  const uri = process.env.MONGODB_URI
  if (!uri) return console.log('mongo: no MONGODB_URI — running on JSON files only')
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 7000 })
    await client.connect()
    const db = client.db('zorr')
    const cols = { players: db.collection('players'), claims: db.collection('claims') }
    // Hydrate: newest wins between Mongo and the local JSON snapshot.
    for (const doc of await cols.players.find().toArray()) {
      const { _id, ...p } = doc
      if (!players[p.owner] || (p.updatedAt ?? 0) > (players[p.owner].updatedAt ?? 0)) players[p.owner] = p
    }
    for (const doc of await cols.claims.find().toArray()) {
      const { _id, ...c } = doc
      if (!claims[c.asset]) claims[c.asset] = c.data
    }
    savePlayers()
    saveClaims()
    // Push anything Mongo is missing (e.g. rows created while offline).
    for (const p of Object.values(players)) await cols.players.updateOne({ owner: p.owner }, { $set: p }, { upsert: true })
    for (const [asset, data] of Object.entries(claims)) await cols.claims.updateOne({ asset }, { $set: { asset, data } }, { upsert: true })
    mongo = cols
    console.log(`mongo: connected — ${Object.keys(players).length} players, ${Object.keys(claims).length} claims synced`)
  } catch (e) {
    console.log('mongo: unavailable, JSON fallback only —', (e.message || e).slice(0, 120))
  }
}

const mirrorPlayer = (owner) => {
  if (mongo && players[owner]) mongo.players.updateOne({ owner }, { $set: players[owner] }, { upsert: true }).catch(() => {})
}
const mirrorClaim = (asset) => {
  if (!mongo) return
  if (claims[asset]) mongo.claims.updateOne({ asset }, { $set: { asset, data: claims[asset] } }, { upsert: true }).catch(() => {})
  else mongo.claims.deleteOne({ asset }).catch(() => {})
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
function upsertPlayer(body) {
  const owner = String(body.owner || '')
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) return null // base58 pubkey
  players[owner] = {
    owner,
    name: String(body.name || 'Explorer').slice(0, 24),
    color: /^#[0-9A-Fa-f]{6}$/.test(String(body.color)) ? body.color : '#7C3AED',
    km2: Math.max(0, num(body.km2)),
    tiles: Math.max(0, Math.floor(num(body.tiles))),
    xp: Math.max(0, Math.floor(num(body.xp))),
    runs: Math.max(0, Math.floor(num(body.runs))),
    wins: Math.max(0, Math.floor(num(body.wins))),
    updatedAt: Date.now(),
  }
  savePlayers()
  mirrorPlayer(owner)
  return players[owner]
}

// ---- umi (transfer) ----
const umi = createUmi(RPC).use(mplCore())
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)))
const collection = await fetchCollection(umi, coll.address)

// ---- anchor (VRF) ----
const kp = web3.Keypair.fromSecretKey(secret)
const provider = new AnchorProvider(new web3.Connection(RPC, 'confirmed'), new Wallet(kp), { commitment: 'confirmed' })
const idl = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'onchain', 'idl', 'zorr.json'), 'utf8'))
const program = new Program(idl, provider)

/** Draw a verifiable random index in [0, n) via MagicBlock VRF (fallback: local). */
async function vrfPick(n) {
  const scope = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  const clientSeed = Math.floor(Math.random() * 256)
  const [pda] = web3.PublicKey.findProgramAddressSync([Buffer.from('vrfseed'), Buffer.from(scope)], program.programId)
  try {
    await program.methods.requestSeed(scope, clientSeed).accountsPartial({ payer: kp.publicKey, oracleQueue: DEFAULT_QUEUE }).rpc({ skipPreflight: true })
    for (let i = 0; i < 40; i++) {
      await sleep(750)
      const acct = await program.account.vrfSeed.fetch(pda, 'confirmed').catch(() => null)
      if (acct?.fulfilled) {
        const b = acct.seed
        const r = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
        return { index: r % n, vrf: true, seedHex: Buffer.from(b).toString('hex') }
      }
    }
  } catch (e) {
    console.log('VRF error, falling back to local:', (e.message || e).slice(0, 120))
  }
  return { index: Math.floor(Math.random() * n), vrf: false }
}

const unclaimed = () => manifest.filter((m) => !claims[m.asset])

async function claim(owner) {
  let ownerPk
  try {
    ownerPk = publicKey(owner)
  } catch {
    return { status: 400, body: { error: 'invalid owner address' } }
  }
  // Up to 3 VRF draws: if a picked asset can't transfer (e.g. already moved out
  // of band), quarantine it and draw again so a claim never dead-ends.
  for (let attempt = 0; attempt < 3; attempt++) {
    const pool = unclaimed()
    if (pool.length === 0) return { status: 409, body: { error: 'genesis pool fully claimed' } }
    const { index, vrf, seedHex } = await vrfPick(pool.length)
    const beast = pool[index]
    // Reserve before transfer (prevents a concurrent double-claim), roll back on failure.
    claims[beast.asset] = { owner, at: Date.now(), pending: true }
    saveClaims()
    mirrorClaim(beast.asset)
    try {
      await transferV1(umi, { asset: publicKey(beast.asset), collection: publicKey(coll.address), newOwner: ownerPk }).sendAndConfirm(umi)
      claims[beast.asset] = { owner, at: Date.now() }
      saveClaims()
      mirrorClaim(beast.asset)
      console.log(`🎁 claimed ${beast.name} [${beast.rarity}] → ${owner}${vrf ? ' (VRF)' : ''}`)
      return { status: 200, body: { beast: { ...beast }, vrf, seedHex } }
    } catch (e) {
      // Quarantine un-transferable assets so they're skipped next draw.
      claims[beast.asset] = { owner: null, quarantined: true, reason: (e.message || String(e)).slice(0, 100) }
      saveClaims()
      mirrorClaim(beast.asset)
      console.log(`⚠️  quarantined ${beast.name}: ${(e.message || e).slice(0, 80)}`)
    }
  }
  return { status: 500, body: { error: 'could not settle a claim, try again' } }
}

// ---- $ZORR operations -------------------------------------------------------
// One-time starter grant so a fresh player can jump into a wager without SOL.
function zorrFaucet(owner) {
  if (!isPubkey(owner)) return { status: 400, body: { error: 'invalid owner' } }
  if (zorr.faucet[owner]) return { status: 200, body: { balance: zBal(owner), granted: 0, already: true } }
  zorr.faucet[owner] = Date.now()
  zSet(owner, zBal(owner) + FAUCET_GRANT)
  return { status: 200, body: { balance: zBal(owner), granted: FAUCET_GRANT } }
}

// Swap SOL → ZORR. On devnet the SOL leg is treasury-funded (guest wallets are
// unfunded); the ZORR credited is real and withdrawable on-chain. Capped so a
// single call can't drain the demo treasury.
function zorrSwap(owner, sol) {
  if (!isPubkey(owner)) return { status: 400, body: { error: 'invalid owner' } }
  const s = Math.min(10, Math.max(0, Number(sol) || 0))
  if (s <= 0) return { status: 400, body: { error: 'sol amount must be > 0' } }
  const got = Math.floor(s * SWAP_RATE)
  zSet(owner, zBal(owner) + got)
  return { status: 200, body: { balance: zBal(owner), got, rate: SWAP_RATE } }
}

// Stake into a room's wager pot. Both players must stake the same amount; the
// first staker sets it. Idempotent per owner.
function zorrStake(room, owner, amount) {
  if (!isPubkey(owner) || !room) return { status: 400, body: { error: 'room + owner required' } }
  const amt = Math.floor(Number(amount) || 0)
  if (amt <= 0) return { status: 400, body: { error: 'amount must be > 0' } }
  const w = (zorr.wagers[room] ||= { stake: amt, pot: 0, players: {}, settled: false })
  if (w.settled) return { status: 409, body: { error: 'wager already settled' } }
  if (w.players[owner]) return { status: 200, body: { balance: zBal(owner), pot: w.pot, stake: w.stake, staked: Object.keys(w.players).length } }
  if (Object.keys(w.players).length === 0) w.stake = amt
  else if (amt !== w.stake) return { status: 400, body: { error: `stake must match ${w.stake}` } }
  if (zBal(owner) < amt) return { status: 400, body: { error: 'insufficient ZORR balance' } }
  zSet(owner, zBal(owner) - amt)
  w.players[owner] = { staked: amt, won: null }
  w.pot += amt
  saveZorr()
  return { status: 200, body: { balance: zBal(owner), pot: w.pot, stake: w.stake, staked: Object.keys(w.players).length } }
}

// Report a duel result. Each staker reports won:true/false. When both have
// reported, the pot pays the sole winner; on any disagreement both are refunded.
function zorrResult(room, owner, won) {
  const w = zorr.wagers[room]
  if (!w || !w.players[owner]) return { status: 400, body: { error: 'not a staker in this room' } }
  if (w.settled) return { status: 200, body: { settled: true, iWon: w.winner === owner, won: w.winner === owner ? w.paid || 0 : 0, refunded: !!w.refunded, balance: zBal(owner) } }
  w.players[owner].won = !!won
  saveZorr()
  const entries = Object.entries(w.players)
  const reported = entries.filter(([, p]) => typeof p.won === 'boolean')
  if (entries.length >= 2 && reported.length >= 2) {
    const winners = reported.filter(([, p]) => p.won)
    if (winners.length === 1) {
      const winOwner = winners[0][0]
      const pot = w.pot
      zSet(winOwner, zBal(winOwner) + pot)
      Object.assign(w, { settled: true, winner: winOwner, paid: pot, pot: 0 })
      saveZorr()
      return { status: 200, body: { settled: true, iWon: winOwner === owner, won: winOwner === owner ? pot : 0, balance: zBal(owner) } }
    }
    // Both claim a win / both a loss → deterministic engine desynced; refund all.
    for (const [o, p] of entries) zSet(o, zBal(o) + p.staked)
    Object.assign(w, { settled: true, winner: null, refunded: true, pot: 0 })
    saveZorr()
    return { status: 200, body: { settled: true, refunded: true, balance: zBal(owner) } }
  }
  return { status: 200, body: { settled: false, reported: reported.length } }
}

// Refund a caller's own stake if the duel never completed (opponent left).
function zorrCancel(room, owner) {
  const w = zorr.wagers[room]
  if (!w || !w.players[owner]) return { status: 400, body: { error: 'not a staker in this room' } }
  if (w.settled) return { status: 409, body: { error: 'already settled' } }
  const p = w.players[owner]
  zSet(owner, zBal(owner) + p.staked)
  w.pot = Math.max(0, w.pot - p.staked)
  delete w.players[owner]
  if (Object.keys(w.players).length === 0) delete zorr.wagers[room]
  saveZorr()
  return { status: 200, body: { refunded: p.staked, balance: zBal(owner) } }
}

// Redeem the fast-ledger balance to the player's real on-chain $ZORR account.
async function zorrWithdraw(owner) {
  if (!token) return { status: 503, body: { error: '$ZORR token not launched' } }
  if (!isPubkey(owner)) return { status: 400, body: { error: 'invalid owner' } }
  const amount = zBal(owner)
  if (amount <= 0) return { status: 400, body: { error: 'nothing to withdraw' } }
  const conn = new web3.Connection(RPC, 'confirmed')
  const mint = new web3.PublicKey(token.mint)
  const src = await getOrCreateAssociatedTokenAccount(conn, kp, mint, kp.publicKey)
  const dst = await getOrCreateAssociatedTokenAccount(conn, kp, mint, new web3.PublicKey(owner))
  const sig = await splTransfer(conn, kp, src.address, dst.address, kp, BigInt(amount) * BigInt(10 ** token.decimals))
  zSet(owner, 0)
  return { status: 200, body: { signature: sig, amount, account: dst.address.toBase58(), explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet` } }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' })
  res.end(JSON.stringify(body))
}

// Read a JSON body then hand it to `fn` (shared by the POST routes below).
function withBody(req, res, fn) {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let body
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      return send(res, 400, { error: 'bad json' })
    }
    Promise.resolve(fn(body)).catch((e) => send(res, 500, { error: (e.message || String(e)).slice(0, 160) }))
  })
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    const url = new URL(req.url, 'http://x')
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, mongo: !!mongo })
    if (req.method === 'GET' && url.pathname === '/pool') {
      return send(res, 200, { total: manifest.length, remaining: unclaimed().length, claimed: manifest.length - unclaimed().length })
    }
    if (req.method === 'GET' && url.pathname === '/owned') {
      const owner = url.searchParams.get('owner')
      const beasts = owner ? manifest.filter((m) => claims[m.asset]?.owner === owner) : []
      return send(res, 200, { owner, beasts })
    }
    if (req.method === 'GET' && url.pathname === '/leaderboard') {
      const board = Object.values(players)
        .sort((a, b) => b.km2 - a.km2 || b.xp - a.xp)
        .slice(0, 100)
      return send(res, 200, { players: board })
    }
    if (req.method === 'POST' && url.pathname === '/stats') {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        try {
          const p = upsertPlayer(JSON.parse(raw || '{}'))
          if (!p) return send(res, 400, { error: 'invalid owner' })
          send(res, 200, { ok: true, player: p })
        } catch {
          send(res, 400, { error: 'bad json' })
        }
      })
      return
    }
    if (req.method === 'POST' && url.pathname === '/claim') {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', async () => {
        let owner
        try {
          owner = JSON.parse(raw || '{}').owner ?? url.searchParams.get('owner')
        } catch {
          owner = url.searchParams.get('owner')
        }
        if (!owner) return send(res, 400, { error: 'owner required' })
        try {
          const r = await claim(owner)
          send(res, r.status, r.body)
        } catch (e) {
          send(res, 500, { error: (e.message || String(e)).slice(0, 160) })
        }
      })
      return
    }

    // ---- $ZORR economy ----
    if (req.method === 'GET' && url.pathname === '/zorr/config') {
      return send(res, 200, token ? { ...token, rate: SWAP_RATE, faucet: FAUCET_GRANT } : { error: 'token not launched' })
    }
    if (req.method === 'GET' && url.pathname === '/zorr/balance') {
      const owner = url.searchParams.get('owner')
      if (!isPubkey(owner)) return send(res, 400, { error: 'invalid owner' })
      return send(res, 200, { owner, balance: zBal(owner), symbol: 'ZORR' })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/faucet') {
      return withBody(req, res, (b) => { const r = zorrFaucet(b.owner); send(res, r.status, r.body) })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/swap') {
      return withBody(req, res, (b) => { const r = zorrSwap(b.owner, b.sol); send(res, r.status, r.body) })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/wager/stake') {
      return withBody(req, res, (b) => { const r = zorrStake(b.room, b.owner, b.amount); send(res, r.status, r.body) })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/wager/result') {
      return withBody(req, res, (b) => { const r = zorrResult(b.room, b.owner, b.won); send(res, r.status, r.body) })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/wager/cancel') {
      return withBody(req, res, (b) => { const r = zorrCancel(b.room, b.owner); send(res, r.status, r.body) })
    }
    if (req.method === 'POST' && url.pathname === '/zorr/withdraw') {
      return withBody(req, res, async (b) => { const r = await zorrWithdraw(b.owner); send(res, r.status, r.body) })
    }

    send(res, 404, { error: 'not found' })
  })
  .listen(PORT, async () => {
    await initMongo()
    console.log(`Zorr Beasts claim relay on :${PORT}  ·  pool ${unclaimed().length}/${manifest.length} unclaimed  ·  collection ${coll.address}`)
  })
