import { describe, expect, it } from 'vitest'
import { findTrack, inTrack } from '../../data/tracks'
import { pickForTracks, trackHistory, trackStats, weakestTracks } from '../training'
import type { PuzzleAttempt } from '../db'
import type { Puzzle } from '../puzzles'

const att = (themes: string[], correct: boolean, rating = 1500, extra: Partial<PuzzleAttempt> = {}): PuzzleAttempt => ({
  puzzleId: Math.random().toString(36), date: new Date().toISOString(), day: '2026-10-25', cat: 'tactics', correct, rating, themes, seconds: 10, ...extra,
})

describe('training sections', () => {
  const forks = findTrack('forks')!
  const pawns = findTrack('pawns')!

  it('assigns puzzles to sections by theme or category', () => {
    expect(inTrack(forks, { cat: 'tactics', themes: ['fork', 'short'] })).toBe(true)
    expect(inTrack(pawns, { cat: 'endgame', themes: ['promotion'] })).toBe(true)
    expect(inTrack(findTrack('endgame')!, { cat: 'endgame', themes: [] })).toBe(true)
    expect(inTrack(forks, { cat: 'tactics', themes: ['pin'] })).toBe(false)
  })

  it('rates a section: up when solving at the first try, down when failing; rush excluded', () => {
    expect(trackStats(forks, [att(['fork'], true), att(['fork'], true)]).rating).toBeGreaterThan(1500)
    expect(trackStats(forks, [att(['fork'], false)]).rating).toBeLessThan(1500)
    expect(trackHistory(forks, [att(['fork'], true, 1500, { rush: true })])).toHaveLength(0)
  })

  it('finds what I do worst among rated sections', () => {
    const attempts = [...Array(12)].map(() => att(['fork'], false)).concat([...Array(12)].map(() => att(['pin'], true)))
    expect(weakestTracks(attempts, 1)[0].id).toBe('forks')
  })

  it('picks unseen puzzles of the section close to the target rating', () => {
    const p = (id: string, rating: number, themes: string[]): Puzzle => ({ id, fen: '', moves: [], rating, themes, cat: 'tactics' })
    const all = [p('a', 1500, ['fork']), p('b', 2200, ['fork']), p('c', 1500, ['pin'])]
    expect(pickForTracks(all, [forks], 1520, new Set(), [])!.id).toBe('a')
    expect(pickForTracks(all, [forks], 1520, new Set(['a']), [])!.id).toBe('b')
  })
})

describe('monthly exam', async () => {
  const { performance, pickExam } = await import('../exam')
  it('computes a performance rating', () => {
    expect(performance([1500, 1500], [true, false])).toBe(1500)
    expect(performance([1500, 1500, 1500, 1500], [true, true, true, false])).toBeGreaterThan(1600)
    expect(performance([1200, 1800], [false, false])).toBe(800)
  })
  it('picks 20 unseen puzzles over five levels, the same for the same month', () => {
    const all: Puzzle[] = []
    for (let r = 900; r <= 2100; r += 10) for (const cat of ['tactics', 'endgame'] as const) all.push({ id: `${cat}${r}`, fen: '', moves: [], rating: r, themes: [], cat })
    const a = pickExam(all, [att([], true, 1100, { puzzleId: 'tactics1100' })], '2026-10')
    expect(a).toHaveLength(20)
    expect(a.some((p) => p.id === 'tactics1100')).toBe(false)
    expect(pickExam(all, [], '2026-10').map((p) => p.id)).toEqual(pickExam(all, [], '2026-10').map((p) => p.id))
  })
})

describe('opening explorer (your games)', async () => {
  const { buildGameIndex, movesFromIndex } = await import('../explorer')
  it('counts moves and results from the mover\'s point of view', () => {
    const g = (pgn: string, result: 'win' | 'loss' | 'draw', color: 'white' | 'black') =>
      ({ date: '', tc: 'rapid', result, color, source: 'chesscom', reviewed: false, pgn }) as const
    const index = buildGameIndex([g('1. d4 d5 2. Nf3', 'win', 'white'), g('1. d4 Nf6', 'loss', 'white'), g('1. e4 e6', 'draw', 'black')])
    const start = movesFromIndex(index, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(start[0]).toMatchObject({ san: 'd4', games: 2, win: 50, loss: 50 })
    expect(start[1]).toMatchObject({ san: 'e4', games: 1, draw: 100 })
  })
})
