import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Buffer } from 'buffer'

import { DEVNET_RPC } from './use-devnet-balance'

type SolProvider = {
  signAndSendTransaction: (tx: Transaction, opts?: unknown) => Promise<{ signature?: string } | string>
}

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

/** Associated token account for (owner, mint) — derived without @solana/spl-token. */
function ataFor(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ATA_PROGRAM_ID)[0]
}

/**
 * Sign + send a REAL SOL transfer from the user's Privy embedded wallet to the
 * $ZORR treasury, so a swap is a genuine on-chain trade (verified relay-side)
 * rather than a pool-funded credit. Returns the tx signature, or null when the
 * embedded wallet can't sign / has no SOL — the caller then falls back to the
 * pool-funded path so the swap still succeeds.
 */
export function useSolPayment() {
  const solana = useEmbeddedSolanaWallet()
  const canPay = !!solana?.wallets?.[0]?.address

  const paySol = async (treasury: string, sol: number): Promise<string | null> => {
    try {
      const wallet = solana?.wallets?.[0]
      const getProvider = (wallet as { getProvider?: () => Promise<SolProvider> } | undefined)?.getProvider
      if (!wallet?.address || typeof getProvider !== 'function') return null

      const conn = new Connection(DEVNET_RPC, 'confirmed')
      const from = new PublicKey(wallet.address)
      const { blockhash } = await conn.getLatestBlockhash('confirmed')
      const tx = new Transaction()
      tx.feePayer = from
      tx.recentBlockhash = blockhash
      tx.add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: new PublicKey(treasury),
          lamports: Math.round(sol * 1_000_000_000),
        }),
      )

      const provider = await getProvider.call(wallet)
      const res = await provider.signAndSendTransaction(tx)
      return typeof res === 'string' ? res : (res?.signature ?? null)
    } catch {
      return null // no provider / insufficient SOL / user cancelled → pool-funded fallback
    }
  }

  /**
   * Sign + send a real $ZORR SPL transfer from the user's Privy wallet to the
   * treasury (on-chain → the spendable game ledger). Returns the tx signature,
   * or null if it can't sign / no tokens. Hand-builds the SPL Transfer ix so the
   * app needs no @solana/spl-token dependency.
   */
  const payZorr = async (mintStr: string, treasuryOwnerStr: string, amount: number, decimals: number): Promise<string | null> => {
    try {
      const wallet = solana?.wallets?.[0]
      const getProvider = (wallet as { getProvider?: () => Promise<SolProvider> } | undefined)?.getProvider
      if (!wallet?.address || typeof getProvider !== 'function') return null

      const conn = new Connection(DEVNET_RPC, 'confirmed')
      const from = new PublicKey(wallet.address)
      const mint = new PublicKey(mintStr)
      const src = ataFor(from, mint)
      const dst = ataFor(new PublicKey(treasuryOwnerStr), mint)

      const data = Buffer.alloc(9)
      data.writeUInt8(3, 0) // SPL Token: Transfer
      data.writeBigUInt64LE(BigInt(Math.round(amount * 10 ** decimals)), 1)
      const ix = new TransactionInstruction({
        programId: TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: src, isSigner: false, isWritable: true },
          { pubkey: dst, isSigner: false, isWritable: true },
          { pubkey: from, isSigner: true, isWritable: false },
        ],
        data,
      })

      const { blockhash } = await conn.getLatestBlockhash('confirmed')
      const tx = new Transaction()
      tx.feePayer = from
      tx.recentBlockhash = blockhash
      tx.add(ix)

      const provider = await getProvider.call(wallet)
      const res = await provider.signAndSendTransaction(tx)
      return typeof res === 'string' ? res : (res?.signature ?? null)
    } catch {
      return null
    }
  }

  return { paySol, payZorr, canPay }
}
