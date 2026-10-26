// Remote MCP server (Streamable HTTP, stateless, JSON responses) so Claude — on your own
// Claude subscription, at no API cost — can read your public Chess.com data.
// Add it in Claude: Settings → Connectors → Add custom connector → https://<your-app>/api/mcp
// Public tools read Chess.com only. With ?key=<app password> in the URL, Claude can also read
// the app's own data (Stockfish findings, section ratings) and send messages, assigned
// training and goals back to the app. No engine here: Claude must not invent evaluations.
import { contextPath, inboxPath, passwordOk, readJson, storageReady, writeJson, type InboxItem } from './_store'

const SERVER = { name: 'pocho-chess', version: '1.0.0' }
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const API = 'https://api.chess.com/pub/player'
const DEFAULT_USER = process.env.DEFAULT_CHESSCOM_USER || 'Pochox23'

const INSTRUCTIONS = `Pocho Chess: Chess.com data for the user (default username ${DEFAULT_USER}).
Use these tools to coach the user with facts from his real games. The data has no engine
evaluations: when you assess moves, say it is your own reading of the position, keep claims
concrete and checkable, and never invent moves that were not played. For engine-verified
mistakes, the user can paste the summary exported from the Pocho Chess app.`

const APP_INSTRUCTIONS = `
App tools are enabled. get_app_training_data has the app's engine-verified data (Stockfish mistakes,
section ratings, weak themes, plan). Prefer it over guessing. You can send things to the app:
send_coach_message (advice, reports), assign_training (a timed session in one section) and
set_training_goal. Send them when the user asks or when it clearly helps; tell the user what you sent.
Write messages in the user's language (Spanish unless he writes in English).`

const TRACK_IDS = ['openings', 'middlegame', 'endgame', 'calculation', 'forks', 'pins', 'discovered', 'mates', 'sacrifices', 'attack', 'defense', 'hanging', 'pawns', 'rook-endgames', 'minor-endgames', 'queen-endgames']

type Json = Record<string, unknown>

const TOOLS = [
  {
    name: 'get_player_overview',
    description: 'Current Chess.com ratings (rapid, blitz, bullet), best ratings and win/loss/draw records.',
    inputSchema: {
      type: 'object',
      properties: { username: { type: 'string', description: `Chess.com username (default ${DEFAULT_USER})` } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_recent_games',
    description:
      'Most recent games with date, colour, result and how it ended, ratings, opponent, opening, Chess.com accuracy (if reviewed there), clock usage and the moves (SAN).',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: `Chess.com username (default ${DEFAULT_USER})` },
        time_class: { type: 'string', enum: ['rapid', 'blitz', 'bullet', 'all'], description: 'Filter by time control (default rapid)' },
        count: { type: 'integer', minimum: 1, maximum: 20, description: 'How many games (default 10)' },
        include_moves: { type: 'boolean', description: 'Include the move list of each game (default true)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_rating_history',
    description: 'Rating after each rated game in one time control over the last months, to see trends.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        time_class: { type: 'string', enum: ['rapid', 'blitz', 'bullet'] },
        months: { type: 'integer', minimum: 1, maximum: 6 },
      },
      additionalProperties: false,
    },
  },
]

