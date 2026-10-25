// Today's Training: a fixed plan per day, built from the chosen duration.
// Progress is never ticked by hand — it is computed from what you actually did today.
// Your weakest area (see areas.ts) gets 50% more items.
import type { Activity, DrillSession, Game, LineAttempt, LineProgress, PuzzleAttempt, Settings } from './db'
import { dayKey } from './dates'
import { needsReview } from './stats'
import { areaStats, priority, type Area } from './areas'

export interface PlanItem {
  activity: Activity
  target: number // puzzles, lines, drill rounds or reviews
  boosted?: boolean
}

type Row = Record<Exclude<Activity, 'review'>, number>

const TABLE: Record<number, Row> = {
  10: { openings: 1, tactics: 4, calculation: 0, middlegame: 0, endgame: 0, blindfold: 1 },
  20: { openings: 2, tactics: 4, calculation: 1, middlegame: 2, endgame: 2, blindfold: 2 },
  30: { openings: 3, tactics: 5, calculation: 2, middlegame: 3, endgame: 3, blindfold: 3 },
  45: { openings: 4, tactics: 7, calculation: 3, middlegame: 4, endgame: 4, blindfold: 4 },
  60: { openings: 5, tactics: 9, calculation: 4, middlegame: 5, endgame: 5, blindfold: 5 },
}

export function buildPlan(minutes: number, hasUnreviewedGame: boolean, weakest?: Area): PlanItem[] {
  const row = { ...(TABLE[minutes] ?? TABLE[20]) }
  const items: PlanItem[] = []
  for (const k of Object.keys(row) as (keyof Row)[]) {
    const boosted = k === weakest
    const target = boosted ? Math.max(2, Math.ceil(row[k] * 1.5)) : row[k]
    if (target > 0) items.push({ activity: k, target, boosted })
  }
  // Weakest area first in the list.
  items.sort((a, b) => Number(!!b.boosted) - Number(!!a.boosted))
  if (hasUnreviewedGame) items.unshift({ activity: 'review', target: 1 })
  return items
}

export function planProgress(
  item: PlanItem,
  data: { attempts: PuzzleAttempt[]; drills: DrillSession[]; games: Game[]; lineAttempts: LineAttempt[] },
  day = dayKey(),
): number {
  switch (item.activity) {
    case 'blindfold':
      return data.drills.filter((d) => d.day === day).length
    case 'review':
      return data.games.filter((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === day).length
    case 'openings':
      return data.lineAttempts.filter((a) => a.day === day).length
    default:
      // Counts attempts (correct or not): the goal is to do the work, accuracy is tracked separately.
      return data.attempts.filter((a) => a.day === day && a.cat === item.activity).length
  }
}

/** Today's plan with progress, from the full app data. */
export function todaysPlan(data: {
  settings: Settings
  attempts: PuzzleAttempt[]
  drills: DrillSession[]
  games: Game[]
  lineAttempts: LineAttempt[]
  lineProgress: LineProgress[]
}) {
  const today = dayKey()
  const reviewedToday = data.games.some((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === today)
  const unreviewed = data.games.some((g) => needsReview(g, data.settings))
  const weakest = priority(areaStats(data.attempts, data.lineAttempts))[0]?.area
  return buildPlan(data.settings.dailyMinutes, unreviewed || reviewedToday, weakest).map((item) => {
    const done = planProgress(item, data, today)
    return { ...item, done, complete: done >= item.target }
  })
}
