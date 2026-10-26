// Two-way link with Claude (MCP): the app uploads its training summary for Claude to read,
// and fetches what Claude sent back (messages, assigned sessions, goals). Free: it runs on
// the user's Claude subscription plus the app's own storage, no API key.
import type { AppData } from './data'
import { db, type CoachItem } from './db'
import { buildContext } from './coach'

const UPLOAD_KEY = 'coach.contextUploaded'
const UPLOAD_EVERY = 30 * 60 * 1000

/** Upload the summary Claude reads (at most every 30 min unless forced). */
export async function uploadContext(data: AppData, password: string, force = false): Promise<boolean> {
  const last = (await db.meta.get(UPLOAD_KEY))?.value ?? 0
  if (!force && Date.now() - last < UPLOAD_EVERY) return true
  try {
    const res = await fetch('/api/backup?kind=context', {
      method: 'POST',
      headers: { 'x-app-key': password, 'content-type': 'application/json' },
      body: buildContext(data),
    })
    if (!res.ok) return false
    await db.meta.put({ key: UPLOAD_KEY, value: Date.now() })
    return true
  } catch {
    return false
  }
}

/** Fetch Claude's items; new ones are stored locally (dismissed ones stay dismissed). */
export async function fetchInbox(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/inbox', { headers: { 'x-app-key': password } })
    if (!res.ok) return false
    const { items } = (await res.json()) as { items: CoachItem[] }
    const known = new Set((await db.coachItems.toCollection().primaryKeys()) as string[])
    await db.coachItems.bulkAdd(items.filter((i) => !known.has(i.id)).map(({ done: _, ...i }) => i))
    return true
  } catch {
    return false
  }
}

/** On app open (and on demand): get Claude's items and keep its copy of the data fresh. */
export async function syncCoach(data: AppData, password?: string, force = false): Promise<boolean> {
  if (!password) return false
  const [got, uploaded] = await Promise.all([fetchInbox(password), uploadContext(data, password, force)])
  return got && uploaded
}

export async function lastUpload(): Promise<number | null> {
  return (await db.meta.get(UPLOAD_KEY))?.value ?? null
}
