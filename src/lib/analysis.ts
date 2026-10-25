// Game analysis with Stockfish. For each of your moves we compare your winning chances
// before and after the move (Lichess model): a drop of 10+ points is an inaccuracy,
// 20+ a mistake, 30+ a blunder. Mistakes and blunders become training positions.
import { Chess } from 'chess.js'
import type { Game, GameAnalysis, MistakePosition, Phase } from './db'
import { winPercent, type EngineResult } from './engine'
import { pgnMoves } from './openings'
import { dayKey } from './dates'

export const ANALYSIS_DEPTH = 12
const VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 }

/** Opening = first 10 moves; endgame = no queens or ≤ 13 points of pieces per side. */
export function phaseOf(chess: Chess, ply: number): Phase {
  if (ply < 20) return 'opening'
  let w = 0
  let b = 0
  let queens = 0
  for (const row of chess.board())
    for (const sq of row) {
      if (!sq || !VALUE[sq.type]) continue
      if (sq.type === 'q') queens++
      if (sq.color === 'w') w += VALUE[sq.type]
      else b += VALUE[sq.type]
    }
  return queens === 0 || (w <= 13 && b <= 13) ? 'endgame' : 'middlegame'
}

export interface PositionEval {
  fen: string
  /** Score for the side to move (cp, mates mapped to ±10000). */
  cp: number
  best?: string
  pv?: string[]
}

export function uciToSan(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

function pvToSan(fen: string, pv: string[], max = 6): string[] {
  const c = new Chess(fen)
  const out: string[] = []
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
    } catch {
      break
    }
  }
  return out
}

/**
 * Evaluates every position of a game. `evaluate` is injected so this can be tested
 * without the engine. Terminal positions are scored directly.
 */
export async function evaluateGame(sans: string[], evaluate: (fen: string) => Promise<EngineResult>): Promise<PositionEval[]> {
  const c = new Chess()
  const evals: PositionEval[] = []
  for (let i = 0; i <= sans.length; i++) {
    const fen = c.fen()
    if (c.isCheckmate()) evals.push({ fen, cp: -10000 })
    else if (c.isGameOver()) evals.push({ fen, cp: 0 })
    else {
      const r = await evaluate(fen)
      evals.push({ fen, cp: r.cp, best: r.best, pv: r.pv })
    }
    if (i === sans.length) break
    try {
      c.move(sans[i])
    } catch {
      break
    }
  }
  return evals
}

/** Turns position evaluations into a game summary and mistake positions. */
export function findMistakes(game: Game, sans: string[], evals: PositionEval[]): { analysis: GameAnalysis; positions: MistakePosition[] } {
  const mine = game.color === 'white' ? 0 : 1
  const moves: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const errors: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  let inaccuracies = 0
  let mistakes = 0
  let blunders = 0
  const positions: MistakePosition[] = []
  const today = dayKey()

  for (let i = mine; i + 1 < evals.length; i += 2) {
    const before = evals[i]
    const after = evals[i + 1]
    if (!before.best) continue
    const chess = new Chess(before.fen)
    const phase = phaseOf(chess, i)
    moves[phase]++
    const played = chess.move(sans[i])
    const playedUci = played.from + played.to + (played.promotion ?? '')
    const evalBest = before.cp
    const evalPlayed = -after.cp
    const wb = winPercent(evalBest)
    const drop = Math.max(0, wb - winPercent(evalPlayed))
    if (playedUci === before.best || drop < 10) continue
    if (drop < 20) {
      inaccuracies++
      continue
    }
    const kind = drop >= 30 ? 'blunder' : 'mistake'
    if (kind === 'blunder') blunders++
    else mistakes++
    errors[phase]++
    // Positions that were already lost are not useful puzzles.
    if (wb < 15) continue
    const best = uciToSan(before.fen, before.best)
    if (!best) continue
    positions.push({
      id: `${game.id}-${i}`,
      gameId: game.id!,
      ply: i,
      fen: before.fen,
      color: game.color,
      played: played.san,
      playedUci,
      best,
      bestUci: before.best,
      pv: pvToSan(before.fen, before.pv ?? [before.best]),
      evalBest,
      evalPlayed,
      drop: Math.round(drop),
      kind,
      phase,
      date: game.date,
      box: 0,
      due: today,
    })
  }
  return {
    analysis: { depth: ANALYSIS_DEPTH, analyzedAt: new Date().toISOString(), inaccuracies, mistakes, blunders, moves, errors },
    positions,
  }
}

export function gameSans(game: Game): string[] {
  return game.pgn ? pgnMoves(game.pgn) : []
}

/** Errors (mistakes + blunders) per 100 of your moves, by phase, over analysed games. */
export function errorRates(games: Game[]) {
  const analysed = games.filter((g) => g.analysis)
  const sum = (k: 'moves' | 'errors', p: Phase) => analysed.reduce((s, g) => s + g.analysis![k][p], 0)
  const phases: Phase[] = ['opening', 'middlegame', 'endgame']
  return {
    games: analysed.length,
    byPhase: phases.map((p) => {
      const m = sum('moves', p)
      return { phase: p, moves: m, errors: sum('errors', p), rate: m ? (sum('errors', p) / m) * 100 : 0 }
    }),
  }
}
