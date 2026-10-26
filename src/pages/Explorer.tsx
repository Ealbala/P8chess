// Opening explorer page: play moves on the board and see what is played next.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, Segmented } from '../components/ui'
import type { AppData } from '../lib/data'
import { buildGameIndex, lichessMoves, movesFromIndex, type ExplorerMove, type LichessError } from '../lib/explorer'
import { buildTree, posKey, repertoire } from '../lib/openings'
import { useT } from '../lib/i18n'

export default function Explorer({ data }: { data: AppData }) {
  const t = useT()
  const [params] = useSearchParams()
  const [moves, setMoves] = useState<string[]>(() => (params.get('moves') ?? '').split(' ').filter(Boolean))
  const [source, setSource] = useState<'mine' | 'lichess'>('mine')
  const [lichess, setLichess] = useState<ExplorerMove[] | { error: LichessError } | null>(null)
  const [color, setColor] = useState<'white' | 'black'>('white')

  const chess = useMemo(() => {
    const c = new Chess()
    for (const m of moves) c.move(m)
    return c
  }, [moves])
  const fen = chess.fen()
  const index = useMemo(() => buildGameIndex(data.games.filter((g) => g.color === color)), [data.games, color])
  // Only your own repertoire moves for the colour you are exploring.
  const tree = useMemo(() => buildTree(repertoire(data.settings).filter((o) => o.color === color)), [data.settings, color])
  const myTurn = (chess.turn() === 'w') === (color === 'white')
  const book = myTurn ? (tree.get(posKey(fen)) ?? new Set<string>()) : new Set<string>()
  const mine = movesFromIndex(index, fen)

  useEffect(() => {
    if (source !== 'lichess') return
    setLichess(null)
    lichessMoves(fen, data.settings.lichessToken).then(setLichess)
  }, [fen, source, data.settings.lichessToken])

  const list = source === 'mine' ? mine : Array.isArray(lichess) ? lichess : []
  const last = chess.history({ verbose: true }).at(-1)

  function onMove(from: Square, to: Square, promotion?: string) {
    try {
      const m = new Chess(fen).move({ from, to, promotion })
      setMoves([...moves, m.san])
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train/openings" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🔭 {t('xp.title')}</h1>
        <span className="w-12" />
      </div>
      <Segmented
        options={[
          { value: 'white' as const, label: `♔ ${t('xp.asWhite')}` },
          { value: 'black' as const, label: `♚ ${t('xp.asBlack')}` },
        ]}
        value={color}
        onChange={(c) => (setColor(c), setMoves([]))}
      />
      <Board fen={fen} orientation={color} onMove={onMove} lastMove={last ? [last.from, last.to] : null} />
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="px-3" onClick={() => setMoves([])}>
          ⏮
        </Button>
        <Button variant="secondary" className="px-3" onClick={() => setMoves(moves.slice(0, -1))}>
          ◀
        </Button>
        <span className="flex-1 truncate font-mono text-xs text-slate-500">
          {moves.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ') || t('xp.start')}
        </span>
      </div>
      <Segmented
        options={[
          { value: 'mine' as const, label: `📂 ${t('xp.mine')}` },
          { value: 'lichess' as const, label: `🌐 Lichess 1400–1800` },
        ]}
        value={source}
        onChange={setSource}
      />
      <Card className="flex flex-col gap-1 text-sm">
        <div className="grid grid-cols-[1fr_auto_8rem] gap-2 text-xs font-semibold text-slate-500">
          <span>{t('xp.move')}</span>
          <span>{t('xp.games')}</span>
          <span>{t('xp.result')}</span>
        </div>
        {list.map((m) => (
          <button key={m.san} onClick={() => setMoves([...moves, m.san])} className="grid grid-cols-[1fr_auto_8rem] items-center gap-2 text-left">
            <span className="font-semibold">
              {m.san} {book.has(m.san) && <span title={t('xp.repertoire')}>★</span>}
            </span>
            <span className="text-xs text-slate-500">{m.games}</span>
            <span className="flex h-3 overflow-hidden rounded-full text-[0]">
              <span className="bg-green-500" style={{ width: `${m.win}%` }} />
              <span className="bg-slate-400" style={{ width: `${m.draw}%` }} />
              <span className="bg-red-500" style={{ width: `${m.loss}%` }} />
            </span>
          </button>
        ))}
        {source === 'mine' && list.length === 0 && <p className="text-slate-500">{t('xp.noGames')}</p>}
        {source === 'lichess' && lichess && !Array.isArray(lichess) && (
          <p className="text-amber-700">{t(lichess.error === 'no-token' ? 'xp.noToken' : lichess.error === 'bad-token' ? 'xp.badToken' : 'sync.network')}</p>
        )}
        {source === 'lichess' && lichess === null && <p className="text-slate-500">…</p>}
        {book.size > 0 && (
          <p className="mt-1 text-xs">
            ★ {t('xp.repertoire')}: <b>{[...book].join(', ')}</b>
          </p>
        )}
      </Card>
      <p className="text-xs text-slate-400">{t(source === 'mine' ? 'xp.mineNote' : 'xp.lichessNote')}</p>
    </div>
  )
}
