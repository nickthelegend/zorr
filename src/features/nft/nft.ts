import { createKeyPairSignerFromPrivateKeyBytes, type KeyPairSigner } from '@solana/kit'
import * as SecureStore from 'expo-secure-store'

// Talks to the Zorr Beasts claim relay (server/../nft/src/claim-relay.mjs). Set
// EXPO_PUBLIC_CLAIM_RELAY_URL to a running relay; emulator default 10.0.2.2:8790.
export const CLAIM_RELAY_URL = process.env.EXPO_PUBLIC_CLAIM_RELAY_URL || 'http://10.0.2.2:8790'

const OWNER_SECRET_KEY = 'zorr.owner.secret' // 32-byte Ed25519 seed (JSON array)
const LEGACY_OWNER_KEY = 'zorr.owner.address' // pre-fix installs stored only the address

// The device's own Solana wallet — it holds this player's claimed Guardian NFTs.
// The 32-byte secret is generated once and kept in the OS keystore, so the wallet
// is recoverable and can actually SIGN for what it owns (not just a stranded
// address). The relay drops NFTs to it; getOwnerSigner() exposes it for on-chain
// moves. Legacy installs that only stored an address keep it for display continuity.
let ownerPromise: Promise<{ address: string; signer: KeyPairSigner | null }> | null = null
function loadOwner() {
  if (!ownerPromise) {
    ownerPromise = (async () => {
      const stored = await SecureStore.getItemAsync(OWNER_SECRET_KEY)
      if (stored) {
        const signer = await createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from(JSON.parse(stored) as number[]))
        return { address: signer.address, signer }
      }
      // Legacy device (old code discarded the key): keep the address so NFTs
      // already dropped there still resolve as owned — but it can't be signed for.
      const legacy = await SecureStore.getItemAsync(LEGACY_OWNER_KEY)
      if (legacy) return { address: legacy, signer: null }
      // Fresh device: mint a real, recoverable keypair and persist its secret.
      // crypto.getRandomValues comes from the react-native-quick-crypto polyfill
      // (src/polyfill.js) — the same global crypto @solana/kit already relies on.
      const secret = crypto.getRandomValues(new Uint8Array(32))
      const signer = await createKeyPairSignerFromPrivateKeyBytes(secret)
      await SecureStore.setItemAsync(OWNER_SECRET_KEY, JSON.stringify([...secret]))
      return { address: signer.address, signer }
    })()
  }
  return ownerPromise
}

/** The device wallet address that owns this player's claimed Guardian NFTs. */
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
