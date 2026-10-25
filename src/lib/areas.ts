// Training areas and "weakest first" priority.
// Definition: accuracy over your last 30 attempts in each area (puzzles; for openings,
// line drills from memory). An area needs at least 10 attempts before it is ranked —
// until then it is "calibrating" and gets a normal share of the daily plan.
import type { Game, LineAttempt, Phase, PuzzleAttempt } from './db'
import { drillAccuracy } from './openings'
import { errorRates } from './analysis'

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
        .filter((a) => a.cat === area && !a.rush)
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

const PHASE_AREA: Record<Phase, Area> = { opening: 'openings', middlegame: 'middlegame', endgame: 'endgame' }
export const MIN_ANALYSED_GAMES = 5

/**
 * The area to boost today. Your real games come first: with 5+ games analysed by
 * Stockfish, it is the game phase with the most mistakes per 100 of your moves.
 * Otherwise, the area with the lowest puzzle/drill accuracy.
 */
export function weakestArea(data: { games: Game[]; attempts: PuzzleAttempt[]; lineAttempts: LineAttempt[] }):
  | { area: Area; source: 'games'; rate: number; games: number }
  | { area: Area; source: 'training'; accuracy: number; n: number }
  | null {
  const rates = errorRates(data.games)
  if (rates.games >= MIN_ANALYSED_GAMES) {
    const worst = [...rates.byPhase].filter((p) => p.moves >= 20).sort((a, b) => b.rate - a.rate)[0]
    if (worst) return { area: PHASE_AREA[worst.phase], source: 'games', rate: worst.rate, games: rates.games }
  }
  const p = priority(areaStats(data.attempts, data.lineAttempts))[0]
  return p ? { area: p.area, source: 'training', accuracy: p.accuracy, n: p.n } : null
}
