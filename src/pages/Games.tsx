import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppData } from '../lib/data'
import { db, type Game, type Settings, type TimeControl } from '../lib/db'
import { weekStart } from '../lib/dates'
import { useLang, useT } from '../lib/i18n'
import { openingFamily } from '../lib/chesscom'
import { runSync, useSyncState } from '../lib/sync'
import { useAnalysisState } from '../lib/analysisRunner'
import { errorRates } from '../lib/analysis'
import { gamesInRange, groupStats, needsReview, record, timeStats, type GroupStat } from '../lib/stats'
import { Button, Card, Field, ProgressBar, SectionTitle, Segmented, inputClass } from '../components/ui'

const TCS: TimeControl[] = ['rapid', 'blitz', 'bullet']

function localNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function Games({ data }: { data: AppData }) {
  const t = useT()
  const { settings, games } = data
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<TimeControl | 'all'>('all')
  const [shown, setShown] = useState(30)
  const weekGames = gamesInRange(games, weekStart())
  const toReview = games.filter((g) => needsReview(g, settings))
  const list = games.filter((g) => filter === 'all' || g.tc === filter)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{t('games.title')}</h1>

      <SyncCard username={settings.chessComUsername} />
      <AnalysisCard data={data} />

      <Card>
        <SectionTitle>{t('games.week')}</SectionTitle>
        <div className="flex flex-col gap-3">
          {TCS.filter((tc) => settings.weeklyGames[tc] > 0 || weekGames.some((g) => g.tc === tc)).map((tc) => {
            const wk = weekGames.filter((g) => g.tc === tc)
            const target = settings.weeklyGames[tc]
            const r = record(wk)
            return (
              <div key={tc}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{t(`tc.${tc}`)}</span>
                  <span className="text-slate-500">
                    {target > 0
                      ? `${t('games.played', { played: wk.length, target })} · ${t('games.left', { n: Math.max(0, target - wk.length) })}`
                      : `${wk.length} · ${t('games.noTarget')}`}
                  </span>
                </div>
                {target > 0 && <ProgressBar value={wk.length / target} />}
                <div className="mt-0.5 text-xs text-slate-500">{t('games.record', { w: r.win, l: r.loss, d: r.draw })}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {toReview.length > 0 && (
        <Card>
          <SectionTitle>
            🔍 {t('games.toReview')} ({toReview.length})
          </SectionTitle>
          <div className="flex flex-col gap-2">
            {toReview.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </div>
        </Card>
      )}

      <GameStats games={games} tc={settings.focus} />

      <section>
        <SectionTitle>{t('games.list')}</SectionTitle>
        <div className="mb-2">
          <Segmented
            options={[
              { value: 'all' as const, label: '∑' },
              ...TCS.map((c) => ({ value: c, label: t(`tc.${c}`) })),
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        {list.length === 0 && <p className="text-sm text-slate-500">{t('games.empty')}</p>}
        <div className="flex flex-col gap-2">
          {list.slice(0, shown).map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </div>
        {list.length > shown && (
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setShown(shown + 50)}>
            ↓ {list.length - shown}
          </Button>
        )}
      </section>

      {adding ? (
        <AddGame settings={settings} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + {t('games.manualAdd')}
        </Button>
      )}
      <p className="text-xs text-slate-400">{t('games.manualNote')}</p>
    </div>
  )
}

function SyncCard({ username }: { username: string }) {
  const t = useT()
  const lang = useLang()
  const sync = useSyncState()
  const last = useLiveQuery(() => db.meta.get('chesscom.lastSync'))
  if (!username) {
    return (
      <Card className="text-sm">
        <Link to="/settings" className="text-green-600 underline">
          {t('sync.noUser')}
        </Link>
      </Card>
    )
  }
  const errorKey = sync.error === 'not-found' ? 'sync.notFound' : sync.error === 'rate-limit' ? 'sync.rateLimit' : 'sync.network'
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <div className="font-semibold">♟️ {username}</div>
          <div className="text-xs text-slate-500">
            {last ? t('sync.last', { t: new Date(last.value).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' }) }) : t('sync.never')}
          </div>
        </div>
        <Button className="shrink-0 text-sm" onClick={() => runSync(username)} disabled={sync.running}>
          {sync.running ? '⏳' : '🔄'} {t('sync.button')}
        </Button>
      </div>
      {sync.running && sync.progress && <p className="text-xs text-slate-500">{t('sync.syncing', { m: sync.progress })}</p>}
      {sync.added !== null && <p className="text-xs text-green-600">✓ {t('sync.done', { n: sync.added })}</p>}
      {sync.error && <p className="text-xs text-red-500">{t(errorKey)}</p>}
      <p className="text-xs text-slate-400">{t('sync.note')}</p>
    </Card>
  )
}

function AnalysisCard({ data }: { data: AppData }) {
  const t = useT()
  const state = useAnalysisState()
  const rates = errorRates(data.games)
  if (!state.running && rates.games === 0) return null
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <SectionTitle>⚙️ {t('an.title')}</SectionTitle>
      {state.running && (
        <>
          <p>{t('an.progress', { d: state.done + 1, t: state.total })}</p>
          <ProgressBar value={state.done / Math.max(1, state.total)} />
        </>
      )}
      {state.error && <p className="text-xs text-red-500">{t('an.error')}</p>}
      {rates.games > 0 && (
        <>
          <p>{t('an.summary', { n: rates.games })}</p>
          <div className="font-semibold">{t('an.rate')}</div>
          {rates.byPhase.map((p) => (
            <div key={p.phase} className="flex items-center gap-2">
              <span className="w-24 capitalize">{t(`phase.${p.phase}`)}</span>
              <div className="flex-1">
                <ProgressBar value={Math.min(1, p.rate / 10)} color="bg-red-400" />
              </div>
              <span className="w-10 text-right font-semibold">{p.rate.toFixed(1)}</span>
            </div>
          ))}
          {(() => {
            const timed = data.positions.filter((p) => p.clock !== undefined)
            if (timed.length < 5) return null
            const low = timed.filter((p) => p.clock! < 60).length
            return <p>⏱️ {t('time.pressure', { pct: Math.round((low / timed.length) * 100), n: timed.length })}</p>
          })()}
          <Link to="/train/mistakes" className="text-green-600 underline">
            🎯 {t('mk.title')} ({data.positions.length})
          </Link>
        </>
      )}
      <p className="text-xs text-slate-400">{t('an.note', { tc: t(`tc.${data.settings.focus}`) })}</p>
    </Card>
  )
}

function GameStats({ games, tc }: { games: Game[]; tc: TimeControl }) {
  const t = useT()
  const recent = games.filter((g) => g.tc === tc).slice(0, 50)
  if (recent.length < 5) return null
  const byColor = groupStats(recent, (g) => g.color)
  const openings = groupStats(recent.filter((g) => g.opening), (g) => openingFamily(g.opening)).slice(0, 5)
  const time = timeStats(recent)
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <SectionTitle>{t('gs.title', { tc: t(`tc.${tc}`), n: recent.length })}</SectionTitle>
      <div>
        <div className="mb-1 font-semibold">{t('gs.byColor')}</div>
        {byColor.map((s) => (
          <StatRow key={s.key} label={t(s.key === 'white' ? 'games.white' : 'games.black')} s={s} />
        ))}
      </div>
      {openings.length > 0 && (
        <div>
          <div className="mb-1 font-semibold">{t('gs.openings')}</div>
          {openings.map((s) => (
            <StatRow key={s.key} label={s.key} s={s} />
          ))}
        </div>
      )}
      {time && (
        <div>
          <div className="mb-1 font-semibold">⏱️ {t('gs.time')}</div>
          <div className="flex justify-between gap-2">
            <span>{t('gs.lowTime')}</span>
            <b>{Math.round(time.lowTimePct * 100)}%</b>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('gs.lostOnTime')}</span>
            <b>
              {time.lostOnTime}/{time.games}
            </b>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('gs.openingSec')}</span>
            <b>{Math.floor(time.openingSeconds / 60)}:{String(time.openingSeconds % 60).padStart(2, '0')}</b>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">{t('gs.scoreNote')}</p>
    </Card>
  )
}

function StatRow({ label, s }: { label: string; s: GroupStat }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-slate-500">
        {s.win}/{s.draw}/{s.loss}
      </span>
      <div className="w-16">
        <ProgressBar value={s.score / 100} color={s.score >= 50 ? 'bg-green-500' : 'bg-red-400'} />
      </div>
      <span className="w-9 text-right font-semibold">{s.score}%</span>
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

function GameRow({ game }: { game: Game }) {
  const t = useT()
  const lang = useLang()
  const icon = { win: '✅', loss: '❌', draw: '🤝' }[game.result]
  return (
    <Link to={`/games/${game.id}`} className="block">
      <Card className="flex items-center gap-3 p-3 active:scale-[0.99]">
        <span className="text-xl">{icon}</span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-semibold">
            {t(`tc.${game.tc}`)} · {game.color === 'white' ? '♔' : '♚'} {game.opponent ? `vs ${game.opponent}` : ''}
            {game.ratingAfter ? ` · ${game.ratingAfter}` : ''}
          </div>
          <div className="truncate text-xs text-slate-500">
            {new Date(game.date).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })}
            {game.opening ? ` · ${game.opening}` : ''}
          </div>
          {game.lesson && <div className="truncate text-xs">💡 {game.lesson}</div>}
        </div>
        {game.reviewed ? <span className="text-xs font-semibold text-green-600">✓</span> : <span className="text-slate-400">›</span>}
      </Card>
    </Link>
  )
}
