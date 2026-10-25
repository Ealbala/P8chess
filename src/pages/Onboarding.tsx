// First screen: collects current ratings and goals, then creates the settings record.
import { useState } from 'react'
import { db, defaultSettings, type TimeControl } from '../lib/db'
import { translate, type TKey } from '../lib/i18n'
import { fetchCurrentRatings } from '../lib/chesscom'
import { Button, Card, Field, Segmented, inputClass } from '../components/ui'

const TCS: TimeControl[] = ['rapid', 'blitz', 'bullet']

export default function Onboarding() {
  const [s, setS] = useState(defaultSettings())
  const t = (k: TKey) => translate(s.lang, k)
  const goal = s.milestones[s.focus].at(-1) ?? s.startRatings[s.focus] + 300
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function loadRatings() {
    setFetchState('loading')
    try {
      const r = await fetchCurrentRatings(s.chessComUsername.trim())
      setS((prev) => ({ ...prev, startRatings: { ...prev.startRatings, ...r } }))
      setFetchState('ok')
    } catch {
      setFetchState('error')
    }
  }

  async function finish() {
    const now = new Date().toISOString()
    // Milestones every 100 points from the current rating up to the goal.
    const start = s.startRatings[s.focus]
    const steps: number[] = []
    for (let r = Math.floor(start / 100) * 100 + 100; r < goal; r += 100) steps.push(r)
    steps.push(goal)
    const settings = { ...s, milestones: { ...s.milestones, [s.focus]: steps }, createdAt: now }
    await db.transaction('rw', db.settings, db.ratings, async () => {
      await db.settings.put(settings)
      await db.ratings.bulkAdd(TCS.map((tc) => ({ date: now, tc, rating: s.startRatings[tc], source: 'start' as const })))
    })
  }

  return (
    <div className="safe-top mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div className="flex justify-end">
        <Segmented
          options={[
            { value: 'en', label: 'EN' },
            { value: 'es', label: 'ES' },
          ]}
          value={s.lang}
          onChange={(lang) => setS({ ...s, lang })}
        />
      </div>
      <div className="text-center">
        <div className="text-5xl">♞</div>
        <h1 className="mt-2 text-2xl font-bold">{t('onb.title')}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t('onb.sub')}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <Field label={t('onb.username')}>
          <div className="flex gap-2">
            <input
              className={inputClass}
              autoCapitalize="none"
              value={s.chessComUsername}
              onChange={(e) => setS({ ...s, chessComUsername: e.target.value })}
            />
            <Button variant="secondary" className="shrink-0 text-sm" onClick={loadRatings} disabled={!s.chessComUsername.trim() || fetchState === 'loading'}>
              {fetchState === 'loading' ? '⏳' : t('onb.fetch')}
            </Button>
          </div>
        </Field>
        {fetchState === 'ok' && <p className="text-xs text-green-600">{t('onb.fetched')}</p>}
        {fetchState === 'error' && <p className="text-xs text-red-500">{t('sync.notFound')}</p>}
        <h2 className="font-semibold">{t('onb.ratings')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {TCS.map((tc) => (
            <Field key={tc} label={t(`tc.${tc}`)}>
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                value={s.startRatings[tc]}
                onChange={(e) => setS({ ...s, startRatings: { ...s.startRatings, [tc]: Number(e.target.value) } })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('onb.focus')}</h2>
        <Segmented
          options={TCS.map((tc) => ({ value: tc, label: t(`tc.${tc}`) }))}
          value={s.focus}
          onChange={(focus) => setS({ ...s, focus })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('onb.goal')}>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              value={goal}
              onChange={(e) => setS({ ...s, milestones: { ...s.milestones, [s.focus]: [Number(e.target.value)] } })}
            />
          </Field>
          <Field label={t('onb.weekly')}>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={0}
              value={s.weeklyGames[s.focus]}
              onChange={(e) => setS({ ...s, weeklyGames: { ...s.weeklyGames, [s.focus]: Number(e.target.value) } })}
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('onb.daily')}</h2>
        <Segmented
          options={([10, 20, 30, 45, 60] as const).map((m) => ({ value: m, label: `${m}′` }))}
          value={s.dailyMinutes}
          onChange={(dailyMinutes) => setS({ ...s, dailyMinutes })}
        />
      </Card>

      <Button onClick={finish} className="py-3 text-lg">
        {t('onb.go')}
      </Button>
    </div>
  )
}
