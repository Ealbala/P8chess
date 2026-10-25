import { afterEach, describe, expect, it } from 'vitest'
import { GET as reminders } from '../../../api/reminders'
import { GET as coachStatus, POST as coach } from '../../../api/coach'

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.COACH_PASSWORD
})

describe('api/reminders', () => {
  it('returns a calendar with three recurring events at the chosen time', async () => {
    const res = reminders(new Request('https://x.test/api/reminders?time=07:45&lang=es'))
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const ics = await res.text()
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toMatch(/DTSTART:\d{8}T074500/)
    expect(ics).toContain('reto de hoy')
  })

  it('ignores invalid times', async () => {
    const ics = await reminders(new Request('https://x.test/api/reminders?time=99:99')).text()
    expect(ics).toMatch(/DTSTART:\d{8}T193000/)
  })
})

describe('api/coach', () => {
  it('reports when it is not configured', async () => {
    expect(await coachStatus().json()).toEqual({ configured: false, passwordRequired: false })
    const res = await coach(new Request('https://x.test/api/coach', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(503)
  })

  it('checks the password before calling the model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    process.env.COACH_PASSWORD = 'secret'
    const res = await coach(new Request('https://x.test/api/coach', { method: 'POST', headers: { 'x-coach-key': 'nope' }, body: '{}' }))
    expect(res.status).toBe(401)
  })
})
