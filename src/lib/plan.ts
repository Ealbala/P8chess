// Today's Training: a fixed plan per day, built from the chosen duration.
// Progress is never ticked by hand — it is computed from what you actually did today,
// and only what you did WELL counts:
//  - puzzles / your mistakes: solved without showing the solution (retries are fine)
//  - opening lines: learned, or reviewed without asking for the arrow
//  - blindfold: finished rounds reaching a bar that rises gradually (0% → 70%), or a blindfold game
//  - review: a game reviewed
// Your weakest area (see areas.ts) gets 50% more items.
import type { Activity, DrillSession, Game, LineAttempt, LineProgress, MistakePosition, PositionAttempt, PuzzleAttempt, Settings } from './db'
import { dayKey } from './dates'
import { needsReview } from './stats'
import { weakestArea, type Area } from './areas'
import { duePositions } from './mistakes'

export interface PlanItem {
  activity: Activity
  target: number // puzzles, lines, drill rounds or reviews
  boosted?: boolean
}

type Row = Record<Exclude<Activity, 'review'>, number>

const TABLE: Record<number, Row> = {
  10: { threats: 1, mistakes: 2, openings: 1, tactics: 4, calculation: 0, middlegame: 0, endgame: 0, blindfold: 1 },
  20: { threats: 2, mistakes: 3, openings: 2, tactics: 4, calculation: 1, middlegame: 2, endgame: 2, blindfold: 2 },
  30: { threats: 2, mistakes: 4, openings: 3, tactics: 5, calculation: 2, middlegame: 3, endgame: 3, blindfold: 3 },
  45: { threats: 3, mistakes: 5, openings: 4, tactics: 7, calculation: 3, middlegame: 4, endgame: 4, blindfold: 4 },
  60: { threats: 3, mistakes: 6, openings: 5, tactics: 9, calculation: 4, middlegame: 5, endgame: 5, blindfold: 5 },
}

/**
 * @param mistakesAvailable positions from your games you can practise today; the
 *   "your mistakes" item is capped by it (and left out when there are none yet).
 */
export function buildPlan(
  minutes: number,
  hasUnreviewedGame: boolean,
  weakest?: Area,
  mistakesAvailable = 0,
  threatsAvailable = 0,
): PlanItem[] {
  const row = { ...(TABLE[minutes] ?? TABLE[20]) }
  row.mistakes = Math.min(row.mistakes, mistakesAvailable)
  row.threats = Math.min(row.threats, threatsAvailable)
  const items: PlanItem[] = []
  for (const k of Object.keys(row) as (keyof Row)[]) {
    const boosted = k === weakest
    const target = boosted ? Math.max(2, Math.ceil(row[k] * 1.5)) : row[k]
    if (target > 0) items.push({ activity: k, target, boosted })
  }
  // Your own mistakes first, then the weakest area.
  const rank = (i: PlanItem) => (i.activity === 'mistakes' ? 3 : i.activity === 'threats' ? 2 : i.boosted ? 1 : 0)
  items.sort((a, b) => rank(b) - rank(a))
  if (hasUnreviewedGame) items.unshift({ activity: 'review', target: 1 })
  return items
}

/**
 * Accuracy a blindfold round needs to count: 0% for your first rounds of each exercise,
 * then +5% per round already done, up to 70%. Mistakes are fine at the start; the bar rises
 * as you practise.
 */
export function drillRequired(kind: DrillSession['kind'], drills: DrillSession[], before?: string): number {
  const prior = drills.filter((d) => d.kind === kind && d.total > 0 && (before === undefined || d.date < before)).length
  return Math.min(0.7, Math.round(prior * 5) / 100)
}

/** A finished blindfold game always counts; a round counts if it reached its required accuracy. */
export function drillPassed(d: DrillSession, drills: DrillSession[]): boolean {
  if (d.total <= 0) return false
  if (d.kind === 'blind-game') return true
  return d.correct / d.total >= drillRequired(d.kind, drills, d.date) - 1e-9
}

export function planProgress(
  item: PlanItem,
  data: { attempts: PuzzleAttempt[]; drills: DrillSession[]; games: Game[]; lineAttempts: LineAttempt[]; positionAttempts: PositionAttempt[] },
  day = dayKey(),
): number {
  switch (item.activity) {
    case 'blindfold':
      return data.drills.filter((d) => d.day === day && drillPassed(d, data.drills)).length
    case 'review':
      return data.games.filter((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === day).length
    case 'openings':
      return data.lineAttempts.filter((a) => a.day === day && (a.mode === 'learn' || (a.solved ?? a.correct))).length
    case 'mistakes':
      return new Set(data.positionAttempts.filter((a) => a.day === day && !a.kind && (a.solved ?? a.correct)).map((a) => a.posId)).size
    case 'threats':
      return new Set(data.positionAttempts.filter((a) => a.day === day && a.kind === 'threat' && (a.solved ?? a.correct)).map((a) => a.posId)).size
    default:
      return data.attempts.filter((a) => a.day === day && a.cat === item.activity && (a.solved ?? a.correct)).length
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
  positions: MistakePosition[]
  positionAttempts: PositionAttempt[]
}) {
  const today = dayKey()
  const reviewedToday = data.games.some((g) => g.reviewedAt && dayKey(new Date(g.reviewedAt)) === today)
  const unreviewed = data.games.some((g) => needsReview(g, data.settings))
  const weakest = weakestArea(data)?.area
  const doneToday = new Set(data.positionAttempts.filter((a) => a.day === today && !a.kind).map((a) => a.posId)).size
  const available = duePositions(data.positions, today).length + doneToday
  const threatsToday = new Set(data.positionAttempts.filter((a) => a.day === today && a.kind === 'threat').map((a) => a.posId)).size
  const threatsAvailable = data.positions.filter((p) => p.threatDue === undefined || p.threatDue <= today).length + threatsToday
  return buildPlan(data.settings.dailyMinutes, unreviewed || reviewedToday, weakest, available, threatsAvailable).map((item) => {
    const done = planProgress(item, data, today)
    return { ...item, done, complete: done >= item.target }
  })
}
