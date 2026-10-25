import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { OPENINGS } from '../../data/openings'

describe('opening content', () => {
  for (const o of OPENINGS) {
    for (const line of o.lines) {
      it(`${line.id} is legal and ends on the trainee's move`, () => {
        const c = new Chess()
        const moves = line.moves.split(' ')
        for (const san of moves) expect(() => c.move(san), `${line.id}: ${san}`).not.toThrow()
        // The last move should be the trainee's, so every line ends with something to remember.
        const lastIsWhite = moves.length % 2 === 1
        expect(lastIsWhite ? 'white' : 'black').toBe(o.color)
        for (const ply of Object.keys(line.notes ?? {})) expect(Number(ply)).toBeLessThanOrEqual(moves.length)
      })
    }
  }

  it('has unique line ids', () => {
    const ids = OPENINGS.flatMap((o) => o.lines.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

import { STRATEGY } from '../../data/strategy'

describe('strategy lessons', () => {
  for (const l of STRATEGY) {
    it(`${l.id}: legal position, side to move matches, accepted moves are legal`, () => {
      const c = new Chess()
      for (const san of l.moves.split(' ')) c.move(san)
      expect(c.turn()).toBe(l.orientation === 'white' ? 'w' : 'b')
      for (const s of l.steps) {
        if (s.type === 'move') for (const m of [...s.accept, ...(s.alsoGood ?? [])]) expect(() => new Chess(c.fen()).move(m), m).not.toThrow()
        else expect(s.options.filter((o) => o.correct)).toHaveLength(1)
      }
    })
  }
})
