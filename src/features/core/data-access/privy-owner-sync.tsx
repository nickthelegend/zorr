import { useEffect } from 'react'

import { setPrivyOwner } from '../../nft/nft'
import { useSolanaAccount } from '../../wallet/use-solana-account'

/**
 * Points $ZORR + Guardian-NFT ownership at the signed-in Privy embedded wallet
 * the moment it resolves — so every asset belongs to the user's real wallet, not
 * a per-device temp key. Renders nothing; must live inside PrivyProvider.
 */
export function PrivyOwnerSync() {
  const { address } = useSolanaAccount()
  useEffect(() => {
    if (address) setPrivyOwner(address)
  }, [address])
  return null
}
