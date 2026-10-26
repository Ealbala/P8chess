// Threat trainer: put yourself in your opponent's shoes. The position is the one right
// after a mistake you made in a real game; find how the opponent punishes it.
// Answers are checked with Stockfish. Wrong answers are not revealed: think again.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import ExplainPlayer from '../components/ExplainPlayer'
import { Button, Card } from '../components/ui'
import type { AppData } from '../lib/data'
import { db, type MistakePosition } from '../lib/db'
import { addDays, dayKey } from '../lib/dates'
import { engine, winPercent } from '../lib/engine'
import { ANALYSIS_DEPTH } from '../lib/analysis'
import { INTERVALS } from '../lib/openings'
import { useLang, useT } from '../lib/i18n'

/** Positions whose threat exercise is due (never done first). */
export function dueThreats(positions: MistakePosition[], today = dayKey()) {
  return positions
    .filter((p) => p.threatDue === undefined || p.threatDue <= today)
    .sort((a, b) => (a.threatBox ?? 0) - (b.threatBox ?? 0) || b.drop - a.drop)
}

function afterMove(p: MistakePosition) {
  const c = new Chess(p.fen)
  c.move(p.played)
  return c
}

export function ThreatsHome({ data }: { data: AppData }) {
  const t = useT()
  const navigate = useNavigate()
  const due = dueThreats(data.positions)
  const done = data.positionAttempts.filter((a) => a.kind === 'threat')
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🚨 {t('th.title')}</h1>
        <span className="w-12" />
      </div>
      <Card className="flex flex-col gap-2 text-sm">
        <p>{t('th.intro')}</p>
        {data.positions.length === 0 ? (
          <p className="text-slate-500">{t('mk.empty')}</p>
        ) : (
          <>
            <p className="text-slate-500">
              {t('th.stats', { n: data.positions.length, due: due.length, ok: done.filter((a) => a.correct).length, total: done.length })}
            </p>
            {due.length > 0 ? (
              <Button onClick={() => navigate(`/train/threats/${due[0].id}`)}>▶ {t('mk.practice')}</Button>
            ) : (
              <p className="text-green-600">✓ {t('mk.allDone')}</p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

type Stage = 'solve' | 'checking' | 'wrong' | 'result'

export function ThreatTrainer({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const pos = data.positions.find((p) => p.id === id)
  const game = pos ? data.allGames.find((g) => g.id === pos.gameId) : undefined
  const start = useMemo(() => (pos ? afterMove(pos) : null), [pos])
  const [reply, setReply] = useState<string[] | null>(pos?.reply ?? null)
  const [stage, setStage] = useState<Stage>('solve')
  const [fen, setFen] = useState(start?.fen() ?? '')
  const [wrongs, setWrongs] = useState(0)
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [answerSan, setAnswerSan] = useState('')
  const recorded = useRef(false)

  // Older positions were stored without the opponent's best reply: compute it once.
  useEffect(() => {
    if (!pos || reply || !start) return
    engine.analyse(start.fen(), ANALYSIS_DEPTH + 2).then((r) => {
      const c = new Chess(start.fen())
      const line: string[] = []
      for (const uci of r.pv.slice(0, 4)) {
        try {
          line.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
        } catch {
          break
        }
      }
      setReply(line)
      db.positions.update(pos.id, { reply: line })
    })
  }, [pos, reply, start])

  if (!pos || !start) return <div className="p-4">—</div>
  const best = reply?.[0]
  const bestMove = best ? new Chess(start.fen()).move(best) : null

  async function record(correct: boolean, solved: boolean) {
    if (recorded.current || !pos) return
    recorded.current = true
    const box = correct ? Math.min((pos.threatBox ?? 0) + 1, INTERVALS.length - 1) : 1
    await db.transaction('rw', db.positions, db.positionAttempts, async () => {
      await db.positions.update(pos.id, { threatBox: box, threatDue: dayKey(addDays(new Date(), correct ? INTERVALS[box] : 1)) })
      await db.positionAttempts.add({ posId: pos.id, date: new Date().toISOString(), day: dayKey(), correct, solved, kind: 'threat' })
    })
  }

  function onMove(from: Square, to: Square, promotion?: string): boolean {
    if ((stage !== 'solve' && stage !== 'wrong') || !best) return false
    const c = new Chess(start!.fen())
    let m
    try {
      m = c.move({ from, to, promotion })
    } catch {
      return false
    }
    setAnswerSan(m.san)
    if (m.san === best) {
      setFen(c.fen())
      setStage('result')
      record(wrongs === 0 && !hint, true)
      return true
    }
    setStage('checking')
    ;(async () => {
      // The opponent's best value is the reverse of your eval after your mistake.
      let cp: number
      if (c.isCheckmate()) cp = 10000
      else if (c.isGameOver()) cp = 0
      else cp = -(await engine.analyse(c.fen(), ANALYSIS_DEPTH + 2)).cp
      if (winPercent(cp) >= winPercent(-pos!.evalPlayed) - 5) {
        setFen(c.fen())
        setStage('result')
        record(wrongs === 0 && !hint, true)
      } else {
        setWrongs((w) => w + 1)
        setFen(start!.fen())
        setStage('wrong')
      }
    })()
    return true
  }

  function reveal() {
    setRevealed(true)
    setStage('result')
    record(false, false)
  }

  function next() {
    if (!recorded.current && wrongs > 0) record(false, false)
    const due = dueThreats(data.positions).filter((p) => p.id !== pos!.id)
    navigate(due.length ? `/train/threats/${due[0].id}` : '/train/threats', { replace: true })
  }

  const playedUci = (() => {
    const m = new Chess(pos.fen).move(pos.played)
    return m.from + m.to + (m.promotion ?? '')
  })()
  const replyUcis = (() => {
    const c = new Chess(start.fen())
    return (reply ?? []).map((san) => {
      const m = c.move(san)
      return m.from + m.to + (m.promotion ?? '')
    })
  })()
  const moveNo = `${Math.floor(pos.ply / 2) + 1}${pos.color === 'white' ? '.' : '...'}`

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/train/threats')} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <span className="text-xs text-slate-500">🚨 {t('th.title')}</span>
      </div>
      <div
        className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
          stage === 'wrong' || (stage === 'result' && revealed)
            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            : stage === 'result'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {stage === 'solve' && t('th.prompt', { move: `${moveNo}${pos.played}`, opp: game?.opponent ?? '?' })}
        {stage === 'checking' && t('mk.checking')}
        {stage === 'wrong' && `✗ ${t('th.wrong')}`}
        {stage === 'result' && (revealed ? t('mk.revealed') : `✓ ${t('th.correct', { move: answerSan })}`)}
      </div>

      {stage === 'result' && reply ? (
        <ExplainPlayer fen={pos.fen} moves={[playedUci, ...replyUcis]} perspective="threat" orientation={pos.color} />
      ) : (
        <Board
          fen={fen}
          orientation={pos.color}
          onMove={onMove}
          interactive={(stage === 'solve' || stage === 'wrong') && !!best}
          lastMove={[playedUci.slice(0, 2), playedUci.slice(2, 4)]}
          marks={hint && bestMove ? { [bestMove.from]: { boxShadow: 'inset 0 0 0 4px rgba(37,99,235,.9)' } } : undefined}
        />
      )}
      {!best && <p className="text-center text-xs text-slate-500">{t('mk.checking')}</p>}

      {(stage === 'solve' || stage === 'wrong') && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setHint(true)} disabled={hint || !best}>
            💡 {t('train.hint')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={reveal} disabled={!best}>
            {t('mk.showAnswer')}
          </Button>
        </div>
      )}
      {stage === 'result' && (
        <>
          <Card className="text-sm">💡 {t('th.lesson')}</Card>
          <Button onClick={next}>{t('common.next')} →</Button>
        </>
      )}
      <p className="text-center text-xs text-slate-400">{t('th.note', { lang })}</p>
    </div>
  )
}
