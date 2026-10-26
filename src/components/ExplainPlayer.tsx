// "Video-style" explanation: plays a line move by move with arrows and a computed
// explanation of what each move does (optionally read aloud).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import Board from './Board'
import { Button, ProgressBar } from './ui'
import { MOVE_COLORS, explainLine } from '../lib/explain'
import { useLang, useT } from '../lib/i18n'
import { speak } from '../pages/Blindfold'

export default function ExplainPlayer({
  fen,
  moves,
  autoPlay = true,
  perspective = 'opponent',
  orientation,
}: {
  fen: string
  moves: string[]
  autoPlay?: boolean
  perspective?: 'opponent' | 'threat'
  orientation?: 'white' | 'black'
}) {
  const t = useT()
  const lang = useLang()
  const { steps, summary } = useMemo(() => explainLine(fen, moves, lang, perspective), [fen, moves, lang, perspective])
  const [i, setI] = useState(0) // index of the step shown (0 = after the opponent's setup move)
  const [playing, setPlaying] = useState(autoPlay)
  const [voice, setVoice] = useState(false)
  const timer = useRef<number | null>(null)
  const solver = new Chess(steps[0].fen).turn() === 'w' ? 'white' : 'black'
  const step = steps[i]
  const atEnd = i === steps.length - 1

  useEffect(() => {
    if (voice) speak(`${step.san}. ${step.texts.join(' ')}${atEnd ? ` ${summary}` : ''}`, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voice])

  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    // Longer pause on the solver's moves, where the idea is.
    timer.current = window.setTimeout(() => setI((x) => x + 1), voice ? 4500 : steps[i + 1]?.mine ? 3000 : 2200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [playing, i, atEnd, voice, steps])

  const arrows: [string, string, string][] = [[step.from, step.to, step.mine ? MOVE_COLORS.mine : MOVE_COLORS.opp], ...step.arrows]
  const moveNo = (k: number) => {
    const ply = new Chess(fen).moveNumber() * 2 - (new Chess(fen).turn() === 'w' ? 2 : 1) + k
    return k === 0 || ply % 2 === 0 ? `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}` : ''
  }

  return (
    <div className="flex flex-col gap-2">
      <Board fen={step.fen} orientation={orientation ?? solver} interactive={false} lastMove={[step.from, step.to]} arrows={arrows} />
      <ProgressBar value={i / Math.max(1, steps.length - 1)} />
      <div
        className={`min-h-20 rounded-xl p-3 text-sm ${
          step.mine ? 'bg-green-50 ring-1 ring-green-200 dark:bg-green-900/30 dark:ring-green-800' : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        <div className="font-bold">
          {step.mine ? '★ ' : ''}
          {moveNo(i)}
          {step.san}
        </div>
        {step.texts.map((tx, k) => (
          <p key={k}>{tx}</p>
        ))}
        {atEnd && <p className="mt-1 font-semibold text-green-700 dark:text-green-300">{summary}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Button variant="secondary" className="px-2" onClick={() => (setPlaying(false), setI(0))}>
          ⏮
        </Button>
        <Button variant="secondary" className="px-2" onClick={() => (setPlaying(false), setI(Math.max(0, i - 1)))}>
          ◀
        </Button>
        <Button variant="secondary" className="px-2" onClick={() => (atEnd ? (setI(0), setPlaying(true)) : setPlaying(!playing))}>
          {playing ? '⏸' : '▶'}
        </Button>
        <Button variant="secondary" className="px-2" onClick={() => (setPlaying(false), setI(Math.min(steps.length - 1, i + 1)))}>
          ▶|
        </Button>
      </div>
      <button className="self-start text-xs text-slate-500" onClick={() => setVoice(!voice)}>
        {voice ? '🔊' : '🔈'} {t('ex.voice')}
      </button>
      <p className="text-xs text-slate-400">{t('ex.note')}</p>
    </div>
  )
}
