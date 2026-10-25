import { useState } from 'react'
import type { AppData } from '../lib/data'
import { db, type Game, type Settings, type TimeControl } from '../lib/db'
import { weekStart } from '../lib/dates'
import { useLang, useT } from '../lib/i18n'
import { gamesInRange, record } from '../lib/stats'
import { Button, Card, Field, ProgressBar, SectionTitle, Segmented, inputClass } from '../components/ui'

const TCS: TimeControl[] = ['rapid', 'blitz', 'bullet']

function localNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function Games({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const { settings, games } = data
  const [adding, setAdding] = useState(false)
  const weekGames = gamesInRange(games, weekStart())

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{t('games.title')}</h1>

      <Card>
        <SectionTitle>{t('games.week')}</SectionTitle>
        <div className="flex flex-col gap-3">
          {TCS.filter((tc) => settings.weeklyGames[tc] > 0 || weekGames.some((g) => g.tc === tc)).map((tc) => {
            const list = weekGames.filter((g) => g.tc === tc)
            const target = settings.weeklyGames[tc]
            const r = record(list)
            return (
              <div key={tc}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{t(`tc.${tc}`)}</span>
                  <span className="text-slate-500">
                    {target > 0
                      ? `${t('games.played', { played: list.length, target })} · ${t('games.left', { n: Math.max(0, target - list.length) })}`
                      : `${list.length} · ${t('games.noTarget')}`}
                  </span>
                </div>
                {target > 0 && <ProgressBar value={list.length / target} />}
                <div className="mt-0.5 text-xs text-slate-500">{t('games.record', { w: r.win, l: r.loss, d: r.draw })}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {adding ? (
        <AddGame settings={settings} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>+ {t('games.add')}</Button>
      )}
      <p className="text-xs text-slate-400">{t('games.manualNote')}</p>

      <section>
        <SectionTitle>{t('games.list')}</SectionTitle>
        {games.length === 0 && <p className="text-sm text-slate-500">{t('games.empty')}</p>}
        <div className="flex flex-col gap-2">
          {games.map((g) => (
            <GameRow key={g.id} game={g} lang={lang} />
          ))}
        </div>
      </section>
    </div>
  )
}

function AddGame({ settings, onDone }: { settings: Settings; onDone: () => void }) {
  const t = useT()
  const [tc, setTc] = useState<TimeControl>(settings.focus)
  const [result, setResult] = useState<Game['result']>('win')
  const [color, setColor] = useState<Game['color']>('white')
  const [initialDate] = useState(localNow)
  const [date, setDate] = useState(initialDate)
  const [ratingAfter, setRatingAfter] = useState('')
  const [opponentRating, setOpponentRating] = useState('')
  const [opening, setOpening] = useState('')

  async function save() {
    // Keep full precision when the date wasn't changed, so ordering with other entries stays right.
    const iso = date === initialDate ? new Date().toISOString() : new Date(date).toISOString()
    await db.transaction('rw', db.games, db.ratings, async () => {
      const id = await db.games.add({
        date: iso,
        tc,
        result,
        color,
        ratingAfter: ratingAfter ? Number(ratingAfter) : undefined,
        opponentRating: opponentRating ? Number(opponentRating) : undefined,
        opening: opening.trim() || undefined,
        source: 'manual',
        reviewed: false,
      })
      if (ratingAfter) await db.ratings.add({ date: iso, tc, rating: Number(ratingAfter), source: 'game', gameId: id })
    })
    onDone()
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">{t('games.add')}</h2>
      <Segmented options={TCS.map((c) => ({ value: c, label: t(`tc.${c}`) }))} value={tc} onChange={setTc} />
      <Segmented
        options={[
          { value: 'win' as const, label: `✅ ${t('games.win')}` },
          { value: 'draw' as const, label: `🤝 ${t('games.draw')}` },
          { value: 'loss' as const, label: `❌ ${t('games.loss')}` },
        ]}
        value={result}
        onChange={setResult}
      />
      <Segmented
        options={[
          { value: 'white' as const, label: `♔ ${t('games.white')}` },
          { value: 'black' as const, label: `♚ ${t('games.black')}` },
        ]}
        value={color}
        onChange={setColor}
      />
      <Field label={t('games.date')}>
        <input className={inputClass} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('games.ratingAfter')}>
          <input className={inputClass} type="number" inputMode="numeric" value={ratingAfter} onChange={(e) => setRatingAfter(e.target.value)} />
        </Field>
        <Field label={`${t('games.opponent')} (${t('games.optional')})`}>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            value={opponentRating}
            onChange={(e) => setOpponentRating(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t('games.opening')}>
        <input className={inputClass} value={opening} onChange={(e) => setOpening(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button className="flex-1" onClick={save}>
          {t('common.save')}
        </Button>
      </div>
    </Card>
  )
}

function GameRow({ game, lang }: { game: Game; lang: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [lesson, setLesson] = useState(game.lesson ?? '')
  const icon = { win: '✅', loss: '❌', draw: '🤝' }[game.result]

  async function saveReview() {
    await db.games.update(game.id!, {
      reviewed: true,
      reviewedAt: game.reviewedAt ?? new Date().toISOString(),
      lesson: lesson.trim(),
    })
    setOpen(false)
  }

  async function remove() {
    if (!confirm(`${t('common.delete')}?`)) return
    await db.transaction('rw', db.games, db.ratings, async () => {
      await db.games.delete(game.id!)
      await db.ratings.where('tc').equals(game.tc).filter((r) => r.gameId === game.id).delete()
    })
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 text-sm">
          <div className="font-semibold">
            {t(`tc.${game.tc}`)} · {t(game.color === 'white' ? 'games.white' : 'games.black')}
            {game.ratingAfter ? ` · ${game.ratingAfter}` : ''}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(game.date).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}
            {game.opponentRating ? ` · vs ${game.opponentRating}` : ''}
            {game.opening ? ` · ${game.opening}` : ''}
          </div>
        </div>
        {game.reviewed ? (
          <button className="text-xs font-semibold text-green-600" onClick={() => setOpen(!open)}>
            ✓ {t('games.reviewed')}
          </button>
        ) : (
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => setOpen(!open)}>
            {t('games.review')}
          </Button>
        )}
      </div>
      {!open && game.lesson && <p className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">💡 {game.lesson}</p>}
      {open && (
        <div className="flex flex-col gap-2">
          <textarea
            className={`${inputClass} min-h-24`}
            placeholder={t('games.lessonPrompt')}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" className="px-3" onClick={remove}>
              🗑
            </Button>
            <Button className="flex-1" onClick={saveReview} disabled={!lesson.trim()}>
              {t('games.saveReview')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
