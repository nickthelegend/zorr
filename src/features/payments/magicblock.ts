import { Keypair, PublicKey } from '@solana/web3.js'
import * as SecureStore from 'expo-secure-store'

import { fetchZorrBalance, getOwnerAddress } from '../nft/nft'
import { explorerTx as teeExplorerTx, teeBalances, teeShield, teeTransferToTreasury, teeWithdraw, ZORR_DECIMALS as DEC } from './tee'

// Private Payments = REAL MagicBlock TEE Ephemeral Rollup, drawing from your
// ACTUAL spendable $ZORR (the same balance shown on the wallet page) — not a
// separate wallet. Shield: the relay moves $ZORR from your spendable ledger onto
// this device's dedicated ER-signing wallet on-chain, which then delegates it to
// the TEE. Withdraw: undelegate → return to the treasury → your spendable ledger
// is credited. The dedicated keypair only exists because the Privy wallet can't
// expose a raw key to sign ER/TEE txs. See tee.ts + the magicblock memory.

export const ZORR_MINT = 'G8iBAC71bd3ikwGQrKUcFUrZ2ZpSxXbXg42NncASUxAL'
export const ZORR_DECIMALS = DEC
export const explorerTx = teeExplorerTx

const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'
const LEGACY_OWNER_KEY = 'zorr.owner.secret'
const PAY_SECRET_KEY = 'zorr.pay.secret' // dedicated ER-signing keypair (never wiped on logout)

// ---- ER-signing keypair (auto-created, persistent) ----
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

let treasuryCache: string | null = null
async function treasuryOwner(): Promise<string> {
  if (treasuryCache) return treasuryCache
  const cfg = await (await fetch(`${CLAIM_RELAY_URL}/zorr/config`)).json()
  if (!cfg.treasury) throw new Error('relay has no treasury')
  treasuryCache = cfg.treasury as string
  return treasuryCache
}

// ---- balances: base = your spendable $ZORR, shielded = what's on the TEE ----
export type SplBalance = { balance: string }

/** Public/base = the player's real spendable $ZORR (relay ledger) — the shield source. */
export async function fetchBaseBalance(): Promise<SplBalance> {
  const spendable = await fetchZorrBalance()
  return { balance: String(Math.round(spendable * 10 ** DEC)) }
}
/** Shielded = $ZORR currently delegated to the MagicBlock TEE Ephemeral Rollup. */
export async function fetchPrivateBalance(): Promise<SplBalance> {
  const { shielded } = await teeBalances(await keypair())
  return { balance: String(Math.round(shielded * 10 ** DEC)) }
}

// ---- shield / send / withdraw ----
/**
 * Shield: draw `amount` (base units) from your spendable $ZORR and delegate it to
 * the TEE. (1) relay moves that $ZORR on-chain to the ER-signing wallet (+ gas),
 * (2) wait for it to land, (3) delegate it to the MagicBlock TEE rollup.
 */
export async function deposit(amount: number): Promise<string> {
  const whole = Math.max(1, Math.floor(amount / 10 ** DEC))
  const gameOwner = await getOwnerAddress()
  const payWallet = await paymentsOwner()
  const kp = await keypair()

  const r = await fetch(`${CLAIM_RELAY_URL}/zorr/shield/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameOwner, payWallet, amount: whole }),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'could not move $ZORR to shield')

  // Wait for the on-chain funding to land before delegating.
  for (let i = 0; i < 12; i++) {
    const { base } = await teeBalances(kp)
    if (base >= whole) break
    await new Promise((s) => setTimeout(s, 2000))
  }
  // teeShield delegates the FULL base ATA (handles repeat shields + stranded funds).
  return teeShield(kp)
}

/**
 * Withdraw: undelegate from the TEE, reclaim to the ER-signing wallet, return the
 * $ZORR to the treasury, and credit it back to your spendable balance.
 */
export async function withdraw(_amount: number): Promise<string> {
  const kp = await keypair()
  const gameOwner = await getOwnerAddress()
  const { signature: wSig, whole } = await teeWithdraw(kp)
  if (whole <= 0) return wSig
  const tSig = await teeTransferToTreasury(kp, new PublicKey(await treasuryOwner()), whole)
  await fetch(`${CLAIM_RELAY_URL}/zorr/shield/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameOwner, sig: tSig, amount: whole }),
  }).catch(() => {})
  return tSig
}

/**
 * Send $ZORR to another player. Delivers instantly to the recipient's spendable
 * balance (off-chain ledger) — a real TEE transfer would require the recipient to
 * be delegated to the rollup too, which an arbitrary wallet isn't.
 */
export async function transfer(opts: {
  to: string
  amount: number // base units
  visibility?: 'public' | 'private'
  fromBalance?: 'base' | 'ephemeral'
  toBalance?: 'base' | 'ephemeral'
}): Promise<string> {
  const whole = Math.max(1, Math.floor(opts.amount / 10 ** DEC))
  const from = await getOwnerAddress()
  const r = await fetch(`${CLAIM_RELAY_URL}/zorr/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, amount: whole }),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'send failed')
  return `sent:${whole}` // off-chain — no on-chain signature
}

// ---- unit helpers ----
export const toBaseUnits = (amt: number, decimals = DEC) => Math.round(amt * 10 ** decimals)
export const fromBaseUnits = (raw: string | number, decimals = DEC) => Number(raw) / 10 ** decimals
