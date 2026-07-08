import { useCallback, useEffect, useRef, useState } from 'react'

import { useGame } from '../game/game-store'
import { claimGuardian, fetchOwned, fetchPool, getOwnerAddress, type OwnedBeast, type PoolStatus } from './nft'

/**
 * Loads the player's real owned Zorr Beast NFTs from the claim relay, feeds
 * their seeds into the game store (so battles use real owned Guardians), and
 * exposes the VRF claim action. Offline-safe: if the relay is unreachable the
 * app keeps its placeholder roster and surfaces `online: false`.
 */
export function useGuardians() {
  const game = useGame()
  const [owner, setOwner] = useState<string | null>(null)
  const [owned, setOwned] = useState<OwnedBeast[] | null>(null)
  const [pool, setPool] = useState<PoolStatus | null>(null)
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const syncedRef = useRef(false)

  const syncRoster = useCallback(
    (beasts: OwnedBeast[]) => {
      if (beasts.length > 0) game.setRoster(beasts.map((b) => b.seed))
    },
    [game],
  )

  const refresh = useCallback(async () => {
    try {
      const addr = await getOwnerAddress()
      setOwner(addr)
      const [list, p] = await Promise.all([fetchOwned(addr), fetchPool()])
      setOwned(list)
      setPool(p)
      setOnline(true)
      if (!syncedRef.current) {
        syncRoster(list)
        syncedRef.current = true
      } else {
        syncRoster(list)
      }
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [syncRoster])

  useEffect(() => {
    refresh()
  }, [refresh])

  const claim = useCallback(async () => {
    setClaiming(true)
    setError(null)
    try {
      const addr = owner ?? (await getOwnerAddress())
      const { beast } = await claimGuardian(addr)
      const next = [...(owned ?? []), beast]
      setOwned(next)
      game.setRoster(
        next.map((b) => b.seed),
        beast.seed,
      )
      fetchPool().then(setPool).catch(() => {})
      return beast
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed')
      return null
    } finally {
      setClaiming(false)
    }
  }, [owner, owned, game])

  return { owner, owned, pool, online, loading, claiming, error, claim, refresh }
}
