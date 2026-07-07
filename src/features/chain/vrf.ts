import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit'

import { ZORR_PROGRAM } from './er'
import { base64ToBytes, parseVrfSeed } from './vrf-seed'

// MagicBlock VRF on Solana devnet base layer. The Zorr program CPIs the oracle
// queue; the oracle writes verifiable randomness back into a scoped PDA.
const DEVNET_RPC = 'https://api.devnet.solana.com'
const DEFAULT_QUEUE = 'Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh'
const VRF_PROGRAM = 'Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz'
const SLOT_HASHES = 'SysvarS1otHashes111111111111111111111111111'
const SYSTEM_PROGRAM = '11111111111111111111111111111111'
// anchor discriminator for `request_seed` (from the IDL).
const REQUEST_SEED_DISC = new Uint8Array([162, 96, 174, 50, 178, 77, 115, 152])

let signerPromise: Promise<KeyPairSigner> | null = null
function getSigner() {
  if (!signerPromise) {
    const raw = process.env.EXPO_PUBLIC_ZORR_SIGNER_SECRET
    if (!raw) throw new Error('Missing EXPO_PUBLIC_ZORR_SIGNER_SECRET')
    signerPromise = createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(raw) as number[]))
  }
  return signerPromise
}

async function pda(...seeds: Uint8Array[]) {
  const [addr] = await getProgramDerivedAddress({ programAddress: address(ZORR_PROGRAM), seeds })
  return addr as string
}
const seedPdaFor = (scope: Uint8Array) => pda(new TextEncoder().encode('vrfseed'), scope)
const identityPda = () => pda(new TextEncoder().encode('identity'))

/** Poll the scoped VrfSeed PDA until the oracle has written a result. */
export async function awaitVrfSeed(scope: Uint8Array, timeoutMs = 30_000): Promise<Uint8Array> {
  const rpc = createSolanaRpc(DEVNET_RPC)
  const seedPda = await seedPdaFor(scope)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 750))
    try {
      const { value } = await rpc.getAccountInfo(address(seedPda), { encoding: 'base64' }).send()
      const raw = value?.data
      if (!raw) continue
      const b64 = Array.isArray(raw) ? raw[0] : (raw as unknown as string)
      const parsed = parseVrfSeed(base64ToBytes(b64))
      if (parsed?.fulfilled) return parsed.seed
    } catch {
      // transient RPC error — keep polling
    }
  }
  throw new Error('VRF seed was not fulfilled in time')
}

/**
 * Request MagicBlock VRF for `scope`, then wait for the oracle callback and
 * return the 32-byte verifiable seed. Used for provably-fair summons (random
 * scope) and trustless battle seeds (room-derived scope, shared by both peers).
 */
export async function requestVrfSeed(
  scope: Uint8Array,
  clientSeed = Math.floor(Math.random() * 256),
): Promise<{ seed: Uint8Array; signature: string }> {
  const signer = await getSigner()
  const rpc = createSolanaRpc(DEVNET_RPC)
  const seedPda = await seedPdaFor(scope)
  const identity = await identityPda()
  const { value: blockhash } = await rpc.getLatestBlockhash().send()

  const data = new Uint8Array(8 + 16 + 1)
  data.set(REQUEST_SEED_DISC, 0)
  data.set(scope.slice(0, 16), 8)
  data[24] = clientSeed & 0xff

  // Account order must match the compiled program (see regenerated IDL).
  const instruction = {
    programAddress: address(ZORR_PROGRAM),
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: address(seedPda), role: AccountRole.WRITABLE },
      { address: address(DEFAULT_QUEUE), role: AccountRole.WRITABLE },
      { address: address(SYSTEM_PROGRAM), role: AccountRole.READONLY },
      { address: address(identity), role: AccountRole.READONLY },
      { address: address(VRF_PROGRAM), role: AccountRole.READONLY },
      { address: address(SLOT_HASHES), role: AccountRole.READONLY },
    ],
    data,
  }

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  )
  const signed = await signTransactionMessageWithSigners(message)
  const signature = getSignatureFromTransaction(signed)
  const wire = getBase64EncodedWireTransaction(signed)
  await rpc.sendTransaction(wire, { encoding: 'base64', skipPreflight: true, preflightCommitment: 'confirmed', maxRetries: 5n }).send()

  const seed = await awaitVrfSeed(scope)
  return { seed, signature }
}
