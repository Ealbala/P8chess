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
