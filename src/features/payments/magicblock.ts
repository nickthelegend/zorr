import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import * as SecureStore from 'expo-secure-store'

// Zorr Private Payments — a REAL on-chain $ZORR shielded vault, run by the Zorr
// relay (the same trust model as the $ZORR economy). MagicBlock's hosted devnet
// TEE ("Private Ephemeral Rollups") is currently in mock mode — its challenge is
// literally "MOCK: …" and its deposit tx never settles — so shielding through it
// would move nothing. Instead we make it genuinely real:
//   • Shield   = a real, locally-signed on-chain $ZORR transfer INTO the treasury
//                vault, credited to a private off-chain balance.
//   • Withdraw = a real treasury→owner on-chain transfer back out.
//   • Send     = private (instant off-chain balance move — nothing on-chain) or
//                public (real on-chain payout to the recipient).
// Every shield/withdraw/public-send is verifiable on Solana Explorer. The private
// balance lives in the relay ledger, redeemable on-chain at any time.

export const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'
export const DEVNET_RPC = 'https://api.devnet.solana.com'
export const ZORR_MINT = 'G8iBAC71bd3ikwGQrKUcFUrZ2ZpSxXbXg42NncASUxAL'
export const ZORR_DECIMALS = 9

const LEGACY_OWNER_KEY = 'zorr.owner.secret' // pre-Privy shared device seed (adopted if present)
const PAY_SECRET_KEY = 'zorr.pay.secret' // dedicated Private-Payments Ed25519 seed

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

/** Associated token account for (owner, mint) — derived without @solana/spl-token. */
function ataFor(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ATA_PROGRAM_ID)[0]
}

// ---- Private-Payments keypair (web3.js) ----
// Private Payments keeps its OWN raw on-device Ed25519 key (the Privy embedded
// wallet never exposes a raw key, so it can't sign the shield transfer). Auto-
// created on first use and NOT wiped on sign-out, so the shielded vault survives
// logout. Fund its base ATA with real $ZORR via fundPaymentsWallet() before shielding.
let kpCache: Keypair | null = null
async function keypair(): Promise<Keypair> {
  if (kpCache) return kpCache
  let seed = await SecureStore.getItemAsync(PAY_SECRET_KEY)
  if (!seed) {
    const legacy = await SecureStore.getItemAsync(LEGACY_OWNER_KEY)
    seed = legacy ?? JSON.stringify([...crypto.getRandomValues(new Uint8Array(32))])
    await SecureStore.setItemAsync(PAY_SECRET_KEY, seed)
  }
  kpCache = Keypair.fromSeed(Uint8Array.from(JSON.parse(seed) as number[]))
  return kpCache
}

export async function paymentsOwner(): Promise<string> {
  return (await keypair()).publicKey.toBase58()
}

// ---- relay helpers ----
const errMsg = (j: unknown, fallback: string) => {
  const e = (j as { error?: unknown })?.error
  return typeof e === 'string' ? e : fallback
}
async function rget<T = any>(path: string): Promise<T> {
  const r = await fetch(`${CLAIM_RELAY_URL}${path}`)
  const j = await r.json().catch(() => null)
  if (!r.ok || (j && (j as { error?: unknown }).error)) throw new Error(errMsg(j, `GET ${path} ${r.status}`))
  return j as T
}
async function rpost<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${CLAIM_RELAY_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => null)
  if (!r.ok || (j && (j as { error?: unknown }).error)) throw new Error(errMsg(j, `POST ${path} ${r.status}`))
  return j as T
}

// The treasury vault owner (shield destination) — cached from the relay config.
let treasuryCache: string | null = null
async function treasuryOwner(): Promise<string> {
  if (treasuryCache) return treasuryCache
  const cfg = await rget<{ treasury?: string; mint?: string }>('/zorr/config')
  if (!cfg.treasury) throw new Error('relay has no treasury configured')
  treasuryCache = cfg.treasury
  return treasuryCache
}

// ---- balances ----
export type SplBalance = { balance: string }
type ShieldState = { owner: string; shielded: number; base: number }

