import { createKeyPairSignerFromPrivateKeyBytes, type KeyPairSigner } from '@solana/kit'
import * as SecureStore from 'expo-secure-store'

// Talks to the Zorr Beasts claim relay (server/../nft/src/claim-relay.mjs). Set
// EXPO_PUBLIC_CLAIM_RELAY_URL to a running relay; emulator default 10.0.2.2:8790.
export const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'

const OWNER_SECRET_KEY = 'zorr.owner.secret' // 32-byte Ed25519 seed (JSON array)
const LEGACY_OWNER_KEY = 'zorr.owner.address' // pre-fix installs stored only the address
const PRIVY_OWNER_KEY = 'zorr.owner.privy' // the signed-in Privy embedded wallet (the REAL owner)

// The player's wallet that owns their $ZORR + Guardian NFTs. Once signed in with
// Privy, THAT wallet is the owner — no shared/temp key. A per-device keypair is
// only a fallback before the Privy wallet resolves (or a brand-new install).
let privyOwner: string | null = null
let ownerPromise: Promise<{ address: string; signer: KeyPairSigner | null }> | null = null

/**
 * Point $ZORR + NFT ownership at the signed-in Privy wallet. Called from
 * <PrivyOwnerSync> the moment the embedded wallet resolves, and persisted so the
 * next launch keys assets to the same Privy wallet immediately.
 */
export function setPrivyOwner(addr: string | null | undefined) {
  if (addr && addr !== privyOwner) {
    privyOwner = addr
    ownerPromise = null // re-resolve the owner to the Privy wallet
    SecureStore.setItemAsync(PRIVY_OWNER_KEY, addr).catch(() => {})
  }
}

/**
 * Drop the current owner entirely — called on sign-out so the NEXT account
 * doesn't inherit the previous wallet. Without this, a different login would
 * still resolve to the stale persisted Privy address (same $ZORR, same NFTs).
 */
export async function clearPrivyOwner() {
  privyOwner = null
  ownerPromise = null
  await Promise.allSettled([
    SecureStore.deleteItemAsync(PRIVY_OWNER_KEY),
    SecureStore.deleteItemAsync(OWNER_SECRET_KEY),
    SecureStore.deleteItemAsync(LEGACY_OWNER_KEY),
  ])
}

function loadOwner() {
  if (!ownerPromise) {
    ownerPromise = (async () => {
      // The signed-in Privy wallet is the owner. It signs via Privy (not a raw
      // keypair here), so no local signer — the relay keys assets to this address.
      const privy = privyOwner || (await SecureStore.getItemAsync(PRIVY_OWNER_KEY))
      if (privy) {
        privyOwner = privy
        return { address: privy, signer: null }
      }
      const stored = await SecureStore.getItemAsync(OWNER_SECRET_KEY)
      if (stored) {
        const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from(JSON.parse(stored) as number[]))
        return { address: signer.address, signer }
      }
      const legacy = await SecureStore.getItemAsync(LEGACY_OWNER_KEY)
      if (legacy) return { address: legacy, signer: null }
      // Brand-new install, not yet signed in: a temporary per-device key so the
      // app still functions; setPrivyOwner() takes over as soon as login resolves.
      const secret = crypto.getRandomValues(new Uint8Array(32))
      const signer = await createKeyPairSignerFromPrivateKeyBytes(secret)
      await SecureStore.setItemAsync(OWNER_SECRET_KEY, JSON.stringify([...secret]))
      return { address: signer.address, signer }
    })()
  }
  return ownerPromise
}

/** The wallet address that owns this player's $ZORR + Guardian NFTs (Privy once signed in). */
export async function getOwnerAddress(): Promise<string> {
  return (await loadOwner()).address
}

/** The device wallet's signer — can sign for its NFTs. Null only on legacy installs. */
export async function getOwnerSigner(): Promise<KeyPairSigner | null> {
  return (await loadOwner()).signer
}

export type OwnedBeast = {
  id: number
  seed: string
  name: string
  element: string
  rarity: string
  asset: string
  uri: string
  image: string
}

export type PoolStatus = { total: number; remaining: number; claimed: number }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${CLAIM_RELAY_URL}${path}`)
  if (!r.ok) throw new Error(`relay ${r.status}`)
  return r.json() as Promise<T>
}

export function fetchPool(): Promise<PoolStatus> {
  return get<PoolStatus>('/pool')
}

export async function fetchOwned(owner: string): Promise<OwnedBeast[]> {
  const { beasts } = await get<{ beasts: OwnedBeast[] }>(`/owned?owner=${encodeURIComponent(owner)}`)
  return beasts ?? []
}

/** Claim a random unclaimed Guardian via MagicBlock VRF; the relay transfers the NFT. */
export async function claimGuardian(owner: string): Promise<{ beast: OwnedBeast; vrf: boolean }> {
  const r = await fetch(`${CLAIM_RELAY_URL}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error || `claim failed (${r.status})`)
  return j
}

export function assetExplorerUrl(asset: string) {
  return `https://explorer.solana.com/address/${asset}?cluster=devnet`
}

// ---- Real global leaderboard (relay player registry) ------------------------

export type PlayerStats = {
  owner: string
  name: string
  color: string
  km2: number
  tiles: number
  xp: number
  runs: number
  wins: number
}

