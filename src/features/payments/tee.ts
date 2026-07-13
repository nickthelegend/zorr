import {
  delegateSpl,
  getAuthToken,
  GetCommitmentSignature,
  transferSpl,
  undelegateIx,
  withdrawSpl,
} from '@magicblock-labs/ephemeral-rollups-sdk'
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import nacl from 'tweetnacl'

// REAL MagicBlock Ephemeral Rollup + TEE integration for $ZORR private payments.
// Proven end-to-end on devnet: delegate a $ZORR token account to the TEE ER,
// transfer privately inside the rollup (visibility:"private"), then undelegate
// back to the base layer. No custom program — the SDK uses MagicBlock's
// pre-deployed ephemeral SPL-token program. See magicblock-private-payments memory.

export const BASE_RPC = 'https://api.devnet.solana.com'
export const TEE_RPC = 'https://devnet-tee.magicblock.app'
export const TEE_WS = 'wss://devnet-tee.magicblock.app'
export const TEE_VALIDATOR = new PublicKey('MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo')
export const ZORR_MINT = new PublicKey('G8iBAC71bd3ikwGQrKUcFUrZ2ZpSxXbXg42NncASUxAL')
export const ZORR_DECIMALS = 9

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

/** Associated token account for (owner, mint) — derived without @solana/spl-token. */
export function ataFor(owner: PublicKey, mint: PublicKey = ZORR_MINT): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ATA_PROGRAM_ID)[0]
}

const units = (whole: number) => BigInt(Math.max(0, Math.floor(whole))) * BigInt(10 ** ZORR_DECIMALS)
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

let baseConn: Connection | null = null
function base(): Connection {
  return (baseConn ??= new Connection(BASE_RPC, 'confirmed'))
}

// Cache the TEE auth token + ER connection per wallet (the JWT is long-lived, and
// getAuthToken is an HTTP+sign round-trip we don't want on every balance refresh).
const erCache = new Map<string, Connection>()
async function teeConnection(kp: Keypair): Promise<Connection> {
  const key = kp.publicKey.toBase58()
  const cached = erCache.get(key)
  if (cached) return cached
  const auth = await getAuthToken(TEE_RPC, kp.publicKey, (m: Uint8Array) => Promise.resolve(nacl.sign.detached(m, kp.secretKey)))
  const conn = new Connection(`${TEE_RPC}?token=${auth.token}`, {
    wsEndpoint: `${TEE_WS}?token=${auth.token}`,
    commitment: 'confirmed',
  })
  erCache.set(key, conn)
  return conn
}

async function signSend(conn: Connection, kp: Keypair, ixs: any[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction()
  tx.feePayer = kp.publicKey
  tx.recentBlockhash = blockhash
  tx.add(...ixs)
  tx.sign(kp)
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 })
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed').catch(() => {})
  return sig
}

/**
 * Shield: delegate `whole` $ZORR from the base ATA into the MagicBlock TEE
 * Ephemeral Rollup. Returns the base-layer delegation tx signature.
 */
export async function teeShield(kp: Keypair, whole: number, initVaultIfMissing = true): Promise<string> {
  const ixs = await delegateSpl(kp.publicKey, ZORR_MINT, units(whole), {
    validator: TEE_VALIDATOR,
    idempotent: false,
    payer: kp.publicKey,
    initVaultIfMissing,
  })
  return signSend(base(), kp, ixs)
}

/**
 * Private send: transfer `whole` $ZORR to `to` INSIDE the TEE rollup. With
 * visibility "private" the transfer's logs/amounts are TEE-gated. Requires the
 * recipient's $ZORR account to also be delegated to the ER.
 */
export async function teeSend(kp: Keypair, to: string, whole: number, priv: boolean): Promise<string> {
  const er = await teeConnection(kp)
  const ixs = await transferSpl(kp.publicKey, new PublicKey(to), ZORR_MINT, units(whole), {
    visibility: priv ? 'private' : 'public',
    fromBalance: 'ephemeral',
    toBalance: 'ephemeral',
  })
  return signSend(er, kp, ixs)
}

/**
 * Withdraw: undelegate the $ZORR from the ER, wait for the commit to land on the
 * base layer, then reclaim the tokens from the escrow vault back into the base
 * ATA (withdrawSpl). Returns the base-layer withdraw tx signature + the whole
 * amount reclaimed (so the caller can return it to the game ledger).
 */
export async function teeWithdraw(kp: Keypair): Promise<{ signature: string; whole: number }> {
  const er = await teeConnection(kp)
  const ata = ataFor(kp.publicKey)
  // Capture the ER balance first — this is what we reclaim (undelegate zeroes it).
  let amount = 0n
  try {
    amount = BigInt((await er.getTokenAccountBalance(ata)).value.amount)
  } catch {
    // not delegated
  }
  // 1. undelegate on the ER, 2. wait for the commit to settle on base.
  const erSig = await signSend(er, kp, [undelegateIx(kp.publicKey, ZORR_MINT)])
  try {
    const commit = await GetCommitmentSignature(erSig, er)
    await base().confirmTransaction(commit, 'confirmed')
  } catch {
    // best-effort; the withdraw below still needs the base account released
  }
  const whole = Number(amount / BigInt(10 ** ZORR_DECIMALS))
  // 3. pull the tokens out of the escrow vault back to the base ATA.
  if (amount > 0n) {
    const ixs = await withdrawSpl(kp.publicKey, ZORR_MINT, amount, { idempotent: false })
    const sig = await signSend(base(), kp, ixs)
    return { signature: sig, whole }
  }
  return { signature: erSig, whole }
}

/** Transfer `whole` $ZORR from the PP wallet's base ATA to the treasury (real tx). */
export async function teeTransferToTreasury(kp: Keypair, treasury: PublicKey, whole: number): Promise<string> {
  const src = ataFor(kp.publicKey)
  const dst = ataFor(treasury)
  const data = Buffer.alloc(9)
  data.writeUInt8(3, 0) // SPL Token: Transfer
  data.writeBigUInt64LE(units(whole), 1)
  const ix = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: src, isSigner: false, isWritable: true },
      { pubkey: dst, isSigner: false, isWritable: true },
      { pubkey: kp.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })
  return signSend(base(), kp, [ix])
}

/** Public (base) + shielded (delegated-on-ER) $ZORR balances, in whole tokens. */
export async function teeBalances(kp: Keypair): Promise<{ base: number; shielded: number }> {
  const ata = ataFor(kp.publicKey)
  let baseBal = 0
  let shielded = 0
  try {
    baseBal = (await base().getTokenAccountBalance(ata)).value.uiAmount ?? 0
  } catch {
    // ATA may not exist yet, or is delegated (owned by the delegation program).
  }
  try {
    const er = await teeConnection(kp)
    shielded = (await er.getTokenAccountBalance(ata)).value.uiAmount ?? 0
  } catch {
    // Not delegated yet.
  }
  // When nothing is delegated, the ER read just mirrors the base balance — treat
  // that as 0 shielded so the UI doesn't show funds as "shielded" before a shield.
  const shieldedFloor = baseBal > 0 && Math.floor(shielded) === Math.floor(baseBal) ? 0 : Math.floor(shielded)
  return { base: Math.floor(baseBal), shielded: shieldedFloor }
}
