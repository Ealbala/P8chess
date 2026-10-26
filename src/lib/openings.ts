// Opening trainer logic: spaced repetition for lines, and a comparison of your real
// games against your repertoire ("where did you leave the book?").
import { Chess } from 'chess.js'
import { OPENINGS, DEFAULT_REPERTOIRE, type Opening, type OpeningLine } from '../data/openings'
import type { Game, LineAttempt, LineProgress, Settings } from './db'
import { addDays, dayKey } from './dates'

export const INTERVALS = [0, 1, 3, 7, 14, 30, 60] // days, indexed by box

export function repertoire(settings: Settings): Opening[] {
  const ids = settings.repertoire ?? DEFAULT_REPERTOIRE
  return OPENINGS.filter((o) => ids.includes(o.id))
}

export const lineMoves = (line: OpeningLine) => line.moves.split(' ')

/** New SRS state after finishing a drill. A mistake sends the line back to box 1. */
export function nextProgress(lineId: string, prev: LineProgress | undefined, correct: boolean, today = new Date()): LineProgress {
  const box = correct ? Math.min((prev?.box ?? 0) + 1, INTERVALS.length - 1) : 1
  return { lineId, box, due: dayKey(addDays(today, INTERVALS[box])) }
}

export type LineStatus = 'new' | 'due' | 'learning' | 'known'

export function lineStatus(p: LineProgress | undefined, today = dayKey()): LineStatus {
  if (!p) return 'new'
  if (p.due <= today) return 'due'
  return p.box >= 4 ? 'known' : 'learning'
}

/** Next line to practise: due lines first (most overdue), then new lines in repertoire order. */
export function nextLine(settings: Settings, progress: LineProgress[]): { opening: Opening; line: OpeningLine; mode: 'learn' | 'drill' } | null {
  const byId = new Map(progress.map((p) => [p.lineId, p]))
  const today = dayKey()
  const all = repertoire(settings).flatMap((opening) => opening.lines.map((line) => ({ opening, line })))
  const due = all
    .filter((x) => lineStatus(byId.get(x.line.id), today) === 'due')
    .sort((a, b) => byId.get(a.line.id)!.due.localeCompare(byId.get(b.line.id)!.due))
  if (due.length) return { ...due[0], mode: 'drill' }
  const fresh = all.find((x) => !byId.has(x.line.id))
  return fresh ? { ...fresh, mode: 'learn' } : null
}

export function dueCount(settings: Settings, progress: LineProgress[]) {
  const byId = new Map(progress.map((p) => [p.lineId, p]))
  return repertoire(settings)
    .flatMap((o) => o.lines)
    .filter((l) => lineStatus(byId.get(l.id)) === 'due').length
}

/** Accuracy of drills (learn mode excluded) over the last `n` attempts. */
export function drillAccuracy(attempts: LineAttempt[], n = 30) {
  const drills = attempts.filter((a) => a.mode === 'drill').sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)
  return { n: drills.length, accuracy: drills.length ? drills.filter((a) => a.correct).length / drills.length : 0 }
}

// ---------- Repertoire vs. your games ----------

/** Position key without move counters or en passant, so transpositions match. */
export const posKey = (fen: string) => fen.split(' ').slice(0, 3).join(' ')

/** Map position → moves your repertoire plays (or expects) from there. */
export function buildTree(openings: Opening[]): Map<string, Set<string>> {
  const tree = new Map<string, Set<string>>()
  for (const o of openings) {
    for (const line of o.lines) {
      const c = new Chess()
      for (const san of lineMoves(line)) {
        const k = posKey(c.fen())
        if (!tree.has(k)) tree.set(k, new Set())
        tree.get(k)!.add(san)
        c.move(san)
      }
    }
  }
  return tree
}

/** SAN moves from a PGN's movetext (comments, numbers and result removed). */
export function pgnMoves(pgn: string): string[] {
  const text = pgn.replace(/\[[^\]]*\]\s*/g, '').replace(/\{[^}]*\}/g, ' ')
  return text
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, ''))
}

function formatPath(sans: string[]) {
  return sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ')
}

export interface BookEvent {
  path: string // moves before the event, e.g. "1.e4 e6 2.Nf3"
  move: string // the move that left the repertoire
  expected: string[] // what the repertoire plays there (for your deviations)
  count: number
}

export interface Coverage {
  games: number
  /** Average number of your moves played inside the repertoire. */
  avgBookMoves: number
  /** Opponent moves your repertoire doesn't cover yet (most frequent first). */
  uncovered: BookEvent[]
  /** Positions where you played something other than your repertoire move. */
  deviations: BookEvent[]
}

export function repertoireCoverage(games: Game[], openings: Opening[], color: 'white' | 'black', maxGames = 300): Coverage | null {
  const mine = openings.filter((o) => o.color === color)
  if (!mine.length) return null
  const tree = buildTree(mine)
  const list = games.filter((g) => g.color === color && g.pgn).slice(0, maxGames)
  if (!list.length) return null
  const uncovered = new Map<string, BookEvent>()
  const deviations = new Map<string, BookEvent>()
  let bookPlies = 0
  for (const g of list) {
    const sans = pgnMoves(g.pgn!).slice(0, 30)
    const c = new Chess()
    for (let i = 0; i < sans.length; i++) {
      const expected = tree.get(posKey(c.fen()))
      if (!expected) break // end of a line: fully in book
      const myTurn = (c.turn() === 'w') === (color === 'white')
      if (!expected.has(sans[i])) {
        const map = myTurn ? deviations : uncovered
        const key = `${formatPath(sans.slice(0, i))}|${sans[i]}`
        const ev = map.get(key) ?? { path: formatPath(sans.slice(0, i)), move: sans[i], expected: [...expected], count: 0 }
        ev.count++
        map.set(key, ev)
        break
      }
      if (myTurn) bookPlies++
      try {
        c.move(sans[i])
      } catch {
        break
      }
    }
  }
  const top = (m: Map<string, BookEvent>) => [...m.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  return { games: list.length, avgBookMoves: bookPlies / list.length, uncovered: top(uncovered), deviations: top(deviations) }
}
