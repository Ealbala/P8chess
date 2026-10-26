// Step-by-step explanation of a tactical line. Every sentence is computed from the board
// (chess.js): checks, captures, double attacks, discovered attacks, pins, undefended
// pieces and the material balance — nothing is invented.
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

type Lang = 'en' | 'es'
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const NAMES: Record<Lang, Record<PieceSymbol, string>> = {
  es: { k: 'el rey', q: 'la dama', r: 'la torre', b: 'el alfil', n: 'el caballo', p: 'el peón' },
  en: { k: 'the king', q: 'the queen', r: 'the rook', b: 'the bishop', n: 'the knight', p: 'the pawn' },
}
const TXT = {
  es: {
    opp: (san: string) => `Tu rival acaba de jugar ${san}.`,
    yours: (san: string) => `Jugaste ${san} en tu partida.`,
    oppGain: (n: number) => `Resultado: tu rival gana material (+${n}).`,
    oppMate: 'Resultado: tu rival da jaque mate.',
    mate: '¡Jaque mate!',
    check: 'Jaque.',
    doubleCheck: '¡Jaque doble! El rey tiene que moverse.',
    capture: (p: string) => `Captura ${p}.`,
    promo: (p: string) => `Corona: el peón se convierte en ${p}.`,
    fork: (list: string) => `Ataque doble: ataca a la vez ${list}.`,
    discovered: (a: string, tgt: string) => `Ataque a la descubierta: al moverse, ${a} queda atacando ${tgt}.`,
    pin: (p: string, behind: string) => `Clava ${p} contra ${behind}: no se puede mover sin perder ${behind}.`,
    pinKing: (p: string) => `Clava ${p} contra el rey: no se puede mover (dejaría al rey en jaque).`,
    undefended: (p: string) => `Ataca ${p}, que está sin defensa.`,
    threat: (p: string) => `Amenaza ${p}.`,
    quietMine: 'Jugada tranquila: no captura ni da jaque, pero prepara lo que viene.',
    reply: 'La mejor defensa del rival.',
    sumMate: 'Resultado: jaque mate.',
    sumGain: (n: number) => `Resultado: ganás material (+${n}).`,
    sumEqual: 'Resultado: el material queda igual; la ventaja es posicional o de iniciativa.',
    and: ' y ',
  },
  en: {
    opp: (san: string) => `Your opponent has just played ${san}.`,
    yours: (san: string) => `You played ${san} in your game.`,
    oppGain: (n: number) => `Result: your opponent wins material (+${n}).`,
    oppMate: 'Result: your opponent delivers checkmate.',
    mate: 'Checkmate!',
    check: 'Check.',
    doubleCheck: 'Double check! The king must move.',
    capture: (p: string) => `Captures ${p}.`,
    promo: (p: string) => `Promotes: the pawn becomes ${p}.`,
    fork: (list: string) => `Double attack: hits ${list} at the same time.`,
    discovered: (a: string, tgt: string) => `Discovered attack: by moving away, ${a} now attacks ${tgt}.`,
    pin: (p: string, behind: string) => `Pins ${p} to ${behind}: it cannot move without losing ${behind}.`,
    pinKing: (p: string) => `Pins ${p} to the king: it cannot move (the king would be in check).`,
    undefended: (p: string) => `Attacks ${p}, which is undefended.`,
    threat: (p: string) => `Threatens ${p}.`,
    quietMine: 'Quiet move: no capture or check, but it prepares what comes next.',
    reply: "Your opponent's best defence.",
    sumMate: 'Result: checkmate.',
    sumGain: (n: number) => `Result: you win material (+${n}).`,
    sumEqual: 'Result: material stays level; the advantage is positional or the initiative.',
    and: ' and ',
  },
}

export interface ExplainStep {
  san: string
  fen: string // position after the move
  from: string
  to: string
  mine: boolean // played by the solver
  texts: string[]
  /** [from, to, color] arrows to draw on top of the move arrow. */
  arrows: [string, string, string][]
}

const MOVE_MINE = 'rgba(22,163,74,0.85)'
const MOVE_OPP = 'rgba(220,38,38,0.75)'
const IDEA = 'rgba(234,179,8,0.85)'

function material(c: Chess, color: Color) {
  let s = 0
  for (const row of c.board()) for (const sq of row) if (sq && sq.color === color && sq.type !== 'k') s += VALUE[sq.type]
  return s
}

const SLIDER_DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
}
const sqName = (x: number, y: number) => ('abcdefgh'[x] + (y + 1)) as Square

/** Pins by `color`'s sliders: [slider, pinned, behind] where behind is the king or a more valuable piece. */
export function pins(c: Chess, color: Color): [Square, Square, Square][] {
  const out: [Square, Square, Square][] = []
  for (const row of c.board())
    for (const sq of row) {
      if (!sq || sq.color !== color || !SLIDER_DIRS[sq.type]) continue
      const x0 = 'abcdefgh'.indexOf(sq.square[0])
      const y0 = Number(sq.square[1]) - 1
      for (const [dx, dy] of SLIDER_DIRS[sq.type]) {
        let first: { square: Square; type: PieceSymbol } | null = null
        for (let x = x0 + dx, y = y0 + dy; x >= 0 && x < 8 && y >= 0 && y < 8; x += dx, y += dy) {
          const p = c.get(sqName(x, y))
          if (!p) continue
          if (p.color === color) break
          if (!first) {
            first = { square: sqName(x, y), type: p.type }
            continue
          }
          if (p.type === 'k' || VALUE[p.type] > VALUE[first.type]) out.push([sq.square, first.square, sqName(x, y)])
          break
        }
      }
    }
  return out
}

