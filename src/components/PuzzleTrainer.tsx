// Puzzle trainer: the opponent's first move is played automatically, then you must find
// the solution moves. Answers are checked against the Lichess solution (or any mate-in-one).
import { useCallback, useEffect, useRef, useState } from 'react'
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

export default function PuzzleTrainer({ cat, data, openingId }: { cat: PuzzleCat; data: AppData; openingId?: string }) {
  const t = useT()
  const lang = useLang()
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [fen, setFen] = useState('8/8/8/8/8/8/8/8 w - - 0 1')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const game = useRef(new Chess())
  const step = useRef(0)
  const failed = useRef(false)
  const recorded = useRef(false)
  const startedAt = useRef(0)
  const seen = useRef(new Set<string>())
  const timers = useRef<number[]>([])
  const dataRef = useRef(data)
  dataRef.current = data

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const applyUci = (uci: string) => {
    const m = uciToMove(uci)
    game.current.move(m)
    setFen(game.current.fen())
    setLastMove([m.from, m.to])
  }

  const next = useCallback(async () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setStatus('loading')
    const all = await loadPuzzles()
    const { attempts } = dataRef.current
    const weak = themeStats(attempts).filter((s) => s.accuracy < 0.6).slice(0, 3).map((s) => s.theme)
    const p = pickPuzzle(all, cat, practiceRating(attempts), attempts, weak, seen.current, openingId)
    if (!p) {
      setStatus('empty')
      return
    }
    seen.current.add(p.id)
    game.current = new Chess(p.fen)
    step.current = 0
    failed.current = false
    recorded.current = false
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
  }, [cat, openingId])

  useEffect(() => {
    next()
  }, [next])

  async function record(correct: boolean) {
    if (recorded.current || !puzzle) return
    recorded.current = true
    await db.attempts.add({
      puzzleId: puzzle.id,
      date: new Date().toISOString(),
      day: dayKey(),
      cat: puzzle.cat,
      correct,
      rating: puzzle.rating,
      themes: puzzle.themes,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
  }

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
      failed.current = true
      record(false)
      setStatus('wrong')
      setMessage(t('train.wrong'))
      return false
    }

    applyUci(`${from}${to}${promo ?? ''}`)
    step.current++
    if (step.current >= puzzle.moves.length) {
      finish()
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

  function finish() {
    if (failed.current) {
      setStatus('failed')
    } else {
      record(true)
      setStatus('solved')
      setMessage(t('train.correct'))
    }
  }

  function showSolution() {
    if (!puzzle) return
    failed.current = true
    record(false)
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

  const plan = todaysPlan(data)
  const item = plan.find((p) => p.activity === cat)

  const solverColor = puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'black' : 'white') : 'white'

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => history.back()} className="text-sm font-semibold text-green-600">
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
          />

          <div className="flex gap-2">
            {(status === 'playing' || status === 'wrong') && (
              <Button variant="secondary" className="flex-1" onClick={showSolution}>
                {t('train.showSolution')}
              </Button>
            )}
            {(status === 'solved' || status === 'failed') && (
              <Button className="flex-1" onClick={next}>
                {t('common.next')} →
              </Button>
            )}
          </div>

          {puzzle && (status === 'solved' || status === 'failed') && (
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
