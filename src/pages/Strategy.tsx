// Middlegame plans: short lessons on the structures from your openings. Wrong answers
// never reveal the solution — you are told to think again (or you can ask to see it).
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, ProgressBar } from '../components/ui'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey } from '../lib/dates'
import { useLang, useT } from '../lib/i18n'
import { STRATEGY } from '../data/strategy'

export function StrategyHome({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🏰 {t('st.title')}</h1>
        <span className="w-12" />
      </div>
      <p className="text-sm text-slate-500">{t('st.intro')}</p>
      {STRATEGY.map((l) => {
        const tries = data.attempts.filter((a) => a.puzzleId === `strategy-${l.id}`)
        const best = tries.some((a) => a.correct) ? 'perfect' : tries.some((a) => a.solved) ? 'solved' : tries.length ? 'tried' : 'new'
        return (
          <Link key={l.id} to={`/train/strategy/${l.id}`}>
            <Card className="flex items-center gap-3 p-3">
              <span className="text-2xl">{best === 'perfect' ? '🏆' : best === 'solved' ? '✅' : best === 'tried' ? '🔁' : l.orientation === 'white' ? '♔' : '♚'}</span>
              <div className="flex-1">
                <div className="font-semibold">{l.title[lang]}</div>
                <div className="text-xs text-slate-500">
                  {t('st.steps', { n: l.steps.length })} · {t('eg.tries', { n: tries.length })}
                </div>
              </div>
              <span className="text-slate-400">›</span>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export function StrategyTrainer() {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const lesson = STRATEGY.find((l) => l.id === id)
  const startFen = useMemo(() => {
    const c = new Chess()
    lesson?.moves.split(' ').forEach((m) => c.move(m))
    return c.fen()
  }, [lesson])
  const [i, setI] = useState(0)
  const [fen, setFen] = useState(startFen)
  const [last, setLast] = useState<[string, string] | null>(null)
  const [wrongPicks, setWrongPicks] = useState<number[]>([])
  const [feedback, setFeedback] = useState<'wrong' | 'alsoGood' | 'right' | 'revealed' | null>(null)
  const mistakes = useRef(0)
  const revealedAny = useRef(false)
  const [finished, setFinished] = useState(false)

  if (!lesson) return null
  const step = lesson.steps[i]

  async function finish() {
    setFinished(true)
    await db.attempts.add({
      puzzleId: `strategy-${lesson!.id}`,
      date: new Date().toISOString(),
      day: dayKey(),
      cat: 'middlegame',
      correct: mistakes.current === 0 && !revealedAny.current,
      solved: !revealedAny.current,
      rating: 1500,
      themes: ['strategy'],
      seconds: 60,
    })
  }

  function nextStep() {
    setWrongPicks([])
    setFeedback(null)
    setFen(startFen)
    setLast(null)
    if (i + 1 < lesson!.steps.length) setI(i + 1)
    else finish()
  }

  function pick(k: number) {
    if (step.type !== 'choice' || feedback === 'right' || feedback === 'revealed') return
    if (step.options[k].correct) setFeedback('right')
    else {
      mistakes.current++
      setWrongPicks([...wrongPicks, k])
      setFeedback('wrong')
    }
  }

  function onMove(from: Square, to: Square, promotion?: string) {
    if (step.type !== 'move' || feedback === 'right' || feedback === 'revealed') return false
    const c = new Chess(startFen)
    let m
    try {
      m = c.move({ from, to, promotion })
    } catch {
      return false
    }
    if (step.accept.includes(m.san)) {
      setFen(c.fen())
      setLast([m.from, m.to])
      setFeedback('right')
      return true
    }
    mistakes.current++
    setFeedback(step.alsoGood?.includes(m.san) ? 'alsoGood' : 'wrong')
    return false
  }

  function reveal() {
    revealedAny.current = true
    if (step.type === 'move') {
      const c = new Chess(startFen)
      const m = c.move(step.accept[0])
      setFen(c.fen())
      setLast([m.from, m.to])
    }
    setFeedback('revealed')
  }

  const done = feedback === 'right' || feedback === 'revealed'

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/train/strategy')} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <span className="text-xs text-slate-500">{t('st.stepOf', { i: Math.min(i + 1, lesson.steps.length), n: lesson.steps.length })}</span>
      </div>
      <h1 className="font-bold">{lesson.title[lang]}</h1>
      <ProgressBar value={(i + (done || finished ? 1 : 0)) / lesson.steps.length} />
      {i === 0 && !finished && <Card className="text-sm">📘 {lesson.concept[lang]}</Card>}

      <Board fen={fen} orientation={lesson.orientation} onMove={onMove} interactive={!finished && step.type === 'move' && !done} lastMove={last} />

      {finished ? (
        <Card className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="text-lg font-bold">
            {revealedAny.current ? t('st.doneRevealed') : mistakes.current === 0 ? `🏆 ${t('st.perfect')}` : `✅ ${t('st.done')}`}
          </div>
          <div className="flex w-full gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                mistakes.current = 0
                revealedAny.current = false
                setFinished(false)
                setI(0)
                setWrongPicks([])
                setFeedback(null)
                setFen(startFen)
                setLast(null)
              }}
            >
              🔁 {t('st.again')}
            </Button>
            <Button className="flex-1" onClick={() => navigate('/train/strategy')}>
              {t('common.next')} →
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          <div className="font-semibold">{step.question[lang]}</div>
          {step.type === 'choice' &&
            step.options.map((o, k) => (
              <button
                key={k}
                onClick={() => pick(k)}
                disabled={wrongPicks.includes(k) || done}
                className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${
                  done && o.correct
                    ? 'bg-green-100 ring-green-400 dark:bg-green-900/40'
                    : wrongPicks.includes(k)
                      ? 'bg-red-50 text-red-700 line-through ring-red-200 dark:bg-red-900/30 dark:text-red-200'
                      : 'ring-slate-200 dark:ring-slate-700'
                }`}
              >
                {o.text[lang]}
              </button>
            ))}
          {feedback === 'wrong' && <p className="text-sm font-semibold text-red-600">✗ {t('st.wrong')}</p>}
          {feedback === 'alsoGood' && <p className="text-sm font-semibold text-amber-600">{t('st.alsoGood')}</p>}
          {done && (
            <>
              <p className={`text-sm ${feedback === 'right' ? 'text-green-700 dark:text-green-300' : ''}`}>
                {feedback === 'right' ? '✓ ' : ''}
                {step.why[lang]}
              </p>
              <Button onClick={nextStep}>{t('common.next')} →</Button>
            </>
          )}
          {!done && (
            <Button variant="ghost" onClick={reveal}>
              {t('mk.showAnswer')}
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
