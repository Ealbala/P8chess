// React hook that keeps the UI in sync with the local database.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DrillSession, type Game, type LineAttempt, type LineProgress, type MistakePosition, type PositionAttempt, type RushResult, type TrainingGoal, type TrainingSession, type PuzzleAttempt, type RatingEntry, type Settings } from './db'

export function useData() {
  return useLiveQuery(async () => {
    const [settings, ratings, games, attempts, drills, lineProgress, lineAttempts, positions, positionAttempts, daysDone, sessions, rushes, goals] = await Promise.all([
      db.settings.get('main'),
      db.ratings.toArray(),
      db.games.orderBy('date').reverse().toArray(),
      db.attempts.toArray(),
      db.drills.toArray(),
      db.lineProgress.toArray(),
      db.lineAttempts.toArray(),
      db.positions.toArray(),
      db.positionAttempts.toArray(),
      db.daysDone.toArray(),
      db.sessions.toArray(),
      db.rushes.toArray(),
      db.goals.toArray(),
    ])
    return {
      settings: settings ?? null, ratings, games, attempts, drills, lineProgress, lineAttempts,
      positions, positionAttempts, daysDone: daysDone.map((d) => d.day), sessions, rushes, goals,
    }
  })
}

/** App data once onboarding is done (settings exist). */
export interface AppData {
  settings: Settings
  ratings: RatingEntry[]
  games: Game[]
  attempts: PuzzleAttempt[]
  drills: DrillSession[]
  lineProgress: LineProgress[]
  lineAttempts: LineAttempt[]
  positions: MistakePosition[]
  positionAttempts: PositionAttempt[]
  /** Days (YYYY-MM-DD) on which the daily challenge was completed. */
  daysDone: string[]
  sessions: TrainingSession[]
  rushes: RushResult[]
  goals: TrainingGoal[]
}
