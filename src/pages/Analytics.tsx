// Advanced statistics. Every chart says what it measures; nothing here is an official rating.
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AppData } from '../lib/data'
import { addDays, dayKey, weekStart } from '../lib/dates'
import { dailySeries, themeStats } from '../lib/stats'
import { themeName, useLang, useT } from '../lib/i18n'
import { Card, ProgressBar, SectionTitle } from '../components/ui'

const TC_COLORS = { rapid: '#16a34a', blitz: '#2563eb', bullet: '#f59e0b' }

function scorePct(list: { result: string }[]) {
  if (!list.length) return null
  return Math.round(((list.filter((g) => g.result === 'win').length + list.filter((g) => g.result === 'draw').length / 2) / list.length) * 100)
}

export default function Analytics({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const { settings, games, ratings, attempts, drills } = data
  const focus = settings.focus

  // Rating history of the three time controls on one chart (one point per day).
  const ratingChart = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>()
    for (const tc of ['rapid', 'blitz', 'bullet'] as const)
      for (const p of dailySeries(ratings, tc)) map.set(p.day, { ...(map.get(p.day) ?? { day: p.day }), [tc]: p.rating })
    return [...map.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))).map((r) => ({ ...r, day: String(r.day).slice(5) }))
  }, [ratings])

  // Last 8 weeks: training vs results (focus time control).
  const weeks = useMemo(() => {
    const out = []
    for (let i = 7; i >= 0; i--) {
      const start = addDays(weekStart(), -7 * i)
      const end = addDays(start, 7)
      const from = dayKey(start)
      const to = dayKey(end)
      const wg = games.filter((g) => g.tc === focus && g.date >= start.toISOString() && g.date < end.toISOString())
      const secs =
        attempts.filter((a) => a.day >= from && a.day < to).reduce((s, a) => s + Math.min(a.seconds, 600), 0) +
        drills.filter((d) => d.day >= from && d.day < to).reduce((s, d) => s + d.seconds, 0)
      const exercises =
        attempts.filter((a) => a.day >= from && a.day < to).length +
        data.positionAttempts.filter((a) => a.day >= from && a.day < to).length +
        data.lineAttempts.filter((a) => a.day >= from && a.day < to).length
      const rated = wg.filter((g) => g.ratingAfter).sort((a, b) => a.date.localeCompare(b.date))
      const analysed = wg.filter((g) => g.analysis)
      out.push({
        week: from.slice(5),
        minutes: Math.round(secs / 60),
        exercises,
        games: wg.length,
        score: scorePct(wg),
        rating: rated.length ? rated[rated.length - 1].ratingAfter : null,
        errors: analysed.length
          ? Number((analysed.reduce((s, g) => s + g.analysis!.mistakes + g.analysis!.blunders, 0) / analysed.length).toFixed(1))
          : null,
      })
    }
    return out
  }, [games, attempts, drills, data.positionAttempts, data.lineAttempts, focus])

  // Mistakes per analysed game over time (oldest first).
  const errorTrend = useMemo(
    () =>
      games
        .filter((g) => g.analysis)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((g) => ({ date: g.date.slice(5, 10), errors: g.analysis!.mistakes + g.analysis!.blunders })),
    [games],
  )

  const tcResults = (['rapid', 'blitz', 'bullet'] as const).map((tc) => {
    const list = games.filter((g) => g.tc === tc).slice(0, 100)
    return { tc, games: list.length, score: scorePct(list) }
  })

  const themes = themeStats(attempts)
  const [thisWeek, lastWeek] = [weeks[7], weeks[6]]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">📊 {t('an2.title')}</h1>
        <span className="w-12" />
      </div>

      <Card>
        <SectionTitle>{t('an2.compare')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <span />
          <span className="text-xs text-slate-500">{t('an2.lastWeek')}</span>
          <span className="text-xs text-slate-500">{t('an2.thisWeek')}</span>
          {(
            [
              ['an2.minutes', 'minutes'],
              ['an2.exercises', 'exercises'],
              ['an2.games', 'games'],
              ['an2.score', 'score'],
              ['an2.errors', 'errors'],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="contents">
              <span className="text-left">{t(label)}</span>
              <span>{lastWeek[key] ?? '—'}</span>
              <b>{thisWeek[key] ?? '—'}</b>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('an2.ratings')}</SectionTitle>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ratingChart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={['dataMin - 30', 'dataMax + 30']} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {(['rapid', 'blitz', 'bullet'] as const).map((tc) => (
                <Line key={tc} isAnimationActive={false} type="monotone" dataKey={tc} name={t(`tc.${tc}`)} stroke={TC_COLORS[tc]} dot={false} connectNulls strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('an2.trainingVsResults', { tc: t(`tc.${focus}`) })}</SectionTitle>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="minutes" name={t('an2.minutes')} fill="#16a34a" isAnimationActive={false} />
              <Bar dataKey="games" name={t('an2.games')} fill="#2563eb" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-2 w-full text-center text-xs">
          <thead className="text-slate-500">
            <tr>
              <th>{t('an2.week')}</th>
              <th>{t('an2.score')}</th>
              <th>{t('an2.rating')}</th>
              <th>{t('an2.errors')}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td>{w.week}</td>
                <td>{w.score ?? '—'}</td>
                <td>{w.rating ?? '—'}</td>
                <td>{w.errors ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-400">{t('an2.trainingNote')}</p>
      </Card>

      {errorTrend.length >= 3 && (
        <Card>
          <SectionTitle>{t('an2.errorTrend')}</SectionTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorTrend} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="errors" name={t('an2.errors')} stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400">{t('an2.errorNote')}</p>
        </Card>
      )}

      <Card className="text-sm">
        <SectionTitle>{t('an2.byTc')}</SectionTitle>
        {tcResults.map((r) => (
          <div key={r.tc} className="flex items-center gap-2 py-0.5">
            <span className="w-20">{t(`tc.${r.tc}`)}</span>
            <div className="flex-1">
              <ProgressBar value={(r.score ?? 0) / 100} />
            </div>
            <span className="w-24 text-right text-xs text-slate-500">
              {r.score ?? '—'}% · {r.games}
            </span>
          </div>
        ))}
        <p className="mt-1 text-xs text-slate-400">{t('an2.byTcNote')}</p>
      </Card>

      {themes.length > 0 && (
        <Card className="text-sm">
          <SectionTitle>{t('an2.themes')}</SectionTitle>
          {themes.slice(0, 8).map((s) => (
            <div key={s.theme} className="flex items-center gap-2 py-0.5">
              <span className="w-36 truncate">{themeName(s.theme, lang)}</span>
              <div className="flex-1">
                <ProgressBar value={s.accuracy} color={s.accuracy < 0.6 ? 'bg-red-400' : 'bg-green-500'} />
              </div>
              <span className="w-16 text-right text-xs text-slate-500">
                {Math.round(s.accuracy * 100)}% ({s.attempts})
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
