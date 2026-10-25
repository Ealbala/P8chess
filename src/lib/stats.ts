// Pure functions that turn stored records into the numbers shown in the app.
// Every metric here has a plain definition (see comments) — nothing is invented.
import type { DrillSession, Game, PuzzleAttempt, RatingEntry, Settings, TimeControl } from './db'
import { addDays, dayKey, parseDay, weekStart } from './dates'

/** Latest recorded rating for a time control, or the starting rating. */
export function currentRating(ratings: RatingEntry[], settings: Settings, tc: TimeControl): number {
  const list = ratings.filter((r) => r.tc === tc).sort((a, b) => a.date.localeCompare(b.date))
  return list.length ? list[list.length - 1].rating : settings.startRatings[tc]
}

/** Rating change over the last `days` days (null if there is no data point that old). */
export function ratingChange(ratings: RatingEntry[], tc: TimeControl, days: number, now = new Date()): number | null {
  const list = ratings.filter((r) => r.tc === tc).sort((a, b) => a.date.localeCompare(b.date))
  if (list.length < 2) return null
  const cutoff = addDays(now, -days).toISOString()
  const before = list.filter((r) => r.date <= cutoff)
  const base = before.length ? before[before.length - 1] : list[0]
  return list[list.length - 1].rating - base.rating
}

/** Next milestone above the current rating, or the last one if all are reached. */
export function nextMilestone(milestones: number[], rating: number): number | null {
  const sorted = [...milestones].sort((a, b) => a - b)
  if (!sorted.length) return null
  return sorted.find((m) => m > rating) ?? sorted[sorted.length - 1]
}

/** Days with at least one training action (puzzle, drill or game review). */
export function trainedDays(attempts: PuzzleAttempt[], drills: DrillSession[], games: Game[]): Set<string> {
  const s = new Set<string>()
  attempts.forEach((a) => s.add(a.day))
  drills.forEach((d) => s.add(d.day))
  games.forEach((g) => g.reviewedAt && s.add(dayKey(new Date(g.reviewedAt))))
  return s
}

/**
 * Training streak: consecutive days with training.
 * Forgiving rule: one missed day per calendar week (Mon–Sun) does not break the streak
 * (it just doesn't add to it). Not having trained *yet* today never breaks it.
 */
export function streak(days: Set<string>, today = new Date()): number {
  let d = days.has(dayKey(today)) ? today : addDays(today, -1)
  let count = 0
  let lastWasRest = false
  const restWeeks = new Set<string>()
  for (let i = 0; i < 3650; i++) {
    if (days.has(dayKey(d))) {
      count++
      lastWasRest = false
    } else {
      const wk = dayKey(weekStart(d))
      if (lastWasRest || restWeeks.has(wk)) break
      restWeeks.add(wk)
      lastWasRest = true
    }
    d = addDays(d, -1)
  }
  return count
}

export function bestStreak(days: Set<string>): number {
  const sorted = [...days].sort()
  let best = 0
  for (const k of sorted) {
    // Only evaluate streak ends (days whose next day isn't trained) to keep it cheap.
    if (!days.has(dayKey(addDays(parseDay(k), 1)))) best = Math.max(best, streak(days, parseDay(k)))
  }
  return best
}

/** Estimated training minutes: real time spent on puzzles and drills (game reviews not timed). */
export function trainingMinutes(attempts: PuzzleAttempt[], drills: DrillSession[], fromDay?: string): number {
  const sec =
    attempts.filter((a) => !fromDay || a.day >= fromDay).reduce((s, a) => s + Math.min(a.seconds, 600), 0) +
    drills.filter((d) => !fromDay || d.day >= fromDay).reduce((s, d) => s + d.seconds, 0)
  return Math.round(sec / 60)
}

/** XP rules: correct puzzle 10, missed puzzle 2, drill round 5 + 1 per correct answer, game review 15. */
export function totalXp(attempts: PuzzleAttempt[], drills: DrillSession[], games: Game[]): number {
  return (
    attempts.reduce((s, a) => s + (a.correct ? 10 : 2), 0) +
    drills.reduce((s, d) => s + 5 + d.correct, 0) +
    games.filter((g) => g.reviewed).length * 15
  )
}

/** Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000… */
export function levelFromXp(xp: number) {
  let level = 1
  while (50 * (level + 1) * level <= xp) level++
  const start = 50 * level * (level - 1)
  const next = 50 * (level + 1) * level
  return { level, progress: (xp - start) / (next - start), toNext: next - xp }
}

/**
 * In-app practice rating (NOT a chess.com or Lichess rating). Simple Elo update replayed
 * over all attempts, against each puzzle's Lichess rating. Starts at 1500.
 */
export function practiceRating(attempts: PuzzleAttempt[]): number {
  let r = 1500
  const sorted = [...attempts].sort((a, b) => a.date.localeCompare(b.date))
  sorted.forEach((a, i) => {
    const k = i < 20 ? 40 : 20
    const expected = 1 / (1 + 10 ** ((a.rating - r) / 400))
    r += k * ((a.correct ? 1 : 0) - expected)
  })
  return Math.round(r)
}

// Lichess themes that describe length/outcome rather than a tactical pattern.
const GENERIC_THEMES = new Set([
  'short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage', 'equality', 'middlegame',
  'opening', 'endgame', 'master', 'masterVsMaster', 'superGM', 'mate',
])

export interface ThemeStat {
  theme: string
  attempts: number
  correct: number
  accuracy: number
}

/** Accuracy per tactical theme. Only themes with at least `minAttempts` attempts are returned. */
export function themeStats(attempts: PuzzleAttempt[], minAttempts = 5): ThemeStat[] {
  const map = new Map<string, ThemeStat>()
  for (const a of attempts) {
    for (const t of a.themes) {
      if (GENERIC_THEMES.has(t)) continue
      const s = map.get(t) ?? { theme: t, attempts: 0, correct: 0, accuracy: 0 }
      s.attempts++
      if (a.correct) s.correct++
      map.set(t, s)
    }
  }
  return [...map.values()]
    .filter((s) => s.attempts >= minAttempts)
    .map((s) => ({ ...s, accuracy: s.correct / s.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy)
}

export function gamesInRange(games: Game[], from: Date, tc?: TimeControl) {
  const iso = from.toISOString()
  return games.filter((g) => g.date >= iso && (!tc || g.tc === tc))
}

export function record(games: Game[]) {
  return {
    win: games.filter((g) => g.result === 'win').length,
    loss: games.filter((g) => g.result === 'loss').length,
    draw: games.filter((g) => g.result === 'draw').length,
  }
}

/**
 * Weekly-games pace: how many games you "should" have played by now if the target
 * were spread evenly over the 7 days. Used for gentle reminders only.
 */
export function weeklyPace(target: number, played: number, now = new Date()) {
  const dayIndex = (now.getDay() + 6) % 7 // Monday = 0
  const expected = Math.floor((target * (dayIndex + 1)) / 7)
  // daysLeft includes today
  return { expected, behind: played < expected, remaining: Math.max(0, target - played), daysLeft: 7 - dayIndex }
}
