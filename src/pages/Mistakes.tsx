// My Mistake Library: positions where you went wrong in your own games.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Chess, type Square } from 'chess.js'
import Board from '../components/Board'
import { Button, Card, ProgressBar, SectionTitle } from '../components/ui'
import type { AppData } from '../lib/data'
import { db, type MistakePosition, type Phase } from '../lib/db'
import { dayKey } from '../lib/dates'
import { engine, formatEval, winPercent } from '../lib/engine'
import { ANALYSIS_DEPTH } from '../lib/analysis'
import { duePositions, nextSrs } from '../lib/mistakes'
import { useLang, useT } from '../lib/i18n'
import { useAnalysisState } from '../lib/analysisRunner'
import { describePosition } from '../lib/coach'

const GREEN = 'rgba(22,163,74,0.85)'
const RED = 'rgba(220,38,38,0.8)'
const BLUE = 'rgba(37,99,235,0.8)'

export function MistakesHome({ data }: { data: AppData }) {
  const t = useT()
  const navigate = useNavigate()
  const analysis = useAnalysisState()
  const due = duePositions(data.positions)
  const byPhase = (['opening', 'middlegame', 'endgame'] as Phase[]).map((p) => ({ p, n: data.positions.filter((x) => x.phase === p).length }))
  const fixed = data.positions.filter((p) => p.box >= 2).length

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🎯 {t('mk.title')}</h1>
        <span className="w-12" />
      </div>
      {analysis.running && (
        <Card className="text-sm">
          ⚙️ {t('an.progress', { d: analysis.done + 1, t: analysis.total })}
          <ProgressBar value={analysis.done / Math.max(1, analysis.total)} />
        </Card>
      )}
      <Card className="flex flex-col gap-2">
        {data.positions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('mk.empty')}</p>
        ) : (
          <>
            <p className="text-sm">{t('mk.stats', { n: data.positions.length, due: due.length })}</p>
            <div className="flex gap-2 text-xs">
              {byPhase.map(({ p, n }) => (
                <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {t(`phase.${p}`)}: {n}
                </span>
              ))}
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/40 dark:text-green-200">✓ {fixed}</span>
            </div>
            {due.length > 0 ? (
              <Button onClick={() => navigate(`/train/mistakes/${due[0].id}`)}>▶ {t('mk.practice')}</Button>
            ) : (
              <p className="text-sm text-green-600">✓ {t('mk.allDone')}</p>
            )}
          </>
        )}
        <p className="text-xs text-slate-400">{t('mk.note', { d: ANALYSIS_DEPTH })}</p>
      </Card>
      <section className="flex flex-col gap-2">
        {[...data.positions]
          .sort((a, b) => b.date.localeCompare(a.date) || a.ply - b.ply)
          .slice(0, 50)
          .map((p) => (
            <PositionRow key={p.id} pos={p} data={data} />
          ))}
      </section>
    </div>
  )
}

function PositionRow({ pos, data }: { pos: MistakePosition; data: AppData }) {
  const t = useT()
  const lang = useLang()
  const game = data.games.find((g) => g.id === pos.gameId)
  return (
    <Link to={`/train/mistakes/${pos.id}`}>
      <Card className="flex items-center gap-3 p-3 text-sm">
        <span className="text-xl">{pos.kind === 'blunder' ? '⁉️' : '❓'}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {Math.floor(pos.ply / 2) + 1}
            {pos.color === 'white' ? '.' : '...'}
            {pos.played} → <span className="text-green-600">{pos.best}</span>
          </div>
          <div className="truncate text-xs text-slate-500">
            {t(pos.kind === 'blunder' ? 'mk.blunder' : 'mk.mistake')} · {t(`phase.${pos.phase}`)} · vs {game?.opponent ?? '?'} ·{' '}
            {new Date(pos.date).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}
          </div>
        </div>
        {pos.box >= 2 ? <span className="text-xs text-green-600">✓</span> : pos.due <= dayKey() ? <span className="text-xs text-amber-600">●</span> : null}
      </Card>
    </Link>
  )
}

type Stage = 'solve' | 'checking' | 'wrong' | 'result'

