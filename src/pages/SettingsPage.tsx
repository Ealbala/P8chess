import { useRef, useState } from 'react'
import type { AppData } from '../lib/data'
import { db, exportData, importData, resetAll, type Settings, type TimeControl } from '../lib/db'
import { useLang, useT } from '../lib/i18n'
import { currentRating } from '../lib/stats'
import { runSync } from '../lib/sync'
import { Button, Card, Field, SectionTitle, Segmented, inputClass } from '../components/ui'

const TCS: TimeControl[] = ['rapid', 'blitz', 'bullet']

const ROADMAP = {
  en: [
    ['✅', 'Phase 1 — Dashboard, goals, weekly games (manual), daily plan, puzzles, blindfold coordinates'],
    ['✅', 'Phase 2 — Chess.com import, review-before-playing, game review, time & opening stats'],
    ['✅', 'Phase 3 — Stockfish analysis on your device, mistake detection, My Mistake Library, daily and weekly challenges'],
    ['✅', 'Phase 4 — Openings with spaced repetition, middlegame, weakest-first plan, blindfold levels 1–5, endgame theory'],
    ['✅', 'Phase 5 — AI coach grounded on your data and Stockfish lines, weekly report (needs an API key)'],
    ['✅', 'Phase 6 — Analytics, calendar reminders, voice in blindfold training'],
  ],
  es: [
    ['✅', 'Fase 1 — Dashboard, objetivos, partidas semanales (manual), plan diario, ejercicios, coordenadas a ciegas'],
    ['✅', 'Fase 2 — Importación de Chess.com, revisar antes de jugar, revisión de partidas, estadísticas de tiempo y aperturas'],
    ['✅', 'Fase 3 — Análisis con Stockfish en tu dispositivo, detección de errores, biblioteca de errores, retos diarios y semanales'],
    ['✅', 'Fase 4 — Aperturas con repetición espaciada, medio juego, plan por área floja, a ciegas niveles 1–5, finales teóricos'],
    ['✅', 'Fase 5 — Coach de IA basado en tus datos y en las líneas de Stockfish, informe semanal (requiere clave de API)'],
    ['✅', 'Fase 6 — Estadísticas avanzadas, recordatorios en el calendario, voz en el entrenamiento a ciegas'],
  ],
}

