// Blindfold level 1: coordinates. Two 60-second drills with verifiable answers:
//  - Find the square: tap the named square on a board without coordinates.
//  - Square color: decide if a square is light or dark with no board visible.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Square } from 'chess.js'
import type { AppData } from '../lib/data'
import { db, type DrillSession } from '../lib/db'
import { dayKey } from '../lib/dates'
import { useT } from '../lib/i18n'
import { todaysPlan } from '../lib/plan'
import Board from './Board'
import DrillBar from './DrillBar'
import { Button, Card, Segmented } from './ui'

const FILES = 'abcdefgh'
const ROUND_SECONDS = 60

function randomSquare(prev?: string): string {
  let sq: string
  do sq = FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8))
  while (sq === prev)
  return sq
}

/** a1 is dark: with 0-based file and rank, the square is dark when their sum is even. */
export function isDark(square: string) {
  return (FILES.indexOf(square[0]) + Number(square[1]) - 1) % 2 === 0
}

type Kind = DrillSession['kind']

export default function CoordsDrill({ data }: { data: AppData }) {
  const t = useT()
  const [kind, setKind] = useState<Kind>('coords-find')
  const [side, setSide] = useState<'white' | 'black'>('white')
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [left, setLeft] = useState(ROUND_SECONDS)
  const [target, setTarget] = useState(randomSquare())
  const [score, setScore] = useState({ c: 0, t: 0 })
  const [flash, setFlash] = useState<{ sq: string; ok: boolean } | null>(null)
  const scoreRef = useRef(score)
  scoreRef.current = score

  const best = Math.max(0, ...data.drills.filter((d) => d.kind === kind).map((d) => d.correct))
  const item = todaysPlan(data).find((p) => p.activity === 'blindfold')

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (running && left <= 0) {
      setRunning(false)
      setFinished(true)
      db.drills.add({
        date: new Date().toISOString(),
        day: dayKey(),
        kind,
        correct: scoreRef.current.c,
        total: scoreRef.current.t,
        seconds: ROUND_SECONDS,
      })
    }
  }, [left, running, kind])

  function start() {
    setScore({ c: 0, t: 0 })
    setLeft(ROUND_SECONDS)
    setTarget(randomSquare())
    setFinished(false)
    setFlash(null)
    setRunning(true)
  }

  function answer(ok: boolean, sq: string) {
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 }))
    setFlash({ sq, ok })
    setTarget((prev) => randomSquare(prev))
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train/blindfold" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        {item && <span className="text-xs text-slate-500">{t('train.progress', { done: Math.min(item.done, item.target), target: item.target })}</span>}
      </div>
      <h1 className="text-xl font-bold">{t('coords.title')}</h1>

      {!running && (
        <Card className="flex flex-col gap-3">
          <Segmented
            options={[
              { value: 'coords-find' as Kind, label: t('coords.find') },
              { value: 'coords-color' as Kind, label: t('coords.color') },
            ]}
            value={kind}
            onChange={setKind}
          />
          <p className="text-sm text-slate-500">{t(kind === 'coords-find' ? 'coords.findDesc' : 'coords.colorDesc')}</p>
          {kind === 'coords-find' && (
            <Segmented
              options={[
                { value: 'white' as const, label: t('games.white') },
                { value: 'black' as const, label: t('coords.asBlack') },
              ]}
              value={side}
              onChange={setSide}
            />
          )}
          {finished && (
            <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-900/30">
              <div className="font-semibold">{t('coords.finished')}</div>
              <div className="text-2xl font-bold">{t('coords.score', { c: score.c, t: score.t })}</div>
            </div>
          )}
          <DrillBar kind={kind} finished={finished} />
          <p className="text-xs text-slate-400">{t('coords.history', { n: best })}</p>
          <Button onClick={start}>{finished ? t('coords.again') : `${t('common.start')} · ${t('coords.round')}`}</Button>
        </Card>
      )}

      {running && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('coords.score', { c: score.c, t: score.t })}</span>
            <span className={`font-mono text-lg font-bold ${left <= 10 ? 'text-red-500' : ''}`}>{left}s</span>
          </div>
          <div className="text-center text-6xl font-extrabold tracking-wide">{target}</div>
          {kind === 'coords-find' ? (
            <Board
              fen="8/8/8/8/8/8/8/8 w - - 0 1"
              orientation={side}
              interactive={false}
              showCoordinates={false}
              hidePieces
              marks={flash ? { [flash.sq]: { background: flash.ok ? 'rgba(34,197,94,.75)' : 'rgba(239,68,68,.75)' } } : undefined}
              onSquareTap={(sq: Square) => answer(sq === target, sq)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                className="rounded-2xl bg-[#eeeed2] py-10 text-xl font-bold text-slate-800 shadow active:scale-95"
                onClick={() => answer(!isDark(target), target)}
              >
                {t('coords.light')}
              </button>
              <button
                className="rounded-2xl bg-[#769656] py-10 text-xl font-bold text-white shadow active:scale-95"
                onClick={() => answer(isDark(target), target)}
              >
                {t('coords.dark')}
              </button>
              {flash && (
                <div className={`col-span-2 text-center text-sm font-semibold ${flash.ok ? 'text-green-600' : 'text-red-500'}`}>
                  {flash.ok ? '✓' : '✗'} {flash.sq} = {t(isDark(flash.sq) ? 'coords.dark' : 'coords.light')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