const APP_TOOLS = [
  {
    name: 'get_app_training_data',
    description:
      "Pocho Chess app data uploaded from the user's phone: engine-verified (Stockfish) mistakes with best lines, mistakes per phase, section (track) ratings, weakest puzzle themes, training minutes, repertoire coverage, results and the messages you already sent.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'send_coach_message',
    description: 'Send a coach message to the app (advice, a weekly report, a game analysis). Shown in the app until he dismisses it.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title (max 80 chars)' },
        text: { type: 'string', description: 'The message (plain text, max 4000 chars)' },
      },
      required: ['title', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'assign_training',
    description: 'Assign a timed training session in one section of the app. The app shows a button that starts it.',
    inputSchema: {
      type: 'object',
      properties: {
        track: { type: 'string', enum: TRACK_IDS, description: 'Training section' },
        minutes: { type: 'integer', minimum: 5, maximum: 120 },
        note: { type: 'string', description: 'Why this session (max 500 chars)' },
      },
      required: ['track', 'minutes'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_training_goal',
    description: "Propose a goal: raise a section's rating by N points. The user accepts it in the app.",
    inputSchema: {
      type: 'object',
      properties: {
        track: { type: 'string', enum: TRACK_IDS },
        plus: { type: 'integer', minimum: 25, maximum: 400, description: 'Rating points to gain' },
        note: { type: 'string', description: 'Why (max 500 chars)' },
      },
      required: ['track', 'plus'],
      additionalProperties: false,
    },
  },
]

async function chesscom<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'PochoChess-MCP/1.0 (personal coaching app)' } })
  if (res.status === 404) throw new Error('Chess.com user or data not found')
  if (!res.ok) throw new Error(`Chess.com API error ${res.status}`)
  return res.json() as Promise<T>
}

interface ApiGame {
  url: string
  pgn?: string
  time_class: string
  time_control: string
  end_time: number
  rated: boolean
  rules: string
  eco?: string
  accuracies?: { white: number; black: number }
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

export function movesFromPgn(pgn: string): string {
  return pgn
    .replace(/\[[^\]]*\]\s*/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\d+\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clockSummary(pgn: string, white: boolean) {
  const clocks = [...pgn.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3])
  const mine = clocks.filter((_, i) => i % 2 === (white ? 0 : 1))
  if (!mine.length) return undefined
  return { min_clock_seconds: Math.round(Math.min(...mine)), final_clock_seconds: Math.round(mine[mine.length - 1]) }
}

async function recentArchives(user: string, months: number) {
  const { archives } = await chesscom<{ archives: string[] }>(`${API}/${user}/games/archives`)
  const games: ApiGame[] = []
  for (const url of archives.slice(-months).reverse()) {
    const { games: g } = await chesscom<{ games: ApiGame[] }>(url)
    games.push(...g.reverse())
  }
  return games.filter((g) => g.rules === 'chess')
}

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

async function addToInbox(item: Omit<InboxItem, 'id' | 'createdAt'>) {
  const path = inboxPath(process.env.COACH_PASSWORD!)
  const items = (await readJson<InboxItem[]>(path)) ?? []
  const full: InboxItem = { ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() }
  await writeJson(path, [...items, full].slice(-50))
  return { sent: true, id: full.id, note: 'It appears in the Pocho Chess app next time it is opened.' }
}

async function callAppTool(name: string, args: Json): Promise<unknown> {
  const pw = process.env.COACH_PASSWORD!
  if (name === 'get_app_training_data') {
    const ctx = await readJson<{ updatedAt: string; context: unknown }>(contextPath(pw))
    const sent = ((await readJson<InboxItem[]>(inboxPath(pw))) ?? []).slice(-10)
    if (!ctx) return { error: 'No data uploaded yet. Ask the user to open the Pocho Chess app (with the app password set in Settings).' }
    return { uploadedAt: ctx.updatedAt, data: ctx.context, messagesYouSentRecently: sent }
  }
  const track = clip(args.track, 40)
  if ((name === 'assign_training' || name === 'set_training_goal') && !TRACK_IDS.includes(track)) throw new Error(`Unknown track: ${track}`)
  if (name === 'send_coach_message') {
    const text = clip(args.text, 4000)
    if (!text) throw new Error('Empty message')
    return addToInbox({ type: 'message', title: clip(args.title, 80) || 'Coach', text })
  }
  if (name === 'assign_training') {
    const minutes = Math.min(120, Math.max(5, Math.round(Number(args.minutes) || 30)))
    return addToInbox({ type: 'assignment', title: track, text: clip(args.note, 500), track, minutes })
  }
  if (name === 'set_training_goal') {
    const plus = Math.min(400, Math.max(25, Math.round(Number(args.plus) || 100)))
    return addToInbox({ type: 'goal', title: track, text: clip(args.note, 500), track, plus })
  }
  throw new Error(`Unknown tool: ${name}`)
}

async function callTool(name: string, args: Json): Promise<unknown> {
  const user = String(args.username || DEFAULT_USER).toLowerCase()
  if (name === 'get_player_overview') {
    const stats = await chesscom<Record<string, { last?: { rating: number }; best?: { rating: number }; record?: Json }>>(`${API}/${user}/stats`)
    const out: Json = { username: user }
    for (const tc of ['rapid', 'blitz', 'bullet']) {
      const s = stats[`chess_${tc}`]
      if (s) out[tc] = { rating: s.last?.rating, best: s.best?.rating, record: s.record }
    }
    return out
  }
  if (name === 'get_recent_games') {
    const tc = String(args.time_class || 'rapid')
    const count = Math.min(20, Math.max(1, Number(args.count) || 10))
    const withMoves = args.include_moves !== false
    const games = (await recentArchives(user, 3)).filter((g) => tc === 'all' || g.time_class === tc).slice(0, count)
    return games.map((g) => {
      const white = g.white.username.toLowerCase() === user
      const me = white ? g.white : g.black
      const opp = white ? g.black : g.white
      return {
        date: new Date(g.end_time * 1000).toISOString().slice(0, 16),
        time_control: `${g.time_class} ${g.time_control}`,
        color: white ? 'white' : 'black',
        result: me.result === 'win' ? 'win' : DRAWS.has(me.result) ? 'draw' : 'loss',
        how: me.result === 'win' ? opp.result : me.result,
        my_rating: me.rating,
        opponent: `${opp.username} (${opp.rating})`,
        opening: g.eco?.split('/openings/')[1]?.replace(/-/g, ' '),
        chesscom_accuracy: g.accuracies ? g.accuracies[white ? 'white' : 'black'] : undefined,
        clock: g.pgn ? clockSummary(g.pgn, white) : undefined,
        moves: withMoves && g.pgn ? movesFromPgn(g.pgn) : undefined,
        url: g.url,
      }
    })
  }
  if (name === 'get_rating_history') {
    const tc = String(args.time_class || 'rapid')
    const months = Math.min(6, Math.max(1, Number(args.months) || 3))
    const games = (await recentArchives(user, months)).filter((g) => g.time_class === tc && g.rated).reverse()
    return games.map((g) => {
      const me = g.white.username.toLowerCase() === user ? g.white : g.black
      return { date: new Date(g.end_time * 1000).toISOString().slice(0, 10), rating: me.rating }
    })
  }
  throw new Error(`Unknown tool: ${name}`)
}

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Json
}

