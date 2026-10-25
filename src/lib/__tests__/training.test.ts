import { describe, expect, it } from 'vitest'
import { OPENINGS } from '../../data/openings'
import { endedInEndgame, priority, type AreaStat } from '../areas'
import { buildPlan } from '../plan'
import { nextProgress, pgnMoves, repertoireCoverage } from '../openings'
import type { Game } from '../db'

describe('spaced repetition', () => {
  const today = new Date(2026, 9, 25)
  it('moves up a box when correct', () => {
    expect(nextProgress('x', { lineId: 'x', box: 2, due: '2026-10-25' }, true, today)).toEqual({ lineId: 'x', box: 3, due: '2026-11-01' })
  })
  it('goes back to box 1 after a mistake', () => {
    expect(nextProgress('x', { lineId: 'x', box: 5, due: '2026-10-25' }, false, today)).toEqual({ lineId: 'x', box: 1, due: '2026-10-26' })
  })
})

describe('repertoire coverage', () => {
  const french = OPENINGS.filter((o) => o.id === 'french')
  const game = (pgn: string): Game => ({ date: '', tc: 'rapid', result: 'win', color: 'black', source: 'chesscom', reviewed: false, pgn })

  it('reads SAN moves from a Chess.com PGN', () => {
    expect(pgnMoves('[Event "x"]\n\n1. e4 {[%clk 0:09:58]} 1... e6 {[%clk 0:09:55]} 2. d4 1-0')).toEqual(['e4', 'e6', 'd4'])
  })

  it('finds opponent moves the repertoire does not cover', () => {
    const c = repertoireCoverage([game('1. e4 e6 2. d4 d5 3. Bd3 dxe4'), game('1. e4 e6 2. d4 d5 3. Bd3 c5')], french, 'black')!
    expect(c.uncovered[0]).toMatchObject({ path: '1.e4 e6 2.d4 d5', move: 'Bd3', count: 2 })
  })

  it('finds where you deviated', () => {
    const c = repertoireCoverage([game('1. e4 e6 2. d4 d5 3. e5 Nc6')], french, 'black')!
    expect(c.deviations[0]).toMatchObject({ move: 'Nc6', expected: ['c5'] })
  })

  it('matches transpositions (2.Nf3 d5 3.exd5 exd5 4.d4 = Exchange line)', () => {
    const c = repertoireCoverage([game('1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Nf6')], french, 'black')!
    expect(c.deviations).toHaveLength(0)
    expect(c.uncovered).toHaveLength(0)
  })
})

describe('areas and plan', () => {
  it('detects endgames from the final position', () => {
    expect(endedInEndgame('[CurrentPosition "8/5pk1/8/8/8/8/5PK1/3R4 w - - 0 50"]')).toBe(true)
    expect(endedInEndgame('[CurrentPosition "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]')).toBe(false)
    expect(endedInEndgame('no header')).toBeNull()
  })

  it('ranks calibrated areas from weakest', () => {
    const s: AreaStat[] = [
      { area: 'tactics', n: 20, accuracy: 0.8, calibrated: true },
      { area: 'endgame', n: 12, accuracy: 0.4, calibrated: true },
      { area: 'openings', n: 3, accuracy: 0, calibrated: false },
    ]
    expect(priority(s).map((x) => x.area)).toEqual(['endgame', 'tactics'])
  })

  it('boosts the weakest area by 50% and lists it first', () => {
    const plan = buildPlan(30, false, 'endgame')
    expect(plan[0]).toMatchObject({ activity: 'endgame', target: 5, boosted: true })
  })
})
