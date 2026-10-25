// Opening line trainer. Learn mode: an arrow shows each of your moves and notes explain
// them. Drill mode: play from memory; a mistake shows the right move and the line comes
// back tomorrow (spaced repetition). The opponent's moves are played automatically.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { useNavigate } from 'react-router'
import Board from './Board'
import { Button, Card, ProgressBar } from './ui'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey } from '../lib/dates'
import { useLang, useT } from '../lib/i18n'
import { lineMoves, nextLine, nextProgress } from '../lib/openings'
import type { Opening, OpeningLine } from '../data/openings'

export default function LineTrainer({
  data,
  opening,
  line,
  mode,
}: {
  data: AppData
  opening: Opening
  line: OpeningLine
  mode: 'learn' | 'drill'
}) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const moves = useMemo(() => lineMoves(line), [line])
  const [ply, setPly] = useState(0)
  const [fen, setFen] = useState(new Chess().fen())
  const [last, setLast] = useState<[string, string] | null>(null)
  const [wrong, setWrong] = useState(false)
  const [finished, setFinished] = useState(false)
  const [nextDue, setNextDue] = useState('')
  const mistakes = useRef(false)
  const game = useRef(new Chess())
  const myTurn = (p: number) => (p % 2 === 0) === (opening.color === 'white')

  // Play the opponent's moves automatically.
  useEffect(() => {
    if (finished || ply >= moves.length || myTurn(ply)) return
    const id = setTimeout(() => play(moves[ply]), ply === 0 ? 500 : 450)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, finished])

  function play(san: string) {
    const m = game.current.move(san)
    setFen(game.current.fen())
    setLast([m.from, m.to])
    const next = ply + 1
    setPly(next)
    if (next >= moves.length) finish()
  }

  async function finish() {
    setFinished(true)
    const correct = !mistakes.current
    const prev = data.lineProgress.find((p) => p.lineId === line.id)
    const progress = mode === 'learn' ? nextProgress(line.id, undefined, true) : nextProgress(line.id, prev, correct)
    setNextDue(progress.due)
    await db.transaction('rw', db.lineProgress, db.lineAttempts, async () => {
      await db.lineProgress.put(progress)
      await db.lineAttempts.add({ lineId: line.id, date: new Date().toISOString(), day: dayKey(), mode, correct })
    })
  }

  function onMove(from: Square, to: Square, promotion?: string) {
    if (finished || !myTurn(ply)) return false
    const expected = new Chess(game.current.fen()).move(moves[ply])
    if (expected.from === from && expected.to === to) {
      setWrong(false)
      play(moves[ply])
      return true
    }
    try {
      new Chess(game.current.fen()).move({ from, to, promotion })
    } catch {
      return false // illegal: just ignore
    }
    if (mode === 'drill') mistakes.current = true
    setWrong(true)
    return false
  }

  // Arrow for your next move: always in learn mode, after a mistake in drill mode.
  const hint = useMemo(() => {
    if (finished || ply >= moves.length || !myTurn(ply) || (mode === 'drill' && !wrong)) return undefined
    const m = new Chess(fen).move(moves[ply])
    return [[m.from, m.to]] as [string, string][]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, ply, wrong, finished, mode])

  // Show the note of the last move played (if any).
  const note = ply > 0 ? line.notes?.[ply]?.[lang] : undefined
  const moveList = moves.slice(0, ply).map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ')

  function goNext() {
    const n = nextLine(data.settings, data.lineProgress)
    if (n) navigate(`/train/line/${n.line.id}?mode=${n.mode}`, { replace: true })
    else navigate('/train/openings', { replace: true })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold dark:bg-slate-800">
          {mode === 'learn' ? `📘 ${t('op.learn')}` : `🔁 ${t('op.drill')}`}
        </span>
      </div>
      <div>
        <h1 className="font-bold">{opening.name[lang]}</h1>
        <p className="text-sm text-slate-500">{line.name[lang]}</p>
      </div>
      <ProgressBar value={ply / moves.length} />

      <div
        className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
          finished
            ? mistakes.current
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
              : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
            : wrong
              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {finished
          ? mistakes.current
            ? t('op.doneMistakes')
            : `✓ ${t('op.done')}`
          : wrong
            ? t('op.wrong')
            : mode === 'learn'
              ? t('op.learnHint')
              : t('op.drillHint')}
      </div>

      <Board fen={fen} orientation={opening.color} onMove={onMove} interactive={!finished} lastMove={last} arrows={hint} />

      {note && (
        <Card className="text-sm">
          💡 <b>{moves[ply - 1]}</b> — {note}
        </Card>
      )}
      <p className="font-mono text-xs text-slate-500">{moveList || '…'}</p>

      {finished && (
        <>
          {nextDue && (
            <p className="text-center text-xs text-slate-500">
              {t('op.nextReview', { d: new Date(nextDue + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' }) })}
            </p>
          )}
          <Button onClick={goNext}>{t('op.next')} →</Button>
        </>
      )}
    </div>
  )
}
