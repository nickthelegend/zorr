import * as SecureStore from 'expo-secure-store'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const KEY = 'zorr.game.v1'
const XP_PER_TILE = 50

export const EXPLORER_COLORS = ['#7C3AED', '#22D3A6', '#F43F5E', '#FBBF24', '#3B82F6', '#EC4899'] as const

type Persisted = { tiles: string[]; xp: number; bestStreak: number; name?: string; color?: string }

type GameState = {
  ready: boolean
  tiles: Set<string>
  xp: number
  level: number
  bestStreak: number
  name: string
  color: string
  hasTile: (key: string) => boolean
  addCapture: (key: string, combo: number) => number
  award: (xp: number) => void
  setIdentity: (name: string, color: string) => void
  reset: () => void
}

const GameContext = createContext<GameState | null>(null)

export function levelForXp(xp: number) {
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
  const [name, setName] = useState('Explorer')
  const [color, setColor] = useState<string>(EXPLORER_COLORS[0])

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY)
        if (raw) {
          const p = JSON.parse(raw) as Persisted
          setTiles(new Set(p.tiles ?? []))
          setXp(p.xp ?? 0)
          setBestStreak(p.bestStreak ?? 0)
          if (p.name) setName(p.name)
          if (p.color) setColor(p.color)
        }
      } catch {
        // ignore
      } finally {
        setReady(true)
      }
    })()
  }, [])

  // Auto-persist any change once loaded.
  useEffect(() => {
    if (!ready) return
    const data: Persisted = { tiles: [...tiles], xp, bestStreak, name, color }
    SecureStore.setItemAsync(KEY, JSON.stringify(data)).catch(() => {})
  }, [ready, tiles, xp, bestStreak, name, color])

  const comboRef = useRef(0)

  const addCapture = useCallback(
    (key: string, combo: number) => {
      const award = XP_PER_TILE * Math.max(1, combo)
      setTiles((prev) => new Set(prev).add(key))
      setXp((x) => x + award)
      comboRef.current = combo
      setBestStreak((b) => Math.max(b, combo))
      return award
    },
    [],
  )

  const value = useMemo<GameState>(() => {
    const { level } = levelForXp(xp)
    return {
      ready,
      tiles,
      xp,
      level,
      bestStreak,
      name,
      color,
      hasTile: (key) => tiles.has(key),
      addCapture,
      award: (amount) => setXp((x) => x + Math.max(0, amount)),
      setIdentity: (n, c) => {
        setName(n.trim() || 'Explorer')
        setColor(c)
      },
      reset: () => {
        setTiles(new Set())
        setXp(0)
        setBestStreak(0)
      },
    }
  }, [ready, tiles, xp, bestStreak, name, color, addCapture])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
