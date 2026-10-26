// Training centre: sections with their own rating, custom sessions ("1 hour of endgames",
// "what I do worst"), Puzzle Rush and training goals.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { AppData } from '../lib/data'
import { db, type RushResult, type TrainingGoal } from '../lib/db'
import { useLang, useT } from '../lib/i18n'
import { loadPuzzles, type Puzzle } from '../lib/puzzles'
import { TRACKS, TRACK_LESSONS, findTrack, type Track } from '../data/tracks'
import { allTrackStats, pickForTracks, trackHistory, trackStats, weakestTracks } from '../lib/training'
import PuzzleCore, { savePuzzleAttempt, type PuzzleResult } from '../components/PuzzleCore'
import { Button, Card, ProgressBar, SectionTitle, Segmented } from '../components/ui'

const DURATIONS = [10, 20, 30, 45, 60, 90]
const RUSH_MODES: RushResult['mode'][] = ['3min', '5min', 'survival', 'per30']

function Back({ to = '/train' }: { to?: string }) {
  const t = useT()
  return (
    <Link to={to} className="text-sm font-semibold text-green-600">
      ← {t('common.back')}
    </Link>
  )
}

function Delta({ n }: { n: number | null }) {
  if (n === null || n === 0) return null
  return <span className={`text-xs font-semibold ${n > 0 ? 'text-green-600' : 'text-red-500'}`}>{n > 0 ? `▲${n}` : `▼${-n}`}</span>
}

// ---------- Hub ----------

