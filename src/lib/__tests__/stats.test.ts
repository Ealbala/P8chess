import { describe, expect, it } from 'vitest'
import { buildPlan } from '../plan'
import { dayKey, parseDay, weekStart } from '../dates'
import { levelFromXp, nextMilestone, streak, weeklyPace } from '../stats'
import { isDark } from '../../components/CoordsDrill'

const days = (...keys: string[]) => new Set(keys)

describe('streak', () => {
  // 2026-10-21 is a Wednesday
  const today = parseDay('2026-10-21')

  it('counts consecutive days', () => {
    expect(streak(days('2026-10-19', '2026-10-20', '2026-10-21'), today)).toBe(3)
  })

  it('does not break if today is not trained yet', () => {
    expect(streak(days('2026-10-19', '2026-10-20'), today)).toBe(2)
  })

  it('forgives one missed day per week', () => {
    expect(streak(days('2026-10-18', '2026-10-20', '2026-10-21'), today)).toBe(3)
  })

  it('only one rest day per week', () => {
    expect(streak(days('2026-10-19', '2026-10-21'), parseDay('2026-10-23'))).toBe(1)
  })

  it('breaks on two consecutive missed days', () => {
    expect(streak(days('2026-10-17', '2026-10-21'), today)).toBe(1)
  })
})

describe('dates', () => {
  it('week starts on Monday', () => {
    expect(dayKey(weekStart(parseDay('2026-10-25')))).toBe('2026-10-19') // Sunday → Monday
    expect(dayKey(weekStart(parseDay('2026-10-19')))).toBe('2026-10-19')
  })
})

describe('goals and XP', () => {
  it('finds the next milestone', () => {
    expect(nextMilestone([1600, 1700, 1800], 1650)).toBe(1700)
    expect(nextMilestone([1600, 1700, 1800], 1900)).toBe(1800)
  })

  it('computes levels', () => {
    expect(levelFromXp(0).level).toBe(1)
    expect(levelFromXp(100).level).toBe(2)
    expect(levelFromXp(299).level).toBe(2)
    expect(levelFromXp(300).level).toBe(3)
  })

  it('computes weekly pace', () => {
    // Sunday: all 5 games expected
    expect(weeklyPace(5, 3, parseDay('2026-10-25'))).toMatchObject({ behind: true, remaining: 2, daysLeft: 1 })
  })
})

describe('plan', () => {
  it('adds a review item only when there is a game to review', () => {
    expect(buildPlan(20, false).some((i) => i.activity === 'review')).toBe(false)
    expect(buildPlan(20, true).some((i) => i.activity === 'review')).toBe(true)
  })
})

describe('square colors', () => {
  it('a1 is dark, h1 is light, e4 is light, d4 is dark', () => {
    expect(isDark('a1')).toBe(true)
    expect(isDark('h1')).toBe(false)
    expect(isDark('e4')).toBe(false)
    expect(isDark('d4')).toBe(true)
  })
})
