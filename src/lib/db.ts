// Local database (IndexedDB via Dexie). Everything is stored on this device.
// Use Settings → Backup to export a copy of your data.
import Dexie, { type EntityTable } from 'dexie'

export type TimeControl = 'rapid' | 'blitz' | 'bullet'
export type Activity = 'tactics' | 'calculation' | 'endgame' | 'blindfold' | 'review'
export type Lang = 'en' | 'es'
export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  id: 'main'
  lang: Lang
  theme: ThemePref
  focus: TimeControl
  /** Starting rating per time control (entered during onboarding). */
  startRatings: Record<TimeControl, number>
  /** Ordered rating milestones per time control, e.g. [1600, 1700, 1800]. */
  milestones: Record<TimeControl, number[]>
  /** Games per week to play, per time control. */
  weeklyGames: Record<TimeControl, number>
  dailyMinutes: 10 | 20 | 30 | 45 | 60
  chessComUsername: string
  createdAt: string
}

export interface RatingEntry {
  id?: number
  date: string // ISO datetime
  tc: TimeControl
  rating: number
  source: 'start' | 'manual' | 'game' | 'chesscom'
  gameId?: number
}

export interface Game {
  id?: number
  date: string
  tc: TimeControl
  result: 'win' | 'loss' | 'draw'
  color: 'white' | 'black'
  ratingAfter?: number
  opponentRating?: number
  opening?: string
  source: 'manual' | 'chesscom'
  reviewed: boolean
  reviewedAt?: string
  lesson?: string
  /** Ply index (1 = first move) you marked as the key moment during review. */
  keyPly?: number
  /** Self-reported mistake categories chosen during review. */
  mistakeTags?: string[]
  // --- Chess.com imports only ---
  uuid?: string
  url?: string
  pgn?: string
  /** e.g. "600" or "180+2" */
  timeControl?: string
  opponent?: string
  /** Chess.com result code for you: win, checkmated, timeout, resigned, agreed, repetition… */
  endReason?: string
  /** Chess.com accuracy, only present when the game was reviewed on Chess.com. */
  accuracy?: number
  /** Your remaining clock (seconds) after each of your moves. */
  myClocks?: number[]
  plies?: number
}

export interface PuzzleAttempt {
  id?: number
  puzzleId: string
  date: string
  day: string // YYYY-MM-DD (local)
  cat: Activity
  correct: boolean
  rating: number
  themes: string[]
  seconds: number
}

export interface DrillSession {
  id?: number
  date: string
  day: string
  kind: 'coords-find' | 'coords-color'
  correct: number
  total: number
  seconds: number
}

export interface Meta {
  key: string
  value: number
}

export const db = new Dexie('my-chess-coach') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  ratings: EntityTable<RatingEntry, 'id'>
  games: EntityTable<Game, 'id'>
  attempts: EntityTable<PuzzleAttempt, 'id'>
  drills: EntityTable<DrillSession, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  settings: 'id',
  ratings: '++id, date, tc',
  games: '++id, date, tc',
  attempts: '++id, puzzleId, day, cat',
  drills: '++id, day',
  meta: 'key',
})
// v2: Chess.com import — unique game uuid prevents duplicates.
db.version(2).stores({
  games: '++id, date, tc, &uuid',
})

export const defaultSettings = (): Settings => ({
  id: 'main',
  lang: navigator.language?.startsWith('es') ? 'es' : 'en',
  theme: 'system',
  focus: 'rapid',
  startRatings: { rapid: 1500, blitz: 1400, bullet: 1300 },
  milestones: { rapid: [1600, 1700, 1800], blitz: [1500, 1600], bullet: [1400] },
  weeklyGames: { rapid: 5, blitz: 0, bullet: 0 },
  dailyMinutes: 20,
  chessComUsername: 'Pochox23',
  createdAt: new Date().toISOString(),
})

export async function exportData(): Promise<string> {
  const data = {
    app: 'my-chess-coach',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    ratings: await db.ratings.toArray(),
    games: await db.games.toArray(),
    attempts: await db.attempts.toArray(),
    drills: await db.drills.toArray(),
    meta: await db.meta.toArray(),
  }
  return JSON.stringify(data)
}

export async function importData(json: string) {
  const data = JSON.parse(json)
  if (data.app !== 'my-chess-coach') throw new Error('Not a My Chess Coach backup file')
  await db.transaction('rw', [db.settings, db.ratings, db.games, db.attempts, db.drills, db.meta], async () => {
    await Promise.all([db.settings.clear(), db.ratings.clear(), db.games.clear(), db.attempts.clear(), db.drills.clear(), db.meta.clear()])
    await db.settings.bulkAdd(data.settings ?? [])
    await db.ratings.bulkAdd(data.ratings ?? [])
    await db.games.bulkAdd(data.games ?? [])
    await db.attempts.bulkAdd(data.attempts ?? [])
    await db.drills.bulkAdd(data.drills ?? [])
    await db.meta.bulkAdd(data.meta ?? [])
  })
}

export async function resetAll() {
  await db.delete()
  location.reload()
}
