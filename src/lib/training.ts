// Training sections: a rating per section that moves with every puzzle you do there, so
// you can see if you are improving. Elo against each puzzle's Lichess rating, starting at
// 1500 (in-app estimate, not an official rating). Puzzle Rush attempts are excluded
// (they measure speed, not accuracy).
import type { PuzzleAttempt } from './db'
import { TRACKS, inTrack, type Track } from '../data/tracks'
import type { Puzzle } from './puzzles'
import { addDays } from './dates'
import { themeStats } from './stats'

export const START_RATING = 1500

function eloStep(r: number, puzzleRating: number, correct: boolean, k: number) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - r) / 400))
  return r + k * ((correct ? 1 : 0) - expected)
}

/** Rating after each attempt in the track (oldest first). */
export function trackHistory(track: Track, attempts: PuzzleAttempt[]): { date: string; rating: number }[] {
  let r = START_RATING
  return attempts
    .filter((a) => !a.rush && !a.puzzleId.startsWith('theory-') && !a.puzzleId.startsWith('strategy-') && inTrack(track, a))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a, i) => {
      r = eloStep(r, a.rating, a.correct, i < 15 ? 40 : 20)
      return { date: a.date, rating: Math.round(r) }
    })
}

export interface TrackStat {
  track: Track
  rating: number
  attempts: number
  accuracy: number // first-try accuracy over the last 30
  change7d: number | null
}

export function trackStats(track: Track, attempts: PuzzleAttempt[], now = new Date()): TrackStat {
  const h = trackHistory(track, attempts)
  const relevant = attempts.filter((a) => !a.rush && inTrack(track, a)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  const weekAgo = addDays(now, -7).toISOString()
  const before = h.filter((x) => x.date < weekAgo)
  const current = h.length ? h[h.length - 1].rating : START_RATING
  return {
    track,
    rating: current,
    attempts: h.length,
    accuracy: relevant.length ? relevant.filter((a) => a.correct).length / relevant.length : 0,
    change7d: h.length ? current - (before.length ? before[before.length - 1].rating : START_RATING) : null,
  }
}

export const allTrackStats = (attempts: PuzzleAttempt[]) => TRACKS.map((t) => trackStats(t, attempts))

/**
 * "What I do worst": the sections with the lowest rating among those with at least 10
 * attempts; before that, your weakest puzzle themes.
 */
export function weakestTracks(attempts: PuzzleAttempt[], n = 3): Track[] {
  const rated = allTrackStats(attempts).filter((s) => s.attempts >= 10).sort((a, b) => a.rating - b.rating)
  if (rated.length) return rated.slice(0, n).map((s) => s.track)
  const weakThemes = themeStats(attempts).slice(0, 3).map((s) => s.theme)
  const byTheme = TRACKS.filter((t) => t.themes?.some((th) => weakThemes.includes(th)))
  return byTheme.length ? byTheme.slice(0, n) : TRACKS.filter((t) => t.group === 'tactic').slice(0, n)
}

/** Puzzles of a track (or several), not yet seen in this session, close to a target rating. */
export function pickForTracks(
  all: Puzzle[],
  tracks: Track[],
  target: number,
  exclude: Set<string>,
  attempts: PuzzleAttempt[],
  window = 150,
): Puzzle | null {
  // Any puzzle already tried (right or wrong, rush included) is skipped while fresh ones remain.
  const done = new Set(attempts.map((a) => a.puzzleId))
  const pool = all.filter((p) => !exclude.has(p.id) && tracks.some((t) => inTrack(t, p)))
  const fresh = pool.filter((p) => !done.has(p.id))
  // A fresh puzzle a bit further from the target beats repeating one; repeats only when all are tried.
  for (const list of [fresh, pool]) {
    for (const w of [window, window * 2, 500, 3000]) {
      const near = list.filter((p) => Math.abs(p.rating - target) <= w)
      if (near.length) return near[Math.floor(Math.random() * near.length)]
    }
  }
  return null
}
