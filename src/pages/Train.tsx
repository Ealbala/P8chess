import { Link, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router'
import { OpeningDetail, OpeningsHome, LineRoute } from './Openings'
import { MistakeTrainer, MistakesHome } from './Mistakes'
import { ThreatTrainer, ThreatsHome } from './Threats'
import { BlindGame, BlindfoldHome, CalcDrill, MemoryDrill, MovesDrill } from './Blindfold'
import { EndgameTrainer, EndgamesHome } from './Endgames'
import { StrategyHome, StrategyTrainer } from './Strategy'
import History from './History'
import Lesson from './Lesson'
import Play from './Play'
import Exam from './Exam'
import Explorer from './Explorer'
import { Rush, SessionRunner, TrackPage, TrainingHub } from './Training'
import { areaStats, endgameScore, priority, weakestArea } from '../lib/areas'
import { errorRates } from '../lib/analysis'
import type { TKey } from '../lib/i18n'
import type { AppData } from '../lib/data'
import type { Settings } from '../lib/db'
import { useT } from '../lib/i18n'
import { todaysPlan } from '../lib/plan'
import type { PuzzleCat } from '../lib/puzzles'
import { Card, ProgressBar, SectionTitle } from '../components/ui'
import PuzzleTrainer from '../components/PuzzleTrainer'
import CoordsDrill from '../components/CoordsDrill'
import { ACT_ICON } from './Dashboard'


export default function Train({ data }: { data: AppData }) {
  const loc = useLocation()
  return (
    <Routes>
      <Route index element={<TrainHome data={data} />} />
      <Route path="puzzles/:cat" element={<PuzzleRoute data={data} />} />
      <Route path="openings" element={<OpeningsHome data={data} />} />
      <Route path="openings/:id" element={<OpeningDetail data={data} />} />
      <Route path="line/:lineId" element={<LineRoute data={data} />} />
      <Route path="mistakes" element={<MistakesHome data={data} />} />
      <Route path="threats" element={<ThreatsHome data={data} />} />
      <Route path="threats/:id" element={<ThreatTrainer data={data} />} />
      <Route path="mistakes/:id" element={<MistakeTrainer data={data} />} />
      <Route path="blindfold" element={<BlindfoldHome data={data} />} />
      <Route path="blindfold/1" element={<CoordsDrill data={data} />} />
      <Route path="blindfold/2" element={<MovesDrill />} />
      <Route path="blindfold/3" element={<MemoryDrill />} />
      <Route path="blindfold/4" element={<CalcDrill />} />
      <Route path="blindfold/5" element={<BlindGame />} />
      <Route path="endgames" element={<EndgamesHome data={data} />} />
      <Route path="strategy" element={<StrategyHome data={data} />} />
      <Route path="strategy/:id" element={<StrategyTrainer />} />
      <Route path="history" element={<History data={data} />} />
      <Route path="practice" element={<TrainingHub data={data} />} />
      <Route path="play" element={<Play data={data} />} />
      <Route path="exam" element={<Exam data={data} />} />
      <Route path="explorer" element={<Explorer data={data} />} />
      <Route path="track/:id" element={<TrackPage data={data} />} />
      <Route path="lesson/:id" element={<Lesson />} />
      <Route path="session" element={<SessionRunner key={loc.search} data={data} />} />
      <Route path="rush" element={<Rush key={loc.search} data={data} />} />
      <Route path="puzzle/:id" element={<PuzzleById data={data} />} />
      <Route path="endgames/:id" element={<EndgameTrainer />} />
    </Routes>
  )
}

const LINK: Record<string, string> = {
  mistakes: 'mistakes',
  threats: 'threats',
  openings: 'openings',
  middlegame: 'puzzles/middlegame',
  tactics: 'puzzles/tactics',
  calculation: 'puzzles/calculation',
  endgame: 'puzzles/endgame',
  blindfold: 'blindfold',
  review: '/games',
}

function TrainHome({ data }: { data: AppData }) {
  const t = useT()
  const plan = todaysPlan(data)
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{t('train.title')}</h1>
      <Link to="practice" className="block">
        <Card className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white ring-0">
          <span className="text-3xl">🏋️</span>
          <div className="flex-1">
            <div className="font-bold">{t('tr.title')}</div>
            <div className="text-xs opacity-90">{t('tr.teaser')}</div>
          </div>
          <span className="text-xl">›</span>
        </Card>
      </Link>
      <Card>
        <SectionTitle right={<Link to="/settings" className="text-xs text-slate-400">{t('train.changeDuration')}</Link>}>
          {t('train.plan', { n: data.settings.dailyMinutes })}
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {plan.map((p) => (
            <Link
              key={p.activity}
              to={LINK[p.activity]}
              className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition active:scale-[0.99] ${
                p.complete
                  ? 'bg-green-50 ring-green-200 dark:bg-green-900/20 dark:ring-green-900'
                  : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">{p.complete ? '✅' : ACT_ICON[p.activity]}</span>
              <div className="flex-1">
                <div className="font-semibold">
                  {t(`act.${p.activity}`)}
                  {p.boosted && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-200">🎯 {t('plan.boost')}</span>}
                </div>
                <div className="mb-1 text-xs text-slate-500">
                  {Math.min(p.done, p.target)}/{p.target} {t(`unit.${p.activity}`)}
                </div>
                <ProgressBar value={p.done / p.target} />
              </div>
              <span className="text-slate-400">›</span>
            </Link>
          ))}
        </div>
      </Card>

      <PriorityCard data={data} />

      <Card>
        <SectionTitle>{t('train.free')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {(['mistakes', 'threats', 'openings', 'tactics', 'calculation', 'middlegame', 'endgame', 'blindfold'] as const).map((a) => (
            <Link
              key={a}
              to={LINK[a]}
              className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800"
            >
              <span className="text-2xl">{ACT_ICON[a]}</span>
              {t(`act.${a}`)}
            </Link>
          ))}
          <Link to="play" className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">
            <span className="text-2xl">🤖</span>
            {t('play.title')}
          </Link>
          <Link to="strategy" className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">
            <span className="text-2xl">♜</span>
            {t('st.title')}
          </Link>
          <Link to="history" className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">
            <span className="text-2xl">🗂️</span>
            {t('hist.title')}
          </Link>
          <Link to="endgames" className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">
            <span className="text-2xl">👑</span>
            {t('eg.title')}
          </Link>
          <Link to="/board" className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">
            <span className="text-2xl">🧩</span>
            {t('board.title')}
          </Link>
        </div>
      </Card>
    </div>
  )
}

function PuzzleById({ data }: { data: AppData }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const cat = (params.get('c') ?? 'tactics') as PuzzleCat
  return <PuzzleTrainer key={id} cat={cat} data={data} puzzleId={id} />
}

function PuzzleRoute({ data }: { data: AppData }) {
  const { cat } = useParams()
  const [params] = useSearchParams()
  const valid: PuzzleCat[] = ['tactics', 'calculation', 'middlegame', 'endgame', 'opening']
  if (!valid.includes(cat as PuzzleCat)) return null
  const openingId = params.get('o') ?? undefined
  return <PuzzleTrainer key={`${cat}-${openingId}`} cat={cat as PuzzleCat} data={data} openingId={openingId} />
}

function PriorityCard({ data }: { data: AppData }) {
  const t = useT()
  const stats = areaStats(data.attempts, data.lineAttempts)
  const ranked = priority(stats)
  const weakest = ranked[0]
  const fromGames = weakestArea(data)
  const rates = errorRates(data.games)
  const eg = endgameScore(data.games.filter((g) => g.tc === data.settings.focus))
  const order = [...ranked, ...stats.filter((s) => !s.calibrated)]
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <SectionTitle>🎯 {t('prio.title')}</SectionTitle>
      {fromGames?.source === 'games' && (
        <p className="font-semibold">
          {t('prio.games', { g: fromGames.games, phase: t(`phase.${fromGames.area === 'openings' ? 'opening' : fromGames.area}` as TKey), rate: fromGames.rate.toFixed(1) })}
        </p>
      )}
      {rates.games > 0 && (
        <div className="flex gap-2 text-xs">
          {rates.byPhase.map((p) => (
            <span key={p.phase} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
              {t(`phase.${p.phase}`)}: {p.rate.toFixed(1)}
            </span>
          ))}
          <span className="text-slate-400">{t('an.rate')}</span>
        </div>
      )}
      {fromGames?.source === 'games' ? null : weakest ? (
        <p className="font-semibold">
          {t('prio.weakest', { area: t(`area.${weakest.area}`), pct: Math.round(weakest.accuracy * 100), n: weakest.n })}
        </p>
      ) : (
        <p>{t('prio.calibrate')}</p>
      )}
      {order.map((s) => (
        <div key={s.area} className="flex items-center gap-2">
          <span className="w-24 shrink-0">{t(`area.${s.area}`)}</span>
          {s.calibrated ? (
            <>
              <div className="flex-1">
                <ProgressBar value={s.accuracy} color={s === weakest && fromGames?.source !== 'games' ? 'bg-red-400' : 'bg-green-500'} />
              </div>
              <span className="w-10 text-right font-semibold">{Math.round(s.accuracy * 100)}%</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">{t('prio.calibrating', { n: s.n })}</span>
          )}
        </div>
      ))}
      {eg.endgames >= 5 && (
        <p className="text-xs text-slate-500">
          🏁 {t('prio.endgameGames', { s: eg.endgameScore, n: eg.endgames, t: eg.totalScore })}
        </p>
      )}
      <p className="text-xs text-slate-400">{t('prio.note')}</p>
    </Card>
  )
}
