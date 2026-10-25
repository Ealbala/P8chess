// Training areas and "weakest first" priority.
// Definition: accuracy over your last 30 attempts in each area (puzzles; for openings,
// line drills from memory). An area needs at least 10 attempts before it is ranked —
// until then it is "calibrating" and gets a normal share of the daily plan.
import type { Game, LineAttempt, PuzzleAttempt } from './db'
import { drillAccuracy } from './openings'

export const AREAS = ['openings', 'tactics', 'calculation', 'middlegame', 'endgame'] as const
export type Area = (typeof AREAS)[number]

export const MIN_ATTEMPTS = 10
const WINDOW = 30

export interface AreaStat {
  area: Area
  n: number
  accuracy: number
  calibrated: boolean
}

export function areaStats(attempts: PuzzleAttempt[], lineAttempts: LineAttempt[]): AreaStat[] {
  return AREAS.map((area) => {
    let n: number
    let accuracy: number
    if (area === 'openings') {
      ;({ n, accuracy } = drillAccuracy(lineAttempts, WINDOW))
    } else {
      const list = attempts
        .filter((a) => a.cat === area)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, WINDOW)
      n = list.length
      accuracy = n ? list.filter((a) => a.correct).length / n : 0
    }
    return { area, n, accuracy, calibrated: n >= MIN_ATTEMPTS }
  })
}

/** Calibrated areas from weakest to strongest. */
export function priority(stats: AreaStat[]): AreaStat[] {
  return stats.filter((s) => s.calibrated).sort((a, b) => a.accuracy - b.accuracy)
}

const VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 }

/**
 * True when the game's final position (PGN "CurrentPosition" header from Chess.com) is an
 * endgame: no queens, or at most 13 points of pieces (Q9 R5 B3 N3) per side.
 */
export function endedInEndgame(pgn?: string): boolean | null {
  const fen = pgn?.match(/\[CurrentPosition "([^"]+)"\]/)?.[1]
  if (!fen) return null
  const board = fen.split(' ')[0]
  let white = 0
  let black = 0
  let queens = 0
  for (const ch of board) {
    const v = VALUE[ch.toLowerCase()]
    if (!v) continue
    if (ch.toLowerCase() === 'q') queens++
    if (ch === ch.toUpperCase()) white += v
    else black += v
  }
  return queens === 0 || (white <= 13 && black <= 13)
}

/** Your score (wins + ½ draws) in games that ended in an endgame vs. all games. */
export function endgameScore(games: Game[]) {
  const score = (list: Game[]) =>
    list.length ? Math.round(((list.filter((g) => g.result === 'win').length + list.filter((g) => g.result === 'draw').length / 2) / list.length) * 100) : 0
  const known = games.filter((g) => endedInEndgame(g.pgn) !== null)
  const endgames = known.filter((g) => endedInEndgame(g.pgn))
  return { endgames: endgames.length, endgameScore: score(endgames), total: known.length, totalScore: score(known) }
}
