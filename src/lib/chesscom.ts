// Chess.com Public API (https://www.chess.com/news/view/published-data-api).
// Public data only: games, PGN, ratings. No login needed. It does NOT provide engine
// analysis; "accuracy" exists only for games you reviewed on Chess.com.
import { db, type Game, type RatingEntry, type TimeControl } from './db'

const API = 'https://api.chess.com/pub/player'
const FIRST_SYNC_MONTHS = 6
const LAST_SYNC_KEY = 'chesscom.lastSync'

export class ChessComError extends Error {
  constructor(public code: 'not-found' | 'rate-limit' | 'network') {
    super(code)
  }
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    // 'no-cache' revalidates with the server (ETag), as Chess.com asks API users to do.
    res = await fetch(url, { cache: 'no-cache' })
  } catch {
    throw new ChessComError('network')
  }
  if (res.status === 404) throw new ChessComError('not-found')
  if (res.status === 429 || res.status === 403) throw new ChessComError('rate-limit')
  if (!res.ok) throw new ChessComError('network')
  return res.json()
}

interface ApiPlayer {
  username: string
  rating: number
  result: string
}
interface ApiGame {
  url: string
  uuid: string
  pgn?: string
  time_control: string
  time_class: string
  end_time: number
  rated: boolean
  rules: string
  eco?: string
  accuracies?: { white: number; black: number }
  white: ApiPlayer
  black: ApiPlayer
}

interface ApiStats {
  [key: string]: { last?: { rating: number; date: number } } | undefined
}

/** Current ratings from the player's stats page (used to prefill onboarding). */
export async function fetchCurrentRatings(username: string): Promise<Partial<Record<TimeControl, number>>> {
  const stats = await getJson<ApiStats>(`${API}/${username.toLowerCase()}/stats`)
  const out: Partial<Record<TimeControl, number>> = {}
  for (const tc of ['rapid', 'blitz', 'bullet'] as const) {
    const r = stats[`chess_${tc}`]?.last?.rating
    if (r) out[tc] = r
  }
  return out
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

export function mapResult(code: string): Game['result'] {
  if (code === 'win') return 'win'
  if (DRAWS.has(code)) return 'draw'
  return 'loss'
}

/** "https://www.chess.com/openings/Sicilian-Defense-Open-2...a6" → "Sicilian Defense Open 2...a6" */
export function openingName(ecoUrl?: string): string | undefined {
  if (!ecoUrl) return undefined
  const slug = decodeURIComponent(ecoUrl.split('/openings/')[1] ?? '')
  return slug ? slug.replace(/-/g, ' ') : undefined
}

const FAMILY_END = new Set(['Defense', 'Opening', 'Game', 'Gambit', 'Attack', 'System'])

/**
 * Opening family for grouping stats, e.g. "French Defense Advance Variation" → "French Defense".
 * Cuts after the first Defense/Opening/Game/Gambit/Attack/System word, otherwise keeps two words.
 */
export function openingFamily(name?: string): string {
  if (!name) return '?'
  const words = name.split(' ')
  const end = words.findIndex((w) => FAMILY_END.has(w))
  return (end >= 0 && end < 4 ? words.slice(0, end + 1) : words.slice(0, 2)).join(' ')
}

/** Remaining clock in seconds after every ply, from PGN "[%clk h:mm:ss.s]" comments. */
export function parseClocks(pgn: string): number[] {
  const out: number[] = []
  for (const m of pgn.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)) {
    out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
  }
  return out
}

/** Base time in seconds from a Chess.com time control ("600", "180+2"). */
export function baseSeconds(timeControl?: string): number | null {
  if (!timeControl || timeControl.includes('/')) return null // daily games use "1/86400"
  const n = Number(timeControl.split('+')[0])
  return Number.isFinite(n) ? n : null
}

export function convertGame(g: ApiGame, username: string): { game: Game; rating?: Omit<RatingEntry, 'gameId'> } | null {
  const tc = g.time_class as TimeControl
  if (g.rules !== 'chess' || !['rapid', 'blitz', 'bullet'].includes(tc)) return null
  const user = username.toLowerCase()
  const isWhite = g.white.username.toLowerCase() === user
  if (!isWhite && g.black.username.toLowerCase() !== user) return null
  const me = isWhite ? g.white : g.black
  const opp = isWhite ? g.black : g.white
  const date = new Date(g.end_time * 1000).toISOString()
  const clocks = g.pgn ? parseClocks(g.pgn) : []
  const myClocks = clocks.filter((_, i) => i % 2 === (isWhite ? 0 : 1))
  const game: Game = {
    date,
    tc,
    result: mapResult(me.result),
    color: isWhite ? 'white' : 'black',
    ratingAfter: me.rating,
    opponentRating: opp.rating,
    opponent: opp.username,
    opening: openingName(g.eco),
    source: 'chesscom',
    reviewed: false,
    uuid: g.uuid,
    url: g.url,
    pgn: g.pgn,
    timeControl: g.time_control,
    endReason: me.result,
    accuracy: g.accuracies ? g.accuracies[isWhite ? 'white' : 'black'] : undefined,
    myClocks,
    plies: clocks.length,
  }
  return { game, rating: g.rated ? { date, tc, rating: me.rating, source: 'chesscom' } : undefined }
}

export async function lastSync(): Promise<number | null> {
  return (await db.meta.get(LAST_SYNC_KEY))?.value ?? null
}

/**
 * Imports new games. First sync: the last 6 monthly archives. Later syncs: only the
 * months since the previous sync. Duplicates are skipped by the game's uuid.
 */
export async function syncGames(username: string, onProgress?: (msg: string) => void): Promise<{ added: number }> {
  const user = username.trim().toLowerCase()
  const { archives } = await getJson<{ archives: string[] }>(`${API}/${user}/games/archives`)
  const prev = await lastSync()
  let months: string[]
  if (prev === null) {
    months = archives.slice(-FIRST_SYNC_MONTHS)
  } else {
    const d = new Date(prev)
    const from = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    months = archives.filter((url) => url.slice(-7) >= from)
  }

  let added = 0
  for (const [i, url] of months.entries()) {
    onProgress?.(`${url.slice(-7)} (${i + 1}/${months.length})`)
    const { games } = await getJson<{ games: ApiGame[] }>(url)
    const converted = games.map((g) => convertGame(g, user)).filter((x) => x !== null)
    const existing = new Set(
      (await db.games.where('uuid').anyOf(converted.map((c) => c.game.uuid!)).toArray()).map((g) => g.uuid),
    )
    const fresh = converted.filter((c) => !existing.has(c.game.uuid))
    await db.transaction('rw', db.games, db.ratings, async () => {
      for (const c of fresh) {
        const id = await db.games.add(c.game)
        if (c.rating) await db.ratings.add({ ...c.rating, gameId: id })
      }
    })
    added += fresh.length
    if (i < months.length - 1) await new Promise((r) => setTimeout(r, 400)) // be gentle with the API
  }
  await db.meta.put({ key: LAST_SYNC_KEY, value: Date.now() })
  return { added }
}
