// AI coach chat. Answers come from Claude using only your data (see lib/coach.ts).
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey, weekStart } from '../lib/dates'
import { askCoach, coachStatus, type CoachError, type CoachMessage } from '../lib/coach'
import { useT, type TKey } from '../lib/i18n'
import { Button, Card, inputClass } from '../components/ui'

const QUICK: TKey[] = ['coach.q.weakness', 'coach.q.today', 'coach.q.losing', 'coach.q.month', 'coach.q.calc', 'coach.q.think']

/** Very small formatter: **bold** and line breaks / bullets. */
function Rich({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1">
      {text.split('\n').map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g)
        return (
          <p key={i} className={line.trim().startsWith('- ') || line.trim().startsWith('• ') ? 'pl-3' : ''}>
            {parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p))}
          </p>
        )
      })}
    </div>
  )
}

export default function Coach({ data }: { data: AppData }) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState<{ configured: boolean; passwordRequired: boolean } | null | 'loading'>('loading')
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CoachError | null>(null)
  const report = useLiveQuery(() => db.reports.get(dayKey(weekStart())))
  const bottom = useRef<HTMLDivElement>(null)
  const autoSent = useRef(false)

  useEffect(() => {
    coachStatus().then(setStatus)
  }, [])

  // A question handed over from another screen (e.g. "explain this mistake").
  useEffect(() => {
    const q = (location.state as { question?: string } | null)?.question
    if (q && !autoSent.current && status !== 'loading' && status?.configured) {
      autoSent.current = true
      send(q)
      navigate('.', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy])

  async function send(text: string, saveAsReport = false) {
    if (!text.trim() || busy) return
    const next: CoachMessage[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)
    const r = await askCoach(data, next)
    setBusy(false)
    if ('error' in r) {
      setError(r.error)
      setMessages(messages)
      return
    }
    setMessages([...next, { role: 'assistant', content: r.text }])
    if (saveAsReport) await db.reports.put({ id: dayKey(weekStart()), text: r.text, createdAt: new Date().toISOString() })
  }

  if (status === 'loading') return <div className="p-4 text-sm text-slate-500">…</div>

  if (!status?.configured) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">🤖 {t('coach.title')}</h1>
        <Card className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{t('coach.setupTitle')}</p>
          <ol className="list-decimal pl-5">
            <li>{t('coach.setup1')}</li>
            <li>{t('coach.setup2')}</li>
            <li>{t('coach.setup3')}</li>
            <li>{t('coach.setup4')}</li>
          </ol>
          <p className="text-xs text-slate-500">{t('coach.cost')}</p>
          {status === null && <p className="text-xs text-red-500">{t('coach.offline')}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🤖 {t('coach.title')}</h1>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => send(t('coach.reportPrompt'), true)} disabled={busy}>
          📋 {t('coach.report')}
        </Button>
      </div>

      {messages.length === 0 && (
        <>
          {report && (
            <Card className="text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">📋 {t('coach.lastReport')}</div>
              <Rich text={report.text} />
            </Card>
          )}
          <p className="text-sm text-slate-500">{t('coach.intro')}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((k) => (
              <button key={k} onClick={() => send(t(k))} className="rounded-full bg-green-50 px-3 py-1.5 text-sm text-green-800 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-800">
                {t(k)}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col gap-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'self-end bg-green-600 text-white' : 'self-start bg-white shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10'
            }`}
          >
            {m.role === 'assistant' ? <Rich text={m.content} /> : m.content.length > 400 ? `${m.content.slice(0, 200)}…` : m.content}
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">🤖 {t('coach.thinking')}</div>}
        {error && <p className="text-sm text-red-500">{t(`coach.err.${error}` as TKey)}</p>}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-20 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input className={inputClass} placeholder={t('coach.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={busy || !input.trim()}>
          ↑
        </Button>
      </form>
      <p className="text-center text-xs text-slate-400">{t('coach.note')}</p>
    </div>
  )
}
