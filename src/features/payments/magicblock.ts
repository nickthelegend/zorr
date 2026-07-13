import { Keypair } from '@solana/web3.js'
import * as SecureStore from 'expo-secure-store'

import { explorerTx as teeExplorerTx, teeBalances, teeSend, teeShield, teeWithdraw, ZORR_DECIMALS as DEC } from './tee'

// Private Payments = REAL MagicBlock Ephemeral Rollup + TEE. Shield delegates the
// wallet's $ZORR to the TEE rollup, Send transfers privately inside it, Withdraw
// undelegates back to the base layer. All signing happens on-device with a
// dedicated raw keypair (the Privy embedded wallet can't expose a raw key, and the
// ER/TEE ops need one). Funding comes from the relay faucet (real on-chain $ZORR +
// gas SOL). See tee.ts + the magicblock-private-payments memory.

export const ZORR_MINT = 'G8iBAC71bd3ikwGQrKUcFUrZ2ZpSxXbXg42NncASUxAL'
export const ZORR_DECIMALS = DEC
export const explorerTx = teeExplorerTx

const LEGACY_OWNER_KEY = 'zorr.owner.secret' // pre-Privy shared device seed (adopted if present)
const PAY_SECRET_KEY = 'zorr.pay.secret' // dedicated Private-Payments Ed25519 seed

// ---- Private-Payments keypair ----
// Auto-created on first use and NOT wiped on sign-out, so the shielded balance
// survives logout. Fund its base ATA via fundPaymentsWallet() before shielding.
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

// ---- balances (base = on-chain public, shielded = delegated on the TEE ER) ----
export type SplBalance = { balance: string }

// Cache the last snapshot briefly so fetchBaseBalance + fetchPrivateBalance (called
// together on refresh) don't each hit the ER separately.
let balCache: { at: number; base: number; shielded: number } | null = null
async function balances(): Promise<{ base: number; shielded: number }> {
  if (balCache && Date.now() - balCache.at < 2500) return balCache
  const b = await teeBalances(await keypair())
  balCache = { at: Date.now(), ...b }
  return b
}
const bump = () => {
  balCache = null
}

export async function fetchBaseBalance(): Promise<SplBalance> {
  const { base } = await balances()
  return { balance: String(Math.round(base * 10 ** DEC)) }
}
export async function fetchPrivateBalance(): Promise<SplBalance> {
  const { shielded } = await balances()
  return { balance: String(Math.round(shielded * 10 ** DEC)) }
}

// ---- shield / send / withdraw on the real TEE Ephemeral Rollup ----
/** Shield: delegate `amount` (base units) of $ZORR to the MagicBlock TEE rollup. */
export async function deposit(amount: number): Promise<string> {
  const whole = Math.max(1, Math.floor(amount / 10 ** DEC))
  const sig = await teeShield(await keypair(), whole)
  bump()
  return sig
}

/** Withdraw: undelegate the $ZORR from the TEE rollup back to the base layer. */
export async function withdraw(_amount: number): Promise<string> {
  const sig = await teeWithdraw(await keypair())
  bump()
  return sig
}

/** Send shielded $ZORR privately (or publicly) to another wallet inside the ER. */
export async function transfer(opts: {
  to: string
  amount: number // base units
  visibility: 'public' | 'private'
  fromBalance?: 'base' | 'ephemeral'
  toBalance?: 'base' | 'ephemeral'
}): Promise<string> {
  const whole = Math.max(1, Math.floor(opts.amount / 10 ** DEC))
  const sig = await teeSend(await keypair(), opts.to, whole, opts.visibility === 'private')
  bump()
  return sig
}

// ---- fund the Private-Payments wallet with real on-chain $ZORR (+ gas SOL) ----
const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'
export async function fundPaymentsWallet(amount = 50): Promise<{ funded: boolean; signature?: string; amount?: number; balance?: number; note?: string; error?: string }> {
  const owner = await paymentsOwner()
  try {
    const r = await fetch(`${CLAIM_RELAY_URL}/zorr/onchain-faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, amount }),
    })
    bump()
    return await r.json()
  } catch {
    return { funded: false, error: 'relay unreachable' }
  }
}

// ---- unit helpers ----
export const toBaseUnits = (amt: number, decimals = DEC) => Math.round(amt * 10 ** decimals)
export const fromBaseUnits = (raw: string | number, decimals = DEC) => Number(raw) / 10 ** decimals
