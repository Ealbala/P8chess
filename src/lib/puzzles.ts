// Puzzle set: a subset of the Lichess puzzle database (CC0), built by scripts/build_puzzles.py.
// Lichess format: `fen` is the position BEFORE the opponent's move; moves[0] is the
// opponent's move, then the solver and opponent alternate.
import type { PuzzleAttempt } from './db'
import { addDays } from './dates'

export type PuzzleCat = 'tactics' | 'calculation' | 'endgame'

export interface Puzzle {
  id: string
  fen: string
  moves: string[]
  rating: number
  themes: string[]
  cat: PuzzleCat
}

let cache: Promise<Puzzle[]> | null = null

export function loadPuzzles(): Promise<Puzzle[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/puzzles.json`).then((r) => {
    if (!r.ok) throw new Error('Could not load puzzles')
    return r.json()
  })
  return cache
}

/**
 * Picks the next puzzle for a category.
 * 1. Puzzles you failed at least 1 day ago come back first (simple spaced review).
 * 2. Otherwise an unseen puzzle close to your practice rating (window widens if needed).
 * 3. For tactics, ~40% of the time we prefer one of your weakest themes.
 */
export function pickPuzzle(
  all: Puzzle[],
  cat: PuzzleCat,
  rating: number,
  attempts: PuzzleAttempt[],
  weakThemes: string[],
  exclude: Set<string> = new Set(),
): Puzzle | null {
  const pool = all.filter((p) => p.cat === cat && !exclude.has(p.id))
  const byId = new Map<string, PuzzleAttempt[]>()
  attempts.forEach((a) => byId.set(a.puzzleId, [...(byId.get(a.puzzleId) ?? []), a]))

  const yesterday = addDays(new Date(), -1).toISOString()
  const due = pool.filter((p) => {
    const list = byId.get(p.id)
    if (!list) return false
    const last = list.reduce((x, y) => (x.date > y.date ? x : y))
    return !last.correct && last.date <= yesterday
  })
  if (due.length) return due[Math.floor(Math.random() * due.length)]

  const unseen = pool.filter((p) => !byId.has(p.id))
  let candidates: Puzzle[] = []
  for (const w of [100, 200, 350, 600, 2000]) {
    candidates = unseen.filter((p) => Math.abs(p.rating - rating) <= w)
    if (candidates.length >= 5) break
  }
  if (!candidates.length) candidates = pool // everything seen: allow repeats
  if (!candidates.length) return null

  if (cat === 'tactics' && weakThemes.length && Math.random() < 0.4) {
    const weak = candidates.filter((p) => p.themes.some((t) => weakThemes.includes(t)))
    if (weak.length) candidates = weak
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}
