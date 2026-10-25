// My Mistake Library: positions from your own games, practised with spaced repetition.
import type { MistakePosition } from './db'
import { addDays, dayKey } from './dates'
import { INTERVALS } from './openings'

/** Due positions, blunders and bigger drops first. */
export function duePositions(positions: MistakePosition[], today = dayKey()): MistakePosition[] {
  return positions
    .filter((p) => p.due <= today)
    .sort((a, b) => (a.box === 0 ? 0 : 1) - (b.box === 0 ? 0 : 1) || b.drop - a.drop || b.date.localeCompare(a.date))
}

export function nextSrs(p: MistakePosition, correct: boolean, today = new Date()): Pick<MistakePosition, 'box' | 'due'> {
  const box = correct ? Math.min(p.box + 1, INTERVALS.length - 1) : 1
  return { box, due: dayKey(addDays(today, correct ? INTERVALS[box] : 1)) }
}
