// Review one game: replay the moves, mark the key moment, tag what went wrong and
// write the lesson. Tags are YOUR assessment; Stockfish findings are shown alongside.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Chess } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, ProgressBar, inputClass } from '../components/ui'
import type { AppData } from '../lib/data'
import { db } from '../lib/db'
import { parseClocks } from '../lib/chesscom'
import { useLang, useT, type TKey } from '../lib/i18n'

export const MISTAKE_TAGS = ['tactic', 'threat', 'hanging', 'calc', 'opening', 'plan', 'endgame', 'time', 'tilt', 'none'] as const

function fmtClock(s?: number) {
  if (s === undefined) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function GameReview({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const game = data.games.find((g) => g.id === Number(id))

  // Positions after every ply, computed once from the PGN.
  const replay = useMemo(() => {
    if (!game?.pgn) return null
    try {
      const c = new Chess()
      c.loadPgn(game.pgn)
      const moves = c.history({ verbose: true })
      return {
        fens: [moves[0]?.before ?? c.fen(), ...moves.map((m) => m.after)],
        moves,
        clocks: parseClocks(game.pgn),
      }
    } catch {
      return null
    }
  }, [game?.pgn])

  const [ply, setPly] = useState(() => game?.keyPly ?? replay?.moves.length ?? 0)
  const [keyPly, setKeyPly] = useState(game?.keyPly)
  const [tags, setTags] = useState<string[]>(game?.mistakeTags ?? [])
  const [lesson, setLesson] = useState(game?.lesson ?? '')

  if (!game) return <div className="p-4">—</div>

  const icon = { win: '✅', loss: '❌', draw: '🤝' }[game.result]
  const last = replay && ply > 0 ? replay.moves[ply - 1] : null
  // Last known clock for each side at this ply (white moves are even indexes).
  const clockOf = (side: 0 | 1) => {
    if (!replay) return undefined
    for (let i = ply - 1; i >= 0; i--) if (i % 2 === side) return replay.clocks[i]
    return undefined
  }

  async function save() {
    await db.games.update(game!.id!, {
      reviewed: true,
      reviewedAt: game!.reviewedAt ?? new Date().toISOString(),
      keyPly,
      mistakeTags: tags,
      lesson: lesson.trim(),
    })
    navigate(-1)
  }

  async function remove() {
    if (!confirm(`${t('common.delete')}?`)) return
    await db.transaction('rw', db.games, db.ratings, async () => {
      await db.games.delete(game!.id!)
      await db.ratings.filter((r) => r.gameId === game!.id).delete()
    })
    navigate('/games')
  }

  const toggle = (tag: string) => setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag])

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <h1 className="font-bold">{t('rev.title')}</h1>
        <span className="w-12" />
      </div>

      <Card className="text-sm">
        <div className="font-semibold">
          {icon} {t(`tc.${game.tc}`)} · {t(game.color === 'white' ? 'games.white' : 'games.black')}
          {game.opponent ? ` · vs ${game.opponent}` : ''} {game.opponentRating ? `(${game.opponentRating})` : ''}
        </div>
        <div className="text-xs text-slate-500">
          {new Date(game.date).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}
          {game.opening ? ` · ${game.opening}` : ''}
        </div>
        {game.accuracy !== undefined && (
          <div className="mt-1 text-xs">
            {t('rev.accuracy')}: <b>{game.accuracy.toFixed(1)}</b>
          </div>
        )}
        {game.analysis && (
          <div className="mt-1 text-xs">
            ⚙️ {t('an.game', { i: game.analysis.inaccuracies, m: game.analysis.mistakes, b: game.analysis.blunders })}
          </div>
        )}
        {data.positions
          .filter((p) => p.gameId === game.id)
          .sort((a, b) => a.ply - b.ply)
          .map((p) => (
            <Link key={p.id} to={`/train/mistakes/${p.id}`} className="mt-1 block text-xs text-green-700 underline dark:text-green-400">
              🎯 {Math.floor(p.ply / 2) + 1}
              {p.color === 'white' ? '.' : '...'}
              {p.played} → {t('mk.best')}: ?
            </Link>
          ))}
        {game.url && (
          <a href={game.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-green-600 underline">
            {t('rev.open')} ↗
          </a>
        )}
      </Card>

      {replay ? (
        <>
          <div className="flex justify-between text-xs font-mono text-slate-500">
            <span>
              {game.color === 'white' ? '♚' : '♔'} {fmtClock(clockOf(game.color === 'white' ? 1 : 0))}
            </span>
            <span>
              {game.color === 'white' ? '♔' : '♚'} {fmtClock(clockOf(game.color === 'white' ? 0 : 1))}
            </span>
          </div>
          <Board fen={replay.fens[ply]} orientation={game.color} interactive={false} lastMove={last ? [last.from, last.to] : null} />
          <ProgressBar value={replay.moves.length ? ply / replay.moves.length : 0} />
          <div className="grid grid-cols-4 gap-2">
            <Button variant="secondary" className="px-2" onClick={() => setPly(0)}>⏮</Button>
            <Button variant="secondary" className="px-2" onClick={() => setPly(Math.max(0, ply - 1))}>◀</Button>
            <Button variant="secondary" className="px-2" onClick={() => setPly(Math.min(replay.moves.length, ply + 1))}>▶</Button>
            <Button variant="secondary" className="px-2" onClick={() => setPly(replay.moves.length)}>⏭</Button>
          </div>
          <Card>
            <div className="flex max-h-40 flex-wrap gap-x-1 gap-y-1 overflow-y-auto font-mono text-sm">
              {replay.moves.map((m, i) => (
                <span key={i}>
                  {i % 2 === 0 && <span className="text-slate-400">{i / 2 + 1}. </span>}
                  <button
                    onClick={() => setPly(i + 1)}
                    className={`rounded px-1 ${
                      ply === i + 1 ? 'bg-green-600 text-white' : keyPly === i + 1 ? 'bg-amber-200 dark:bg-amber-800' : ''
                    }`}
                  >
                    {keyPly === i + 1 ? '⭐' : ''}
                    {m.san}
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1 text-sm" onClick={() => setKeyPly(ply || undefined)} disabled={ply === 0}>
                ⭐ {t('rev.key')}
              </Button>
              <Link
                to="/board"
                state={{ fen: replay.fens[ply] }}
                className="flex flex-1 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold dark:bg-slate-800"
              >
                🧩 {t('rev.analyze')}
              </Link>
            </div>
            {keyPly && <p className="mt-2 text-xs text-amber-600">{t('rev.keyMarked', { n: Math.ceil(keyPly / 2) })}</p>}
          </Card>
        </>
      ) : (
        <p className="text-sm text-slate-500">{t('rev.noMoves')}</p>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-slate-500">💭 {t('rev.questions')}</p>
        <div>
          <div className="mb-1 text-sm font-semibold">{t('rev.tags')}</div>
          <div className="flex flex-wrap gap-1.5">
            {MISTAKE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  tags.includes(tag)
                    ? 'bg-green-600 text-white ring-green-600'
                    : 'ring-slate-300 dark:ring-slate-600'
                }`}
              >
                {t(`tag.${tag}` as TKey)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t('rev.lesson')}</span>
          <textarea className={`${inputClass} min-h-20`} placeholder={t('games.lessonPrompt')} value={lesson} onChange={(e) => setLesson(e.target.value)} />
        </label>
        <Button onClick={save} disabled={!lesson.trim() && tags.length === 0}>
          {t('games.saveReview')}
        </Button>
        <p className="text-xs text-slate-400">{t('rev.engineNote')}</p>
        {game.source === 'manual' && (
          <Button variant="danger" onClick={remove}>
            🗑 {t('common.delete')}
          </Button>
        )}
      </Card>
    </div>
  )
}
