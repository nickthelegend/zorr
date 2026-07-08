import { generateKeyPairSigner } from '@solana/kit'
import * as SecureStore from 'expo-secure-store'

// Talks to the Zorr Beasts claim relay (server/../nft/src/claim-relay.mjs). Set
// EXPO_PUBLIC_CLAIM_RELAY_URL to a running relay; emulator default 10.0.2.2:8790.
export const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'

const OWNER_KEY = 'zorr.owner.address'

// The per-device wallet address that owns this player's claimed Guardian NFTs.
// Generated once and persisted; the relay drops NFTs to it. (Battle is off-chain
// so no signing is needed in-app; a Privy/connected wallet can replace this.)
let ownerPromise: Promise<string> | null = null
export function getOwnerAddress(): Promise<string> {
  if (!ownerPromise) {
    ownerPromise = (async () => {
      const existing = await SecureStore.getItemAsync(OWNER_KEY)
      if (existing) return existing
      const signer = await generateKeyPairSigner()
      await SecureStore.setItemAsync(OWNER_KEY, signer.address)
      return signer.address
    })()
  }
  return ownerPromise
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
