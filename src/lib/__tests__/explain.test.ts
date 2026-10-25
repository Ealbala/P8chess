import { describe, expect, it } from 'vitest'
import { explainLine } from '../explain'

describe('explainLine', () => {
  it('explains the queen-trap puzzle: captures, check and the final material', () => {
    // Black plays ...Qxh4+, White Nxh4 wins the queen; ...Rxe5 Ng6+ (fork king+rook) Kh7 Nxe5.
    const { steps, summary } = explainLine('1r5k/6p1/p4n2/1r2QNqp/7P/8/P1R3P1/6RK b - - 0 29', ['g5h4', 'f5h4', 'b5e5', 'h4g6', 'h8h7', 'g6e5'], 'es')
    expect(steps[0].texts[0]).toBe('Tu rival acaba de jugar Qxh4+.')
    expect(steps[1].texts).toContain('Captura la dama.')
    expect(steps[3].texts.join(' ')).toMatch(/Jaque\./)
    expect(steps[3].texts.join(' ')).toMatch(/Ataque doble: ataca a la vez .*el rey.*la torre|la torre.*el rey/)
    expect(steps[5].texts).toContain('Captura la torre.')
    expect(summary).toMatch(/ganás material/)
  })

  it('detects a pin', () => {
    // After ...d6, Bb5 pins the c6 knight to the e8 king (d7 is empty).
    const { steps } = explainLine('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3', ['d7d6', 'f1b5'], 'en')
    expect(steps[1].texts.join(' ')).toMatch(/Pins the knight to the king: it cannot move/)
  })

  it('detects checkmate', () => {
    const { steps, summary } = explainLine('rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3', ['d1h5', 'g8f6', 'h5f7'], 'en')
    expect(steps[2].texts).toContain('Checkmate!')
    expect(summary).toBe('Result: checkmate.')
  })
})
