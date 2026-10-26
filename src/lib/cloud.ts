// Cloud backup client: gzip the full export and send it to /api/backup.
import { db, exportData, importData } from './db'

const LAST_KEY = 'cloud.lastBackup'

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).blob()
}

async function gunzip(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export type CloudError = 'no-storage' | 'no-password' | 'bad-password' | 'no-backup' | 'too-big' | 'network'

async function errorOf(res: Response): Promise<CloudError> {
  const body = await res.json().catch(() => ({}))
  return (['no-storage', 'no-password', 'bad-password', 'no-backup', 'too-big'] as const).includes(body.error) ? body.error : 'network'
}

export async function cloudStatus(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/backup?status')
    return res.ok ? (await res.json()).configured : null
  } catch {
    return null
  }
}

export async function backupNow(password: string): Promise<{ ok: true; bytes: number } | { ok: false; error: CloudError }> {
  try {
    const body = await gzip(await exportData())
    const res = await fetch('/api/backup', { method: 'POST', headers: { 'x-app-key': password }, body })
    if (!res.ok) return { ok: false, error: await errorOf(res) }
    await db.meta.put({ key: LAST_KEY, value: Date.now() })
    return { ok: true, bytes: body.size }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function restoreFromCloud(password: string): Promise<{ ok: true } | { ok: false; error: CloudError }> {
  try {
    const res = await fetch('/api/backup', { headers: { 'x-app-key': password } })
    if (!res.ok) return { ok: false, error: await errorOf(res) }
    await importData(await gunzip(await res.blob()))
    await db.meta.put({ key: LAST_KEY, value: Date.now() })
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function lastBackup(): Promise<number | null> {
  return (await db.meta.get(LAST_KEY))?.value ?? null
}

/** Automatic daily backup when the app opens (only if a password is set). */
export async function autoBackup(password?: string) {
  if (!password) return
  const last = await lastBackup()
  if (last && Date.now() - last < 24 * 3600 * 1000) return
  await backupNow(password)
}
