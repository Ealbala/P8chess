// Free analysis board: play moves for both sides, step back/forward, load a FEN or PGN.
import { useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, inputClass } from '../components/ui'
import { useT } from '../lib/i18n'

const START = new Chess().fen()

export default function BoardPage() {
  const t = useT()
  const [startFen, setStartFen] = useState(START)
  const [moves, setMoves] = useState<string[]>([]) // SAN
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  // Replay moves up to the current ply.
  const { game, last } = useMemo(() => {
    const g = new Chess(startFen)
    let last: [string, string] | null = null
    for (const san of moves.slice(0, ply)) {
      const m = g.move(san)
      last = [m.from, m.to]
    }
    return { game: g, last }
  }, [startFen, moves, ply])

  function onMove(from: Square, to: Square, promotion?: string) {
    const g = new Chess(game.fen())
    try {
      const m = g.move({ from, to, promotion })
      setMoves([...moves.slice(0, ply), m.san])
      setPly(ply + 1)
      return true
    } catch {
      return false
    }
  }

  function load() {
    const text = input.trim()
    setError('')
    try {
      const g = new Chess()
      if (text.includes('.') || text.includes('[')) {
        g.loadPgn(text)
        const header = g.header()
        const first = header.FEN ?? START
        setStartFen(first)
        setMoves(g.history())
        setPly(g.history().length)
      } else {
        g.load(text)
        setStartFen(g.fen())
        setMoves([])
        setPly(0)
      }
    } catch {
      setError(t('board.invalid'))
    }
  }

  const status = game.isCheckmate()
    ? t('board.mate')
    : game.isDraw() || game.isStalemate()
      ? t('board.draw')
      : `${t('board.toMove', { color: t(game.turn() === 'w' ? 'games.white' : 'games.black') })}${game.inCheck() ? ' · ' + t('board.check') : ''}`

  // Pair moves for display: 1. e4 e5  2. Nf3 ...
  const startsBlack = new Chess(startFen).turn() === 'b'
  const startNum = Number(startFen.split(' ')[5] ?? 1)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('board.title')}</h1>
        <span className="text-sm text-slate-500">{status}</span>
      </div>
      <Board fen={game.fen()} orientation={orientation} onMove={onMove} lastMove={last} />
      <div className="grid grid-cols-5 gap-2">
        <Button variant="secondary" className="px-2" onClick={() => setPly(0)}>⏮</Button>
        <Button variant="secondary" className="px-2" onClick={() => setPly(Math.max(0, ply - 1))}>◀</Button>
        <Button variant="secondary" className="px-2" onClick={() => setPly(Math.min(moves.length, ply + 1))}>▶</Button>
        <Button variant="secondary" className="px-2" onClick={() => setPly(moves.length)}>⏭</Button>
        <Button variant="secondary" className="px-2" onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}>
          🔄
        </Button>
      </div>

      <Card>
        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t('board.moves')}</div>
        <div className="flex flex-wrap gap-x-1 gap-y-1 font-mono text-sm">
          {moves.length === 0 && <span className="text-slate-400">—</span>}
          {moves.map((san, i) => {
            const idx = i + (startsBlack ? 1 : 0)
            const num = startNum + Math.floor(idx / 2)
            const showNum = idx % 2 === 0 || i === 0
            return (
              <span key={i}>
                {showNum && <span className="text-slate-400">{num}.{idx % 2 === 1 ? '..' : ''} </span>}
                <button
                  onClick={() => setPly(i + 1)}
                  className={`rounded px-1 ${ply === i + 1 ? 'bg-green-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {san}
                </button>
              </span>
            )
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => ply > 0 && (setMoves(moves.slice(0, ply - 1)), setPly(ply - 1))}>
            {t('board.undo')}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setStartFen(START)
              setMoves([])
              setPly(0)
            }}
          >
            {t('board.reset')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase text-slate-500">{t('board.load')}</div>
        <textarea className={`${inputClass} min-h-20 font-mono text-xs`} value={input} onChange={(e) => setInput(e.target.value)} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button variant="secondary" onClick={load} disabled={!input.trim()}>
          {t('board.loadBtn')}
        </Button>
      </Card>
    </div>
  )
}
