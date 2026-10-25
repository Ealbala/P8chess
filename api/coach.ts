// Vercel serverless function: the AI coach. The Anthropic API key stays on the server
// (Vercel env var ANTHROPIC_API_KEY); the app sends your data summary and question.
// Optional COACH_PASSWORD protects the endpoint so nobody else can spend your credits.
import Anthropic from '@anthropic-ai/sdk'

const MAX_CONTEXT_CHARS = 40_000
const MAX_MESSAGE_CHARS = 4_000
const MAX_TURNS = 12

interface Body {
  lang: 'en' | 'es'
  context: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

const SYSTEM = {
  es: `Sos el entrenador personal de ajedrez de Pocho (≈1500 en Chess.com, objetivo de subir de rating).
Respondés en español rioplatense, claro y concreto, como un coach exigente pero motivador.

Reglas:
- Basate SOLO en los datos de Pocho que vienen abajo (partidas, errores encontrados por Stockfish, estadísticas, revisiones). Citá números y ejemplos concretos de sus partidas.
- Para explicar una posición, usá únicamente las jugadas y líneas de Stockfish que aparecen en los datos. No inventes variantes, amenazas ni jugadas que no estén ahí. Si los datos no alcanzan para afirmar algo, decilo.
- Evitá consejos genéricos ("practicá más táctica") sin explicar por qué según sus datos y qué ejercicio concreto de la app hacer (Tus errores, Aperturas, Táctica, Cálculo, Medio juego, Finales, A ciegas).
- No atribuyas errores a causas psicológicas sin evidencia (por ejemplo, datos de reloj o etiquetas que él mismo marcó).
- Las estadísticas de la app no son ratings oficiales; no prometas fechas para llegar a un rating.
- Respuestas breves (máx. ~200 palabras) salvo que pida un informe. Usá viñetas cuando ayuden.`,
  en: `You are Pocho's personal chess coach (≈1500 on Chess.com, working to improve).
Answer in clear, concrete English, like a demanding but encouraging coach.

Rules:
- Use ONLY Pocho's data below (games, Stockfish-detected mistakes, stats, reviews). Quote numbers and concrete examples from his games.
- To explain a position, only use the moves and Stockfish lines given in the data. Never invent variations, threats or moves that are not there. If the data is not enough to claim something, say so.
- No generic advice ("do more tactics") without explaining why from his data and which concrete app exercise to do (Your mistakes, Openings, Tactics, Calculation, Middlegame, Endgames, Blindfold).
- Don't attribute mistakes to psychological causes without evidence (e.g. clock data or tags he chose himself).
- App statistics are not official ratings; never promise dates for reaching a rating.
- Keep answers short (max ~200 words) unless he asks for a report. Use bullets when helpful.`,
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export function GET() {
  return json(200, { configured: !!process.env.ANTHROPIC_API_KEY, passwordRequired: !!process.env.COACH_PASSWORD })
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'not-configured' })
  if (process.env.COACH_PASSWORD && request.headers.get('x-coach-key') !== process.env.COACH_PASSWORD) {
    return json(401, { error: 'bad-password' })
  }
  let body: Body
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'bad-request' })
  }
  const lang = body.lang === 'en' ? 'en' : 'es'
  const messages = (body.messages ?? [])
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
  if (!messages.length || messages[0].role !== 'user') return json(400, { error: 'bad-request' })

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      // If a request is ever declined by a safety classifier, retry it on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      system: [
        { type: 'text', text: SYSTEM[lang] },
        { type: 'text', text: `DATOS DE POCHO / POCHO'S DATA (JSON):\n${String(body.context ?? '').slice(0, MAX_CONTEXT_CHARS)}` },
      ],
      messages,
    })
    if (response.stop_reason === 'refusal') return json(200, { text: '', refused: true })
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    return json(200, { text })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(503, { error: 'bad-api-key' })
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: 'rate-limit' })
    if (error instanceof Anthropic.APIError) return json(502, { error: `api-${error.status}` })
    return json(502, { error: 'network' })
  }
}
