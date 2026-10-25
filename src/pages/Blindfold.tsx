// Blindfold chess, levels 1–5. Level 1 (coordinates) lives in components/CoordsDrill.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Chess } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, ProgressBar, Segmented, inputClass } from '../components/ui'
import type { AppData } from '../lib/data'
import { db, type DrillSession } from '../lib/db'
import { dayKey } from '../lib/dates'
import { useLang, useT, type TKey } from '../lib/i18n'
import { loadPuzzles } from '../lib/puzzles'
import { OPENINGS } from '../data/openings'
import { createSparringEngine, type Engine } from '../lib/engine'
import {
  PIECE_GLYPH, PIECE_OPTIONS, memorySquares, moveQuestion, parseMoveInput, pieceAt, speakSan, type MoveQuestion,
} from '../lib/blindfold'

const LEVELS: { level: number; kinds: DrillSession['kind'][]; icon: string }[] = [
  { level: 1, kinds: ['coords-find', 'coords-color'], icon: '🔤' },
  { level: 2, kinds: ['moves'], icon: '♞' },
  { level: 3, kinds: ['memory'], icon: '🧠' },
  { level: 4, kinds: ['calc'], icon: '🔢' },
  { level: 5, kinds: ['blind-game'], icon: '🙈' },
]

async function saveDrill(d: Omit<DrillSession, 'id' | 'date' | 'day'>) {
  await db.drills.add({ ...d, date: new Date().toISOString(), day: dayKey() })
}

export function speak(text: string, lang: 'en' | 'es') {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'es' ? 'es-ES' : 'en-US'
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  } catch {
    /* speech not available */
  }
}

function Header({ title }: { title: string }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between">
      <Link to="/train/blindfold" className="text-sm font-semibold text-green-600">
        ← {t('common.back')}
      </Link>
      <h1 className="text-lg font-bold">{title}</h1>
      <span className="w-12" />
    </div>
  )
}

