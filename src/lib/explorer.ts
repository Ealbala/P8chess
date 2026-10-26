// Opening explorer: next moves in a position, from your own games (local) and from
// Lichess players around your level (needs a free Lichess API token).
import { Chess } from 'chess.js'
import type { Game } from './db'
import { pgnMoves, posKey } from './openings'

export interface ExplorerMove {
  san: string
  games: number
  /** From the side to move's point of view, in %. */
  win: number
  draw: number
  loss: number
}

type Stat = { games: number; w: number; d: number; l: number }

/**
 * Index of your games: position → move → result for the side that moved (your results
 * when you moved, your opponent's when they did — shown from the mover's view).
 */
export function buildGameIndex(games: Game[], maxPlies = 24): Map<string, Map<string, Stat>> {
  const index = new Map<string, Map<string, Stat>>()
  for (const g of games) {
    if (!g.pgn) continue
    const c = new Chess()
    const sans = pgnMoves(g.pgn).slice(0, maxPlies)
    for (const san of sans) {
      const key = posKey(c.fen())
      const moverIsMe = (c.turn() === 'w') === (g.color === 'white')
      const myResult = g.result
      const res = moverIsMe ? myResult : myResult === 'win' ? 'loss' : myResult === 'loss' ? 'win' : 'draw'
      const moves = index.get(key) ?? new Map<string, Stat>()
      const s = moves.get(san) ?? { games: 0, w: 0, d: 0, l: 0 }
      s.games++
      if (res === 'win') s.w++
      else if (res === 'draw') s.d++
      else s.l++
      moves.set(san, s)
      index.set(key, moves)
      try {
        c.move(san)
      } catch {
        break
      }
    }
  }
  return index
}

export function movesFromIndex(index: Map<string, Map<string, Stat>>, fen: string): ExplorerMove[] {
  const moves = index.get(posKey(fen))
  if (!moves) return []
  return [...moves]
    .map(([san, s]) => ({
      san,
      games: s.games,
      win: Math.round((s.w / s.games) * 100),
      draw: Math.round((s.d / s.games) * 100),
      loss: Math.round((s.l / s.games) * 100),
    }))
    .sort((a, b) => b.games - a.games)
}

export type LichessError = 'no-token' | 'bad-token' | 'network'

/** Lichess explorer (rapid + blitz, players rated 1400–1800). */
export async function lichessMoves(fen: string, token?: string): Promise<ExplorerMove[] | { error: LichessError }> {
  if (!token) return { error: 'no-token' }
  const url =
    'https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid&ratings=1400,1600,1800&moves=12&fen=' +
    encodeURIComponent(fen)
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    return { error: 'network' }
  }
  if (res.status === 401 || res.status === 403) return { error: 'bad-token' }
  if (!res.ok) return { error: 'network' }
  const body = (await res.json()) as { moves: { san: string; white: number; draws: number; black: number }[] }
  const whiteToMove = fen.split(' ')[1] === 'w'
  return body.moves.map((m) => {
    const games = m.white + m.draws + m.black
    const mine = whiteToMove ? m.white : m.black
    const theirs = whiteToMove ? m.black : m.white
    return {
      san: m.san,
      games,
      win: Math.round((mine / games) * 100),
      draw: Math.round((m.draws / games) * 100),
      loss: Math.round((theirs / games) * 100),
    }
  })
}
