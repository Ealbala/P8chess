// Calendar reminders (.ics). Opening this URL on an iPhone offers to add the events to the
// Calendar app, which then notifies you — no push server or database needed.
// Query: ?time=19:30&lang=es&app=https://p8chess.vercel.app
// Times are "floating" (no time zone): they follow the phone's local time.

const TEXT = {
  es: {
    daily: '♞ Pocho Chess: reto de hoy',
    dailyDesc: 'Completá el reto de hoy: tus errores, aperturas y ejercicios.',
    mid: '♟️ Pocho Chess: partidas de la semana',
    midDesc: '¿Cómo vas con tus partidas semanales? Jugá y revisalas.',
    sunday: '📅 Pocho Chess: cierre de semana',
    sundayDesc: 'Último día del reto semanal. Revisá tus partidas y pedile el informe semanal al coach.',
  },
  en: {
    daily: "♞ Pocho Chess: today's challenge",
    dailyDesc: "Complete today's challenge: your mistakes, openings and puzzles.",
    mid: '♟️ Pocho Chess: weekly games',
    midDesc: 'How are your weekly games going? Play and review them.',
    sunday: '📅 Pocho Chess: end of the week',
    sundayDesc: 'Last day of the weekly challenge. Review your games and ask the coach for the weekly report.',
  },
}

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function event(uid: string, start: string, rrule: string, summary: string, desc: string, url: string) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@pocho-chess`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${start}`,
    'DURATION:PT20M',
    `RRULE:${rrule}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}\\n${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ]
}

export function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const lang = q.get('lang') === 'en' ? 'en' : 'es'
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(q.get('time') ?? '') ? q.get('time')! : '19:30'
  const app = /^https:\/\/[\w.-]+(\/.*)?$/.test(q.get('app') ?? '') ? q.get('app')! : 'https://p8chess.vercel.app'
  const [hh, mm] = time.split(':')
  const now = new Date()
  const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  const start = `${day}T${hh}${mm}00`
  const t = TEXT[lang]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pocho Chess//Reminders//ES',
    'CALSCALE:GREGORIAN',
    ...event('daily', start, 'FREQ=DAILY', t.daily, t.dailyDesc, app),
    ...event('weekly-thu', start, 'FREQ=WEEKLY;BYDAY=TH', t.mid, t.midDesc, app),
    ...event('weekly-sun', `${day}T180000`, 'FREQ=WEEKLY;BYDAY=SU', t.sunday, t.sundayDesc, app),
    'END:VCALENDAR',
  ]
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="pocho-chess.ics"',
    },
  })
}
