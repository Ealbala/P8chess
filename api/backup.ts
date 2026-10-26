// Cloud backup of the app's data (Vercel Blob). The app sends a gzipped JSON export;
// it is stored privately under a path derived from your app password (COACH_PASSWORD).
// Needs: a Blob store connected to the Vercel project (adds BLOB_READ_WRITE_TOKEN).
import { head } from '@vercel/blob'
import { contextPath, passwordOk, readBlob, userPrefix, writeBlob, writeJson } from './_store.js'

const MAX_BYTES = 4_000_000

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function check(request: Request): { path: string } | Response {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(503, { error: 'no-storage' })
  if (!process.env.COACH_PASSWORD) return json(503, { error: 'no-password' })
  if (!passwordOk(request.headers.get('x-app-key'))) return json(401, { error: 'bad-password' })
  return { path: `${userPrefix(process.env.COACH_PASSWORD)}/backup.json.gz` }
}

/** GET ?status → { configured }, GET → the latest backup (gzip bytes). */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has('status')) {
    return json(200, { configured: !!process.env.BLOB_READ_WRITE_TOKEN && !!process.env.COACH_PASSWORD })
  }
  const c = check(request)
  if (c instanceof Response) return c
  const r = await readBlob(c.path)
  if (!r) return json(404, { error: 'no-backup' })
  return new Response(r.stream, { headers: { 'content-type': 'application/gzip', 'x-uploaded-at': String(r.uploadedAt ?? '') } })
}

/**
 * POST gzip bytes → stores them, replacing the previous backup.
 * POST ?kind=context with JSON → the training summary the coach (Claude via MCP) reads.
 */
export async function POST(request: Request) {
  const c = check(request)
  if (c instanceof Response) return c
  const kind = new URL(request.url).searchParams.get('kind')
  const body = await request.arrayBuffer()
  if (!body.byteLength || body.byteLength > MAX_BYTES) return json(413, { error: 'too-big' })
  try {
    if (kind === 'context') {
      const context = JSON.parse(Buffer.from(body).toString('utf8'))
      await writeJson(contextPath(process.env.COACH_PASSWORD!), { updatedAt: new Date().toISOString(), context })
      return json(200, { ok: true })
    }
    await writeBlob(c.path, Buffer.from(body), 'application/gzip')
    const info = await head(c.path).catch(() => null)
    return json(200, { ok: true, bytes: body.byteLength, uploadedAt: info?.uploadedAt ?? new Date().toISOString() })
  } catch (e) {
    return json(502, { error: 'storage-error', detail: String(e).slice(0, 200) })
  }
}
