import { useEffect } from 'react'

import { clearPrivyOwner, setPrivyOwner } from '../../nft/nft'
import { useSolanaAccount } from '../../wallet/use-solana-account'

/**
 * Keeps $ZORR + Guardian-NFT ownership pointed at the CURRENTLY signed-in Privy
 * wallet. Uses the server-side account address (resolves the moment Privy has the
 * user, before the local embedded wallet finishes connecting) so switching to a
 * different account immediately re-keys assets — no stale wallet carried over.
 * On sign-out it clears the owner so the next login starts clean. Renders nothing;
 * must live inside PrivyProvider.
 */
export function PrivyOwnerSync() {
  const { address, accountAddress, isReady, isLoggedIn, status, recover, create } = useSolanaAccount()
  const owner = address ?? accountAddress ?? null

  // Bring the embedded wallet online app-wide so its address resolves promptly
  // after a fresh login (it comes back 'needs-recovery' / 'not-created' cold).
  useEffect(() => {
    if (!isLoggedIn) return
    if (status === 'needs-recovery' && recover) recover()?.catch?.(() => {})
    else if (status === 'not-created' && create) create()?.catch?.(() => {})
  }, [isLoggedIn, status, recover, create])

  useEffect(() => {
    if (owner) setPrivyOwner(owner)
    else if (isReady && !isLoggedIn) clearPrivyOwner() // only once Privy confirms no user
  }, [owner, isReady, isLoggedIn])

  return null
}
