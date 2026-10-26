// Cloud backup of the app's data (Vercel Blob). The app sends a gzipped JSON export;
// it is stored privately under a path derived from your app password (COACH_PASSWORD).
// Needs: a Blob store connected to the Vercel project (adds BLOB_READ_WRITE_TOKEN).
import { createHash } from 'node:crypto'
import { get, head, put } from '@vercel/blob'

const MAX_BYTES = 4_000_000

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function check(request: Request): { path: string } | Response {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(503, { error: 'no-storage' })
  if (!process.env.COACH_PASSWORD) return json(503, { error: 'no-password' })
  if (request.headers.get('x-app-key') !== process.env.COACH_PASSWORD) return json(401, { error: 'bad-password' })
  const id = createHash('sha256').update(process.env.COACH_PASSWORD).digest('hex').slice(0, 24)
  return { path: `pocho-chess/backup-${id}.json.gz` }
}

/** GET ?status → { configured }, GET → the latest backup (gzip bytes). */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has('status')) {
    return json(200, { configured: !!process.env.BLOB_READ_WRITE_TOKEN && !!process.env.COACH_PASSWORD })
  }
  const c = check(request)
  if (c instanceof Response) return c
  for (const access of ['private', 'public'] as const) {
    try {
      const r = await get(c.path, { access, useCache: false })
      if (r && r.statusCode === 200) {
        return new Response(r.stream, {
          headers: { 'content-type': 'application/gzip', 'x-uploaded-at': String(r.blob.uploadedAt ?? '') },
        })
      }
    } catch {
      /* try the other access mode */
    }
  }
  return json(404, { error: 'no-backup' })
}

/** POST gzip bytes → stores them, replacing the previous backup. */
export async function POST(request: Request) {
  const c = check(request)
  if (c instanceof Response) return c
  const body = await request.arrayBuffer()
  if (!body.byteLength || body.byteLength > MAX_BYTES) return json(413, { error: 'too-big' })
  let lastError: unknown
  for (const access of ['private', 'public'] as const) {
    try {
      await put(c.path, Buffer.from(body), { access, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/gzip' })
      const info = await head(c.path).catch(() => null)
      return json(200, { ok: true, bytes: body.byteLength, uploadedAt: info?.uploadedAt ?? new Date().toISOString() })
    } catch (e) {
      lastError = e // a public-only store rejects private blobs: retry as public
    }
  }
  return json(502, { error: 'storage-error', detail: String(lastError).slice(0, 200) })
}