async function shieldState(): Promise<ShieldState> {
  const owner = await paymentsOwner()
  return rget<ShieldState>(`/zorr/shield/balance?owner=${owner}`)
}
/** Public base balance = the shielded wallet's REAL on-chain $ZORR (in base units). */
export async function fetchBaseBalance(): Promise<SplBalance> {
  const s = await shieldState()
  return { balance: String(Math.round(s.base * 10 ** ZORR_DECIMALS)) }
}
/** Shielded (private) balance held in the Zorr vault (in base units). */
export async function fetchPrivateBalance(): Promise<SplBalance> {
  const s = await shieldState()
  return { balance: String(Math.round(s.shielded * 10 ** ZORR_DECIMALS)) }
}

// ---- shield: real on-chain $ZORR transfer (owner → treasury vault), then credit ----
async function signedTransferToTreasury(whole: number): Promise<string> {
  const kp = await keypair()
  const conn = new Connection(DEVNET_RPC, 'confirmed')
  const mint = new PublicKey(ZORR_MINT)
  const src = ataFor(kp.publicKey, mint)
  const dst = ataFor(new PublicKey(await treasuryOwner()), mint)

  const data = Buffer.alloc(9)
  data.writeUInt8(3, 0) // SPL Token: Transfer
  data.writeBigUInt64LE(BigInt(whole) * BigInt(10 ** ZORR_DECIMALS), 1)
  const ix = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: src, isSigner: false, isWritable: true },
      { pubkey: dst, isSigner: false, isWritable: true },
      { pubkey: kp.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction()
  tx.feePayer = kp.publicKey
  tx.recentBlockhash = blockhash
  tx.add(ix)
  tx.sign(kp)
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 })
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed').catch(() => {})
  return sig
}

/** Shield: move on-chain $ZORR into the private vault. `amount` is base units. */
export async function deposit(amount: number, _mint = ZORR_MINT): Promise<string> {
  const whole = Math.max(1, Math.floor(amount / 10 ** ZORR_DECIMALS))
  const owner = await paymentsOwner()
  const sig = await signedTransferToTreasury(whole)
  await rpost('/zorr/shield/deposit', { owner, sig, amount: whole })
  return sig
}

/** Withdraw: move shielded $ZORR back out to the public base balance (real tx). */
export async function withdraw(amount: number, _mint = ZORR_MINT): Promise<string> {
  const whole = Math.max(1, Math.floor(amount / 10 ** ZORR_DECIMALS))
  const owner = await paymentsOwner()
  const r = await rpost<{ signature: string }>('/zorr/shield/withdraw', { owner, amount: whole })
  return r.signature
}

/** Send shielded $ZORR — private (instant off-chain) or public (real on-chain payout). */
export async function transfer(opts: {
  to: string
  amount: number // base units
  visibility: 'public' | 'private'
  fromBalance?: 'base' | 'ephemeral'
  toBalance?: 'base' | 'ephemeral'
  split?: number
  mint?: string
}): Promise<string> {
  const whole = Math.max(1, Math.floor(opts.amount / 10 ** ZORR_DECIMALS))
  const from = await paymentsOwner()
  const r = await rpost<{ signature?: string; private?: boolean }>('/zorr/shield/send', {
    from,
    to: opts.to,
    amount: whole,
    private: opts.visibility === 'private',
  })
  return r.signature ?? `private:${whole}` // private sends settle off-chain (no on-chain sig)
}

// ---- fund the Private-Payments wallet with real on-chain $ZORR ----
/**
 * Mint real on-chain $ZORR into this device's Private-Payments base ATA
 * (treasury → owner, via the relay). Gives the shielded wallet genuine tokens to
 * shield into the private vault. Self-limits server-side.
 */
export async function fundPaymentsWallet(amount = 50): Promise<{ funded: boolean; signature?: string; amount?: number; balance?: number; note?: string; error?: string }> {
  const owner = await paymentsOwner()
  try {
    const r = await fetch(`${CLAIM_RELAY_URL}/zorr/onchain-faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, amount }),
    })
    return await r.json()
  } catch {
    return { funded: false, error: 'relay unreachable' }
  }
}

// ---- unit helpers ----
export const toBaseUnits = (amt: number, decimals = ZORR_DECIMALS) => Math.round(amt * 10 ** decimals)
export const fromBaseUnits = (raw: string | number, decimals = ZORR_DECIMALS) => Number(raw) / 10 ** decimals
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
