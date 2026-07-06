import { getAddMemoInstruction } from '@solana-program/memo'
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit'

// Solana devnet (Stage 1). Stage 2 swaps this for the MagicBlock ER endpoint
// once the delegated tile-claim program is deployed.
const RPC_HTTP = 'https://api.devnet.solana.com'

let signerPromise: Promise<KeyPairSigner> | null = null
function getSigner() {
  if (!signerPromise) {
    const raw = process.env.EXPO_PUBLIC_ZORR_SIGNER_SECRET
    if (!raw) throw new Error('Missing EXPO_PUBLIC_ZORR_SIGNER_SECRET')
    const bytes = Uint8Array.from(JSON.parse(raw) as number[])
    signerPromise = createKeyPairSignerFromBytes(bytes)
  }
  return signerPromise
}

export async function getSignerAddress(): Promise<string> {
  return (await getSigner()).address
}

export function explorerTxUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`
}

export class UnfundedError extends Error {}

/** Sign + send a real on-chain memo transaction from the Zorr wallet. Returns the signature. */
async function sendMemoTx(memo: string): Promise<string> {
  const signer = await getSigner()
  const rpc = createSolanaRpc(RPC_HTTP)

  // Fast, deterministic unfunded check (fees ~5000 lamports).
  const { value: bal } = await rpc.getBalance(signer.address).send()
  if (bal < 10_000n) throw new UnfundedError('Zorr wallet needs devnet SOL')

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(getAddMemoInstruction({ memo }), m),
  )

  const signed = await signTransactionMessageWithSigners(message)
  const signature = getSignatureFromTransaction(signed)
  const wire = getBase64EncodedWireTransaction(signed)

  // Send over HTTP only — kit's sendAndConfirm relies on WebSocket subscriptions
  // and AbortSignal.throwIfAborted(), neither available under Hermes (RN).
  try {
    await rpc
      .sendTransaction(wire, { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 5n })
      .send()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/insufficient|debit an account|attempt to debit|simulation failed/i.test(msg)) {
      throw new UnfundedError('Zorr wallet needs devnet SOL')
    }
    throw e
  }

  // Light HTTP confirmation poll (no WebSocket/AbortSignal).
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 600))
    const { value } = await rpc.getSignatureStatuses([signature]).send()
    const status = value[0]
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') break
  }

  return signature
}

/** Log a single captured tile on-chain. */
export function claimTileOnChain(tileKey: string, lat: number, lng: number) {
  return sendMemoTx(`ZORR|claim|${tileKey}|${lat.toFixed(5)},${lng.toFixed(5)}`)
}

/** Log a completed run on-chain (distance, area captured, tile count). */
export function logRunOnChain(distanceKm: number, areaKm2: number, tileCount: number) {
  return sendMemoTx(`ZORR|run|${distanceKm.toFixed(2)}km|${areaKm2.toFixed(4)}km2|${tileCount}tiles`)
}
