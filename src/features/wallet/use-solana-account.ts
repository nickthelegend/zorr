import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'

/**
 * The Privy embedded Solana wallet, with the FULL lifecycle surfaced:
 * status ∈ connecting | reconnecting | connected | disconnected | not-created |
 * creating | needs-recovery | error. `accountAddress` is the wallet as recorded
 * on the Privy account server-side (linked_accounts) — shown even while the
 * local device is still connecting/recovering, so the user can always see the
 * wallet exists.
 */
export function useSolanaAccount() {
  const { user, isReady } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const wallet = solana?.wallets?.[0]
  const status = (solana?.status ?? 'disconnected') as
    | 'connecting'
    | 'reconnecting'
    | 'connected'
    | 'disconnected'
    | 'not-created'
    | 'creating'
    | 'needs-recovery'
    | 'error'

  // Server-side record of the embedded Solana wallet on this Privy account.
  const accounts = (user as { linked_accounts?: { type?: string; chain_type?: string; address?: string }[] } | null)
    ?.linked_accounts
  const accountAddress = accounts?.find((a) => a.type === 'wallet' && a.chain_type === 'solana')?.address ?? null

  return {
    isReady,
    isLoggedIn: !!user,
    /** Address usable on THIS device (local wallet connected). */
    address: wallet?.address as string | undefined,
    /** Address recorded on the Privy account (may exist before local connect). */
    accountAddress,
    wallet,
    status,
    error: status === 'error' ? ((solana as { error?: string }).error ?? 'Unknown wallet error') : null,
    create: solana?.create,
    recover: (solana as { recover?: () => Promise<unknown> })?.recover,
  }
}
