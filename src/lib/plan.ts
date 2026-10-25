// Today's Training: a fixed plan per day, built from the chosen duration.
// Progress is never ticked by hand — it is computed from what you actually did today.
import type { Activity, DrillSession, Game, PuzzleAttempt } from './db'
import { dayKey } from './dates'

export interface PlanItem {
  activity: Activity
  target: number // puzzles, drill rounds or reviews
}

const TABLE: Record<number, Omit<Record<Activity, number>, 'review'>> = {
  10: { tactics: 5, calculation: 0, endgame: 0, blindfold: 2 },
  20: { tactics: 5, calculation: 2, endgame: 1, blindfold: 3 },
  30: { tactics: 8, calculation: 3, endgame: 2, blindfold: 4 },
  45: { tactics: 10, calculation: 4, endgame: 3, blindfold: 5 },
  60: { tactics: 12, calculation: 5, endgame: 4, blindfold: 6 },
}

export function buildPlan(minutes: number, hasUnreviewedGame: boolean): PlanItem[] {
  const row = TABLE[minutes] ?? TABLE[20]
  const items: PlanItem[] = (Object.keys(row) as (keyof typeof row)[])
    .filter((k) => row[k] > 0)
    .map((k) => ({ activity: k, target: row[k] }))
  if (hasUnreviewedGame) items.push({ activity: 'review', target: 1 })
  return items
}

export function planProgress(
  item: PlanItem,
  attempts: PuzzleAttempt[],
  drills: DrillSession[],
  games: Game[],
  day = dayKey(),
): number {
  switch (item.activity) {
    case 'blindfold':
      return drills.filter((d) => d.day === day).length
    case 'review':
      return games.filter((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === day).length
    default:
      // Counts attempts (correct or not): the goal is to do the work, accuracy is tracked separately.
      return attempts.filter((a) => a.day === day && a.cat === item.activity).length
  }
}

/** Today's plan with progress, from the full app data. */
export function todaysPlan(data: { settings: { dailyMinutes: number }; attempts: PuzzleAttempt[]; drills: DrillSession[]; games: Game[] }) {
  const today = dayKey()
  const reviewedToday = data.games.some((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === today)
  const unreviewed = data.games.some((g) => !g.reviewed)
  return buildPlan(data.settings.dailyMinutes, unreviewed || reviewedToday).map((item) => {
    const done = planProgress(item, data.attempts, data.drills, data.games, today)
    return { ...item, done, complete: done >= item.target }
  })
}
