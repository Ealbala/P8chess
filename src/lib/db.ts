// Local database (IndexedDB via Dexie). Everything is stored on this device.
// Use Settings → Backup to export a copy of your data.
import Dexie, { type EntityTable } from 'dexie'

export type TimeControl = 'rapid' | 'blitz' | 'bullet'
export type Activity = 'mistakes' | 'openings' | 'tactics' | 'calculation' | 'middlegame' | 'endgame' | 'blindfold' | 'review'
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
  /** Opening ids in your repertoire (see src/data/openings.ts). Missing = starter openings. */
  repertoire?: string[]
  /** Password for the AI coach endpoint (COACH_PASSWORD on Vercel), if one is set. */
  coachPassword?: string
  /** Daily reminder time, "HH:MM". */
  reminderTime?: string
}

export interface CoachReport {
  id: string // week start, YYYY-MM-DD
  text: string
  createdAt: string
}

/** Spaced-repetition state of one opening line. */
export interface LineProgress {
  lineId: string
  box: number // 1..6 — higher = better known
  due: string // YYYY-MM-DD
}

export interface LineAttempt {
  id?: number
  lineId: string
  date: string
  day: string
  mode: 'learn' | 'drill'
  correct: boolean
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
  /** Stockfish analysis summary (Phase 3). */
  analysis?: GameAnalysis
}

export type Phase = 'opening' | 'middlegame' | 'endgame'

export interface GameAnalysis {
  depth: number
  analyzedAt: string
  inaccuracies: number
  mistakes: number
  blunders: number
  /** Your moves and your mistakes+blunders per phase. */
  moves: Record<Phase, number>
  errors: Record<Phase, number>
}

/** A position from one of your games where you made a mistake (My Mistake Library). */
export interface MistakePosition {
  id: string // `${gameId}-${ply}`
  gameId: number
  ply: number // index of your move (0 = White's first move)
  fen: string // position before your move
  color: 'white' | 'black'
  played: string // SAN you played
  playedUci: string
  best: string // SAN Stockfish prefers
  bestUci: string
  pv: string[] // best line in SAN (a few moves)
  /** The opponent's best reply to the move you played, with the line that follows (SAN). */
  reply?: string[]
  evalBest: number // centipawns, your point of view, after the best move
  evalPlayed: number // after your move
  drop: number // winning chances lost (0-100)
  kind: 'mistake' | 'blunder'
  phase: Phase
  date: string // game date
  box: number // spaced repetition (0 = never tried)
  due: string
}

export interface PositionAttempt {
  id?: number
  posId: string
  date: string
  day: string
  correct: boolean
}

export interface PuzzleAttempt {
  id?: number
  puzzleId: string
  date: string
  day: string // YYYY-MM-DD (local)
  cat: Activity | 'opening'
  correct: boolean
  rating: number
  themes: string[]
  seconds: number
}

export interface DrillSession {
  id?: number
  date: string
  day: string
  kind: 'coords-find' | 'coords-color' | 'moves' | 'memory' | 'calc' | 'blind-game'
  correct: number
  total: number
  seconds: number
  /** Blindfold games only: how many times you looked at the board, and moves played. */
  peeks?: number
  moves?: number
}

export interface Meta {
  key: string
  value: number
}

export const db = new Dexie('my-chess-coach') as Dexie & {
  reports: EntityTable<CoachReport, 'id'>
  positions: EntityTable<MistakePosition, 'id'>
  positionAttempts: EntityTable<PositionAttempt, 'id'>
  daysDone: EntityTable<{ day: string }, 'day'>
  lineProgress: EntityTable<LineProgress, 'lineId'>
  lineAttempts: EntityTable<LineAttempt, 'id'>
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
// v3: opening trainer.
db.version(3).stores({
  lineProgress: 'lineId',
  lineAttempts: '++id, lineId, day',
})
// v4: Stockfish analysis — mistake positions, attempts, completed daily challenges.
db.version(4).stores({
  positions: 'id, gameId, due',
  positionAttempts: '++id, posId, day',
  daysDone: 'day',
})
// v5: weekly reports from the AI coach.
db.version(5).stores({
  reports: 'id',
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
    lineProgress: await db.lineProgress.toArray(),
    lineAttempts: await db.lineAttempts.toArray(),
    positions: await db.positions.toArray(),
    positionAttempts: await db.positionAttempts.toArray(),
    daysDone: await db.daysDone.toArray(),
    reports: await db.reports.toArray(),
  }
  return JSON.stringify(data)
}

export async function importData(json: string) {
  const data = JSON.parse(json)
  if (data.app !== 'my-chess-coach') throw new Error('Not a My Chess Coach backup file')
  const tables = [
    db.settings, db.ratings, db.games, db.attempts, db.drills, db.meta,
    db.lineProgress, db.lineAttempts, db.positions, db.positionAttempts, db.daysDone, db.reports,
  ]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await db.lineProgress.bulkAdd(data.lineProgress ?? [])
    await db.lineAttempts.bulkAdd(data.lineAttempts ?? [])
    await db.positions.bulkAdd(data.positions ?? [])
    await db.positionAttempts.bulkAdd(data.positionAttempts ?? [])
    await db.daysDone.bulkAdd(data.daysDone ?? [])
    await db.reports.bulkAdd(data.reports ?? [])
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
