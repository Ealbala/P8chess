// Puzzle set: a subset of the Lichess puzzle database (CC0), built by scripts/build_puzzles.py.
// Lichess format: `fen` is the position BEFORE the opponent's move; moves[0] is the
// opponent's move, then the solver and opponent alternate.
import type { PuzzleAttempt } from './db'

export type PuzzleCat = 'tactics' | 'calculation' | 'middlegame' | 'endgame' | 'opening'

export interface Puzzle {
  id: string
  fen: string
  moves: string[]
  rating: number
  themes: string[]
  cat: PuzzleCat
  /** Opening ids (src/data/openings.ts) for "opening" puzzles. */
  openings?: string[]
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
  openingId?: string,
): Puzzle | null {
  const pool = all.filter((p) => p.cat === cat && !exclude.has(p.id) && (!openingId || p.openings?.includes(openingId)))
  // Never repeat on its own: puzzles already tried (in any mode) only come back when
  // you redo them from the history, or once the whole category is used up.
  const tried = new Set(attempts.map((a) => a.puzzleId))
  const unseen = pool.filter((p) => !tried.has(p.id))
  let candidates: Puzzle[] = []
  for (const w of [100, 200, 350, 600, 2000]) {
    candidates = unseen.filter((p) => Math.abs(p.rating - rating) <= w)
    if (candidates.length >= 5) break
  }
  if (!candidates.length) candidates = unseen.length ? unseen : pool // all tried: allow repeats
  if (!candidates.length) return null

  if (cat === 'tactics' && weakThemes.length && Math.random() < 0.4) {
    const weak = candidates.filter((p) => p.themes.some((t) => weakThemes.includes(t)))
    if (weak.length) candidates = weak
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}
