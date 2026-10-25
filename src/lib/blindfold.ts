// Blindfold training helpers: square geometry and question generators. Every answer is
// computed, so it can be checked exactly.
import { Chess, type Square } from 'chess.js'

export const FILES = 'abcdefgh'
export const ALL_SQUARES: string[] = [...FILES].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => f + r))

const xy = (sq: string) => [FILES.indexOf(sq[0]), Number(sq[1]) - 1] as const
export const randomSquare = () => ALL_SQUARES[Math.floor(Math.random() * 64)]

export function knightMoves(sq: string): string[] {
  const [x, y] = xy(sq)
  const out: string[] = []
  for (const [dx, dy] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) out.push(FILES[nx] + (ny + 1))
  }
  return out
}

/** Minimum number of knight moves between two squares (BFS). */
export function knightDistance(from: string, to: string): number {
  const dist = new Map([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const sq = queue.shift()!
    if (sq === to) return dist.get(sq)!
    for (const n of knightMoves(sq)) if (!dist.has(n)) dist.set(n, dist.get(sq)! + 1), queue.push(n)
  }
  return -1
}

export function sameDiagonal(a: string, b: string): boolean {
  const [ax, ay] = xy(a)
  const [bx, by] = xy(b)
  return a !== b && Math.abs(ax - bx) === Math.abs(ay - by)
}

export interface MoveQuestion {
  kind: 'knightDistance' | 'diagonal' | 'knightCount'
  squares: string[]
  options: string[]
  answer: string
}

export function moveQuestion(): MoveQuestion {
  const r = Math.random()
  if (r < 0.4) {
    let a = randomSquare()
    let b = randomSquare()
    while (a === b) b = randomSquare()
    return { kind: 'knightDistance', squares: [a, b], options: ['1', '2', '3', '4', '5', '6'], answer: String(knightDistance(a, b)) }
  }
  if (r < 0.75) {
    const a = randomSquare()
    // Half of the time pick a square that really is on a diagonal with a.
    const diag = ALL_SQUARES.filter((s) => sameDiagonal(a, s))
    let b = Math.random() < 0.5 && diag.length ? diag[Math.floor(Math.random() * diag.length)] : randomSquare()
    while (b === a) b = randomSquare()
    return { kind: 'diagonal', squares: [a, b], options: ['yes', 'no'], answer: sameDiagonal(a, b) ? 'yes' : 'no' }
  }
  const a = randomSquare()
  return { kind: 'knightCount', squares: [a], options: ['2', '3', '4', '6', '8'], answer: String(knightMoves(a).length) }
}

/** Piece code on a square: "wN", "bP"… or "" for empty. */
export function pieceAt(chess: Chess, sq: string): string {
  const p = chess.get(sq as Square)
  return p ? p.color + p.type.toUpperCase() : ''
}

export const PIECE_OPTIONS = ['', 'wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
export const PIECE_GLYPH: Record<string, string> = {
  '': '∅', wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

/** Squares to ask about: mostly occupied ones, plus some empty squares. */
export function memorySquares(chess: Chess, n: number): string[] {
  const occupied = ALL_SQUARES.filter((s) => pieceAt(chess, s))
  const empty = ALL_SQUARES.filter((s) => !pieceAt(chess, s))
  const pick = (arr: string[]) => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]
  const out: string[] = []
  while (out.length < n && (occupied.length || empty.length)) {
    out.push(Math.random() < 0.75 && occupied.length ? pick(occupied) : pick(empty.length ? empty : occupied))
  }
  return out
}

// ---------- Spoken moves (Spanish / English) ----------

const PIECE_WORDS = {
  es: { K: 'rey', Q: 'dama', R: 'torre', B: 'alfil', N: 'caballo', P: 'peón' },
  en: { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' },
}

/** "Nxf3+" → "caballo toma f3, jaque". */
export function speakSan(san: string, lang: 'en' | 'es'): string {
  const w = PIECE_WORDS[lang]
  if (san.startsWith('O-O-O')) return lang === 'es' ? 'enroque largo' : 'long castle'
  if (san.startsWith('O-O')) return lang === 'es' ? 'enroque corto' : 'short castle'
  const piece = /^[KQRBN]/.test(san) ? w[san[0] as 'K'] : w.P
  const capture = san.includes('x') ? (lang === 'es' ? ' toma' : ' takes') : ''
  const target = san.match(/[a-h][1-8](?!.*[a-h][1-8])/)?.[0] ?? ''
  const promo = san.match(/=([QRBN])/)?.[1]
  let text = `${piece}${capture} ${target}`
  if (promo) text += lang === 'es' ? ` corona ${w[promo as 'Q']}` : ` promotes to ${w[promo as 'Q']}`
  if (san.includes('#')) text += lang === 'es' ? ', jaque mate' : ', checkmate'
  else if (san.includes('+')) text += lang === 'es' ? ', jaque' : ', check'
  return text
}

const NUMBER_WORDS: Record<string, string> = {
  uno: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8',
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
}

/**
 * Matches free text or speech ("caballo f3", "Nf3", "e2e4", "alfil toma c4", "enroque corto")
 * against the legal moves. Returns the SAN or null.
 */
export function parseMoveInput(chess: Chess, input: string): string | null {
  const legal = chess.moves({ verbose: true })
  let text = input.trim().toLowerCase()
  if (!text) return null
  for (const [w, n] of Object.entries(NUMBER_WORDS)) text = text.replace(new RegExp(`\\b${w}\\b`, 'g'), n)
  text = text.replace(/\b([a-h])\s+([1-8])\b/g, '$1$2')
  // Exact SAN / UCI first.
  const compact = text.replace(/[\s+#!?]/g, '')
  for (const m of legal) {
    const san = m.san.replace(/[+#]/g, '').toLowerCase()
    if (compact === san || compact === m.from + m.to + (m.promotion ?? '')) return m.san
  }
  if (/enroque corto|short castle|^o-o$|^0-0$/.test(text)) return legal.find((m) => m.san.startsWith('O-O') && !m.san.startsWith('O-O-O'))?.san ?? null
  if (/enroque largo|long castle|o-o-o|0-0-0/.test(text)) return legal.find((m) => m.san.startsWith('O-O-O'))?.san ?? null
  // Spoken form: piece word + target square.
  const target = text.match(/[a-h][1-8]/g)?.pop()
  if (!target) return null
  let piece = 'p'
  for (const [code, names] of [['n', ['caballo', 'knight']], ['b', ['alfil', 'bishop']], ['r', ['torre', 'rook']], ['q', ['dama', 'reina', 'queen']], ['k', ['rey', 'king']]] as const)
    if (names.some((n) => text.includes(n))) piece = code
  const candidates = legal.filter((m) => m.to === target && m.piece === piece)
  return candidates.length === 1 ? candidates[0].san : null
}
