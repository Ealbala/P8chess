// What the coach (Claude via MCP) sent to the app: messages, assigned training, goals.
// The app reads it with the app password; items stay on the server (last 50).
import { inboxPath, passwordOk, readJson, storageReady, type InboxItem } from './_store.js'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export async function GET(request: Request) {
  if (!storageReady()) return json(503, { error: 'no-storage' })
  if (!passwordOk(request.headers.get('x-app-key'))) return json(401, { error: 'bad-password' })
  const items = (await readJson<InboxItem[]>(inboxPath(process.env.COACH_PASSWORD!))) ?? []
  return json(200, { items })
}
