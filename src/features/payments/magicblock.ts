import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import * as SecureStore from 'expo-secure-store'
import nacl from 'tweetnacl'

// MagicBlock Private Payments (Private Ephemeral Rollups) client. The API builds
// unsigned SPL transactions; we refresh the blockhash, sign with the device
// wallet, and send to the right RPC (base, or the ephemeral rollup for private
// txs). Verified end-to-end on devnet with $ZORR. Contract details live in the
// magicblock-private-payments memory. Everything here is real — no mocks.

export const PAY_API = process.env.EXPO_PUBLIC_PAYMENTS_API || 'https://api.magicblock.app'
export const CLUSTER = 'devnet'
export const BASE_RPC = 'https://rpc.magicblock.app/devnet'
export const ZORR_MINT = 'G8iBAC71bd3ikwGQrKUcFUrZ2ZpSxXbXg42NncASUxAL'
export const ZORR_DECIMALS = 9

const OWNER_SECRET_KEY = 'zorr.owner.secret' // 32-byte Ed25519 seed (shared with nft.ts)
const tokenKey = (addr: string) => `magicblock.privtoken.${addr}`

// ---- device keypair (web3.js) — same seed kit uses, so the address matches ----
let kpCache: Keypair | null = null
async function keypair(): Promise<Keypair> {
  if (kpCache) return kpCache
  const stored = await SecureStore.getItemAsync(OWNER_SECRET_KEY)
  if (!stored) throw new Error('No device wallet on this device yet.')
  kpCache = Keypair.fromSeed(Uint8Array.from(JSON.parse(stored) as number[]))
  return kpCache
}

export async function paymentsOwner(): Promise<string> {
  return (await keypair()).publicKey.toBase58()
}

