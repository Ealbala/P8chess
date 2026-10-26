// Practice games against Stockfish at a chosen strength (UCI_Elo), optionally starting from
// your repertoire, with a real clock. Finished games are saved (source "bot"), analysed
// in the background, and their mistakes go to My Mistake Library. They never count as
// real games (weekly challenge, ratings, stats).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, SectionTitle, Segmented } from '../components/ui'
import type { AppData } from '../lib/data'
import { db, type Game, type TimeControl } from '../lib/db'
import { Engine } from '../lib/engine'
import { useLang, useT } from '../lib/i18n'
import { repertoire } from '../lib/openings'
import { currentRating } from '../lib/stats'

const ELOS = [1320, 1400, 1500, 1600, 1700, 1800, 2000]
const CLOCKS: { id: string; base: number; inc: number }[] = [
  { id: '10+0', base: 600, inc: 0 },
  { id: '15+10', base: 900, inc: 10 },
  { id: '5+0', base: 300, inc: 0 },
  { id: '∞', base: 0, inc: 0 },
]

function fmt(s: number) {
  const v = Math.max(0, Math.ceil(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

function clockTag(s: number) {
  const v = Math.max(0, s)
  const h = Math.floor(v / 3600)
  const m = Math.floor((v % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${(v % 60).toFixed(1).padStart(4, '0')}`
}

export default function Play({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const myRating = currentRating(data.ratings, data.settings, data.settings.focus)
  const [elo, setElo] = useState(() => ELOS.reduce((a, b) => (Math.abs(b - myRating) < Math.abs(a - myRating) ? b : a)))
  const [color, setColor] = useState<'white' | 'black'>('white')
  const [clockId, setClockId] = useState('10+0')
  const [startLine, setStartLine] = useState('')
  const [stage, setStage] = useState<'setup' | 'play' | 'over'>('setup')
  const [, setTick] = useState(0)
  const [result, setResult] = useState<{ result: Game['result']; reason: string; id?: number } | null>(null)
  const game = useRef(new Chess())
  const clocks = useRef({ w: 0, b: 0 })
  const clockLog = useRef<number[]>([])
  const turnStarted = useRef(0)
  const engineRef = useRef<Engine | null>(null)
  const thinking = useRef(false)
  const startPlies = useRef(0)
  const clock = CLOCKS.find((c) => c.id === clockId)!
  const lines = useMemo(() => repertoire(data.settings).flatMap((o) => o.lines.map((l) => ({ o, l }))), [data.settings])
  const practice = data.allGames.filter((g) => g.source === 'bot').slice(0, 10)
  const mine = color === 'white' ? 'w' : 'b'
  const rerender = () => setTick((x) => x + 1)

  useEffect(() => () => engineRef.current?.terminate(), [])

  // Clock: tick the side to move.
  useEffect(() => {
    if (stage !== 'play' || !clock.base) return
    const id = setInterval(() => {
      const side = game.current.turn()
      const left = clocks.current[side] - (Date.now() - turnStarted.current) / 1000
      if (left <= 0) {
        clocks.current[side] = 0
        finish(side === mine ? 'loss' : 'win', t('play.flag'))
      } else rerender()
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function start() {
    engineRef.current?.terminate()
    engineRef.current = new Engine(['setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${elo}`])
    const g = new Chess()
    const line = lines.find((x) => x.l.id === startLine)
    if (line) {
      // Play the first moves of the line (up to 8 plies) so the game starts in your opening.
      const moves = line.l.moves.split(' ')
      moves.slice(0, Math.min(8, moves.length - 1)).forEach((m) => g.move(m))
    }
    startPlies.current = g.history().length
    game.current = g
    clocks.current = { w: clock.base, b: clock.base }
    clockLog.current = g.history().map(() => clock.base)
    turnStarted.current = Date.now()
    setResult(null)
    setStage('play')
    if (g.turn() !== mine) engineMove()
  }

  function spend(side: 'w' | 'b') {
    if (!clock.base) return
    clocks.current[side] = clocks.current[side] - (Date.now() - turnStarted.current) / 1000 + clock.inc
    clockLog.current.push(clocks.current[side])
    turnStarted.current = Date.now()
  }

  function afterMove() {
    const g = game.current
    rerender()
    if (g.isCheckmate()) return finish(g.turn() === mine ? 'loss' : 'win', t('board.mate')), true
    if (g.isDraw() || g.isStalemate()) return finish('draw', t('board.draw')), true
    return false
  }

  async function engineMove() {
    if (!engineRef.current || thinking.current) return
    thinking.current = true
    rerender()
    try {
      const r = await engineRef.current.analyse(game.current.fen(), 12)
      if (stageRef.current !== 'play') return
      spend(game.current.turn())
      game.current.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] })
      afterMove()
    } finally {
      thinking.current = false
      rerender()
    }
  }

  const stageRef = useRef(stage)
  stageRef.current = stage

  function onMove(from: Square, to: Square, promotion?: string) {
    if (stage !== 'play' || game.current.turn() !== mine || thinking.current) return false
    try {
      spend(mine)
      game.current.move({ from, to, promotion })
    } catch {
      clockLog.current.pop()
      return false
    }
    if (!afterMove()) engineMove()
    return true
  }

  async function finish(res: Game['result'], reason: string) {
    if (stageRef.current !== 'play') return
    stageRef.current = 'over'
    setStage('over')
    const g = game.current
    const moves = g.history()
    if (moves.length - startPlies.current < 2) return setResult({ result: res, reason })
    // PGN with clock comments, so time stats and analysis work like for Chess.com games.
    const body = moves
      .map((san, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : ''}${san}${clock.base ? ` {[%clk ${clockTag(clockLog.current[i] ?? 0)}]}` : ''}`)
      .join(' ')
    const tag = res === 'draw' ? '1/2-1/2' : (res === 'win') === (color === 'white') ? '1-0' : '0-1'
    const pgn = `[Event "Practice vs Stockfish ${elo}"]\n[White "${color === 'white' ? 'You' : `Stockfish ${elo}`}"]\n[Black "${color === 'black' ? 'You' : `Stockfish ${elo}`}"]\n[Result "${tag}"]\n[CurrentPosition "${g.fen()}"]\n\n${body} ${tag}`
    const tc: TimeControl = !clock.base || clock.base >= 600 ? 'rapid' : clock.base >= 180 ? 'blitz' : 'bullet'
    const myClocks = clockLog.current.filter((_, i) => i % 2 === (color === 'white' ? 0 : 1))
    const id = (await db.games.add({
      date: new Date().toISOString(),
      tc,
      result: res,
      color,
      source: 'bot',
      reviewed: false,
      opponent: `Stockfish ${elo}`,
      opponentRating: elo,
      pgn,
      timeControl: clock.base ? `${clock.base}${clock.inc ? `+${clock.inc}` : ''}` : undefined,
      endReason: reason,
      myClocks: clock.base ? myClocks : undefined,
      plies: moves.length,
    })) as number
    setResult({ result: res, reason, id })
  }

  const g = game.current
  const live = (side: 'w' | 'b') =>
    stage === 'play' && g.turn() === side ? clocks.current[side] - (Date.now() - turnStarted.current) / 1000 : clocks.current[side]
  const opp = mine === 'w' ? 'b' : 'w'
  const last = g.history({ verbose: true }).at(-1)

  if (stage === 'setup') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <Link to="/train" className="text-sm font-semibold text-green-600">
            ← {t('common.back')}
          </Link>
          <h1 className="text-xl font-bold">🤖 {t('play.title')}</h1>
          <span className="w-12" />
        </div>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">{t('play.intro')}</p>
          <div className="text-sm font-semibold">{t('play.elo')}</div>
          <Segmented options={ELOS.map((e) => ({ value: e, label: String(e) }))} value={elo} onChange={setElo} />
          <Segmented
            options={[
              { value: 'white' as const, label: `♔ ${t('games.white')}` },
              { value: 'black' as const, label: `♚ ${t('games.black')}` },
            ]}
            value={color}
            onChange={setColor}
          />
          <div className="text-sm font-semibold">{t('play.clock')}</div>
          <Segmented options={CLOCKS.map((c) => ({ value: c.id, label: c.id }))} value={clockId} onChange={setClockId} />
          <div className="text-sm font-semibold">{t('play.start')}</div>
          <select className="rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800" value={startLine} onChange={(e) => setStartLine(e.target.value)}>
            <option value="">{t('play.startpos')}</option>
            {lines
              .filter((x) => x.o.color === color)
              .map((x) => (
                <option key={x.l.id} value={x.l.id}>
                  {x.o.name[lang]} · {x.l.name[lang]}
                </option>
              ))}
          </select>
          <Button onClick={start}>▶ {t('common.start')}</Button>
          <p className="text-xs text-slate-400">{t('play.note')}</p>
        </Card>
        {practice.length > 0 && (
          <Card className="flex flex-col gap-1 text-sm">
            <SectionTitle>{t('play.history')}</SectionTitle>
            {practice.map((p) => (
              <Link key={p.id} to={`/games/${p.id}`} className="flex justify-between">
                <span>
                  {{ win: '✅', loss: '❌', draw: '🤝' }[p.result]} {p.opponent} · {p.color === 'white' ? '♔' : '♚'}
                </span>
                <span className="text-xs text-slate-500">
                  {p.analysis ? t('an.game', { i: p.analysis.inaccuracies, m: p.analysis.mistakes, b: p.analysis.blunders }) : '⚙️'}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between text-sm">
        <span>🤖 Stockfish {elo}</span>
        {clock.base > 0 && <span className={`font-mono text-lg font-bold ${g.turn() === opp ? '' : 'text-slate-400'}`}>{fmt(live(opp))}</span>}
      </div>
      <Board fen={g.fen()} orientation={color} onMove={onMove} interactive={stage === 'play' && g.turn() === mine} lastMove={last ? [last.from, last.to] : null} />
      <div className="flex items-center justify-between text-sm">
        <span>{thinking.current ? `🤖 ${t('play.thinking')}` : stage === 'play' ? t('play.yourTurn') : ''}</span>
        {clock.base > 0 && (
          <span className={`font-mono text-lg font-bold ${live(mine) < 30 ? 'text-red-500' : g.turn() === mine ? '' : 'text-slate-400'}`}>{fmt(live(mine))}</span>
        )}
      </div>
      <p className="font-mono text-xs text-slate-500">
        {g
          .history()
          .map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s))
          .join(' ')}
      </p>
      {stage === 'play' && (
        <Button variant="ghost" onClick={() => finish('loss', t('play.resigned'))}>
          🏳 {t('bf.game.resign')}
        </Button>
      )}
      {stage === 'over' && result && (
        <Card className="flex flex-col gap-2 text-center">
          <div className="text-lg font-bold">
            {{ win: `🏆 ${t('bf.game.won')}`, loss: `❌ ${t('bf.game.lost')}`, draw: `🤝 ${t('board.draw')}` }[result.result]}
          </div>
          <div className="text-xs text-slate-500">{result.reason}</div>
          {result.id && <p className="text-sm">{t('play.analysing')}</p>}
          <div className="flex gap-2">
            {result.id && (
              <Button variant="secondary" className="flex-1" onClick={() => navigate(`/games/${result.id}`)}>
                🔍 {t('games.review')}
              </Button>
            )}
            <Button className="flex-1" onClick={() => setStage('setup')}>
              🔁 {t('play.again')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