/** `app` = the request carried the app password, so the app tools are available. */
export async function handleRpc(msg: RpcRequest, app = false): Promise<Json | null> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } })
  if (msg.id === undefined) return null // notification (e.g. notifications/initialized)
  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion ?? '')
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: app ? INSTRUCTIONS + APP_INSTRUCTIONS : INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: app ? [...TOOLS, ...APP_TOOLS] : TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      const isApp = app && APP_TOOLS.some((t) => t.name === name)
      if (!isApp && !TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`)
      try {
        const args = (msg.params?.arguments as Json) ?? {}
        const data = isApp ? await callAppTool(name, args) : await callTool(name, args)
        return reply({ content: [{ type: 'text', text: JSON.stringify(data) }] })
      } catch (e) {
        return reply({ content: [{ type: 'text', text: String(e instanceof Error ? e.message : e) }], isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-session-id, mcp-protocol-version, authorization',
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

/** No server-initiated stream: this server only answers requests. */
export function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { ...CORS, allow: 'POST' } })
}

export async function POST(request: Request) {
  let body: RpcRequest | RpcRequest[]
  try {
    body = await request.json()
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS })
  }
  const batch = Array.isArray(body)
  const messages: RpcRequest[] = Array.isArray(body) ? body : [body]
  const app = storageReady() && passwordOk(new URL(request.url).searchParams.get('key'))
  const results = (await Promise.all(messages.map((m) => handleRpc(m, app)))).filter((r) => r !== null)
  if (!results.length) return new Response(null, { status: 202, headers: CORS })
  return Response.json(batch ? results : results[0], { headers: CORS })
}
