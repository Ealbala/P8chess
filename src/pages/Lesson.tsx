// Animated lesson per training section: what it is, what to look for, and three examples
// played and explained move by move. Plus a YouTube search for videos on the theme.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ExplainPlayer from '../components/ExplainPlayer'
import { Button, Card, Segmented } from '../components/ui'
import { useLang, useT } from '../lib/i18n'
import { loadPuzzles, type Puzzle } from '../lib/puzzles'
import { TRACK_LESSONS, findTrack, inTrack } from '../data/tracks'

export default function Lesson() {
  const t = useT()
  const lang = useLang()
  const navigate = useNavigate()
  const { id } = useParams()
  const track = findTrack(id ?? '')
  const lesson = id ? TRACK_LESSONS[id] : undefined
  const [examples, setExamples] = useState<Puzzle[]>([])
  const [k, setK] = useState(0)

  useEffect(() => {
    if (!track) return
    loadPuzzles().then((all) => {
      // Short, easy examples first so the idea is clear; spread over three levels.
      const pool = all.filter((p) => inTrack(track, p) && p.moves.length <= 6).sort((a, b) => a.rating - b.rating)
      const pick = [pool[0], pool[Math.floor(pool.length * 0.15)], pool[Math.floor(pool.length * 0.3)]].filter(Boolean)
      setExamples([...new Map(pick.map((p) => [p.id, p])).values()])
    })
  }, [track])

  if (!track || !lesson) return null

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link to={`/train/track/${track.id}`} className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-lg font-bold">
          📺 {track.icon} {track.name[lang]}
        </h1>
        <span className="w-12" />
      </div>
      <Card className="flex flex-col gap-2 text-sm">
        <p>{lesson.what[lang]}</p>
        <div className="font-semibold">{t('ex.look')}</div>
        <ul className="list-disc pl-5">
          {lesson.look.map((l, i) => (
            <li key={i}>{l[lang]}</li>
          ))}
        </ul>
      </Card>

      {examples.length > 0 && (
        <Card className="flex flex-col gap-2">
          <Segmented
            options={examples.map((_, i) => ({ value: i, label: t('ex.example', { n: i + 1 }) }))}
            value={k}
            onChange={setK}
          />
          <ExplainPlayer key={examples[k].id} fen={examples[k].fen} moves={examples[k].moves} />
        </Card>
      )}

      <Button onClick={() => navigate(`/train/session?tracks=${track.id}&min=15`)}>▶ {t('ex.practice')}</Button>
      <a
        className="rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800"
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.youtube[lang])}`}
        target="_blank"
        rel="noreferrer"
      >
        ▶️ {t('ex.youtube')} ↗
      </a>
      <p className="text-xs text-slate-400">{t('ex.youtubeNote')}</p>
    </div>
  )
}
