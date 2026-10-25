import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AppData } from '../lib/data'
import type { Settings, TimeControl } from '../lib/db'
import { dayKey, monthStart, weekStart } from '../lib/dates'
import { themeName, useLang, useT, type TKey } from '../lib/i18n'
import { todaysPlan } from '../lib/plan'
import {
  bestStreak, currentRating, dailySeries, gamesInRange, levelFromXp, lossStreakToday, mistakeTagCounts, needsReview,
  nextMilestone, practiceRating, ratingChange, record, streak, themeStats, totalXp, trainedDays, trainingMinutes, weeklyPace,
  weeklyChallenge, weeksMetSince,
} from '../lib/stats'
import { db } from '../lib/db'
import { Card, ProgressBar, SectionTitle, Segmented, Stat } from '../components/ui'

export const ACT_ICON = { mistakes: '🎯', openings: '📖', tactics: '⚔️', calculation: '🧠', middlegame: '🏰', endgame: '🏁', blindfold: '🙈', review: '🔍' } as const

export default function Dashboard({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const { settings, ratings, games, attempts, drills } = data
  const [tc, setTc] = useState<TimeControl>(settings.focus)

  const rating = currentRating(ratings, settings, tc)
  const goal = settings.milestones[tc].at(-1) ?? null
  const next = nextMilestone(settings.milestones[tc], rating)
  const start = settings.startRatings[tc]
  const change30 = ratingChange(ratings, tc, 30)

  const days = trainedDays(attempts, drills, games)
  data.lineAttempts.forEach((a) => days.add(a.day))
  data.positionAttempts.forEach((a) => days.add(a.day))
  const weekly = weeklyChallenge(games, settings)
  const dayStreak = streak(new Set(data.daysDone))
  const wk = dayKey(weekStart())
  const weekGames = gamesInRange(games, weekStart())
  const focusWeekGames = weekGames.filter((g) => g.tc === settings.focus)
  const target = settings.weeklyGames[settings.focus]
  const pace = weeklyPace(target, focusWeekGames.length)
  const toReview = games.filter((g) => needsReview(g, settings))
  const lossStreak = lossStreakToday(games)
  const tagCounts = mistakeTagCounts(games)

  const xp = totalXp(attempts, drills, games, {
    lineAttempts: data.lineAttempts,
    positionAttempts: data.positionAttempts,
    daysDone: data.daysDone,
    weeksMet: weeksMetSince(games, settings),
  })
  const lvl = levelFromXp(xp)
  const plan = todaysPlan(data)
  const stats = themeStats(attempts)

  const chartData = dailySeries(ratings, tc).map((p) => ({ date: p.day.slice(5), rating: p.rating }))

  const achievements: { key: TKey; done: boolean; icon: string }[] = [
    { key: 'ach.firstPuzzle', done: attempts.some((a) => a.correct), icon: '🧩' },
    { key: 'ach.firstBlind', done: drills.length > 0, icon: '🙈' },
    { key: 'ach.streak7', done: bestStreak(days) >= 7, icon: '🔥' },
    { key: 'ach.correct50', done: attempts.filter((a) => a.correct).length >= 50, icon: '🎯' },
    { key: 'ach.reviews5', done: games.filter((g) => g.reviewed).length >= 5, icon: '🔍' },
    { key: 'ach.week1', done: weeksMetSince(games, settings) >= 1, icon: '📅' },
    { key: 'ach.days7', done: data.daysDone.length >= 7, icon: '🏅' },
    { key: 'ach.mistakes10', done: data.positions.filter((p) => p.box >= 2).length >= 10, icon: '🎯' },
    {
      key: 'ach.milestone',
      done: (['rapid', 'blitz', 'bullet'] as const).some((c) => {
        const first = [...settings.milestones[c]].sort((a, b) => a - b)[0]
        return first !== undefined && ratings.some((r) => r.tc === c && r.source !== 'start' && r.rating >= first)
      }),
      icon: '🏆',
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="h-12 w-12 rounded-xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{t('app.name')}</h1>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{t('app.slogan')}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-green-600 dark:text-green-400">
            {t('dash.level', { n: lvl.level })} · {xp} XP
          </div>
          <div className="w-28">
            <ProgressBar value={lvl.progress} />
          </div>
        </div>
      </header>

      {pace.behind && target > 0 && settings.createdAt < weekStart().toISOString() && (
        <Banner icon="⏰">
          {t('dash.behind', { played: focusWeekGames.length, target, left: pace.remaining, days: pace.daysLeft })}
        </Banner>
      )}
      {lossStreak >= 2 && <Banner icon="🧊">{t('tilt.text', { n: lossStreak })}</Banner>}

      {toReview.length > 0 ? (
        <Card className="flex flex-col gap-2 ring-2 ring-amber-400">
          <div className="font-bold">🔍 {t('gate.title')}</div>
          <p className="text-sm">
            {t('gate.text', {
              tc: t(`tc.${toReview[0].tc}`),
              result: t(`games.${toReview[0].result}`),
              opp: toReview[0].opponent ?? '?',
            })}
          </p>
          <Link to={`/games/${toReview[0].id}`} className="rounded-xl bg-green-600 py-2.5 text-center font-semibold text-white">
            {t('gate.cta')}
          </Link>
          {toReview.length > 1 && <p className="text-xs text-slate-500">{t('gate.more', { n: toReview.length - 1 })}</p>}
        </Card>
      ) : (
        games.length > 0 && (
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-green-600">✓ {t('gate.ok')}</div>
            <p className="text-xs text-slate-500">🧠 {t('gate.checklist')}</p>
            <a
              href="https://www.chess.com/play/online"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-100 py-2 text-center text-sm font-semibold dark:bg-slate-800"
            >
              ♟️ {t('gate.play')} ↗
            </a>
          </Card>
        )
      )}

      <Card className="flex flex-col gap-2 ring-2 ring-green-500">
        <div className="flex items-center justify-between">
          <div className="font-bold">🔥 {t('ch.daily')}</div>
          <span className="text-xs font-semibold text-slate-500">
            {t('ch.dailyText', { done: plan.filter((p) => p.complete).length, total: plan.length })}
          </span>
        </div>
        <ProgressBar value={plan.filter((p) => p.complete).length / Math.max(1, plan.length)} />
        {plan.every((p) => p.complete) ? (
          <p className="text-sm font-semibold text-green-600">🎉 {t('ch.dailyDone')}</p>
        ) : (
          <Link to="/train" className="rounded-xl bg-green-600 py-2.5 text-center font-semibold text-white">
            {t('ch.continue')} →
          </Link>
        )}
        {dayStreak > 0 && <p className="text-xs text-slate-500">{t('ch.dayStreak', { n: dayStreak })}</p>}
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="font-bold">📅 {t('ch.weekly')}</div>
          {weekly.target > 0 && <span className="text-xs text-slate-500">{t('ch.daysLeft', { n: weekly.daysLeft })}</span>}
        </div>
        {weekly.target > 0 ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('ch.weeklyText', { target: weekly.target, tc: t(`tc.${settings.focus}`) })}
            </p>
            <div className="flex justify-between text-sm font-semibold">
              <span>♟️ {t('ch.played', { n: weekly.played, t: weekly.target })}</span>
              <span>🔍 {t('ch.reviewed', { n: weekly.reviewed, t: weekly.played })}</span>
            </div>
            <ProgressBar value={weekly.played / weekly.target} color={weekly.met ? 'bg-green-500' : 'bg-amber-400'} />
            {weekly.met && <p className="text-sm font-semibold text-green-600">🏆 {t('ch.weekDone')}</p>}
            {weekly.streak > 0 && <p className="text-xs text-slate-500">{t('ch.weekStreak', { n: weekly.streak })}</p>}
          </>
        ) : (
          <Link to="/settings" className="text-sm text-green-600 underline">
            {t('ch.setTarget')}
          </Link>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('dash.title')}</SectionTitle>
        <Segmented
          options={(['rapid', 'blitz', 'bullet'] as const).map((c) => ({ value: c, label: t(`tc.${c}`) }))}
          value={tc}
          onChange={setTc}
        />
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-500">{t('dash.current')}</div>
            <div className="text-4xl font-extrabold">{rating}</div>
            {change30 !== null && (
              <div className={`text-sm font-semibold ${change30 >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {change30 >= 0 ? '▲' : '▼'} {Math.abs(change30)} · {t('dash.change30')}
              </div>
            )}
          </div>
          {goal !== null && (
            <div className="text-right">
              <div className="text-xs text-slate-500">{t('dash.goal')}</div>
              <div className="text-2xl font-bold">{goal}</div>
              <div className="text-sm text-slate-500">
                {rating >= goal ? t('dash.reached') : t('dash.toGo', { n: goal - rating })}
              </div>
            </div>
          )}
        </div>
        {goal !== null && goal > start && <ProgressBar value={(rating - start) / (goal - start)} />}
        {goal !== null && rating >= goal && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 p-2 text-sm dark:bg-green-900/30">
            <span>🏆 {t('goal.reached', { g: goal })}</span>
            <button
              className="rounded-lg bg-green-600 px-3 py-1 font-semibold text-white"
              onClick={() =>
                db.settings.update('main', {
                  milestones: { ...settings.milestones, [tc]: [...settings.milestones[tc], Math.ceil((rating + 1) / 100) * 100] },
                })
              }
            >
              {t('goal.next', { g: Math.ceil((rating + 1) / 100) * 100 })}
            </button>
          </div>
        )}
        {settings.milestones[tc].length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[...settings.milestones[tc]].sort((a, b) => a - b).map((m) => (
              <span
                key={m}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  rating >= m
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : m === next
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
              >
                {rating >= m ? '✓ ' : ''}
                {m}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('dash.history')}</SectionTitle>
        {chartData.length < 2 ? (
          <p className="text-sm text-slate-500">{t('dash.noHistory')}</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={['dataMin - 30', 'dataMax + 30']} tick={{ fontSize: 11 }} />
                <Tooltip />
                {goal !== null && <ReferenceLine y={goal} stroke="#16a34a" strokeDasharray="4 4" />}
                <Line isAnimationActive={false} type="monotone" dataKey="rating" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon="🔥" label={t('dash.streak')} value={streak(days)} sub={t('dash.best', { n: bestStreak(days) })} />
        <Stat
          icon="⏱️"
          label={t('dash.minutesWeek')}
          value={trainingMinutes(attempts, drills, wk)}
          sub={t('dash.minutesMonth', { n: trainingMinutes(attempts, drills, dayKey(monthStart())) })}
        />
        <Stat
          icon="♟️"
          label={t('dash.gamesWeek')}
          value={target > 0 ? `${focusWeekGames.length}/${target}` : weekGames.length}
          sub={(() => {
            const r = record(weekGames)
            return t('games.record', { w: r.win, l: r.loss, d: r.draw })
          })()}
        />
        <Stat
          icon="🧩"
          label={t('dash.exercises')}
          value={attempts.filter((a) => a.day >= wk).length + drills.filter((d) => d.day >= wk).length}
          sub={t('dash.exercisesTotal', { n: attempts.length + drills.length })}
        />
      </div>

      <Card>
        <SectionTitle right={<Link to="/train" className="text-sm font-semibold text-green-600">{t('common.start')} →</Link>}>
          {t('dash.today')}
        </SectionTitle>
        {plan.every((p) => p.complete) && <p className="mb-2 text-sm font-semibold text-green-600">🎉 {t('dash.todayAllDone')}</p>}
        <ul className="flex flex-col gap-2">
          {plan.map((p) => (
            <li key={p.activity} className="flex items-center gap-3">
              <span className="text-xl">{p.complete ? '✅' : ACT_ICON[p.activity]}</span>
              <div className="flex-1">
                <div className={`text-sm font-medium ${p.complete ? 'text-slate-400 line-through' : ''}`}>{t(`act.${p.activity}`)}</div>
                <ProgressBar value={p.done / p.target} />
              </div>
              <span className="text-xs text-slate-500">
                {Math.min(p.done, p.target)}/{p.target}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>{t('dash.strengths')}</SectionTitle>
        {stats.length === 0 ? (
          <p className="text-sm text-slate-500">{t('dash.swEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="mb-1 font-semibold text-red-500">{t('dash.weak')}</div>
              {stats.slice(0, 3).map((s) => (
                <ThemeRow key={s.theme} name={themeName(s.theme, lang)} acc={s.accuracy} n={s.attempts} />
              ))}
            </div>
            <div>
              <div className="mb-1 font-semibold text-green-600">{t('dash.strong')}</div>
              {stats.slice(-3).reverse().map((s) => (
                <ThemeRow key={s.theme} name={themeName(s.theme, lang)} acc={s.accuracy} n={s.attempts} />
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">{t('dash.swNote')}</p>
        {tagCounts.length > 0 && (
          <div className="mt-3 text-sm">
            <div className="mb-1 font-semibold">{t('dash.mistakes')}</div>
            {tagCounts.slice(0, 4).map((c) => (
              <div key={c.tag} className="flex justify-between py-0.5">
                <span>{t(`tag.${c.tag}` as TKey)}</span>
                <span className="text-slate-500">×{c.count}</span>
              </div>
            ))}
            <p className="text-xs text-slate-400">{t('dash.mistakesNote')}</p>
          </div>
        )}
        {attempts.length > 0 && (
          <p className="mt-2 text-sm">
            {t('dash.practice')}: <b>{practiceRating(attempts)}</b>{' '}
            <span className="text-xs text-slate-400">({t('dash.practiceNote')})</span>
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('dash.achievements')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {achievements.map((a) => (
            <div
              key={a.key}
              className={`flex flex-col items-center rounded-xl p-2 text-center text-xs ${
                a.done ? 'bg-amber-50 dark:bg-amber-900/30' : 'opacity-40 grayscale'
              }`}
            >
              <span className="text-2xl">{a.icon}</span>
              {t(a.key)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ThemeRow({ name, acc, n }: { name: string; acc: number; n: number }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="truncate">{name}</span>
      <span className="shrink-0 text-slate-500">
        {Math.round(acc * 100)}% <span className="text-xs">({n})</span>
      </span>
    </div>
  )
}

function Banner({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800">
      <span>{icon}</span>
      <div>{children}</div>
    </div>
  )
}
