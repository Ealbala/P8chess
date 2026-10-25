// Theoretical endgames against perfect defence (Lichess tablebase). Win: keep the position
// winning until mate or promotion. Draw: never let it become lost for 12 of your moves.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card } from '../components/ui'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { dayKey } from '../lib/dates'
import { useLang, useT } from '../lib/i18n'
import { ENDGAMES } from '../data/endgames'
import { isLoss, isWin, probe } from '../lib/tablebase'

const DRAW_MOVES = 12

export function EndgamesHome({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🏁 {t('eg.title')}</h1>
        <span className="w-12" />
      </div>
      <p className="text-sm text-slate-500">{t('eg.intro')}</p>
      {ENDGAMES.map((e) => {
        const tries = data.attempts.filter((a) => a.puzzleId === `theory-${e.id}`)
        const solved = tries.some((a) => a.correct)
        return (
          <Link key={e.id} to={`/train/endgames/${e.id}`}>
            <Card className="flex items-center gap-3 p-3">
              <span className="text-2xl">{solved ? '✅' : e.goal === 'win' ? '🏆' : '🛡️'}</span>
              <div className="flex-1">
                <div className="font-semibold">{e.name[lang]}</div>
                <div className="text-xs text-slate-500">
                  {t(e.goal === 'win' ? 'eg.goalWin' : 'eg.goalDraw')} · {t('eg.tries', { n: tries.length })}
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

type Status = 'loading' | 'play' | 'thinking' | 'won' | 'held' | 'failed' | 'offline'

export function EndgameTrainer() {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const lesson = ENDGAMES.find((e) => e.id === id)
  const game = useRef(new Chess())
  const [fen, setFen] = useState(lesson?.fen ?? '')
  const [last, setLast] = useState<[string, string] | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const [myMoves, setMyMoves] = useState(0)
  const [limit, setLimit] = useState(30)
  const recorded = useRef(false)
  const myColor = lesson && lesson.fen.split(' ')[1] === 'w' ? 'white' : 'black'

  async function reset() {
    if (!lesson) return
    game.current = new Chess(lesson.fen)
    setFen(lesson.fen)
    setLast(null)
    setMyMoves(0)
    setMessage('')
    recorded.current = false
    setStatus('loading')
    try {
      const r = await probe(lesson.fen)
      // Allow a margin over perfect play (dtm is in plies).
      setLimit(lesson.goal === 'win' ? Math.ceil(Math.abs(r.dtm ?? 40) / 2) + 10 : DRAW_MOVES)
      setStatus('play')
    } catch {
      setStatus('offline')
    }
  }

  useEffect(() => {
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!lesson) return null

  async function record(correct: boolean) {
    if (recorded.current) return
    recorded.current = true
    await db.attempts.add({
      puzzleId: `theory-${lesson!.id}`,
      date: new Date().toISOString(),
      day: dayKey(),
      cat: 'endgame',
      correct,
      rating: 1500,
      themes: ['endgame', 'endgameTheory'],
      seconds: myMoves * 10,
    })
  }

  function end(s: 'won' | 'held' | 'failed', msg: string) {
    setStatus(s)
    setMessage(msg)
    record(s !== 'failed')
  }

  function onMove(from: Square, to: Square, promotion?: string) {
    if (status !== 'play') return false
    try {
      const m = game.current.move({ from, to, promotion })
      setFen(game.current.fen())
      setLast([m.from, m.to])
      const n = myMoves + 1
      setMyMoves(n)
      judge(n, !!m.promotion)
      return true
    } catch {
      return false
    }
  }

  async function judge(n: number, promoted: boolean) {
    const g = game.current
    setStatus('thinking')
    if (g.isCheckmate()) return end('won', t('eg.mate'))
    if (g.isStalemate()) return end(lesson!.goal === 'draw' ? 'held' : 'failed', t('eg.stalemate'))
    if (g.isDraw()) return end(lesson!.goal === 'draw' ? 'held' : 'failed', t('board.draw'))
    let r
    try {
      r = await probe(g.fen())
    } catch {
      return setStatus('offline')
    }
    // r.category is from the opponent's point of view (they are to move).
    if (lesson!.goal === 'win') {
      if (!isLoss(r.category)) return end('failed', t('eg.lostWin'))
      if (promoted) return end('won', t('eg.promoted'))
      if (n >= limit) return end('failed', t('eg.tooSlow', { n: limit }))
    } else {
      if (isWin(r.category)) return end('failed', t('eg.lostDraw'))
      if (n >= DRAW_MOVES) return end('held', t('eg.held', { n: DRAW_MOVES }))
    }
    // Opponent plays the best tablebase move.
    const best = r.moves[0]
    const m = g.move({ from: best.uci.slice(0, 2), to: best.uci.slice(2, 4), promotion: best.uci[4] })
    setFen(g.fen())
    setLast([m.from, m.to])
    if (g.isCheckmate()) return end('failed', t('bf.game.lost'))
    if (g.isDraw()) return end(lesson!.goal === 'draw' ? 'held' : 'failed', t('board.draw'))
    setStatus('play')
  }

  const done = status === 'won' || status === 'held' || status === 'failed'

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/train/endgames')} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <span className="text-xs text-slate-500">
          {t('eg.moves', { n: myMoves, max: limit })}
        </span>
      </div>
      <h1 className="font-bold">{lesson.name[lang]}</h1>
      <Card className="text-sm">💡 {lesson.idea[lang]}</Card>
      <div
        className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
          status === 'failed' || status === 'offline'
            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            : done
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {status === 'offline'
          ? t('eg.offline')
          : done
            ? message
            : `${t(lesson.goal === 'win' ? 'eg.goalWin' : 'eg.goalDraw')} · ${t('train.playAs', { color: t(myColor === 'white' ? 'games.white' : 'games.black') })}`}
      </div>
      <Board fen={fen} orientation={myColor} onMove={onMove} interactive={status === 'play'} lastMove={last} />
      {(done || status === 'offline') && <Button onClick={reset}>{t('train.retry')}</Button>}
      <p className="text-center text-xs text-slate-400">{t('eg.source')}</p>
    </div>
  )
}
