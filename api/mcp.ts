// Remote MCP server (Streamable HTTP, stateless, JSON responses) so Claude — on your own
// Claude subscription, at no API cost — can read your public Chess.com data.
// Add it in Claude: Settings → Connectors → Add custom connector → https://<your-app>/api/mcp
// Read-only, public data only. No engine here: Claude must not invent evaluations.

const SERVER = { name: 'pocho-chess', version: '1.0.0' }
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const API = 'https://api.chess.com/pub/player'
const DEFAULT_USER = process.env.DEFAULT_CHESSCOM_USER || 'Pochox23'

const INSTRUCTIONS = `Pocho Chess: Chess.com data for the user (default username ${DEFAULT_USER}).
Use these tools to coach the user with facts from his real games. The data has no engine
evaluations: when you assess moves, say it is your own reading of the position, keep claims
concrete and checkable, and never invent moves that were not played. For engine-verified
mistakes, the user can paste the summary exported from the Pocho Chess app.`

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

export async function handleRpc(msg: RpcRequest): Promise<Json | null> {
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
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`)
      try {
        const data = await callTool(name, (msg.params?.arguments as Json) ?? {})
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
  const results = (await Promise.all(messages.map(handleRpc))).filter((r) => r !== null)
  if (!results.length) return new Response(null, { status: 202, headers: CORS })
  return Response.json(batch ? results : results[0], { headers: CORS })
}