export function BlindfoldHome({ data }: { data: AppData }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🙈 {t('bf.title')}</h1>
        <span className="w-12" />
      </div>
      {LEVELS.map(({ level, kinds, icon }) => {
        const sessions = data.drills.filter((d) => kinds.includes(d.kind))
        const correct = sessions.reduce((s, d) => s + d.correct, 0)
        const total = sessions.reduce((s, d) => s + d.total, 0)
        return (
          <Link key={level} to={`/train/blindfold/${level}`}>
            <Card className="flex items-center gap-3 p-3 active:scale-[0.99]">
              <span className="text-2xl">{icon}</span>
              <div className="flex-1">
                <div className="font-semibold">{t(`bf.l${level}` as TKey)}</div>
                <div className="text-xs text-slate-500">{t(`bf.l${level}.desc` as TKey)}</div>
                {sessions.length > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    {t('bf.stats', { n: sessions.length, pct: total ? Math.round((correct / total) * 100) : 0 })}
                  </div>
                )}
              </div>
              <span className="text-slate-400">›</span>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

// ---------- Level 2: movements ----------

export function MovesDrill() {
  const t = useT()
  const [q, setQ] = useState<MoveQuestion>(moveQuestion)
  const [score, setScore] = useState({ c: 0, t: 0 })
  const [feedback, setFeedback] = useState<{ ok: boolean; answer: string } | null>(null)
  const ROUND = 10

  function answer(opt: string) {
    if (feedback) return
    const ok = opt === q.answer
    setFeedback({ ok, answer: q.answer })
    const next = { c: score.c + (ok ? 1 : 0), t: score.t + 1 }
    setScore(next)
    if (next.t === ROUND) saveDrill({ kind: 'moves', correct: next.c, total: ROUND, seconds: 120 })
  }

  const text =
    q.kind === 'knightDistance'
      ? t('bf.q.knightDistance', { a: q.squares[0], b: q.squares[1] })
      : q.kind === 'diagonal'
        ? t('bf.q.diagonal', { a: q.squares[0], b: q.squares[1] })
        : t('bf.q.knightCount', { a: q.squares[0] })

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header title={t('bf.l2')} />
      <ProgressBar value={score.t / ROUND} />
      {score.t < ROUND ? (
        <>
          <Card className="py-8 text-center text-xl font-bold">{text}</Card>
          <div className="grid grid-cols-3 gap-2">
            {q.options.map((o) => (
              <Button key={o} variant="secondary" className="py-4 text-lg" onClick={() => answer(o)}>
                {o === 'yes' ? t('bf.yes') : o === 'no' ? t('bf.no') : o}
              </Button>
            ))}
          </div>
          {feedback && (
            <div className="flex flex-col gap-2">
              <p className={`text-center font-semibold ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
                {feedback.ok ? '✓' : `✗ ${t('bf.answerWas', { a: feedback.answer === 'yes' ? t('bf.yes') : feedback.answer === 'no' ? t('bf.no') : feedback.answer })}`}
              </p>
              <Button
                onClick={() => {
                  setQ(moveQuestion())
                  setFeedback(null)
                }}
              >
                {t('common.next')} →
              </Button>
            </div>
          )}
        </>
      ) : (
        <RoundDone score={score} onAgain={() => (setScore({ c: 0, t: 0 }), setQ(moveQuestion()), setFeedback(null))} />
      )}
    </div>
  )
}

function RoundDone({ score, onAgain, children }: { score: { c: number; t: number }; onAgain: () => void; children?: ReactNode }) {
  const t = useT()
  return (
    <Card className="flex flex-col items-center gap-3 py-6">
      <div className="text-lg font-semibold">{t('coords.finished')}</div>
      <div className="text-4xl font-extrabold">
        {score.c}/{score.t}
      </div>
      {children}
      <Button onClick={onAgain}>{t('coords.again')}</Button>
    </Card>
  )
}

function PiecePicker({ onPick, disabled }: { onPick: (p: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {PIECE_OPTIONS.map((p) => (
        <button
          key={p || 'empty'}
          disabled={disabled}
          onClick={() => onPick(p)}
          className="rounded-lg bg-slate-100 py-2 text-2xl disabled:opacity-40 dark:bg-slate-800"
        >
          {PIECE_GLYPH[p]}
        </button>
      ))}
    </div>
  )
}

// ---------- Level 3: memory ----------

export function MemoryDrill() {
  const t = useT()
  const [seconds, setSeconds] = useState(10)
  const [stage, setStage] = useState<'ready' | 'show' | 'ask' | 'done'>('ready')
  const [fen, setFen] = useState('')
  const [squares, setSquares] = useState<string[]>([])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<{ sq: string; ok: boolean; answer: string }[]>([])
  const [left, setLeft] = useState(0)
  const QUESTIONS = 5

  async function start() {
    const all = await loadPuzzles()
    const small = all.filter((p) => p.fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length <= 12)
    const p = small[Math.floor(Math.random() * small.length)]
    const c = new Chess(p.fen)
    setFen(p.fen)
    setSquares(memorySquares(c, QUESTIONS))
    setI(0)
    setResults([])
    setLeft(seconds)
    setStage('show')
  }

  useEffect(() => {
    if (stage !== 'show') return
    if (left <= 0) {
      setStage('ask')
      return
    }
    const id = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(id)
  }, [stage, left])

  function pick(p: string) {
    const c = new Chess(fen)
    const sq = squares[i]
    const answer = pieceAt(c, sq)
    const next = [...results, { sq, ok: p === answer, answer }]
    setResults(next)
    if (i + 1 < squares.length) setI(i + 1)
    else {
      setStage('done')
      saveDrill({ kind: 'memory', correct: next.filter((r) => r.ok).length, total: next.length, seconds: seconds + 30 })
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header title={t('bf.l3')} />
      {stage === 'ready' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">{t('bf.memory.intro')}</p>
          <Segmented options={[5, 10, 20].map((s) => ({ value: s, label: `${s}s` }))} value={seconds} onChange={setSeconds} />
          <Button onClick={start}>{t('common.start')}</Button>
        </Card>
      )}
      {stage === 'show' && (
        <>
          <div className="text-center text-3xl font-bold">{left}s</div>
          <Board fen={fen} interactive={false} />
        </>
      )}
      {stage === 'ask' && (
        <>
          <ProgressBar value={i / squares.length} />
          <Card className="py-6 text-center text-xl font-bold">{t('bf.memory.q', { sq: squares[i] })}</Card>
          <PiecePicker onPick={pick} />
          {results.length > 0 && (
            <p className={`text-center text-sm ${results[results.length - 1].ok ? 'text-green-600' : 'text-red-500'}`}>
              {results[results.length - 1].sq}: {PIECE_GLYPH[results[results.length - 1].answer]}
            </p>
          )}
        </>
      )}
      {stage === 'done' && (
        <RoundDone score={{ c: results.filter((r) => r.ok).length, t: results.length }} onAgain={() => setStage('ready')}>
          <Board
            fen={fen}
            interactive={false}
            marks={Object.fromEntries(results.map((r) => [r.sq, { background: r.ok ? 'rgba(34,197,94,.6)' : 'rgba(239,68,68,.6)' }]))}
          />
        </RoundDone>
      )}
    </div>
  )
}

// ---------- Level 4: mental calculation ----------

export function CalcDrill() {
  const t = useT()
  const lang = useLang()
  const [plies, setPlies] = useState(6)
  const [stage, setStage] = useState<'ready' | 'read' | 'ask' | 'done'>('ready')
  const [moves, setMoves] = useState<string[]>([])
  const [squares, setSquares] = useState<string[]>([])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<{ sq: string; ok: boolean; answer: string }[]>([])
  const final = useMemo(() => {
    const c = new Chess()
    moves.forEach((m) => c.move(m))
    return c
  }, [moves])

  function start() {
    const lines = OPENINGS.flatMap((o) => o.lines).filter((l) => l.moves.split(' ').length >= plies)
    const line = lines[Math.floor(Math.random() * lines.length)]
    const seq = line.moves.split(' ').slice(0, plies)
    const c = new Chess()
    const touched = new Set<string>()
    for (const san of seq) {
      const m = c.move(san)
      touched.add(m.to)
      touched.add(m.from)
    }
    const pool = [...touched].sort(() => Math.random() - 0.5).slice(0, 3)
    setMoves(seq)
    setSquares(pool)
    setI(0)
    setResults([])
    setStage('read')
  }

  const text = moves.map((s, k) => (k % 2 === 0 ? `${k / 2 + 1}.${s}` : s)).join(' ')

  function pick(p: string) {
    const sq = squares[i]
    const answer = pieceAt(final, sq)
    const next = [...results, { sq, ok: p === answer, answer }]
    setResults(next)
    if (i + 1 < squares.length) setI(i + 1)
    else {
      setStage('done')
      saveDrill({ kind: 'calc', correct: next.filter((r) => r.ok).length, total: next.length, seconds: 60 })
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header title={t('bf.l4')} />
      {stage === 'ready' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">{t('bf.calc.intro')}</p>
          <Segmented options={[4, 6, 8, 12].map((n) => ({ value: n, label: t('bf.plies', { n }) }))} value={plies} onChange={setPlies} />
          <Button onClick={start}>{t('common.start')}</Button>
        </Card>
      )}
      {stage === 'read' && (
        <Card className="flex flex-col gap-3">
          <p className="font-mono text-lg leading-relaxed">{text}</p>
          <Button variant="secondary" onClick={() => speak(moves.map((m) => speakSan(m, lang)).join('. '), lang)}>
            🔊 {t('bf.listen')}
          </Button>
          <Button onClick={() => setStage('ask')}>{t('bf.calc.ready')}</Button>
        </Card>
      )}
      {stage === 'ask' && (
        <>
          <ProgressBar value={i / squares.length} />
          <Card className="py-6 text-center text-xl font-bold">{t('bf.memory.q', { sq: squares[i] })}</Card>
          <PiecePicker onPick={pick} />
        </>
      )}
      {stage === 'done' && (
        <RoundDone score={{ c: results.filter((r) => r.ok).length, t: results.length }} onAgain={() => setStage('ready')}>
          <p className="font-mono text-sm">{text}</p>
          <Board
            fen={final.fen()}
            interactive={false}
            marks={Object.fromEntries(results.map((r) => [r.sq, { background: r.ok ? 'rgba(34,197,94,.6)' : 'rgba(239,68,68,.6)' }]))}
          />
        </RoundDone>
      )}
    </div>
  )
}

// ---------- Level 5: blindfold game vs Stockfish ----------

type SpeechRec = { lang: string; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: () => void }

export function BlindGame() {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const [skill, setSkill] = useState(3)
  const [color, setColor] = useState<'white' | 'black'>('white')
  const [stage, setStage] = useState<'setup' | 'play' | 'over'>('setup')
  const gameRef = useRef(new Chess())
  const [, setTick] = useState(0)
  const rerender = () => setTick((x) => x + 1)
  const game = gameRef.current
  const [resigned, setResigned] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [peek, setPeek] = useState(false)
  const [peeks, setPeeks] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [lastEngine, setLastEngine] = useState('')
  const engineRef = useRef<Engine | null>(null)
  const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition

  useEffect(() => () => engineRef.current?.terminate(), [])

  function start() {
    engineRef.current?.terminate()
    engineRef.current = createSparringEngine(skill)
    const g = new Chess()
    gameRef.current = g
    setResigned(false)
    setPeeks(0)
    setPeek(false)
    setLastEngine('')
    setStage('play')
    if (color === 'black') engineMove(g)
  }

  async function engineMove(g: Chess) {
    setThinking(true)
    try {
      const r = await engineRef.current!.analyse(g.fen(), 8)
      const m = g.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] })
      setLastEngine(m.san)
      speak(speakSan(m.san, lang), lang)
      rerender()
      if (g.isGameOver()) finish(g)
    } finally {
      setThinking(false)
    }
  }

  function finish(g: Chess, resign = false) {
    setStage('over')
    setResigned(resign)
    const mine = color === 'white' ? 'w' : 'b'
    const points = resign ? 0 : g.isCheckmate() ? (g.turn() === mine ? 0 : 2) : 1
    saveDrill({ kind: 'blind-game', correct: points, total: 2, seconds: 0, peeks, moves: Math.ceil(g.history().length / 2) })
  }

  function submit(text: string) {
    setError('')
    const san = parseMoveInput(game, text)
    if (!san) {
      setError(t('bf.game.invalid', { m: text }))
      return
    }
    game.move(san)
    setInput('')
    rerender()
    if (game.isGameOver()) finish(game)
    else engineMove(game)
  }

  function listen() {
    if (!SR) return
    const rec = new SR()
    rec.lang = lang === 'es' ? 'es-AR' : 'en-US'
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript
      setInput(said)
      submit(said)
    }
    rec.onerror = () => setError(t('bf.game.micError'))
    rec.start()
  }

  const history = game.history()
  const text = history.map((s, k) => (k % 2 === 0 ? `${k / 2 + 1}.${s}` : s)).join(' ')
  const myTurn = (game.turn() === 'w') === (color === 'white')

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header title={t('bf.l5')} />
      {stage === 'setup' && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">{t('bf.game.intro')}</p>
          <div className="text-sm font-semibold">{t('bf.game.level')}</div>
          <Segmented options={[1, 3, 5, 8, 12].map((s) => ({ value: s, label: String(s) }))} value={skill} onChange={setSkill} />
          <Segmented
            options={[
              { value: 'white' as const, label: `♔ ${t('games.white')}` },
              { value: 'black' as const, label: `♚ ${t('games.black')}` },
            ]}
            value={color}
            onChange={setColor}
          />
          <Button onClick={start}>{t('common.start')}</Button>
        </Card>
      )}
      {stage !== 'setup' && (
        <>
          <Card className="flex flex-col gap-2">
            <div className="font-mono text-sm leading-relaxed">{text || '…'}</div>
            {lastEngine && (
              <div className="text-sm">
                🤖 {t('bf.game.engine')}: <b>{lastEngine}</b>{' '}
                <button className="text-green-600" onClick={() => speak(speakSan(lastEngine, lang), lang)}>
                  🔊
                </button>
              </div>
            )}
            {thinking && <div className="text-xs text-slate-500">🤖 …</div>}
          </Card>
          {stage === 'play' && myTurn && !thinking && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit(input)
              }}
            >
              <input
                className={inputClass}
                autoCapitalize="none"
                autoComplete="off"
                placeholder={t('bf.game.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              {SR && (
                <Button type="button" variant="secondary" onClick={listen}>
                  🎤
                </Button>
              )}
              <Button type="submit">↵</Button>
            </form>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            variant="secondary"
            onClick={() => {
              if (!peek) setPeeks(peeks + 1)
              setPeek(!peek)
            }}
          >
            👁 {peek ? t('bf.game.hide') : t('bf.game.peek')} ({peeks})
          </Button>
          {(peek || stage === 'over') && <Board fen={game.fen()} orientation={color} interactive={false} />}
          {stage === 'over' && (
            <Card className="text-center font-semibold">
              {resigned
                ? t('bf.game.lost')
                : game.isCheckmate()
                ? (game.turn() === (color === 'white' ? 'w' : 'b') ? t('bf.game.lost') : t('bf.game.won'))
                : t('board.draw')}
              <div className="mt-2 flex gap-2">
                <Button className="flex-1" onClick={() => setStage('setup')}>
                  {t('coords.again')}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => navigate('/train/blindfold')}>
                  {t('common.back')}
                </Button>
              </div>
            </Card>
          )}
          {stage === 'play' && (
            <Button variant="ghost" onClick={() => finish(game, true)}>
              🏳 {t('bf.game.resign')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
