// How much a blindfold round needs to count for the daily challenge (rises gradually).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DrillSession } from '../lib/db'
import { drillPassed, drillRequired } from '../lib/plan'
import { useT } from '../lib/i18n'

export default function DrillBar({ kind, finished }: { kind: DrillSession['kind']; finished?: boolean }) {
  const t = useT()
  const drills = useLiveQuery(() => db.drills.toArray(), [])
  if (!drills) return null
  const mine = drills.filter((d) => d.kind === kind && d.total > 0).sort((a, b) => a.date.localeCompare(b.date))
  const last = mine[mine.length - 1]
  const next = Math.round(drillRequired(kind, drills) * 100)
  return (
    <div className="flex flex-col items-center gap-1 text-center text-xs">
      {finished && last && (
        <p className={`text-sm font-semibold ${drillPassed(last, drills) ? 'text-green-600' : 'text-amber-600'}`}>
          {drillPassed(last, drills) ? `✓ ${t('bf.counts')}` : t('bf.notCounted', { p: Math.round(drillRequired(kind, drills, last.date) * 100) })}
        </p>
      )}
      <p className="text-slate-400">{next === 0 ? t('bf.nextAny') : t('bf.nextPct', { p: next })}</p>
    </div>
  )
}
