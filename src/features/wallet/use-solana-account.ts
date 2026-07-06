import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'

/**
 * Surfaces the user's Privy embedded Solana wallet as a simple account object.
 * `address` is the base58 public key once a wallet exists.
 */
export function useSolanaAccount() {
  const { user, isReady } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const wallet = solana?.wallets?.[0]

  return {
    isReady,
    isLoggedIn: !!user,
    address: wallet?.address as string | undefined,
    wallet,
    status: solana?.status,
    // Create an embedded Solana wallet if the logged-in user doesn't have one yet.
    create: solana?.create,
  }
}
