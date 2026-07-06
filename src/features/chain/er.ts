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

// Deployed Zorr territory program + MagicBlock devnet Ephemeral Rollup endpoint.
export const ZORR_PROGRAM = 'BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F'
const ER_RPC = 'https://devnet-as.magicblock.app'
// Anchor discriminator for `capture_tile` (from the IDL).
const CAPTURE_TILE_DISC = new Uint8Array([4, 55, 84, 232, 142, 81, 238, 39])

let signerPromise: Promise<KeyPairSigner> | null = null
function getSigner() {
  if (!signerPromise) {
    const raw = process.env.EXPO_PUBLIC_ZORR_SIGNER_SECRET
    if (!raw) throw new Error('Missing EXPO_PUBLIC_ZORR_SIGNER_SECRET')
    signerPromise = createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(raw) as number[]))
  }
  return signerPromise
}

let territoryPromise: Promise<string> | null = null
function getTerritoryPda() {
  if (!territoryPromise) {
    territoryPromise = getProgramDerivedAddress({
      programAddress: address(ZORR_PROGRAM),
      seeds: [new TextEncoder().encode('territory')],
    }).then(([addr]) => addr as string)
  }
  return territoryPromise
}

function i64le(n: number): number[] {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigInt64(0, BigInt(Math.trunc(n)), true)
  return Array.from(b)
}

/**
 * Capture a tile on the MagicBlock Ephemeral Rollup (gasless, ~sub-second).
 * The territory PDA is delegated to the ER once (see onchain/tests/zorr-er.ts);
 * this sends `capture_tile` straight to the ER endpoint.
 */
export async function captureTileOnER(tileX: number, tileY: number): Promise<{ signature: string; ms: number }> {
  const signer = await getSigner()
  const territory = await getTerritoryPda()
  const rpc = createSolanaRpc(ER_RPC)

  const { value: blockhash } = await rpc.getLatestBlockhash().send()
  const data = new Uint8Array([...CAPTURE_TILE_DISC, ...i64le(tileX), ...i64le(tileY)])
  const instruction = {
    programAddress: address(ZORR_PROGRAM),
    accounts: [{ address: address(territory), role: AccountRole.WRITABLE }],
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

  const t = Date.now()
  await rpc.sendTransaction(wire, { encoding: 'base64', skipPreflight: true }).send()
  return { signature, ms: Date.now() - t }
}
