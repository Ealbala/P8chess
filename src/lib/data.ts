// React hook that keeps the UI in sync with the local database.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DrillSession, type Game, type LineAttempt, type LineProgress, type PuzzleAttempt, type RatingEntry, type Settings } from './db'

export function useData() {
  return useLiveQuery(async () => {
    const [settings, ratings, games, attempts, drills, lineProgress, lineAttempts] = await Promise.all([
      db.settings.get('main'),
      db.ratings.toArray(),
      db.games.orderBy('date').reverse().toArray(),
      db.attempts.toArray(),
      db.drills.toArray(),
      db.lineProgress.toArray(),
      db.lineAttempts.toArray(),
    ])
    return { settings: settings ?? null, ratings, games, attempts, drills, lineProgress, lineAttempts }
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
}
