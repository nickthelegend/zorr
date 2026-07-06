import * as SecureStore from 'expo-secure-store'
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'zorr.game.v1'
const XP_PER_TILE = 50

type Persisted = { tiles: string[]; xp: number; bestStreak: number }

type GameState = {
  ready: boolean
  tiles: Set<string>
  xp: number
  level: number
  bestStreak: number
  hasTile: (key: string) => boolean
  /** Record a captured tile. Returns xp awarded (combo-boosted). */
  addCapture: (key: string, combo: number) => number
  reset: () => void
}

const GameContext = createContext<GameState | null>(null)

export function levelForXp(xp: number) {
  // Rising thresholds: level 1 at 0, then every 250*level xp.
  let level = 1
  let need = 250
  let acc = 0
  while (xp >= acc + need) {
    acc += need
    level += 1
    need = 250 * level
  }
  return { level, into: xp - acc, need }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [tiles, setTiles] = useState<Set<string>>(new Set())
  const [xp, setXp] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY)
        if (raw) {
          const p = JSON.parse(raw) as Persisted
          setTiles(new Set(p.tiles ?? []))
          setXp(p.xp ?? 0)
          setBestStreak(p.bestStreak ?? 0)
        }
      } catch {
        // ignore
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const persist = (next: Persisted) => {
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {})
  }

  const value = useMemo<GameState>(() => {
    const { level } = levelForXp(xp)
    return {
      ready,
      tiles,
      xp,
      level,
      bestStreak,
      hasTile: (key) => tiles.has(key),
      addCapture: (key, combo) => {
        const award = XP_PER_TILE * Math.max(1, combo)
        setTiles((prev) => {
          const next = new Set(prev).add(key)
          setXp((x) => {
            const nx = x + award
            setBestStreak((b) => {
              const nb = Math.max(b, combo)
              persist({ tiles: [...next], xp: nx, bestStreak: nb })
              return nb
            })
            return nx
          })
          return next
        })
        return award
      },
      reset: () => {
        setTiles(new Set())
        setXp(0)
        setBestStreak(0)
        SecureStore.deleteItemAsync(KEY).catch(() => {})
      },
    }
  }, [ready, tiles, xp, bestStreak])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
