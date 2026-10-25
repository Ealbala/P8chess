import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { evaluateGame, findMistakes, errorRates } from '../analysis'
import { weakestArea } from '../areas'
import { buildPlan } from '../plan'
import { weeklyChallenge } from '../stats'
import { defaultSettings, type Game } from '../db'
import type { EngineResult } from '../engine'

// Fake engine: knows two positions from a short game where White hangs the queen.
// 1.e4 e5 2.Qh5 Nc6 3.Qxf7+?? (blunder: Kxf7) — best was 3.Bc4.
const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+', 'Kxf7']

function fakeEngine(): (fen: string) => Promise<EngineResult> {
  const c = new Chess()
  const fens = [c.fen()]
  for (const s of sans) {
    c.move(s)
    fens.push(c.fen())
  }
  return async (fen) => {
    const i = fens.indexOf(fen)
    if (i === 4) return { best: 'f1c4', cp: 40, mate: null, depth: 12, pv: ['f1c4', 'g7g6'] } // White to move, fine
    if (i === 5) return { best: 'e8f7', cp: 900, mate: null, depth: 12, pv: ['e8f7'] } // Black to move: up a queen
    return { best: 'a2a3', cp: i % 2 === 0 ? 20 : -20, mate: null, depth: 12, pv: ['a2a3'] }
  }
}

const game = (p: Partial<Game> = {}): Game => ({
  id: 7, date: '2026-10-20T10:00:00.000Z', tc: 'rapid', result: 'loss', color: 'white', source: 'chesscom', reviewed: false, ...p,
})

describe('mistake detection', () => {
  it('finds the blunder, the best move and the line', async () => {
    const evals = await evaluateGame(sans, fakeEngine())
    const { analysis, positions } = findMistakes(game(), sans, evals)
    expect(analysis.blunders).toBe(1)
    expect(positions).toHaveLength(1)
    expect(positions[0]).toMatchObject({ id: '7-4', ply: 4, played: 'Qxf7+', best: 'Bc4', pv: ['Bc4', 'g6'], kind: 'blunder', phase: 'opening' })
  })

  it('computes error rates per 100 moves by phase', () => {
    const g = game({ analysis: { depth: 12, analyzedAt: '', inaccuracies: 0, mistakes: 1, blunders: 1,
      moves: { opening: 10, middlegame: 20, endgame: 0 }, errors: { opening: 0, middlegame: 2, endgame: 0 } } })
    const r = errorRates([g])
    expect(r.byPhase.find((p) => p.phase === 'middlegame')!.rate).toBe(10)
  })

  it('uses the worst phase of your analysed games as the weakest area', () => {
    const a = { depth: 12, analyzedAt: '', inaccuracies: 0, mistakes: 1, blunders: 0,
      moves: { opening: 10, middlegame: 20, endgame: 10 }, errors: { opening: 0, middlegame: 1, endgame: 2 } }
    const games = Array.from({ length: 5 }, (_, i) => game({ id: i, analysis: a }))
    expect(weakestArea({ games, attempts: [], lineAttempts: [] })).toMatchObject({ area: 'endgame', source: 'games' })
  })
})

describe('challenges and plan', () => {
  it('counts the weekly challenge and the streak of weeks', () => {
    const s = { ...defaultSettings(), weeklyGames: { rapid: 2, blitz: 0, bullet: 0 } }
    const now = new Date(2026, 9, 22, 12) // Thursday
    const g = (d: Date) => game({ date: d.toISOString() })
    const games = [g(new Date(2026, 9, 20)), g(new Date(2026, 9, 21)), g(new Date(2026, 9, 13)), g(new Date(2026, 9, 14))]
    expect(weeklyChallenge(games, s, now)).toMatchObject({ played: 2, met: true, streak: 2, daysLeft: 4 })
  })

  it('caps "your mistakes" by available positions and puts it first', () => {
    expect(buildPlan(30, false, undefined, 0).some((i) => i.activity === 'mistakes')).toBe(false)
    expect(buildPlan(30, false, undefined, 2)[0]).toMatchObject({ activity: 'mistakes', target: 2 })
  })
})