export function MistakeTrainer({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const pos = data.positions.find((p) => p.id === id)
  const game = pos ? data.games.find((g) => g.id === pos.gameId) : undefined

  const [stage, setStage] = useState<Stage>('solve')
  const [fen, setFen] = useState(pos?.fen ?? '')
  const [answer, setAnswer] = useState<{ san: string; uci: string; cp: number | null; good: boolean; exact: boolean } | null>(null)
  const [lineStep, setLineStep] = useState(0)
  const [wrongs, setWrongs] = useState(0)
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const recorded = useRef(false)

  useEffect(() => {
    // Reset when moving to another position.
    setStage('solve')
    setFen(pos?.fen ?? '')
    setAnswer(null)
    setLineStep(0)
    setWrongs(0)
    setHint(false)
    setRevealed(false)
    recorded.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const lineFens = useMemo(() => {
    if (!pos) return []
    const c = new Chess(pos.fen)
    const out: { fen: string; from: string; to: string }[] = []
    for (const san of pos.pv) {
      try {
        const m = c.move(san)
        out.push({ fen: c.fen(), from: m.from, to: m.to })
      } catch {
        break
      }
    }
    return out
  }, [pos])

  if (!pos) return <div className="p-4">—</div>

  /** correct = first try without hint; solved = found it without revealing the answer. */
  async function record(correct: boolean, solved: boolean) {
    if (recorded.current || !pos) return
    recorded.current = true
    await db.transaction('rw', db.positions, db.positionAttempts, async () => {
      await db.positions.update(pos.id, nextSrs(pos, correct))
      await db.positionAttempts.add({ posId: pos.id, date: new Date().toISOString(), day: dayKey(), correct, solved })
    })
  }

  const clean = () => wrongs === 0 && !hint

  function onMove(from: Square, to: Square, promotion?: string): boolean {
    if ((stage !== 'solve' && stage !== 'wrong') || !pos) return false
    const c = new Chess(pos.fen)
    let m
    try {
      m = c.move({ from, to, promotion })
    } catch {
      return false
    }
    const uci = m.from + m.to + (m.promotion ?? '')
    setFen(c.fen())
    if (uci === pos.bestUci) {
      setAnswer({ san: m.san, uci, cp: pos.evalBest, good: true, exact: true })
      setStage('result')
      record(clean(), true)
      return true
    }
    // Not the engine's first choice: check how much worse it is.
    setStage('checking')
    checkMove(c, m.san, uci)
    return true
  }

  async function checkMove(c: Chess, san: string, uci: string) {
    let cp: number
    if (c.isCheckmate()) cp = 10000
    else if (c.isGameOver()) cp = 0
    else cp = -(await engine.analyse(c.fen(), ANALYSIS_DEPTH + 2)).cp
    // "Good" = within 5 points of winning chances of the best move.
    const good = winPercent(cp) >= winPercent(pos!.evalBest) - 5
    if (good) {
      setAnswer({ san, uci, cp, good, exact: false })
      setStage('result')
      record(clean(), true)
      return
    }
    // Wrong: don't show the answer — put the position back and let you think again.
    setWrongs((w) => w + 1)
    setFen(pos!.fen)
    setStage('wrong')
  }

  function reveal() {
    setRevealed(true)
    setAnswer(null)
    setFen(pos!.fen)
    setStage('result')
    record(false, false)
  }

  function next() {
    // Leaving after a wrong try without finding it counts as not solved.
    if (!recorded.current && wrongs > 0) record(false, false)
    goNext()
  }

  function goNext() {
    const due = duePositions(data.positions).filter((p) => p.id !== pos!.id)
    if (due.length) navigate(`/train/mistakes/${due[0].id}`, { replace: true })
    else navigate('/train/mistakes', { replace: true })
  }

  const arrows: [string, string, string][] = []
  if (stage === 'result' && lineStep === 0) {
    arrows.push([pos.bestUci.slice(0, 2), pos.bestUci.slice(2, 4), GREEN])
    if (pos.playedUci !== pos.bestUci) arrows.push([pos.playedUci.slice(0, 2), pos.playedUci.slice(2, 4), RED])
    if (answer && !answer.exact && answer.uci !== pos.playedUci) arrows.push([answer.uci.slice(0, 2), answer.uci.slice(2, 4), BLUE])
  }
  const shownFen = stage === 'result' ? (lineStep > 0 ? lineFens[lineStep - 1].fen : pos.fen) : fen
  const last = stage === 'result' && lineStep > 0 ? ([lineFens[lineStep - 1].from, lineFens[lineStep - 1].to] as [string, string]) : null
  const moveNo = `${Math.floor(pos.ply / 2) + 1}${pos.color === 'white' ? '.' : '...'}`
  const evalTxt = (cp: number) => formatEval(cp, Math.abs(cp) >= 9000 ? Math.round((10000 - Math.abs(cp)) / 10) * Math.sign(cp) : null)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/train/mistakes')} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <span className="text-xs text-slate-500">
          {t(pos.kind === 'blunder' ? 'mk.blunder' : 'mk.mistake')} · {t(`phase.${pos.phase}`)}
        </span>
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
        {stage === 'solve' &&
          t('mk.prompt', {
            opp: game?.opponent ?? '?',
            date: new Date(pos.date).toLocaleDateString(lang, { day: 'numeric', month: 'short' }),
            n: moveNo,
          })}
        {stage === 'checking' && t('mk.checking')}
        {stage === 'wrong' && `✗ ${t('mk.wrongRetry')}`}
        {stage === 'result' &&
          (revealed
            ? t('mk.revealed')
            : answer?.exact
              ? `✓ ${t('mk.correct')}${wrongs ? ` (${t('train.tries', { n: wrongs + 1 })})` : ''}`
              : `✓ ${t('mk.alsoGood')}`)}
      </div>

      <Board
        fen={shownFen}
        orientation={pos.color}
        onMove={onMove}
        interactive={stage === 'solve' || stage === 'wrong'}
        arrows={arrows}
        lastMove={last}
        marks={hint && stage !== 'result' ? { [pos.bestUci.slice(0, 2)]: { boxShadow: 'inset 0 0 0 4px rgba(37,99,235,.9)' } } : undefined}
      />

      {(stage === 'solve' || stage === 'wrong') && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setHint(true)} disabled={hint}>
            💡 {t('train.hint')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={reveal}>
            {t('mk.showAnswer')}
          </Button>
        </div>
      )}

      {stage === 'result' && (
        <>
          <Card className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span>🔴 {t('mk.inGame')}</span>
              <b>
                {moveNo}
                {pos.played} ({evalTxt(pos.evalPlayed)})
              </b>
            </div>
            <div className="flex justify-between">
              <span>🟢 {t('mk.best')}</span>
              <b>
                {moveNo}
                {pos.best} ({evalTxt(pos.evalBest)})
              </b>
            </div>
            {answer && !answer.exact && answer.uci === pos.playedUci && (
              <div className="text-xs text-red-600">🔁 {t('mk.sameAsGame')}</div>
            )}
            {answer && !answer.exact && answer.uci !== pos.playedUci && (
              <div className="flex justify-between">
                <span>🔵 {t('mk.yours')}</span>
                <b>
                  {moveNo}
                  {answer.san} {answer.cp !== null ? `(${evalTxt(answer.cp)})` : ''}
                </b>
              </div>
            )}
            <div className="text-xs text-slate-500">{t('mk.lost', { drop: pos.drop })}</div>
            {pos.pv.length > 1 && (
              <div className="mt-1 font-mono text-xs">
                {t('mk.line')}:{' '}
                {pos.pv.map((s, i) => {
                  const ply = pos.ply + i
                  const num = ply % 2 === 0 ? `${ply / 2 + 1}.` : i === 0 ? `${Math.floor(ply / 2) + 1}...` : ''
                  return (
                    <button key={i} onClick={() => setLineStep(i + 1)} className={`mr-1 rounded px-0.5 ${lineStep === i + 1 ? 'bg-green-600 text-white' : ''}`}>
                      {num}
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" className="px-2 text-sm" onClick={() => setLineStep(Math.max(0, lineStep - 1))}>
              ◀
            </Button>
            <Button variant="secondary" className="px-2 text-sm" onClick={() => setLineStep(Math.min(lineFens.length, lineStep + 1))}>
              ▶ {t('mk.playLine')}
            </Button>
            <Button className="px-2 text-sm" onClick={next}>
              {t('common.next')} →
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              navigate('/coach', {
                state: { question: `${t('coach.explainPrompt')}\n${JSON.stringify(describePosition(pos, game?.opponent))}` },
              })
            }
          >
            🤖 {t('coach.explain')}
          </Button>
          {game && (
            <Link to={`/games/${game.id}`} className="text-center text-xs text-green-600 underline">
              {t('mk.openGame')}
            </Link>
          )}
        </>
      )}
      <p className="text-center text-xs text-slate-400">{t('mk.note', { d: ANALYSIS_DEPTH })}</p>
    </div>
  )
}