function list(lang: Lang, items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}${TXT[lang].and}${items[items.length - 1]}`
}

/**
 * Explains a puzzle line. `fen` is the position before moves[0] (the opponent's setup move,
 * Lichess format); the solver is the side to move after it.
 */
export function explainLine(
  fen: string,
  moves: string[],
  lang: Lang,
  /** 'opponent' (default): moves[0] is the opponent's setup move and you solve.
   *  'threat': moves[0] is YOUR move from a game and the line shows how the opponent punishes it. */
  perspective: 'opponent' | 'threat' = 'opponent',
): { steps: ExplainStep[]; summary: string } {
  const tx = TXT[lang]
  const names = NAMES[lang]
  const c = new Chess(fen)
  const steps: ExplainStep[] = []
  let solver: Color = 'w'
  let startBalance = 0

  moves.forEach((uci, i) => {
    const mover = c.turn()
    const enemy: Color = mover === 'w' ? 'b' : 'w'
    const beforeAttacks = new Map<Square, Square[]>()
    const enemyPieces = () =>
      c.board().flat().filter((s): s is NonNullable<typeof s> => !!s && s.color === enemy && (s.type === 'k' || VALUE[s.type] >= 3))
    for (const p of enemyPieces()) beforeAttacks.set(p.square, c.attackers(p.square, mover))
    const pinsBefore = new Set(pins(c, mover).map((p) => p.join()))

    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    const texts: string[] = []
    const arrows: [string, string, string][] = []

    if (i === 0) {
      solver = c.turn()
      startBalance = material(c, solver) - material(c, solver === 'w' ? 'b' : 'w')
      texts.push(perspective === 'threat' ? tx.yours(m.san) : tx.opp(m.san))
    } else {
      const mine = mover === solver
      if (c.isCheckmate()) texts.push(tx.mate)
      else if (c.inCheck()) {
        const king = enemyPieces().find((p) => p.type === 'k')!
        texts.push(c.attackers(king.square, mover).length >= 2 ? tx.doubleCheck : tx.check)
      }
      if (m.captured) texts.push(tx.capture(names[m.captured]))
      if (m.promotion) texts.push(tx.promo(names[m.promotion]))

      // Pieces the moved piece attacks from its new square.
      const targets = enemyPieces().filter((p) => c.attackers(p.square, mover).includes(m.to as Square))
      const valuable = targets.filter((p) => p.type === 'k' || VALUE[p.type] >= 3)
      if (valuable.length >= 2) {
        texts.push(tx.fork(list(lang, valuable.map((p) => names[p.type]))))
        valuable.forEach((p) => arrows.push([m.to, p.square, IDEA]))
      }

      // Discovered attacks: another of our pieces now attacks a valuable enemy piece.
      for (const p of enemyPieces()) {
        const before = beforeAttacks.get(p.square) ?? []
        for (const a of c.attackers(p.square, mover)) {
          if (a === m.to || before.includes(a)) continue
          const attacker = c.get(a)
          if (!attacker) continue
          texts.push(tx.discovered(names[attacker.type], names[p.type]))
          arrows.push([a, p.square, IDEA])
        }
      }

      // New pins that matter: against the king, or a piece pinned to the queen.
      for (const [slider, pinned, behind] of pins(c, mover)) {
        if (pinsBefore.has([slider, pinned, behind].join())) continue
        const behindType = c.get(behind)!.type
        if (!(behindType === 'k' || (behindType === 'q' && VALUE[c.get(pinned)!.type] >= 3))) continue
        texts.push(behindType === 'k' ? tx.pinKing(names[c.get(pinned)!.type]) : tx.pin(names[c.get(pinned)!.type], names[behindType]))
        arrows.push([slider, behind, IDEA])
      }

      // A single target: undefended, or worth more than the attacker (if not already a double attack).
      if (valuable.length < 2 && !c.isCheckmate()) {
        const moved = c.get(m.to as Square)!
        const loose = targets.find((p) => p.type !== 'k' && c.attackers(p.square, enemy).length === 0)
        const bigger = targets.find((p) => p.type !== 'k' && VALUE[p.type] > VALUE[moved.type])
        const target = loose ?? bigger
        if (target) {
          texts.push(!mine ? tx.threat(names[target.type]) : loose ? tx.undefended(names[target.type]) : tx.threat(names[target.type]))
          arrows.push([m.to, target.square, IDEA])
        }
      }

      if (!texts.length) texts.push(mine ? tx.quietMine : tx.reply)
    }

    steps.push({ san: m.san, fen: c.fen(), from: m.from, to: m.to, mine: i > 0 && mover === solver, texts, arrows })
  })

  const balance = material(c, solver) - material(c, solver === 'w' ? 'b' : 'w')
  const gain = balance - startBalance
  const summary =
    perspective === 'threat'
      ? c.isCheckmate() ? tx.oppMate : gain > 0 ? tx.oppGain(gain) : tx.sumEqual
      : c.isCheckmate() ? tx.sumMate : gain > 0 ? tx.sumGain(gain) : tx.sumEqual
  return { steps, summary }
}

export const MOVE_COLORS = { mine: MOVE_MINE, opp: MOVE_OPP }
