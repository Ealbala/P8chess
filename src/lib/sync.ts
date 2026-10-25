// Shared sync state, so the Games screen and the automatic sync on app open agree.
import { useSyncExternalStore } from 'react'
import { ChessComError, lastSync, syncGames } from './chesscom'

export interface SyncState {
  running: boolean
  progress: string
  added: number | null
  error: ChessComError['code'] | null
}

let state: SyncState = { running: false, progress: '', added: null, error: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )
}

export async function runSync(username: string) {
  if (state.running || !username.trim()) return
  set({ running: true, progress: '', added: null, error: null })
  try {
    const { added } = await syncGames(username, (progress) => set({ progress }))
    set({ added })
  } catch (e) {
    set({ error: e instanceof ChessComError ? e.code : 'network' })
  } finally {
    set({ running: false, progress: '' })
  }
}

/** Sync automatically when the app opens, at most every 15 minutes. */
export async function autoSync(username: string) {
  const prev = await lastSync()
  if (!prev || Date.now() - prev > 15 * 60 * 1000) await runSync(username)
}
