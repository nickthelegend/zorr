import { address as toAddress, createSolanaRpc } from '@solana/kit'
import { useQuery } from '@tanstack/react-query'

// Base-layer Solana devnet RPC (MagicBlock ER uses a separate endpoint, added later).
export const DEVNET_RPC = 'https://api.devnet.solana.com'

const rpc = createSolanaRpc(DEVNET_RPC)

/** Live SOL balance (in SOL) for an address, polled every 15s. */
export function useDevnetBalance(addr?: string) {
  return useQuery({
    queryKey: ['devnet-balance', addr],
    enabled: !!addr,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { value } = await rpc.getBalance(toAddress(addr as string)).send()
      return Number(value) / 1_000_000_000
    },
  })
}
