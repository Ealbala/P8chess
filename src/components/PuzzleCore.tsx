// One puzzle on the board. The opponent's first move is played automatically, then you
// find the solution. Answers are checked against the Lichess solution (or any mate-in-one).
//  - learn mode: a wrong move never reveals the answer — think again, ask a hint, or show
//    the solution. "correct" = first try without hint; "solved" = without showing it.
//  - rush mode: no retries; the first wrong move ends the puzzle.
import { useEffect, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import Board from './Board'
import { Button, Card } from './ui'
import { themeName, useLang, useT } from '../lib/i18n'
import type { Puzzle } from '../lib/puzzles'
import { db } from '../lib/db'
import { dayKey } from '../lib/dates'

export interface PuzzleResult {
  correct: boolean
  solved: boolean
  seconds: number
}

type Status = 'intro' | 'playing' | 'wrong' | 'solved' | 'failed'

function uciToMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined }
}

export default function PuzzleCore({
  puzzle,
  mode = 'learn',
  onResult,
  onNext,
  compact = false,
}: {
  puzzle: Puzzle
  mode?: 'learn' | 'rush'
  onResult: (r: PuzzleResult) => void
  onNext?: () => void
  compact?: boolean
}) {
  const t = useT()
  const lang = useLang()
  const [fen, setFen] = useState(puzzle.fen)
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [status, setStatus] = useState<Status>('intro')
  const [message, setMessage] = useState('')
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [wrongs, setWrongs] = useState(0)
  const game = useRef(new Chess(puzzle.fen))
  const step = useRef(0)
  const wrongCount = useRef(0)
  const hinted = useRef(false)
  const reported = useRef(false)
  const startedAt = useRef(Date.now())
  const timers = useRef<number[]>([])
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const applyUci = (uci: string) => {
    const m = uciToMove(uci)
    game.current.move(m)
    setFen(game.current.fen())
    setLastMove([m.from, m.to])
  }
  const report = (correct: boolean, solved: boolean) => {
    if (reported.current) return
    reported.current = true
    onResultRef.current({ correct, solved, seconds: Math.round((Date.now() - startedAt.current) / 1000) })
  }

  useEffect(() => {
    later(() => {
      applyUci(puzzle.moves[0])
      step.current = 1
      startedAt.current = Date.now()
      setStatus('playing')
    }, mode === 'rush' ? 350 : 700)
    return () => {
      timers.current.forEach(clearTimeout)
      // Leaving a puzzle you already got wrong counts as not solved.
      if (!reported.current && wrongCount.current > 0) report(false, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onMove(from: Square, to: Square, promotion?: string): boolean {
    if (status !== 'playing' && status !== 'wrong') return false
    if (step.current % 2 === 0) return false // opponent's reply still pending
    const expected = puzzle.moves[step.current]
    const exp = uciToMove(expected)
    const promo = exp.from === from && exp.to === to ? exp.promotion : promotion
    const test = new Chess(game.current.fen())
    try {
      test.move({ from, to, promotion: promo })
    } catch {
      return false
    }
    const isLast = step.current === puzzle.moves.length - 1
    const ok = `${from}${to}${promo ?? ''}` === expected || (isLast && test.isCheckmate())

    if (!ok) {
      wrongCount.current++
      setWrongs(wrongCount.current)
      if (mode === 'rush') {
        setStatus('failed')
        setMessage(`✗ ${t('rush.wrong')}`)
        report(false, false)
        return false
      }
      setStatus('wrong')
      setMessage(t('train.wrongRetry'))
      return false
    }

    setHintSquare(null)
    applyUci(`${from}${to}${promo ?? ''}`)
    step.current++
    if (step.current >= puzzle.moves.length) {
      const clean = wrongCount.current === 0 && !hinted.current
      setStatus('solved')
      setMessage(clean ? t('train.correct') : t('train.solvedAfterRetry', { n: wrongCount.current + 1 }))
      report(clean, true)
    } else {
      setStatus('playing')
      setMessage(t('train.keepGoing'))
      later(() => {
        applyUci(puzzle.moves[step.current])
        step.current++
      }, mode === 'rush' ? 250 : 450)
    }
    return true
  }

  function hint() {
    hinted.current = true
    setHintSquare(uciToMove(puzzle.moves[step.current]).from)
  }

  function showSolution() {
    report(false, false)
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

  function replay() {
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

  const solverColor = new Chess(puzzle.fen).turn() === 'w' ? 'black' : 'white'
  const done = status === 'solved' || status === 'failed'

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
          status === 'solved'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
            : status === 'wrong' || status === 'failed'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {status === 'intro'
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

      {mode === 'learn' && (status === 'playing' || status === 'wrong') && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={hint} disabled={!!hintSquare}>
            💡 {t('train.hint')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={showSolution}>
            {t('train.showSolution')}
          </Button>
        </div>
      )}
      {mode === 'learn' && wrongs > 0 && !done && <p className="text-center text-xs text-slate-500">{t('train.tries', { n: wrongs })}</p>}

      {mode === 'learn' && done && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={replay}>
            🔁 {t('train.replay')}
          </Button>
          {onNext && (
            <Button className="flex-1" onClick={onNext}>
              {t('common.next')} →
            </Button>
          )}
        </div>
      )}

      {mode === 'learn' && done && !compact && (
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
          <a className="mt-2 block text-xs text-slate-400 underline" href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer">
            {t('train.source')} · #{puzzle.id}
          </a>
        </Card>
      )}
    </div>
  )
}

/** Saves a puzzle attempt. */
export async function savePuzzleAttempt(puzzle: Puzzle, r: PuzzleResult, extra: { rush?: boolean } = {}) {
  await db.attempts.add({
    puzzleId: puzzle.id,
    date: new Date().toISOString(),
    day: dayKey(),
    cat: puzzle.cat,
    correct: r.correct,
    solved: r.solved,
    rush: extra.rush,
    rating: puzzle.rating,
    themes: puzzle.themes,
    seconds: r.seconds,
  })
}
