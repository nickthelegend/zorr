import { buildLeaderboard } from '../leaderboard'

describe('leaderboard', () => {
  it('inserts you and sorts by km² descending', () => {
    const board = buildLeaderboard({ name: 'Me', color: '#fff', km2: 5 })
    expect(board.find((r) => r.you)?.name).toBe('Me')
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].km2).toBeGreaterThanOrEqual(board[i].km2)
    }
  })

  it('ranks a huge score first', () => {
    const board = buildLeaderboard({ name: 'X', color: '#fff', km2: 999 })
    expect(board[0].you).toBe(true)
  })

  it('ranks a zero score last', () => {
    const board = buildLeaderboard({ name: 'X', color: '#fff', km2: 0 })
    expect(board[board.length - 1].you).toBe(true)
  })

  it('includes exactly one you-row', () => {
    const board = buildLeaderboard({ name: 'X', color: '#fff', km2: 3 })
    expect(board.filter((r) => r.you)).toHaveLength(1)
  })
})
