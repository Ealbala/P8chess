// AI coach client. The app sends a compact JSON summary of YOUR data (only facts the
// app computed: games, Stockfish findings, stats) plus the conversation. The model is told
// to use only this data and the Stockfish lines in it.
import type { AppData } from './data'
import type { MistakePosition } from './db'
import { addDays, dayKey, weekStart } from './dates'
import { errorRates } from './analysis'
import { areaStats } from './areas'
import { repertoire, repertoireCoverage } from './openings'
import { currentRating, groupStats, mistakeTagCounts, ratingChange, streak, themeStats, timeStats, trainingMinutes, weeklyChallenge } from './stats'
import { openingFamily } from './chesscom'

export type CoachMessage = { role: 'user' | 'assistant'; content: string }

const moveLabel = (p: MistakePosition) => `${Math.floor(p.ply / 2) + 1}${p.color === 'white' ? '.' : '...'}`

export function describePosition(p: MistakePosition, opponent?: string) {
  return {
    date: p.date.slice(0, 10),
    opponent,
    you: p.color,
    phase: p.phase,
    kind: p.kind,
    fen: p.fen,
    move: moveLabel(p),
    played: p.played,
    stockfishBest: p.best,
    bestLine: p.pv.join(' '),
    opponentBestReplyAfterYourMove: p.reply?.join(' '),
    evalAfterBest: (p.evalBest / 100).toFixed(1),
    evalAfterPlayed: (p.evalPlayed / 100).toFixed(1),
    winningChancesLost: p.drop,
    timesPractised: p.box,
  }
}

function score(list: { result: string }[]) {
  if (!list.length) return null
  return Math.round(((list.filter((g) => g.result === 'win').length + list.filter((g) => g.result === 'draw').length / 2) / list.length) * 100)
}

export function buildContext(data: AppData): string {
  const { settings, games, attempts, drills, ratings } = data
  const focus = settings.focus
  const fg = games.filter((g) => g.tc === focus)
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const last30 = fg.filter((g) => g.date >= iso(addDays(now, -30)))
  const prev30 = fg.filter((g) => g.date < iso(addDays(now, -30)) && g.date >= iso(addDays(now, -60)))
  const wk = weekStart()
  const lastWk = addDays(wk, -7)
  const byId = new Map(games.map((g) => [g.id, g]))
  const rep = repertoire(settings)

  const ctx = {
    today: dayKey(),
    profile: {
      focusTimeControl: focus,
      ratings: Object.fromEntries((['rapid', 'blitz', 'bullet'] as const).map((tc) => [tc, currentRating(ratings, settings, tc)])),
      ratingChange30d: ratingChange(ratings, focus, 30),
      goals: settings.milestones[focus],
      weeklyGamesTarget: settings.weeklyGames[focus],
      dailyMinutes: settings.dailyMinutes,
      repertoire: rep.map((o) => `${o.name.en} (${o.color})`),
    },
    weeklyChallenge: weeklyChallenge(games, settings),
    dailyChallengeStreak: streak(new Set(data.daysDone)),
    results: {
      last30days: { games: last30.length, scorePct: score(last30) },
      previous30days: { games: prev30.length, scorePct: score(prev30) },
      byColor: groupStats(fg.slice(0, 50), (g) => g.color),
      byOpening: groupStats(fg.slice(0, 50).filter((g) => g.opening), (g) => openingFamily(g.opening)).slice(0, 6),
      clock: timeStats(fg.slice(0, 50)),
    },
    stockfish: {
      mistakesPer100MovesByPhase: errorRates(fg),
      recentMistakes: [...data.positions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12)
        .map((p) => describePosition(p, byId.get(p.gameId)?.opponent)),
    },
    recentGames: fg.slice(0, 15).map((g) => ({
      date: g.date.slice(0, 10),
      color: g.color,
      result: g.result,
      endReason: g.endReason,
      opponentRating: g.opponentRating,
      opening: g.opening,
      chessComAccuracy: g.accuracy,
      stockfish: g.analysis && { inaccuracies: g.analysis.inaccuracies, mistakes: g.analysis.mistakes, blunders: g.analysis.blunders },
      yourReview: g.reviewed ? { lesson: g.lesson, tags: g.mistakeTags } : 'not reviewed',
    })),
    selfReportedMistakeTags: mistakeTagCounts(games),
    openings: {
      white: repertoireCoverage(games, rep, 'white', 150),
      black: repertoireCoverage(games, rep, 'black', 150),
    },
    training: {
      accuracyLast30ByArea: areaStats(attempts, data.lineAttempts),
      weakestPuzzleThemes: themeStats(attempts).slice(0, 5),
      minutesThisWeek: trainingMinutes(attempts, drills, dayKey(wk)),
      minutesLastWeek: trainingMinutes(attempts, drills, dayKey(lastWk)) - trainingMinutes(attempts, drills, dayKey(wk)),
      mistakePositionsSolvedLast30d: data.positionAttempts.filter((a) => a.correct && a.date >= iso(addDays(now, -30))).length,
      blindfoldSessions: drills.length,
    },
  }
  return JSON.stringify(ctx)
}

export type CoachError = 'not-configured' | 'bad-password' | 'bad-api-key' | 'rate-limit' | 'network' | 'refused'

export async function askCoach(data: AppData, messages: CoachMessage[]): Promise<{ text: string } | { error: CoachError }> {
  let res: Response
  try {
    res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coach-key': data.settings.coachPassword ?? '' },
      body: JSON.stringify({ lang: data.settings.lang, context: buildContext(data), messages }),
    })
  } catch {
    return { error: 'network' }
  }
  const body = await res.json().catch(() => ({}))
  if (res.status === 503) return { error: body.error === 'bad-api-key' ? 'bad-api-key' : 'not-configured' }
  if (res.status === 401) return { error: 'bad-password' }
  if (res.status === 429) return { error: 'rate-limit' }
  if (!res.ok) return { error: 'network' }
  if (body.refused) return { error: 'refused' }
  return { text: body.text }
}

export async function coachStatus(): Promise<{ configured: boolean; passwordRequired: boolean } | null> {
  try {
    const res = await fetch('/api/coach')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
