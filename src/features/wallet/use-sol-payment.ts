import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

import { DEVNET_RPC } from './use-devnet-balance'

type SolProvider = {
  signAndSendTransaction: (tx: Transaction, opts?: unknown) => Promise<{ signature?: string } | string>
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

  return { paySol, canPay }
}
