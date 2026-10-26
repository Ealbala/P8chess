// Monthly exam: 20 puzzles you have never seen, 4 at each of five levels, one try each,
// no hints. The result is a "performance rating": the rating R at which the expected score
// (Elo formula) against those puzzles equals your actual score.
import type { PuzzleAttempt } from './db'
import type { Puzzle } from './puzzles'

export const EXAM_LEVELS = [1100, 1300, 1500, 1700, 1900]
export const PER_LEVEL = 4

/** Small deterministic random generator so a month's exam is stable once created. */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function pickExam(all: Puzzle[], attempts: PuzzleAttempt[], month: string): Puzzle[] {
  const seen = new Set(attempts.map((a) => a.puzzleId))
  const rand = rng(month)
  const out: Puzzle[] = []
  for (const level of EXAM_LEVELS) {
    const pool = all.filter((p) => !seen.has(p.id) && Math.abs(p.rating - level) <= 100 && !out.includes(p))
    // Mix categories: take puzzles round-robin from each category.
    const byCat = new Map<string, Puzzle[]>()
    for (const p of pool.sort(() => rand() - 0.5)) byCat.set(p.cat, [...(byCat.get(p.cat) ?? []), p])
    const cats = [...byCat.keys()].sort(() => rand() - 0.5)
    for (let i = 0; out.filter((p) => Math.abs(p.rating - level) <= 100).length < PER_LEVEL && i < 50; i++) {
      const list = byCat.get(cats[i % cats.length])
      const p = list?.shift()
      if (p) out.push(p)
    }
  }
  return out
}

/** Performance rating for results against puzzles of the given ratings. */
export function performance(ratings: number[], results: boolean[]): number {
  const score = results.filter(Boolean).length
  if (!ratings.length) return 0
  if (score === 0) return Math.min(...ratings) - 400
  if (score === ratings.length) return Math.max(...ratings) + 400
  let lo = 0
  let hi = 4000
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const expected = ratings.reduce((s, r) => s + 1 / (1 + 10 ** ((r - mid) / 400)), 0)
    if (expected < score) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