/** Report this device's live game stats to the relay (fire-and-forget safe). */
export async function submitStats(stats: Omit<PlayerStats, 'owner'>): Promise<void> {
  const owner = await getOwnerAddress()
  await fetch(`${CLAIM_RELAY_URL}/stats`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner, ...stats }),
  })
}

/** Every real player that has reported stats, ranked by the relay. */
export async function fetchLeaderboard(): Promise<PlayerStats[]> {
  const { players } = await get<{ players: PlayerStats[] }>('/leaderboard')
  return players ?? []
}

// ---- $ZORR token economy (real devnet SPL token + fast relay ledger) --------
// Spendable $ZORR lives in a fast ledger on the relay (settles instantly,
// MagicBlock-ER style) and is redeemable to the device wallet's real on-chain
// token account via withdraw. Every call is keyed by the device owner address.

export type ZorrConfig = { name: string; symbol: string; mint: string; decimals: number; supply: number; rate: number; faucet: number; cluster: string; feeBps?: number; reserveSol?: number; reserveZorr?: number; treasury?: string }

/** One $ZORR ledger event (swap, withdraw, faucet, wager, claim), newest first. */
export type ZorrEvent = { t: 'swap' | 'withdraw' | 'deposit' | 'faucet' | 'wager-stake' | 'wager-win' | 'wager-refund' | 'claim'; amount: number; sol?: number; sig?: string; price?: number; beast?: string; asset?: string; room?: string; ts: number }

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${CLAIM_RELAY_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error || `relay ${r.status}`)
  return j as T
}

/** $ZORR token metadata + swap rate from the relay (null if not launched). */
export async function fetchZorrConfig(): Promise<ZorrConfig | null> {
  try {
    const c = await get<ZorrConfig & { error?: string }>('/zorr/config')
    return c?.mint ? c : null
  } catch {
    return null
  }
}

/** This wallet's spendable (fast-ledger) $ZORR balance — what you swap + wager with. */
export async function fetchZorrBalance(): Promise<number> {
  const owner = await getOwnerAddress()
  const { balance } = await get<{ balance: number }>(`/zorr/balance?owner=${encodeURIComponent(owner)}`)
  return balance ?? 0
}

/** The wallet's REAL on-chain $ZORR balance (where withdrawals land). */
export async function fetchZorrOnchain(): Promise<number> {
  const owner = await getOwnerAddress()
  const { balance } = await get<{ balance: number }>(`/zorr/onchain-balance?owner=${encodeURIComponent(owner)}`)
  return balance ?? 0
}

/** Live AMM quote for a SOL→$ZORR buy: ZORR out, effective rate, price impact (0–1). */
export async function fetchZorrQuote(sol: number): Promise<{ got: number; rate: number; impact: number; spot: number }> {
  return get(`/zorr/quote?sol=${encodeURIComponent(sol)}`)
}

/** This wallet's $ZORR tx history (swaps, withdrawals, wagers, claims), newest first. */
export async function fetchZorrHistory(): Promise<ZorrEvent[]> {
  const owner = await getOwnerAddress()
  const { events } = await get<{ events: ZorrEvent[] }>(`/zorr/history?owner=${encodeURIComponent(owner)}`)
  return events ?? []
}

/** One-time starter $ZORR grant so a new player can wager without SOL. */
export async function claimZorrFaucet(): Promise<{ balance: number; granted: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/faucet', { owner })
}

/** Swap SOL → $ZORR on the constant-product AMM; the $ZORR is real + withdrawable.
 *  Pass `paidSig` (a Privy-signed SOL-transfer signature) for a real on-chain swap;
 *  omit it to let the devnet pool fund the SOL leg. */
export async function swapZorr(sol: number, paidSig?: string): Promise<{ balance: number; got: number; rate: number; impact?: number; spot?: number; paid?: boolean; sig?: string }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/swap', { owner, sol, paidSig })
}

/** Stake into a duel room's $ZORR pot. Both players must stake the same amount. */
export async function stakeWager(room: string, amount: number): Promise<{ balance: number; pot: number; stake: number; staked: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/wager/stake', { room, owner, amount })
}

/** Report a wager duel result; the pot pays the winner once both agree. */
export async function reportWager(room: string, won: boolean): Promise<{ settled: boolean; iWon?: boolean; won?: number; refunded?: boolean; balance?: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/wager/result', { room, owner, won })
}

/** Reclaim your stake if a wager duel never completed (opponent left). */
export async function cancelWager(room: string): Promise<{ refunded: number; balance: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/wager/cancel', { room, owner })
}

/** Stake into a solo (vs-AI) pot — the house matches you, so pot = 2×. */
export async function soloStake(amount: number): Promise<{ balance: number; pot: number; stake: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/wager/solo/stake', { owner, amount })
}

/** Settle a solo (vs-AI) wager: a win takes the whole pot (2×). */
export async function soloSettle(amount: number, won: boolean): Promise<{ balance: number; won: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/wager/solo/settle', { owner, amount, won })
}

/** Redeem the fast-ledger balance to the device wallet's real on-chain $ZORR account. */
export async function withdrawZorr(): Promise<{ signature: string; amount: number; explorer: string }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/withdraw', { owner })
}

/** Move on-chain $ZORR back into the spendable ledger — pass a signed transfer sig. */
export async function depositZorr(amount: number, sig: string): Promise<{ balance: number; deposited: number }> {
  const owner = await getOwnerAddress()
  return postJson('/zorr/deposit', { owner, amount, sig })
}
