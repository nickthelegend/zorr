import { rankBoard, type Runner } from '../leaderboard'

const others: Runner[] = [
  { owner: 'A1', name: 'Nova', color: '#38BDF8', km2: 4.2 },
  { owner: 'B2', name: 'Drift', color: '#F43F5E', km2: 1.1 },
  { owner: 'C3', name: 'Kite', color: '#FBBF24', km2: 2.7 },
]

describe('rankBoard (real players only)', () => {
  it('merges you with relay players and sorts by km² descending', () => {
    const board = rankBoard({ owner: 'ME', name: 'Me', color: '#fff', km2: 3 }, others)
    expect(board).toHaveLength(4)
    expect(board.find((r) => r.you)?.name).toBe('Me')
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].km2).toBeGreaterThanOrEqual(board[i].km2)
    }
  })

  it('replaces the relay copy of you with fresher local numbers', () => {
    const withMe = [...others, { owner: 'ME', name: 'Me (stale)', color: '#fff', km2: 0.1 }]
    const board = rankBoard({ owner: 'ME', name: 'Me', color: '#fff', km2: 9 }, withMe)
    expect(board.filter((r) => r.owner === 'ME')).toHaveLength(1)
    expect(board[0].you).toBe(true)
    expect(board[0].km2).toBe(9)
  })

  it('works with an empty relay list (offline / first player)', () => {
    const board = rankBoard({ owner: 'ME', name: 'Me', color: '#fff', km2: 0 }, [])
    expect(board).toHaveLength(1)
    expect(board[0].you).toBe(true)
  })

  it('includes exactly one you-row', () => {
    const board = rankBoard({ owner: 'ME', name: 'Me', color: '#fff', km2: 3 }, others)
    expect(board.filter((r) => r.you)).toHaveLength(1)
  })

  it('ranks a zero score last among real players', () => {
    const board = rankBoard({ owner: 'ME', name: 'Me', color: '#fff', km2: 0 }, others)
    expect(board[board.length - 1].you).toBe(true)
  })
})
