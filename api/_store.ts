// Shared private storage helpers (Vercel Blob). Files prefixed with "_" are not routes.
import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'

/** Per-user prefix derived from the app password, so paths can't be guessed. */
export function userPrefix(password: string) {
  return `pocho-chess/${createHash('sha256').update(password).digest('hex').slice(0, 24)}`
}

export const storageReady = () => !!process.env.BLOB_READ_WRITE_TOKEN && !!process.env.COACH_PASSWORD

export const passwordOk = (key: string | null | undefined) => !!process.env.COACH_PASSWORD && key === process.env.COACH_PASSWORD

export async function readBlob(path: string): Promise<{ stream: ReadableStream<Uint8Array>; uploadedAt?: Date } | null> {
  for (const access of ['private', 'public'] as const) {
    try {
      const r = await get(path, { access, useCache: false })
      if (r && r.statusCode === 200) return { stream: r.stream, uploadedAt: r.blob.uploadedAt }
    } catch {
      /* try the other access mode */
    }
  }
  return null
}

export async function writeBlob(path: string, body: Buffer | string, contentType: string) {
  let lastError: unknown
  for (const access of ['private', 'public'] as const) {
    try {
      return await put(path, body, { access, addRandomSuffix: false, allowOverwrite: true, contentType })
    } catch (e) {
      lastError = e // a public-only store rejects private blobs: retry as public
    }
  }
  throw lastError
}

export async function readJson<T>(path: string): Promise<T | null> {
  const r = await readBlob(path)
  if (!r) return null
  try {
    return JSON.parse(await new Response(r.stream).text()) as T
  } catch {
    return null
  }
}

export const writeJson = (path: string, value: unknown) => writeBlob(path, JSON.stringify(value), 'application/json')

/** Something the coach (Claude via MCP) sends to the app. */
export interface InboxItem {
  id: string
  type: 'message' | 'assignment' | 'goal'
  title: string
  text: string
  track?: string
  minutes?: number
  plus?: number
  createdAt: string
}

export const inboxPath = (password: string) => `${userPrefix(password)}/inbox.json`
export const contextPath = (password: string) => `${userPrefix(password)}/context.json`
