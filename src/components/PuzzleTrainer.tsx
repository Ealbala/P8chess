// Puzzle trainer: the opponent's first move is played automatically, then you must find
// the solution moves. Answers are checked against the Lichess solution (or any mate-in-one).
// A wrong move never reveals the answer: you are told it's wrong and can think again.
// It counts as "solved" only if you finish without showing the solution; "correct"
// (for accuracy stats) means solved at the first try without a hint.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Chess, type Square } from 'chess.js'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey } from '../lib/dates'
import { themeName, useLang, useT } from '../lib/i18n'
import { todaysPlan } from '../lib/plan'
import { loadPuzzles, pickPuzzle, type Puzzle, type PuzzleCat } from '../lib/puzzles'
import { practiceRating, themeStats } from '../lib/stats'
import Board from './Board'
import { OPENINGS } from '../data/openings'
import { Button, Card, ProgressBar } from './ui'

function openingTitle(id: string, lang: 'en' | 'es') {
  const o = OPENINGS.find((x) => x.id === id)
  return o ? `${o.name[lang]} · ⚔️` : id
}

type Status = 'loading' | 'empty' | 'intro' | 'playing' | 'wrong' | 'solved' | 'failed'

function uciToMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined }
}

export default function PuzzleTrainer({
  cat,
  data,
  openingId,
  puzzleId,
}: {
  cat: PuzzleCat
  data: AppData
  openingId?: string
  /** Redo one specific puzzle (from the history). */
  puzzleId?: string
}) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [fen, setFen] = useState('8/8/8/8/8/8/8/8 w - - 0 1')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [wrongs, setWrongs] = useState(0)
  const game = useRef(new Chess())
  const step = useRef(0)
  const wrongCount = useRef(0)
  const hinted = useRef(false)
  const recorded = useRef(false)
  const startedAt = useRef(0)
  const seen = useRef(new Set<string>())
  const timers = useRef<number[]>([])
  const puzzleRef = useRef<Puzzle | null>(null)
  const firstLoad = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const applyUci = (uci: string) => {
    const m = uciToMove(uci)
    game.current.move(m)
    setFen(game.current.fen())
    setLastMove([m.from, m.to])
  }

  async function record(correct: boolean, solved: boolean) {
    const p = puzzleRef.current
    if (recorded.current || !p) return
    recorded.current = true
    await db.attempts.add({
      puzzleId: p.id,
      date: new Date().toISOString(),
      day: dayKey(),
      cat: p.cat,
      correct,
      solved,
      rating: p.rating,
      themes: p.themes,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
  }

  /** Leaving a puzzle you already got wrong counts as not solved. */
  const abandon = () => {
    if (!recorded.current && wrongCount.current > 0) record(false, false)
  }

  // Record on leaving the screen too.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      abandon()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const start = (p: Puzzle) => {
    seen.current.add(p.id)
    puzzleRef.current = p
    game.current = new Chess(p.fen)
    step.current = 0
    wrongCount.current = 0
    hinted.current = false
    recorded.current = false
    setWrongs(0)
    setHintSquare(null)
    setPuzzle(p)
    setFen(p.fen)
    setLastMove(null)
    setMessage('')
    setStatus('intro')
    later(() => {
      applyUci(p.moves[0])
      step.current = 1
      startedAt.current = Date.now()
      setStatus('playing')
    }, 700)
  }

  const next = useCallback(async () => {
    abandon()
    timers.current.forEach(clearTimeout)
    timers.current = []
    setStatus('loading')
    const all = await loadPuzzles()
    if (puzzleId && firstLoad.current) {
      firstLoad.current = false
      const p = all.find((x) => x.id === puzzleId)
      if (p) return start(p)
    }
    firstLoad.current = false
    const { attempts } = dataRef.current
    const weak = themeStats(attempts).filter((s) => s.accuracy < 0.6).slice(0, 3).map((s) => s.theme)
    const p = pickPuzzle(all, cat, practiceRating(attempts), attempts, weak, seen.current, openingId)
    if (!p) {
      setStatus('empty')
      return
    }
    start(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, openingId, puzzleId])

  useEffect(() => {
    next()
  }, [next])

  function onMove(from: Square, to: Square, promotion?: string): boolean {
    if (!puzzle || (status !== 'playing' && status !== 'wrong')) return false
    // Ignore input while the opponent's reply is still pending.
    if (step.current % 2 === 0) return false
    const expected = puzzle.moves[step.current]
    const exp = uciToMove(expected)
    // Use the solution's promotion piece when the squares match (e.g. a knight underpromotion).
    const promo = exp.from === from && exp.to === to ? exp.promotion : promotion
    const test = new Chess(game.current.fen())
    try {
      test.move({ from, to, promotion: promo })
    } catch {
      return false
    }
    const isLast = step.current === puzzle.moves.length - 1
    const correct = `${from}${to}${promo ?? ''}` === expected || (isLast && test.isCheckmate())

    if (!correct) {
      // Don't reveal anything: the piece goes back and you think again.
      wrongCount.current++
      setWrongs(wrongCount.current)
      setStatus('wrong')
      setMessage(t('train.wrongRetry'))
      return false
    }

    setHintSquare(null)
    applyUci(`${from}${to}${promo ?? ''}`)
    step.current++
    if (step.current >= puzzle.moves.length) {
      const clean = wrongCount.current === 0 && !hinted.current
      record(clean, true)
      setStatus('solved')
      setMessage(clean ? t('train.correct') : t('train.solvedAfterRetry', { n: wrongCount.current + 1 }))
    } else {
      setStatus('playing')
      setMessage(t('train.keepGoing'))
      later(() => {
        applyUci(puzzle.moves[step.current])
        step.current++
      }, 450)
    }
    return true
  }

  function hint() {
    if (!puzzle) return
    hinted.current = true
    setHintSquare(uciToMove(puzzle.moves[step.current]).from)
  }

  function showSolution() {
    if (!puzzle) return
    record(false, false)
    setHintSquare(null)
    setStatus('failed')
    setMessage(t('train.solution'))
    const playFrom = (i: number) => {
      if (i >= puzzle.moves.length) return
      applyUci(puzzle.moves[i])
      step.current = i + 1
      later(() => playFrom(i + 1), 800)
    }
    playFrom(step.current)
  }

  /** Watch the whole solution again from the start (after finishing). */
  function replay() {
    if (!puzzle) return
    timers.current.forEach(clearTimeout)
    game.current = new Chess(puzzle.fen)
    setFen(puzzle.fen)
    setLastMove(null)
    const playFrom = (i: number) => {
      if (i >= puzzle.moves.length) return
      applyUci(puzzle.moves[i])
      later(() => playFrom(i + 1), 900)
    }
    later(() => playFrom(0), 400)
  }

  const plan = todaysPlan(data)
  const item = plan.find((p) => p.activity === cat)
  const solverColor = puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'black' : 'white') : 'white'
  const done = status === 'solved' || status === 'failed'

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <h1 className="font-bold">{openingId ? openingTitle(openingId, lang) : t(`act.${cat}`)}</h1>
        <span className="w-12 text-right text-xs text-slate-500">{item ? `${Math.min(item.done, item.target)}/${item.target}` : ''}</span>
      </div>
      {item && <ProgressBar value={item.done / item.target} />}

      {status === 'empty' ? (
        <Card>{t('train.empty')}</Card>
      ) : (
        <>
          <div
            className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
              status === 'solved'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                : status === 'wrong' || status === 'failed'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                  : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {status === 'loading' || status === 'intro'
              ? t('train.loading')
              : message || `${t('train.yourMove')} · ${t('train.playAs', { color: t(solverColor === 'white' ? 'games.white' : 'games.black') })}`}
          </div>

          <Board
            fen={fen}
            orientation={solverColor}
            onMove={onMove}
            interactive={status === 'playing' || status === 'wrong'}
            lastMove={lastMove}
            marks={hintSquare ? { [hintSquare]: { boxShadow: 'inset 0 0 0 4px rgba(37,99,235,.9)' } } : undefined}
          />

          {(status === 'playing' || status === 'wrong') && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={hint} disabled={!!hintSquare}>
                💡 {t('train.hint')}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={showSolution}>
                {t('train.showSolution')}
              </Button>
            </div>
          )}
          {wrongs > 0 && !done && <p className="text-center text-xs text-slate-500">{t('train.tries', { n: wrongs })}</p>}

          {done && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={replay}>
                🔁 {t('train.replay')}
              </Button>
              <Button className="flex-1" onClick={next}>
                {t('common.next')} →
              </Button>
            </div>
          )}

          {puzzle && done && (
            <Card className="text-sm">
              <div>
                {t('train.rating')}: <b>{puzzle.rating}</b>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {puzzle.themes.map((th) => (
                  <span key={th} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {themeName(th, lang)}
                  </span>
                ))}
              </div>
              <a
                className="mt-2 block text-xs text-slate-400 underline"
                href={`https://lichess.org/training/${puzzle.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('train.source')} · #{puzzle.id}
              </a>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
