// What Claude (via the MCP connector) sent to the app: messages, assigned sessions and goals.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppData } from '../lib/data'
import { db, type CoachItem } from '../lib/db'
import { lastUpload, syncCoach } from '../lib/coachInbox'
import { trackStats } from '../lib/training'
import { findTrack } from '../data/tracks'
import { useLang, useT } from '../lib/i18n'
import { Button, Card } from './ui'

function Item({ item, data }: { item: CoachItem; data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const track = item.track ? findTrack(item.track) : undefined
  const trackName = track ? `${track.icon} ${track.name[lang]}` : item.track ?? ''
  const done = () => db.coachItems.update(item.id, { done: true })
  const heading =
    item.type === 'assignment'
      ? t('inbox.assign', { min: item.minutes ?? 30, track: trackName })
      : item.type === 'goal'
        ? t('inbox.goal', { track: trackName, plus: item.plus ?? 100 })
        : item.title
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-3 ${item.done ? 'bg-slate-50 opacity-70 dark:bg-slate-800/50' : 'bg-green-50 dark:bg-green-900/20'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">
          {item.type === 'assignment' ? '🏋️' : item.type === 'goal' ? '🎯' : '💬'} {heading}
        </div>
        <span className="shrink-0 text-xs text-slate-400">{item.createdAt.slice(0, 10)}</span>
      </div>
      {item.text && <p className="whitespace-pre-wrap text-sm">{item.text}</p>}
      {!item.done && (
        <div className="flex gap-2">
          {item.type === 'assignment' && track && (
            <Button
              className="flex-1"
              onClick={async () => {
                await done()
                navigate(`/train/session?tracks=${track.id}&min=${item.minutes ?? 30}`)
              }}
            >
              ▶ {t('inbox.start')}
            </Button>
          )}
          {item.type === 'goal' && track && (
            <Button
              className="flex-1"
              onClick={async () => {
                const current = trackStats(track, data.attempts).rating
                await db.goals.add({ track: track.id, startRating: current, target: current + (item.plus ?? 100), createdAt: new Date().toISOString() })
                await done()
              }}
            >
              ✓ {t('inbox.accept')}
            </Button>
          )}
          <Button variant="secondary" className={item.type === 'message' || !track ? 'flex-1' : ''} onClick={done}>
            {t('inbox.dismiss')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** `full` = Coach page (status, refresh, history). Otherwise only pending items, or nothing. */
export default function CoachInbox({ data, full = false }: { data: AppData; full?: boolean }) {
  const t = useT()
  const items = useLiveQuery(() => db.coachItems.orderBy('createdAt').reverse().toArray(), []) ?? []
  const uploaded = useLiveQuery(lastUpload, [])
  const [state, setState] = useState<'idle' | 'busy' | 'fail'>('idle')
  const password = data.settings.coachPassword
  const pending = items.filter((i) => !i.done)
  const old = items.filter((i) => i.done).slice(0, 10)
  if (!full && !pending.length) return null

  async function refresh() {
    setState('busy')
    setState((await syncCoach(data, password, true)) ? 'idle' : 'fail')
  }

  return (
    <Card className={`flex flex-col gap-2 ${pending.length ? 'ring-2 ring-green-500' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="font-bold">🤖 {t('inbox.title')}</div>
        {full && password && (
          <button className="text-sm font-semibold text-green-600 disabled:opacity-50" disabled={state === 'busy'} onClick={refresh}>
            {state === 'busy' ? '…' : `↻ ${t('inbox.refresh')}`}
          </button>
        )}
      </div>
      {pending.map((i) => (
        <Item key={i.id} item={i} data={data} />
      ))}
      {full && (
        <>
          {!pending.length && <p className="text-sm text-slate-500">{password ? t('inbox.empty') : t('inbox.noPassword')}</p>}
          {password && (
            <p className="text-xs text-slate-400">
              {uploaded ? t('inbox.synced', { when: new Date(uploaded).toLocaleString() }) : t('inbox.never')}
            </p>
          )}
          {state === 'fail' && <p className="text-sm text-red-600">{t('inbox.fail')}</p>}
          {old.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-slate-500">{t('inbox.history', { n: old.length })}</summary>
              <div className="mt-2 flex flex-col gap-2">
                {old.map((i) => (
                  <Item key={i.id} item={i} data={data} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </Card>
  )
}