export default function SettingsPage({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const { settings } = data
  const [tc, setTc] = useState<TimeControl>(settings.focus)
  const [milestones, setMilestones] = useState(settings.milestones[tc].join(', '))
  const [newRating, setNewRating] = useState('')
  const [username, setUsername] = useState(settings.chessComUsername)
  const [flash, setFlash] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<Settings>) => db.settings.update('main', patch)
  const notify = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1500)
  }

  function switchTc(c: TimeControl) {
    setTc(c)
    setMilestones(settings.milestones[c].join(', '))
  }

  async function saveMilestones() {
    const list = milestones
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
    await update({ milestones: { ...settings.milestones, [tc]: list } })
    setMilestones(list.join(', '))
    notify(t('set.saved'))
  }

  async function addRating() {
    if (!newRating) return
    await db.ratings.add({ date: new Date().toISOString(), tc, rating: Number(newRating), source: 'manual' })
    setNewRating('')
    notify(t('set.saved'))
  }

  async function saveUsername() {
    const name = username.trim()
    if (name.toLowerCase() !== settings.chessComUsername.toLowerCase()) await db.meta.delete('chesscom.lastSync')
    await update({ chessComUsername: name })
    notify(t('set.saved'))
    if (name) runSync(name)
  }

  async function doExport() {
    const blob = new Blob([await exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `my-chess-coach-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doImport(file: File) {
    try {
      await importData(await file.text())
      notify(t('set.imported'))
    } catch (e) {
      alert(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('set.title')}</h1>
        {flash && <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">✓ {flash}</span>}
      </div>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('set.goals')}</SectionTitle>
        <Field label={t('set.focus')}>
          <Segmented options={TCS.map((c) => ({ value: c, label: t(`tc.${c}`) }))} value={settings.focus} onChange={(focus) => update({ focus })} />
        </Field>
        <hr className="border-slate-200 dark:border-slate-700" />
        <Segmented options={TCS.map((c) => ({ value: c, label: t(`tc.${c}`) }))} value={tc} onChange={switchTc} />
        <div className="text-sm text-slate-500">
          {t('dash.current')}: <b>{currentRating(data.ratings, settings, tc)}</b>
        </div>
        <Field label={t('set.milestones')}>
          <div className="flex gap-2">
            <input className={inputClass} value={milestones} onChange={(e) => setMilestones(e.target.value)} />
            <Button onClick={saveMilestones}>{t('common.save')}</Button>
          </div>
        </Field>
        <Field label={t('set.weekly')}>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            min={0}
            value={settings.weeklyGames[tc]}
            onChange={(e) => update({ weeklyGames: { ...settings.weeklyGames, [tc]: Math.max(0, Number(e.target.value)) } })}
          />
        </Field>
        <Field label={t('set.addRating')}>
          <div className="flex gap-2">
            <input className={inputClass} type="number" inputMode="numeric" value={newRating} onChange={(e) => setNewRating(e.target.value)} />
            <Button variant="secondary" onClick={addRating} disabled={!newRating}>
              {t('set.addRatingBtn')}
            </Button>
          </div>
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('set.daily')}</SectionTitle>
        <Segmented
          options={([10, 20, 30, 45, 60] as const).map((m) => ({ value: m, label: `${m}′` }))}
          value={settings.dailyMinutes}
          onChange={(dailyMinutes) => update({ dailyMinutes })}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('set.appearance')}</SectionTitle>
        <Field label={t('set.lang')}>
          <Segmented
            options={[
              { value: 'en' as const, label: 'English' },
              { value: 'es' as const, label: 'Español' },
            ]}
            value={settings.lang}
            onChange={(l) => update({ lang: l })}
          />
        </Field>
        <Field label={t('set.theme')}>
          <Segmented
            options={[
              { value: 'system' as const, label: t('set.system') },
              { value: 'light' as const, label: `☀️ ${t('set.light')}` },
              { value: 'dark' as const, label: `🌙 ${t('set.dark')}` },
            ]}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>{t('set.chesscom')}</SectionTitle>
        <div className="flex gap-2">
          <input className={inputClass} value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} />
          <Button variant="secondary" onClick={saveUsername}>
            {t('common.save')}
          </Button>
        </div>
        <p className="text-xs text-slate-400">{t('set.chesscomNote')}</p>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>⏰ {t('set.reminders')}</SectionTitle>
        <p className="text-xs text-slate-500">{t('set.remindersNote')}</p>
        <div className="flex gap-2">
          <input
            className={inputClass}
            type="time"
            value={settings.reminderTime ?? '19:30'}
            onChange={(e) => update({ reminderTime: e.target.value })}
          />
          <a
            className="shrink-0 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white"
            href={`/api/reminders?time=${encodeURIComponent(settings.reminderTime ?? '19:30')}&lang=${settings.lang}&app=${encodeURIComponent(location.origin)}`}
            target="_blank"
            rel="noreferrer"
          >
            📅 {t('set.addCalendar')}
          </a>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>🤖 {t('coach.title')}</SectionTitle>
        <p className="text-xs text-slate-500">{t('set.coachNote')}</p>
        <input
          className={inputClass}
          type="password"
          autoComplete="off"
          placeholder={t('set.coachPassword')}
          value={settings.coachPassword ?? ''}
          onChange={(e) => update({ coachPassword: e.target.value })}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>{t('set.backup')}</SectionTitle>
        <p className="text-xs text-slate-500">{t('set.backupNote')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={doExport}>
            ⬇️ {t('set.export')}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
            ⬆️ {t('set.import')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
        <Button variant="danger" onClick={() => confirm(t('set.resetConfirm')) && resetAll()}>
          {t('set.reset')}
        </Button>
      </Card>

      <Card>
        <SectionTitle>{t('set.roadmap')}</SectionTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          {ROADMAP[lang].map(([icon, text]) => (
            <li key={text} className="flex gap-2">
              <span>{icon}</span>
              <span className={icon === '✅' ? '' : 'text-slate-500'}>{text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
