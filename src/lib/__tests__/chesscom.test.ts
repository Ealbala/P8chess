import { describe, expect, it } from 'vitest'
import { convertGame, mapResult, openingFamily, openingName, parseClocks } from '../chesscom'
import { groupStats, lossStreakToday, timeStats } from '../stats'
import type { Game } from '../db'

const PGN = `[Event "Live Chess"]
[Result "0-1"]
[TimeControl "600"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:55.5]} 2. Qh5 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:40]} 0-1`

const apiGame = {
  url: 'https://www.chess.com/game/live/1',
  uuid: 'abc',
  pgn: PGN,
  time_control: '600',
  time_class: 'rapid',
  end_time: 1792715138,
  rated: true,
  rules: 'chess',
  eco: 'https://www.chess.com/openings/Kings-Pawn-Opening-Wayward-Queen-Attack-2...Nc6',
  white: { username: 'Pochox23', rating: 1510, result: 'timeout' },
  black: { username: 'rival', rating: 1530, result: 'win' },
}

describe('chess.com import', () => {
  it('maps result codes', () => {
    expect(mapResult('win')).toBe('win')
    expect(mapResult('repetition')).toBe('draw')
    expect(mapResult('timevsinsufficient')).toBe('draw')
    expect(mapResult('checkmated')).toBe('loss')
    expect(mapResult('abandoned')).toBe('loss')
  })

  it('parses clocks', () => {
    expect(parseClocks(PGN)).toEqual([598, 595.5, 590, 580])
  })

  it('names openings', () => {
    const name = openingName(apiGame.eco)
    expect(name).toBe('Kings Pawn Opening Wayward Queen Attack 2...Nc6')
    expect(openingFamily(name)).toBe('Kings Pawn Opening')
    expect(openingFamily('French Defense Advance Variation')).toBe('French Defense')
    expect(openingFamily('Indian Game Knights Variation')).toBe('Indian Game')
    expect(openingFamily('Mieses Opening')).toBe('Mieses Opening')
    expect(openingFamily('Philidor Countergambit')).toBe('Philidor Countergambit')
  })

  it('converts a game from the user perspective (case-insensitive)', () => {
    const c = convertGame(apiGame, 'pochox23')!
    expect(c.game).toMatchObject({
      tc: 'rapid',
      result: 'loss',
      color: 'white',
      ratingAfter: 1510,
      opponent: 'rival',
      endReason: 'timeout',
      myClocks: [598, 590],
      plies: 4,
    })
    expect(c.rating).toMatchObject({ tc: 'rapid', rating: 1510, source: 'chesscom' })
  })

  it('skips variants, daily games and other players', () => {
    expect(convertGame({ ...apiGame, rules: 'chess960' }, 'pochox23')).toBeNull()
    expect(convertGame({ ...apiGame, time_class: 'daily' }, 'pochox23')).toBeNull()
    expect(convertGame(apiGame, 'someoneelse')).toBeNull()
  })

  it('does not create a rating point for unrated games', () => {
    expect(convertGame({ ...apiGame, rated: false }, 'pochox23')!.rating).toBeUndefined()
  })
})

const g = (p: Partial<Game>): Game => ({
  date: new Date().toISOString(), tc: 'rapid', result: 'win', color: 'white', source: 'chesscom', reviewed: false, ...p,
})

describe('game stats', () => {
  it('computes time stats', () => {
    const s = timeStats([
      g({ timeControl: '600', myClocks: [590, 500, 30], endReason: 'timeout', result: 'loss' }),
      g({ timeControl: '600', myClocks: [595, 400, 300] }),
    ])!
    expect(s.games).toBe(2)
    expect(s.lowTimePct).toBe(0.5)
    expect(s.lostOnTime).toBe(1)
  })

  it('groups results with a score', () => {
    const [w] = groupStats([g({ result: 'win' }), g({ result: 'draw' })], (x) => x.color)
    expect(w).toMatchObject({ games: 2, win: 1, draw: 1, score: 75 })
  })

  it('counts losses in a row today', () => {
    const now = new Date(2026, 9, 25, 15, 0) // fixed afternoon time so the test never crosses midnight
    const at = (min: number) => new Date(now.getTime() - min * 60000).toISOString()
    expect(lossStreakToday([g({ date: at(1), result: 'loss' }), g({ date: at(20), result: 'loss' }), g({ date: at(40) })], now)).toBe(2)
  })
})
