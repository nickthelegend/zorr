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

import { encodeCaptureTileData } from './encode'

// Deployed Zorr territory program + MagicBlock devnet Ephemeral Rollup endpoint.
export const ZORR_PROGRAM = 'BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F'
const ER_RPC = 'https://devnet-as.magicblock.app'

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
  const data = encodeCaptureTileData(tileX, tileY)
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

// The MagicBlock commit accounts injected by the program's `#[commit]` macro
// (fixed addresses; discriminator from onchain/idl/zorr.json).
const COMMIT_DISCRIMINATOR = new Uint8Array([223, 140, 142, 165, 229, 208, 156, 74])
const MAGIC_PROGRAM = 'Magic11111111111111111111111111111111111111'
const MAGIC_CONTEXT = 'MagicContext1111111111111111111111111111111'

/**
 * Commit the ER territory state back to the Solana devnet base layer — the
 * second half of the round-trip. Best-effort and called ONCE at run-end, AFTER
 * the tile captures already landed on the ER, so a failed/absent commit never
 * affects the fast gasless captures (returns null instead of throwing).
 */
export async function commitTerritoryFromER(): Promise<{ signature: string; ms: number } | null> {
  try {
    const signer = await getSigner()
    const territory = await getTerritoryPda()
    const rpc = createSolanaRpc(ER_RPC)
    const { value: blockhash } = await rpc.getLatestBlockhash().send()
    const instruction = {
      programAddress: address(ZORR_PROGRAM),
      accounts: [
        { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: address(territory), role: AccountRole.WRITABLE },
        { address: address(MAGIC_PROGRAM), role: AccountRole.READONLY },
        { address: address(MAGIC_CONTEXT), role: AccountRole.WRITABLE },
      ],
      data: COMMIT_DISCRIMINATOR,
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
  } catch {
    return null // best-effort — the captures already landed on the ER regardless
  }
}
