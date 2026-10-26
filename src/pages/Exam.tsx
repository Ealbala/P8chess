// Monthly exam: 20 unseen puzzles over five levels, one try each, no hints.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PuzzleCore, { savePuzzleAttempt, type PuzzleResult } from '../components/PuzzleCore'
import { Button, Card, ProgressBar, SectionTitle } from '../components/ui'
import type { AppData } from '../lib/data'
import { db, type Exam as ExamRecord } from '../lib/db'
import { EXAM_LEVELS, monthKey, performance, pickExam } from '../lib/exam'
import { useLang, useT } from '../lib/i18n'
import { loadPuzzles, type Puzzle } from '../lib/puzzles'

export default function Exam({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const month = monthKey()
  const exam = data.exams.find((e) => e.id === month)
  const [puzzles, setPuzzles] = useState<Puzzle[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!exam) return
    loadPuzzles().then((all) => setPuzzles(exam.puzzleIds.map((id) => all.find((p) => p.id === id)).filter((p): p is Puzzle => !!p)))
  }, [exam])

  async function create() {
    const all = await loadPuzzles()
    const list = pickExam(all, data.attempts, month)
    const record: ExamRecord = { id: month, puzzleIds: list.map((p) => p.id), results: list.map(() => null), startedAt: new Date().toISOString() }
    await db.exams.put(record)
    setRunning(true)
  }

  async function answer(p: Puzzle, r: PuzzleResult) {
    if (!exam) return
    await savePuzzleAttempt(p, r)
    const i = exam.puzzleIds.indexOf(p.id)
    const results = [...exam.results]
    results[i] = r.correct
    const done = results.every((x) => x !== null)
    await db.exams.update(exam.id, {
      results,
      ...(done ? { finishedAt: new Date().toISOString(), performance: performance(puzzles.map((x) => x.rating), results as boolean[]) } : {}),
    })
  }

  const history = data.exams.filter((e) => e.finishedAt).sort((a, b) => a.id.localeCompare(b.id))
  const current = exam ? exam.results.findIndex((x) => x === null) : -1
  const currentPuzzle = current >= 0 ? puzzles[current] : undefined

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train/practice" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">📝 {t('exam.title')}</h1>
        <span className="w-12" />
      </div>

      {!exam && (
        <Card className="flex flex-col gap-3 text-sm">
          <p>{t('exam.intro', { levels: EXAM_LEVELS.join(', ') })}</p>
          <Button onClick={create}>▶ {t('exam.start', { month })}</Button>
        </Card>
      )}

      {exam && !exam.finishedAt && (
        <>
          <div className="flex justify-between text-sm">
            <span>{t('exam.progress', { i: current + 1, n: exam.puzzleIds.length })}</span>
            <span className="text-slate-500">{t('exam.oneTry')}</span>
          </div>
          <ProgressBar value={current / exam.puzzleIds.length} />
          {(running || current >= 0) && currentPuzzle && (
            <PuzzleCore key={currentPuzzle.id} puzzle={currentPuzzle} mode="rush" onResult={(r) => answer(currentPuzzle, r)} />
          )}
        </>
      )}

      {exam?.finishedAt && (
        <Card className="flex flex-col items-center gap-1 py-4 text-center">
          <div className="text-sm text-slate-500">{t('exam.result', { month })}</div>
          <div className="text-4xl font-extrabold">{exam.performance}</div>
          <div className="text-sm">
            {t('exam.score', { c: exam.results.filter(Boolean).length, n: exam.results.length })}
          </div>
          <p className="text-xs text-slate-400">{t('exam.next')}</p>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <SectionTitle>{t('exam.history')}</SectionTitle>
          {history.length > 1 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.map((e) => ({ month: e.id, performance: e.performance }))} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={['dataMin - 50', 'dataMax + 50']} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line isAnimationActive={false} dataKey="performance" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {history
            .slice()
            .reverse()
            .map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span>{new Date(e.id + '-15').toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</span>
                <span>
                  <b>{e.performance}</b> · {e.results.filter(Boolean).length}/{e.results.length}
                </span>
              </div>
            ))}
        </Card>
      )}
      <p className="text-xs text-slate-400">{t('exam.note')}</p>
    </div>
  )
}
