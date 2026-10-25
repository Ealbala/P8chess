import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { knightDistance, knightMoves, parseMoveInput, sameDiagonal, speakSan } from '../blindfold'
import { ENDGAMES } from '../../data/endgames'

describe('blindfold geometry', () => {
  it('computes knight moves and distances', () => {
    expect(knightMoves('a1').sort()).toEqual(['b3', 'c2'])
    expect(knightMoves('e4')).toHaveLength(8)
    expect(knightDistance('a1', 'b3')).toBe(1)
    expect(knightDistance('a1', 'h8')).toBe(6)
    expect(knightDistance('e4', 'e5')).toBe(3)
  })

  it('detects diagonals', () => {
    expect(sameDiagonal('a1', 'h8')).toBe(true)
    expect(sameDiagonal('c1', 'h6')).toBe(true)
    expect(sameDiagonal('a1', 'a8')).toBe(false)
  })
})

describe('move input (text and voice)', () => {
  const c = new Chess()
  it('accepts SAN, UCI and spoken Spanish', () => {
    expect(parseMoveInput(c, 'e4')).toBe('e4')
    expect(parseMoveInput(c, 'g1f3')).toBe('Nf3')
    expect(parseMoveInput(c, 'nf3')).toBe('Nf3')
    expect(parseMoveInput(c, 'caballo f tres')).toBe('Nf3')
    expect(parseMoveInput(c, 'peón e cuatro')).toBe('e4')
    expect(parseMoveInput(c, 'knight c3')).toBe('Nc3')
    expect(parseMoveInput(c, 'dama h5')).toBeNull()
  })

  it('speaks moves in Spanish', () => {
    expect(speakSan('Nxf3+', 'es')).toBe('caballo toma f3, jaque')
    expect(speakSan('O-O', 'es')).toBe('enroque corto')
    expect(speakSan('e8=Q#', 'es')).toBe('peón e8 corona dama, jaque mate')
  })
})

describe('endgame lessons', () => {
  it('are legal positions with the trainee to move', () => {
    for (const e of ENDGAMES) expect(() => new Chess(e.fen)).not.toThrow()
  })
})
