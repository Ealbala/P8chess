import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { useLang, useT, type TKey } from '../lib/i18n'
import { dueCount, lineStatus, nextLine, repertoire, repertoireCoverage, type Coverage } from '../lib/openings'
import { DEFAULT_REPERTOIRE, OPENINGS, findLine, type Opening } from '../data/openings'
import { Button, Card, ProgressBar, SectionTitle } from '../components/ui'
import LineTrainer from '../components/LineTrainer'

const STATUS_STYLE = {
  new: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  learning: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  known: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

export function OpeningsHome({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const mine = repertoire(data.settings)
  const others = OPENINGS.filter((o) => !mine.includes(o))
  const next = nextLine(data.settings, data.lineProgress)
  const due = dueCount(data.settings, data.lineProgress)
  const coverage = useMemo(
    () => ({
      white: repertoireCoverage(data.games, mine, 'white'),
      black: repertoireCoverage(data.games, mine, 'black'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.games, data.settings.repertoire],
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">📖 {t('op.title')}</h1>
        <span className="w-12" />
      </div>

      <Card className="flex flex-col gap-2">
        {next ? (
          <>
            <div className="text-sm">
              {due > 0 && <span className="mr-2 font-semibold text-amber-600">{t('op.due', { n: due })}</span>}
              <span className="text-slate-500">
                {next.opening.name[lang]} · {next.line.name[lang]}
              </span>
            </div>
            <Button onClick={() => navigate(`/train/line/${next.line.id}?mode=${next.mode}`)}>▶ {t('op.practice')}</Button>
          </>
        ) : (
          <p className="text-sm text-green-600">✓ {t('op.allDone')}</p>
        )}
      </Card>

      <section>
        <SectionTitle>{t('op.mine')}</SectionTitle>
        <div className="flex flex-col gap-2">
          {mine.map((o) => (
            <OpeningCard key={o.id} opening={o} data={data} />
          ))}
        </div>
      </section>

      {(['white', 'black'] as const).map((c) => coverage[c] && <CoverageCard key={c} color={c} coverage={coverage[c]!} />)}

      <section>
        <SectionTitle>{t('op.new')}</SectionTitle>
        <div className="flex flex-col gap-2">
          {others.map((o) => (
            <OpeningCard key={o.id} opening={o} data={data} />
          ))}
        </div>
      </section>
    </div>
  )
}

function OpeningCard({ opening, data }: { opening: Opening; data: AppData }) {
  const t = useT()
  const lang = useLang()
  const byId = new Map(data.lineProgress.map((p) => [p.lineId, p]))
  const learned = opening.lines.filter((l) => byId.has(l.id)).length
  return (
    <Link to={`/train/openings/${opening.id}`}>
      <Card className="flex items-center gap-3 p-3 active:scale-[0.99]">
        <span className="text-2xl">{opening.color === 'white' ? '♔' : '♚'}</span>
        <div className="flex-1">
          <div className="font-semibold">{opening.name[lang]}</div>
          <div className="mb-1 text-xs text-slate-500">{t('op.lines', { done: learned, total: opening.lines.length })}</div>
          <ProgressBar value={learned / opening.lines.length} />
        </div>
        <span className="text-slate-400">›</span>
      </Card>
    </Link>
  )
}

function CoverageCard({ color, coverage }: { color: 'white' | 'black'; coverage: Coverage }) {
  const t = useT()
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <SectionTitle>
        {color === 'white' ? '♔' : '♚'} {t('op.fromGames')} · {t(color === 'white' ? 'games.white' : 'games.black')}
      </SectionTitle>
      <p>{t('op.bookMoves', { n: coverage.avgBookMoves.toFixed(1), g: coverage.games })}</p>
      {coverage.uncovered.length > 0 && (
        <div>
          <div className="font-semibold">{t('op.uncovered')}</div>
          {coverage.uncovered.map((e) => (
            <div key={e.path + e.move} className="flex justify-between gap-2 font-mono text-xs">
              <span>
                {e.path} <b className="text-amber-600">{e.move}</b>
              </span>
              <span className="text-slate-500">×{e.count}</span>
            </div>
          ))}
        </div>
      )}
      {coverage.deviations.length > 0 && (
        <div>
          <div className="font-semibold">{t('op.deviations')}</div>
          {coverage.deviations.map((e) => (
            <div key={e.path + e.move} className="flex justify-between gap-2 font-mono text-xs">
              <span>
                {e.path} <b className="text-red-500">{e.move}</b>{' '}
                <span className="text-slate-500">({t('op.repertoireMove', { m: e.expected.join('/') })})</span>
              </span>
              <span className="text-slate-500">×{e.count}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">{t('op.coverageNote')}</p>
    </Card>
  )
}

export function OpeningDetail({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const opening = OPENINGS.find((o) => o.id === id)
  if (!opening) return null
  const ids = data.settings.repertoire ?? DEFAULT_REPERTOIRE
  const inRep = ids.includes(opening.id)
  const byId = new Map(data.lineProgress.map((p) => [p.lineId, p]))

  const toggle = () =>
    db.settings.update('main', { repertoire: inRep ? ids.filter((x) => x !== opening.id) : [...ids, opening.id] })

  return (
    <div className="flex flex-col gap-4 p-4">
      <button onClick={() => navigate(-1)} className="self-start text-sm font-semibold text-green-600">
        ← {t('common.back')}
      </button>
      <div>
        <h1 className="text-xl font-bold">
          {opening.color === 'white' ? '♔' : '♚'} {opening.name[lang]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{opening.description[lang]}</p>
      </div>
      <Button variant={inRep ? 'secondary' : 'primary'} onClick={toggle}>
        {inRep ? t('op.remove') : `+ ${t('op.add')}`}
      </Button>
      <div className="flex flex-col gap-2">
        {opening.lines.map((line) => {
          const status = lineStatus(byId.get(line.id))
          return (
            <Card key={line.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{line.name[lang]}</div>
                <div className="truncate font-mono text-xs text-slate-500">
                  {line.moves
                    .split(' ')
                    .slice(0, 8)
                    .map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s))
                    .join(' ')}
                  …
                </div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
                  {t(`op.status.${status}` as TKey)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Button className="px-3 py-1.5 text-sm" variant="secondary" onClick={() => navigate(`/train/line/${line.id}?mode=learn`)}>
                  📘 {t('op.learn')}
                </Button>
                {status !== 'new' && (
                  <Button className="px-3 py-1.5 text-sm" onClick={() => navigate(`/train/line/${line.id}?mode=drill`)}>
                    🔁 {t('op.drill')}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      <Link
        to={`/train/puzzles/opening?o=${opening.id}`}
        className="rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold dark:bg-slate-800"
      >
        ⚔️ {t('op.tactics')}
      </Link>
    </div>
  )
}

export function LineRoute({ data }: { data: AppData }) {
  const { lineId } = useParams()
  const [params] = useSearchParams()
  const found = lineId ? findLine(lineId) : null
  if (!found) return null
  const mode = params.get('mode') === 'drill' ? 'drill' : 'learn'
  return <LineTrainer key={`${lineId}-${mode}`} data={data} opening={found.opening} line={found.line} mode={mode} />
}