export function TrainingHub({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const stats = useMemo(() => allTrackStats(data.attempts), [data.attempts])
  const weakest = useMemo(() => weakestTracks(data.attempts), [data.attempts])
  const [focus, setFocus] = useState<string>('weakest')
  const [minutes, setMinutes] = useState(30)

  const groups: { id: Track['group']; label: string }[] = [
    { id: 'phase', label: t('tr.groupPhase') },
    { id: 'tactic', label: t('tr.groupTactic') },
    { id: 'endgame', label: t('tr.groupEndgame') },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Back />
        <h1 className="text-xl font-bold">🏋️ {t('tr.title')}</h1>
        <span className="w-12" />
      </div>

      <Card className="flex flex-col gap-3 ring-2 ring-green-500">
        <div className="font-bold">🎛️ {t('tr.custom')}</div>
        <div className="text-sm font-semibold">{t('tr.what')}</div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={focus === 'weakest'} onClick={() => setFocus('weakest')}>
            🎯 {t('tr.weakest')}
          </Chip>
          {TRACKS.map((tr) => (
            <Chip key={tr.id} active={focus === tr.id} onClick={() => setFocus(tr.id)}>
              {tr.icon} {tr.name[lang]}
            </Chip>
          ))}
        </div>
        {focus === 'weakest' && (
          <p className="text-xs text-slate-500">
            {t('tr.weakestIs')} {weakest.map((w) => `${w.icon} ${w.name[lang]}`).join(' · ')}
          </p>
        )}
        <div className="text-sm font-semibold">{t('tr.howLong')}</div>
        <Segmented options={DURATIONS.map((m) => ({ value: m, label: `${m}′` }))} value={minutes} onChange={setMinutes} />
        <Button
          onClick={() =>
            navigate(`/train/session?tracks=${focus === 'weakest' ? weakest.map((w) => w.id).join(',') : focus}&min=${minutes}`)
          }
        >
          ▶ {t('tr.start', { n: minutes })}
        </Button>
      </Card>

      <RushCard data={data} />
      <div className="grid grid-cols-2 gap-2">
        <Link to="/train/exam">
          <Card className="h-full p-3 text-sm">
            <div className="font-bold">📝 {t('exam.title')}</div>
            <div className="text-xs text-slate-500">
              {(() => {
                const done = data.exams.filter((e) => e.finishedAt).sort((a, b) => a.id.localeCompare(b.id))
                return done.length ? t('exam.last', { n: done[done.length - 1].performance ?? 0 }) : t('exam.teaser')
              })()}
            </div>
          </Card>
        </Link>
        <Link to="/train/play">
          <Card className="h-full p-3 text-sm">
            <div className="font-bold">🤖 {t('play.title')}</div>
            <div className="text-xs text-slate-500">{t('play.teaser')}</div>
          </Card>
        </Link>
      </div>
      <GoalsCard data={data} />

      {groups.map((g) => (
        <section key={g.id}>
          <SectionTitle>{g.label}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {stats
              .filter((s) => s.track.group === g.id)
              .map((s) => (
                <Link key={s.track.id} to={`/train/track/${s.track.id}`}>
                  <Card className="flex h-full flex-col gap-1 p-3">
                    <div className="text-sm font-semibold">
                      {s.track.icon} {s.track.name[lang]}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold">{s.attempts ? s.rating : '—'}</span>
                      <Delta n={s.change7d} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.attempts ? t('tr.statLine', { n: s.attempts, pct: Math.round(s.accuracy * 100) }) : t('tr.notStarted')}
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-slate-400">{t('tr.ratingNote')}</p>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ring-1 ${active ? 'bg-green-600 text-white ring-green-600' : 'ring-slate-300 dark:ring-slate-600'}`}
    >
      {children}
    </button>
  )
}

function RushCard({ data, track = 'all' }: { data: AppData; track?: string }) {
  const t = useT()
  const best = (mode: RushResult['mode']) =>
    Math.max(0, ...data.rushes.filter((r) => r.mode === mode && r.track === track).map((r) => r.score))
  return (
    <Card className="flex flex-col gap-2">
      <div className="font-bold">⚡ Puzzle Rush</div>
      <p className="text-xs text-slate-500">{t('rush.intro')}</p>
      <div className="grid grid-cols-2 gap-2">
        {RUSH_MODES.map((m) => (
          <Link key={m} to={`/train/rush?mode=${m}&track=${track}`} className="rounded-xl bg-amber-50 p-2 text-center ring-1 ring-amber-200 dark:bg-amber-900/30 dark:ring-amber-800">
            <div className="text-sm font-bold">{t(`rush.${m}`)}</div>
            <div className="text-xs text-slate-500">{t('rush.best', { n: best(m) })}</div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

function GoalsCard({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const [adding, setAdding] = useState(false)
  const [track, setTrack] = useState(TRACKS[1].id)
  const [plus, setPlus] = useState(100)
  const active = data.goals.filter((g) => !g.achievedAt)
  const achieved = data.goals.filter((g) => g.achievedAt)

  // Mark goals as achieved when the section rating reaches the target.
  useEffect(() => {
    for (const g of active) {
      const tr = findTrack(g.track)
      if (tr && trackStats(tr, data.attempts).rating >= g.target) db.goals.update(g.id!, { achievedAt: new Date().toISOString() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.attempts])

  async function add() {
    const tr = findTrack(track)!
    const current = trackStats(tr, data.attempts).rating
    await db.goals.add({ track, startRating: current, target: current + plus, createdAt: new Date().toISOString() })
    setAdding(false)
  }

  return (
    <Card className="flex flex-col gap-2">
      <SectionTitle right={!adding && <button className="text-sm font-semibold text-green-600" onClick={() => setAdding(true)}>+ {t('goal.add')}</button>}>
        🎯 {t('goal.title')}
      </SectionTitle>
      {active.length === 0 && !adding && <p className="text-sm text-slate-500">{t('goal.empty')}</p>}
      {active.map((g) => (
        <GoalRow key={g.id} goal={g} data={data} />
      ))}
      {achieved.length > 0 && <p className="text-xs text-green-600">🏆 {t('goal.achievedCount', { n: achieved.length })}</p>}
      {adding && (
        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <div className="text-sm font-semibold">{t('goal.improve')}</div>
          <select className="rounded-lg bg-white p-2 dark:bg-slate-900" value={track} onChange={(e) => setTrack(e.target.value)}>
            {TRACKS.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.icon} {tr.name[lang]} ({trackStats(tr, data.attempts).rating})
              </option>
            ))}
          </select>
          <Segmented options={[50, 100, 200].map((n) => ({ value: n, label: `+${n}` }))} value={plus} onChange={setPlus} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" onClick={add}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function GoalRow({ goal, data }: { goal: TrainingGoal; data: AppData }) {
  const t = useT()
  const lang = useLang()
  const tr = findTrack(goal.track)
  if (!tr) return null
  const now = trackStats(tr, data.attempts).rating
  const progress = (now - goal.startRating) / Math.max(1, goal.target - goal.startRating)
  return (
    <Link to={`/train/track/${tr.id}`} className="block">
      <div className="flex justify-between text-sm">
        <span>
          {tr.icon} {t('goal.line', { track: tr.name[lang], target: goal.target })}
        </span>
        <span className="text-slate-500">{now}</span>
      </div>
      <ProgressBar value={progress} />
      <div className="text-xs text-slate-500">{t('goal.toGo', { n: Math.max(0, goal.target - now) })}</div>
    </Link>
  )
}

// ---------- Section page ----------

export function TrackPage({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const track = findTrack(id ?? '')
  if (!track) return null
  const s = trackStats(track, data.attempts)
  const history = trackHistory(track, data.attempts).map((h, i) => ({ i, rating: h.rating }))
  const sessions = data.sessions.filter((x) => x.tracks.includes(track.id) && x.endedAt).slice(-5).reverse()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Back to="/train/practice" />
        <h1 className="text-lg font-bold">
          {track.icon} {track.name[lang]}
        </h1>
        <span className="w-12" />
      </div>
      <Card className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-500">{t('tr.rating')}</div>
            <div className="text-4xl font-extrabold">{s.attempts ? s.rating : '—'}</div>
          </div>
          <div className="text-right text-sm">
            <Delta n={s.change7d} /> <span className="text-xs text-slate-500">{t('tr.last7')}</span>
            <div className="text-xs text-slate-500">{t('tr.statLine', { n: s.attempts, pct: Math.round(s.accuracy * 100) })}</div>
          </div>
        </div>
        {history.length > 2 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 4, left: -24, bottom: 0 }}>
                <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line isAnimationActive={false} dataKey="rating" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-slate-400">{t('tr.ratingNote')}</p>
      </Card>

      {TRACK_LESSONS[track.id] && (
        <Link to={`/train/lesson/${track.id}`}>
          <Card className="flex items-center gap-3 p-3">
            <span className="text-2xl">📺</span>
            <div className="flex-1">
              <div className="font-semibold">{t('ex.lesson')}</div>
              <div className="text-xs text-slate-500">{t('ex.lessonSub')}</div>
            </div>
            <span className="text-slate-400">›</span>
          </Card>
        </Link>
      )}

      <Card className="flex flex-col gap-2">
        <div className="font-bold">▶ {t('tr.trainThis')}</div>
        <div className="grid grid-cols-3 gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} variant="secondary" onClick={() => navigate(`/train/session?tracks=${track.id}&min=${m}`)}>
              {m}′
            </Button>
          ))}
        </div>
      </Card>
      <RushCard data={data} track={track.id} />

      {track.related && (
        <Card className="flex flex-col gap-1 text-sm">
          <SectionTitle>{t('tr.related')}</SectionTitle>
          {track.related.map((r) => (
            <Link key={r.to} to={r.to} className="font-semibold text-green-600">
              → {r.label[lang]}
            </Link>
          ))}
        </Card>
      )}

      {sessions.length > 0 && (
        <Card className="flex flex-col gap-1 text-sm">
          <SectionTitle>{t('tr.sessions')}</SectionTitle>
          {sessions.map((x) => (
            <div key={x.id} className="flex justify-between">
              <span>{new Date(x.startedAt).toLocaleDateString(lang, { day: 'numeric', month: 'short' })} · {x.minutes}′</span>
              <span>
                {x.firstTry}/{x.puzzles} · <Delta n={x.ratingEnd !== undefined ? x.ratingEnd - x.ratingStart : null} />
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ---------- Custom session ----------

function eloStep(r: number, puzzleRating: number, correct: boolean) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - r) / 400))
  return r + 20 * ((correct ? 1 : 0) - expected)
}

export function SessionRunner({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tracks = (params.get('tracks') ?? '').split(',').map(findTrack).filter((x): x is Track => !!x)
  const minutes = Number(params.get('min') ?? 30)
  const startRating = useMemo(
    () => Math.round(tracks.reduce((s, tr) => s + trackStats(tr, data.attempts).rating, 0) / Math.max(1, tracks.length)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [rating, setRating] = useState(startRating)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [results, setResults] = useState<{ puzzle: Puzzle; r: PuzzleResult }[]>([])
  const [left, setLeft] = useState(minutes * 60)
  const [finished, setFinished] = useState(false)
  const sessionId = useRef<number | null>(null)
  const seen = useRef(new Set<string>())
  const ratingRef = useRef(startRating)
  const resultsRef = useRef(results)
  resultsRef.current = results

  useEffect(() => {
    db.sessions
      .add({ tracks: tracks.map((x) => x.id), minutes, startedAt: new Date().toISOString(), puzzles: 0, firstTry: 0, solved: 0, ratingStart: startRating })
      .then((id) => (sessionId.current = id as number))
    next()
    const timer = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function next() {
    if (left <= 0) return finish()
    const all = await loadPuzzles()
    const p = pickForTracks(all, tracks, ratingRef.current, seen.current, data.attempts)
    if (!p) return finish()
    seen.current.add(p.id)
    setPuzzle(p)
  }

  function onResult(p: Puzzle, r: PuzzleResult) {
    savePuzzleAttempt(p, r)
    ratingRef.current = eloStep(ratingRef.current, p.rating, r.correct)
    setRating(Math.round(ratingRef.current))
    const all = [...resultsRef.current, { puzzle: p, r }]
    setResults(all)
    if (sessionId.current)
      db.sessions.update(sessionId.current, {
        puzzles: all.length,
        firstTry: all.filter((x) => x.r.correct).length,
        solved: all.filter((x) => x.r.solved).length,
        ratingEnd: Math.round(ratingRef.current),
        endedAt: new Date().toISOString(),
      })
  }

  function finish() {
    setFinished(true)
    setPuzzle(null)
  }

  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  const title = tracks.map((x) => `${x.icon} ${x.name[lang]}`).join(' · ')

  if (finished) {
    const failed = results.filter((x) => !x.r.correct)
    const delta = Math.round(ratingRef.current) - startRating
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">🏁 {t('tr.summary')}</h1>
        <Card className="flex flex-col gap-1">
          <div className="text-sm text-slate-500">{title}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-extrabold">{results.length}</div>
              <div className="text-xs text-slate-500">{t('tr.puzzles')}</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold">{results.length ? Math.round((results.filter((x) => x.r.correct).length / results.length) * 100) : 0}%</div>
              <div className="text-xs text-slate-500">{t('tr.firstTry')}</div>
            </div>
            <div>
              <div className={`text-2xl font-extrabold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {delta >= 0 ? '+' : ''}
                {delta}
              </div>
              <div className="text-xs text-slate-500">{t('tr.ratingChange')}</div>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">{t('tr.sessionNote')}</p>
        </Card>
        {failed.length > 0 && (
          <Card className="flex flex-col gap-1 text-sm">
            <SectionTitle>{t('tr.toRedo')}</SectionTitle>
            {failed.map((x) => (
              <Link key={x.puzzle.id} to={`/train/puzzle/${x.puzzle.id}?c=${x.puzzle.cat}`} className="flex justify-between">
                <span>
                  {x.r.solved ? '🟡' : '🔴'} {t(`act.${x.puzzle.cat === 'opening' ? 'tactics' : x.puzzle.cat}`)} · {x.puzzle.rating}
                </span>
                <span className="text-green-600">🔁</span>
              </Link>
            ))}
          </Card>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/train/practice')}>
            {t('common.back')}
          </Button>
          <Button className="flex-1" onClick={() => navigate(0)}>
            🔁 {t('tr.again')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={finish} className="text-sm font-semibold text-red-500">
          ■ {t('tr.stop')}
        </button>
        <span className={`font-mono text-lg font-bold ${left <= 60 ? 'text-red-500' : ''}`}>
          {mm}:{ss}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-semibold">{title}</span>
        <span>
          {t('tr.rating')}: <b>{rating}</b> <Delta n={rating - startRating} />
        </span>
      </div>
      <ProgressBar value={1 - left / (minutes * 60)} />
      <div className="text-xs text-slate-500">
        {t('tr.liveLine', { n: results.length, ok: results.filter((x) => x.r.correct).length })}
        {left <= 0 && ` · ${t('tr.timeUp')}`}
      </div>
      {puzzle ? (
        <PuzzleCore key={puzzle.id} puzzle={puzzle} compact onResult={(r) => onResult(puzzle, r)} onNext={next} />
      ) : (
        <div className="text-center text-sm text-slate-500">{t('train.loading')}</div>
      )}
    </div>
  )
}

// ---------- Puzzle Rush ----------

const RUSH_SECONDS: Record<RushResult['mode'], number | null> = { '3min': 180, '5min': 300, survival: null, per30: null }
/** Seconds allowed per puzzle (clock training): only in the "per30" mode. */
const PER_PUZZLE: Partial<Record<RushResult['mode'], number>> = { per30: 30 }
const STRIKES = 3

export function Rush({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const dataRef = useRef(data)
  dataRef.current = data
  const [params] = useSearchParams()
  const mode = (params.get('mode') as RushResult['mode']) ?? '3min'
  const trackId = params.get('track') ?? 'all'
  const tracks = trackId === 'all' ? TRACKS.filter((x) => x.group !== 'endgame') : [findTrack(trackId)!].filter(Boolean)
  const [stage, setStage] = useState<'ready' | 'run' | 'over'>('ready')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [left, setLeft] = useState(RUSH_SECONDS[mode] ?? 0)
  const [failed, setFailed] = useState<Puzzle[]>([])
  const [puzzleLeft, setPuzzleLeft] = useState(PER_PUZZLE[mode] ?? 0)
  const resolved = useRef(new Set<string>())
  const level = useRef(700)
  const seen = useRef(new Set<string>())
  const stateRef = useRef({ score: 0, strikes: 0, over: false })
  const best = Math.max(0, ...data.rushes.filter((r) => r.mode === mode && r.track === trackId).map((r) => r.score))
  // Personal best before this round (the round itself is saved when it ends).
  const [bestBefore, setBestBefore] = useState(best)

  useEffect(() => {
    if (stage !== 'run' || RUSH_SECONDS[mode] === null) return
    const id = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(id)
  }, [stage, mode])

  useEffect(() => {
    if (stage === 'run' && RUSH_SECONDS[mode] !== null && left <= 0) end()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  // Per-puzzle clock: running out of time counts as a mistake.
  useEffect(() => {
    if (stage !== 'run' || !PER_PUZZLE[mode] || !puzzle) return
    setPuzzleLeft(PER_PUZZLE[mode]!)
    const id = setInterval(() => setPuzzleLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [stage, mode, puzzle])
  useEffect(() => {
    if (stage === 'run' && PER_PUZZLE[mode] && puzzle && puzzleLeft <= 0 && !resolved.current.has(puzzle.id)) {
      const p = puzzle
      setPuzzle(null)
      onResult(p, { correct: false, solved: false, seconds: PER_PUZZLE[mode]! })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleLeft])

  async function next() {
    const all = await loadPuzzles()
    const p = pickForTracks(all, tracks, level.current, seen.current, dataRef.current.attempts, 80)
    if (!p) return end()
    seen.current.add(p.id)
    setPuzzle(p)
  }

  function start() {
    stateRef.current = { score: 0, strikes: 0, over: false }
    setBestBefore(best)
    level.current = 700
    seen.current = new Set()
    resolved.current = new Set()
    setScore(0)
    setStrikes(0)
    setFailed([])
    setLeft(RUSH_SECONDS[mode] ?? 0)
    setStage('run')
    next()
  }

  function end() {
    if (stateRef.current.over) return
    stateRef.current.over = true
    setStage('over')
    setPuzzle(null)
    db.rushes.add({ mode, track: trackId, score: stateRef.current.score, mistakes: stateRef.current.strikes, date: new Date().toISOString() })
  }

  function onResult(p: Puzzle, r: PuzzleResult) {
    if (stateRef.current.over || resolved.current.has(p.id)) return
    resolved.current.add(p.id)
    savePuzzleAttempt(p, r, { rush: true })
    if (r.correct) {
      stateRef.current.score++
      setScore(stateRef.current.score)
      level.current += 60 // harder every time
    } else {
      stateRef.current.strikes++
      setStrikes(stateRef.current.strikes)
      setFailed((f) => [...f, p])
      if (stateRef.current.strikes >= STRIKES) return void setTimeout(end, 700)
    }
    setTimeout(next, r.correct ? 300 : 900)
  }

  const trackName = trackId === 'all' ? t('rush.allTactics') : `${tracks[0]?.icon} ${tracks[0]?.name[lang]}`

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Back to="/train/practice" />
        <h1 className="font-bold">⚡ Puzzle Rush · {t(`rush.${mode}`)}</h1>
        <span className="w-12" />
      </div>
      <div className="text-center text-sm text-slate-500">{trackName}</div>

      {stage === 'ready' && (
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm">
            {t(mode === 'per30' ? 'rush.rulesPer30' : mode === 'survival' ? 'rush.rulesSurvival' : 'rush.rulesTimed', { s: STRIKES, m: (RUSH_SECONDS[mode] ?? 0) / 60 })}
          </p>
          <div className="text-sm">{t('rush.best', { n: best })}</div>
          <Button className="w-full" onClick={start}>
            ▶ {t('common.start')}
          </Button>
        </Card>
      )}

      {stage === 'run' && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-extrabold text-green-600">{score}</span>
            <span className="text-xl">{'❌'.repeat(strikes)}{'⚪'.repeat(STRIKES - strikes)}</span>
            {PER_PUZZLE[mode] && (
              <span className={`font-mono text-xl font-bold ${puzzleLeft <= 10 ? 'text-red-500' : ''}`}>⏱ {Math.max(0, puzzleLeft)}s</span>
            )}
            {RUSH_SECONDS[mode] !== null && (
              <span className={`font-mono text-xl font-bold ${left <= 20 ? 'text-red-500' : ''}`}>
                {Math.floor(left / 60)}:{String(Math.max(0, left) % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {puzzle && <PuzzleCore key={puzzle.id} puzzle={puzzle} mode="rush" onResult={(r) => onResult(puzzle, r)} />}
        </>
      )}

      {stage === 'over' && (
        <Card className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="text-sm text-slate-500">{t('rush.score')}</div>
          <div className="text-5xl font-extrabold">{score}</div>
          {score > bestBefore ? (
            <div className="font-bold text-amber-600">🏆 {t('rush.newBest')}</div>
          ) : (
            <div className="text-sm">{t('rush.best', { n: bestBefore })}</div>
          )}
          {failed.length > 0 && (
            <div className="mt-2 w-full text-left text-sm">
              <div className="font-semibold">{t('tr.toRedo')}</div>
              {failed.map((p) => (
                <Link key={p.id} to={`/train/puzzle/${p.id}?c=${p.cat}`} className="flex justify-between">
                  <span>🔴 {p.rating}</span>
                  <span className="text-green-600">🔁</span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-2 flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/train/practice')}>
              {t('common.back')}
            </Button>
            <Button className="flex-1" onClick={start}>
              🔁 {t('coords.again')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
