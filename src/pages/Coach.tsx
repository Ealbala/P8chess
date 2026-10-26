// AI coach chat. Answers come from Claude using only your data (see lib/coach.ts).
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { buildClaudePrompt } from '../lib/coach'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey, weekStart } from '../lib/dates'
import { askCoach, coachStatus, type CoachError, type CoachMessage } from '../lib/coach'
import { useT, type TKey } from '../lib/i18n'
import { Button, Card, inputClass } from '../components/ui'
import CoachInbox from '../components/CoachInbox'

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

function ApiChat({ data, initialQuestion }: { data: AppData; initialQuestion?: string }) {
  const t = useT()
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
    if (initialQuestion && !autoSent.current && status !== 'loading' && status?.configured) {
      autoSent.current = true
      send(initialQuestion)
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

  if (!status?.configured) return <ApiSetup offline={status === null} />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">💬 {t('coach.apiTitle')}</h2>
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

function ApiSetup({ offline }: { offline: boolean }) {
  const t = useT()
  return (
    <details className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
      <summary className="cursor-pointer font-semibold">💳 {t('coach.apiOptional')}</summary>
      <ol className="mt-2 list-decimal pl-5">
        <li>{t('coach.setup1')}</li>
        <li>{t('coach.setup2')}</li>
        <li>{t('coach.setup3')}</li>
        <li>{t('coach.setup4')}</li>
      </ol>
      <p className="mt-1 text-xs text-slate-500">{t('coach.cost')}</p>
      {offline && <p className="text-xs text-slate-400">{t('coach.offline')}</p>}
    </details>
  )
}

/** Free: build the prompt with all your data, copy it and open Claude (your own subscription). */
function FreeCoach({ data, initialQuestion }: { data: AppData; initialQuestion?: string }) {
  const t = useT()
  const [question, setQuestion] = useState(initialQuestion ?? '')
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null)
  const [manualText, setManualText] = useState('')

  async function copyAndOpen(q: string) {
    if (!q.trim()) return
    const prompt = buildClaudePrompt(data, q.trim())
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied('ok')
      window.open('https://claude.ai/new', '_blank', 'noopener')
    } catch {
      setManualText(prompt)
      setCopied('manual')
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <div className="font-bold">🆓 {t('coach.freeTitle')}</div>
        <p className="text-sm text-slate-500">{t('coach.freeIntro')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((k) => (
          <button
            key={k}
            onClick={() => setQuestion(t(k))}
            className="rounded-full bg-green-50 px-3 py-1.5 text-sm text-green-800 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-800"
          >
            {t(k)}
          </button>
        ))}
        <button
          onClick={() => setQuestion(t('coach.reportPrompt'))}
          className="rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800"
        >
          📋 {t('coach.report')}
        </button>
      </div>
      <textarea className={`${inputClass} min-h-20 text-sm`} placeholder={t('coach.placeholder')} value={question} onChange={(e) => setQuestion(e.target.value)} />
      <Button onClick={() => copyAndOpen(question)} disabled={!question.trim()}>
        📋 {t('coach.copyOpen')}
      </Button>
      {copied === 'ok' && <p className="text-sm font-semibold text-green-600">✓ {t('coach.copied')}</p>}
      {copied === 'manual' && (
        <>
          <p className="text-sm text-amber-700">{t('coach.copyManual')}</p>
          <textarea readOnly className={`${inputClass} min-h-32 font-mono text-xs`} value={manualText} onFocus={(e) => e.target.select()} />
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="text-center text-sm font-semibold text-green-600 underline">
            {t('coach.openClaude')} ↗
          </a>
        </>
      )}
      <p className="text-xs text-slate-400">{t('coach.freeNote')}</p>
    </Card>
  )
}

function McpCard({ password }: { password?: string }) {
  const t = useT()
  const url = `${location.origin}/api/mcp${password ? `?key=${encodeURIComponent(password)}` : ''}`
  const [copied, setCopied] = useState(false)
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <div className="font-bold">🔌 {t('coach.mcpTitle')}</div>
      <p className="text-slate-500">{t('coach.mcpIntro')}</p>
      <p className={password ? 'font-semibold text-green-700 dark:text-green-400' : 'text-amber-700'}>{password ? t('coach.mcpKey') : t('coach.mcpNoKey')}</p>
      <div className="flex gap-2">
        <input readOnly className={`${inputClass} font-mono text-xs`} value={url} onFocus={(e) => e.target.select()} />
        <Button
          variant="secondary"
          onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined)}
        >
          {copied ? '✓' : '📋'}
        </Button>
      </div>
      <ol className="list-decimal pl-5">
        <li>{t('coach.mcp1')}</li>
        <li>{t('coach.mcp2')}</li>
        <li>{t('coach.mcp3')}</li>
      </ol>
      {password && <p className="text-xs text-amber-700">🔒 {t('coach.mcpKeyWarn')}</p>}
      <p className="text-xs text-slate-400">{t('coach.mcpNote')}</p>
    </Card>
  )
}

export default function Coach({ data }: { data: AppData }) {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  // A question handed over from another screen (e.g. "explain this mistake").
  const [initialQuestion] = useState(() => (location.state as { question?: string } | null)?.question)
  useEffect(() => {
    if (initialQuestion) navigate('.', { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">🤖 {t('coach.title')}</h1>
      <CoachInbox data={data} full />
      <FreeCoach data={data} initialQuestion={initialQuestion} />
      <McpCard password={data.settings.coachPassword} />
      <ApiChat data={data} />
    </div>
  )
}
