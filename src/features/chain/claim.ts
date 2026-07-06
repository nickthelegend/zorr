import { getAddMemoInstruction } from '@solana-program/memo'
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  type KeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit'

// Solana devnet (Stage 1). Stage 2 swaps this for the MagicBlock ER endpoint
// once the delegated tile-claim program is deployed.
const RPC_HTTP = 'https://api.devnet.solana.com'
const RPC_WS = 'wss://api.devnet.solana.com'

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

/** Sign + send a real on-chain tile-claim transaction. Returns the tx signature. */
export async function claimTileOnChain(tileKey: string, lat: number, lng: number): Promise<string> {
  const signer = await getSigner()
  const rpc = createSolanaRpc(RPC_HTTP)
  const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_WS)

  // Fast, deterministic unfunded check (fees ~5000 lamports).
  const { value: bal } = await rpc.getBalance(signer.address).send()
  if (bal < 10_000n) throw new UnfundedError('Zorr wallet needs devnet SOL')

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
  const memo = `ZORR|claim|${tileKey}|${lat.toFixed(5)},${lng.toFixed(5)}`

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(getAddMemoInstruction({ memo }), m),
  )

  const signed = await signTransactionMessageWithSigners(message)
  const signature = getSignatureFromTransaction(signed)

  try {
    const send = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })
    // `signed` uses a blockhash lifetime at runtime; the signer's return type widens it.
    await send(signed as Parameters<typeof send>[0], { commitment: 'confirmed' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/insufficient|debit an account|attempt to debit|simulation failed/i.test(msg)) {
      throw new UnfundedError('Zorr wallet needs devnet SOL')
    }
    throw e
  }

  return signature
}