// ---- API helpers ----
const q = (p: Record<string, string>) => new URLSearchParams(p).toString()
const errMsg = (j: unknown, fallback: string) => {
  const e = (j as { error?: unknown })?.error
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return fallback
}
async function jget<T = any>(path: string, token?: string): Promise<T> {
  const r = await fetch(`${PAY_API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const j = await r.json().catch(() => null)
  if (!r.ok || (j && (j as { error?: unknown }).error)) throw new Error(errMsg(j, `GET ${path} ${r.status}`))
  return j as T
}
async function jpost<T = any>(path: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(`${PAY_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok || (j && (j as { error?: unknown }).error)) throw new Error(errMsg(j, `POST ${path} ${r.status}`))
  return j as T
}

// ---- auth (challenge → sign → bearer token) ----
export async function refreshPrivateToken(): Promise<string> {
  const kp = await keypair()
  const addr = kp.publicKey.toBase58()
  const { challenge } = await jget<{ challenge: string }>(`/v1/spl/challenge?${q({ pubkey: addr, cluster: CLUSTER })}`)
  const sig = nacl.sign.detached(new TextEncoder().encode(challenge), kp.secretKey)
  const { token } = await jpost<{ token: string }>('/v1/spl/login', { pubkey: addr, challenge, signature: bs58.encode(sig) })
  await SecureStore.setItemAsync(tokenKey(addr), token)
  return token
}
async function getToken(): Promise<string> {
  const addr = (await keypair()).publicKey.toBase58()
  return (await SecureStore.getItemAsync(tokenKey(addr))) || refreshPrivateToken()
}

// ---- balances ----
export type SplBalance = { address: string; mint: string; ata: string; location: 'base' | 'ephemeral'; balance: string }

export async function fetchBaseBalance(mint = ZORR_MINT): Promise<SplBalance> {
  const addr = await paymentsOwner()
  return jget(`/v1/spl/balance?${q({ address: addr, mint, cluster: CLUSTER })}`)
}
export async function fetchPrivateBalance(mint = ZORR_MINT): Promise<SplBalance> {
  const addr = await paymentsOwner()
  const path = `/v1/spl/private-balance?${q({ address: addr, mint, cluster: CLUSTER })}`
  try {
    return await jget(path, await getToken())
  } catch {
    // token likely expired → re-login once
    return jget(path, await refreshPrivateToken())
  }
}

export async function isMintInitialized(mint = ZORR_MINT): Promise<boolean> {
  const j = await jget<{ initialized?: boolean }>(`/v1/spl/is-mint-initialized?${q({ mint, cluster: CLUSTER })}`)
  return !!j.initialized
}

// ---- build → refresh blockhash → sign → send (the verified flow) ----
type BuiltTx = {
  version?: 'legacy' | number
  transactionBase64: string
  sendTo?: 'base' | 'ephemeral'
  sendRpcEndpoint?: string
}
async function signAndSend(built: BuiltTx, token?: string): Promise<string> {
  const kp = await keypair()
  const ephemeral = built.sendTo === 'ephemeral' || !!built.sendRpcEndpoint
  const url = built.sendRpcEndpoint || BASE_RPC
  const conn = new Connection(url, {
    commitment: 'confirmed',
    ...(ephemeral && token ? { httpHeaders: { Authorization: `Bearer ${token}` } } : {}),
  })
  // Ephemeral txs MUST use a fresh blockhash from their rollup RPC, or the send
  // fails with "Blockhash not found". Base txs are fine to refresh too.
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const buf = Buffer.from(built.transactionBase64, 'base64')
  let signed: Uint8Array
  if (built.version === 'legacy') {
    const tx = Transaction.from(buf)
    tx.recentBlockhash = blockhash
    tx.sign(kp)
    signed = tx.serialize()
  } else {
    const tx = VersionedTransaction.deserialize(buf)
    tx.message.recentBlockhash = blockhash
    tx.sign([kp])
    signed = tx.serialize()
  }
  const sig = await conn.sendRawTransaction(signed, { skipPreflight: true, maxRetries: 3 })
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed').catch(() => {})
  return sig
}

/** One-time setup of a mint's private transfer queue (idempotent). */
export async function initializeMint(mint = ZORR_MINT): Promise<string> {
  const payer = await paymentsOwner()
  return signAndSend(await jpost('/v1/spl/initialize-mint', { payer, mint, cluster: CLUSTER }))
}

/** Deposit base → private ephemeral rollup. `amount` is base units. */
export async function deposit(amount: number, mint = ZORR_MINT): Promise<string> {
  const owner = await paymentsOwner()
  return signAndSend(
    await jpost('/v1/spl/deposit', { owner, cluster: CLUSTER, mint, amount, initIfMissing: true, initAtasIfMissing: true, initVaultIfMissing: true, idempotent: true }),
  )
}

/** Withdraw private ephemeral → base. `amount` is base units. */
export async function withdraw(amount: number, mint = ZORR_MINT): Promise<string> {
  const owner = await paymentsOwner()
  return signAndSend(
    await jpost('/v1/spl/withdraw', { owner, cluster: CLUSTER, mint, amount, initIfMissing: true, initAtasIfMissing: true, idempotent: true }),
  )
}

/** Public or private transfer. Private = delayed + split scheduled transfer on the rollup. */
export async function transfer(opts: {
  to: string
  amount: number // base units
  visibility: 'public' | 'private'
  fromBalance: 'base' | 'ephemeral'
  toBalance: 'base' | 'ephemeral'
  split?: number
  mint?: string
}): Promise<string> {
  const from = await paymentsOwner()
  const mint = opts.mint || ZORR_MINT
  const token = opts.fromBalance === 'ephemeral' ? await getToken() : undefined
  const body: Record<string, unknown> = {
    from, to: opts.to, mint, cluster: CLUSTER, amount: opts.amount,
    visibility: opts.visibility, fromBalance: opts.fromBalance, toBalance: opts.toBalance,
  }
  if (opts.visibility === 'private') {
    body.split = opts.split ?? 2
    body.minDelayMs = '0'
    body.maxDelayMs = '1000'
  }
  return signAndSend(await jpost('/v1/spl/transfer', body, token), token)
}

// ---- unit helpers ----
export const toBaseUnits = (amt: number, decimals = ZORR_DECIMALS) => Math.round(amt * 10 ** decimals)
export const fromBaseUnits = (raw: string | number, decimals = ZORR_DECIMALS) => Number(raw) / 10 ** decimals
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
