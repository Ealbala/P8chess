// Background analysis: while the app is open, analyse your most recent games in your
// focus time control, one at a time, and store the mistakes found.
import { useSyncExternalStore } from 'react'
import { db, type Settings } from './db'
import { engine } from './engine'
import { ANALYSIS_DEPTH, evaluateGame, findMistakes, gameSans } from './analysis'

const RECENT = 30 // most recent focus games to analyse (plus every new one)

export interface AnalysisState {
  running: boolean
  done: number
  total: number
  error: boolean
}

let state: AnalysisState = { running: false, done: 0, total: 0, error: false }
const listeners = new Set<() => void>()
const set = (p: Partial<AnalysisState>) => {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export function useAnalysisState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )
}

export async function runAnalysis(settings: Settings) {
  if (state.running) return
  const games = (await db.games.orderBy('date').reverse().toArray()).filter((g) => g.tc === settings.focus && g.pgn)
  const queue = games.filter((g, i) => !g.analysis && (i < RECENT || g.date >= settings.createdAt))
  if (!queue.length) return
  set({ running: true, done: 0, total: queue.length, error: false })
  try {
    for (const game of queue) {
      const sans = gameSans(game)
      const evals = await evaluateGame(sans, (fen) => engine.analyse(fen, ANALYSIS_DEPTH))
      const { analysis, positions } = findMistakes(game, sans, evals)
      await db.transaction('rw', db.games, db.positions, async () => {
        await db.games.update(game.id!, { analysis })
        // Keep SRS progress if a position already exists.
        const existing = new Set((await db.positions.where('gameId').equals(game.id!).toArray()).map((p) => p.id))
        await db.positions.bulkAdd(positions.filter((p) => !existing.has(p.id)))
      })
      set({ done: state.done + 1 })
    }
  } catch (e) {
    console.warn('analysis stopped', e)
    set({ error: true })
  } finally {
    set({ running: false })
  }
}
