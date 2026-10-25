// Puzzle trainer for a category (or one specific puzzle from the history).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { AppData } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { todaysPlan } from '../lib/plan'
import { loadPuzzles, pickPuzzle, type Puzzle, type PuzzleCat } from '../lib/puzzles'
import { practiceRating, themeStats } from '../lib/stats'
import { OPENINGS } from '../data/openings'
import PuzzleCore, { savePuzzleAttempt } from './PuzzleCore'
import { Card, ProgressBar } from './ui'

function openingTitle(id: string, lang: 'en' | 'es') {
  const o = OPENINGS.find((x) => x.id === id)
  return o ? `${o.name[lang]} · ⚔️` : id
}

export default function PuzzleTrainer({
  cat,
  data,
  openingId,
  puzzleId,
}: {
  cat: PuzzleCat
  data: AppData
  openingId?: string
  /** Redo one specific puzzle (from the history). */
  puzzleId?: string
}) {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [empty, setEmpty] = useState(false)
  const seen = useRef(new Set<string>())
  const firstLoad = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  const next = useCallback(async () => {
    const all = await loadPuzzles()
    if (puzzleId && firstLoad.current) {
      firstLoad.current = false
      const p = all.find((x) => x.id === puzzleId)
      if (p) {
        seen.current.add(p.id)
        return setPuzzle(p)
      }
    }
    firstLoad.current = false
    const { attempts } = dataRef.current
    const weak = themeStats(attempts).filter((s) => s.accuracy < 0.6).slice(0, 3).map((s) => s.theme)
    const p = pickPuzzle(all, cat, practiceRating(attempts), attempts, weak, seen.current, openingId)
    if (!p) return setEmpty(true)
    seen.current.add(p.id)
    setPuzzle(p)
  }, [cat, openingId, puzzleId])

  useEffect(() => {
    next()
  }, [next])

  const item = todaysPlan(data).find((p) => p.activity === cat)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </button>
        <h1 className="font-bold">{openingId ? openingTitle(openingId, lang) : t(`act.${cat}`)}</h1>
        <span className="w-12 text-right text-xs text-slate-500">{item ? `${Math.min(item.done, item.target)}/${item.target}` : ''}</span>
      </div>
      {item && <ProgressBar value={item.done / item.target} />}
      {empty ? (
        <Card>{t('train.empty')}</Card>
      ) : puzzle ? (
        <PuzzleCore key={puzzle.id} puzzle={puzzle} onResult={(r) => savePuzzleAttempt(puzzle, r)} onNext={next} />
      ) : (
        <div className="text-center text-sm text-slate-500">{t('train.loading')}</div>
      )}
    </div>
  )
}
