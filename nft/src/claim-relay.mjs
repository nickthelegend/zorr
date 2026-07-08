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

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' })
  res.end(JSON.stringify(body))
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
    send(res, 404, { error: 'not found' })
  })
  .listen(PORT, async () => {
    await initMongo()
    console.log(`Zorr Beasts claim relay on :${PORT}  ·  pool ${unclaimed().length}/${manifest.length} unclaimed  ·  collection ${coll.address}`)
  })
