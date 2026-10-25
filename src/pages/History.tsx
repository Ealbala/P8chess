// Exercise history: everything you did, right or wrong, with one tap to do it again.
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { AppData } from '../lib/data'
import { findLine } from '../data/openings'
import { ENDGAMES } from '../data/endgames'
import { STRATEGY } from '../data/strategy'
import { useLang, useT, type TKey } from '../lib/i18n'
import { Card, Segmented } from '../components/ui'

type Result = 'first' | 'retry' | 'failed'

interface Item {
  key: string
  date: string
  icon: string
  title: string
  result: Result
  link: string
}

export default function History({ data }: { data: AppData }) {
  const t = useT()
  const lang = useLang()
  const [filter, setFilter] = useState<'all' | 'ok' | 'bad'>('all')

  const items = useMemo(() => {
    const out: Item[] = []
    const res = (correct: boolean, solved?: boolean): Result => (correct ? 'first' : (solved ?? correct) ? 'retry' : 'failed')
    for (const a of data.attempts) {
      const r = res(a.correct, a.solved)
      if (a.puzzleId.startsWith('theory-')) {
        const e = ENDGAMES.find((x) => `theory-${x.id}` === a.puzzleId)
        out.push({ key: `a${a.id}`, date: a.date, icon: '👑', title: e?.name[lang] ?? a.puzzleId, result: r, link: `/train/endgames/${e?.id}` })
      } else if (a.puzzleId.startsWith('strategy-')) {
        const s = STRATEGY.find((x) => `strategy-${x.id}` === a.puzzleId)
        out.push({ key: `a${a.id}`, date: a.date, icon: '🏰', title: s?.title[lang] ?? a.puzzleId, result: r, link: `/train/strategy/${s?.id}` })
      } else {
        out.push({
          key: `a${a.id}`,
          date: a.date,
          icon: a.cat === 'endgame' ? '🏁' : a.cat === 'calculation' ? '🧠' : a.cat === 'middlegame' ? '🏰' : '⚔️',
          title: `${t(`act.${a.cat}` as TKey)} · ${a.rating}`,
          result: r,
          link: `/train/puzzle/${a.puzzleId}?c=${a.cat}`,
        })
      }
    }
    for (const a of data.positionAttempts) {
      const p = data.positions.find((x) => x.id === a.posId)
      if (!p) continue
      out.push({
        key: `p${a.id}`,
        date: a.date,
        icon: '🎯',
        title: `${t('mk.title')} · ${Math.floor(p.ply / 2) + 1}${p.color === 'white' ? '.' : '...'}${p.played}`,
        result: res(a.correct, a.solved),
        link: `/train/mistakes/${p.id}`,
      })
    }
    for (const a of data.lineAttempts) {
      const f = findLine(a.lineId)
      if (!f) continue
      out.push({
        key: `l${a.id}`,
        date: a.date,
        icon: '📖',
        title: `${f.opening.name[lang]} · ${f.line.name[lang]}${a.mode === 'learn' ? ` (${t('op.learn')})` : ''}`,
        result: a.mode === 'learn' ? 'first' : res(a.correct, a.solved),
        link: `/train/line/${a.lineId}?mode=drill`,
      })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [data, lang, t])

  const shown = items.filter((i) => filter === 'all' || (filter === 'ok' ? i.result !== 'failed' : i.result !== 'first')).slice(0, 150)
  const LABEL: Record<Result, string> = { first: `✓ ${t('hist.first')}`, retry: `✓ ${t('hist.retry')}`, failed: `✗ ${t('hist.failed')}` }
  const COLOR: Record<Result, string> = { first: 'text-green-600', retry: 'text-amber-600', failed: 'text-red-500' }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Link to="/train" className="text-sm font-semibold text-green-600">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold">🗂️ {t('hist.title')}</h1>
        <span className="w-12" />
      </div>
      <Segmented
        options={[
          { value: 'all' as const, label: t('hist.all') },
          { value: 'ok' as const, label: `✓ ${t('hist.ok')}` },
          { value: 'bad' as const, label: `✗ ${t('hist.bad')}` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <p className="text-xs text-slate-500">{t('hist.note')}</p>
      {shown.length === 0 && <p className="text-sm text-slate-500">{t('hist.empty')}</p>}
      {shown.map((i) => (
        <Link key={i.key} to={i.link}>
          <Card className="flex items-center gap-3 p-3 text-sm">
            <span className="text-xl">{i.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{i.title}</div>
              <div className="text-xs text-slate-500">
                {new Date(i.date).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                <span className={COLOR[i.result]}>{LABEL[i.result]}</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-green-600">🔁</span>
          </Card>
        </Link>
      ))}
    </div>
  )
}
