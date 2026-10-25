import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router'
import { useData } from './lib/data'
import { autoSync } from './lib/sync'
import { runAnalysis } from './lib/analysisRunner'
import { todaysPlan } from './lib/plan'
import { dayKey } from './lib/dates'
import { db } from './lib/db'
import { LangContext, useT, type TKey } from './lib/i18n'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Train from './pages/Train'
import Games from './pages/Games'
import GameReview from './pages/GameReview'
import BoardPage from './pages/BoardPage'
import Coach from './pages/Coach'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const data = useData()
  const theme = data?.settings?.theme ?? 'system'

  // Apply light/dark theme to <html>
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const username = data?.settings?.chessComUsername
  useEffect(() => {
    if (username) autoSync(username)
  }, [username])

  // Analyse new games with Stockfish in the background (no-op when nothing is pending).
  const gameCount = data?.games.length ?? 0
  const settingsForAnalysis = data?.settings
  useEffect(() => {
    if (settingsForAnalysis && gameCount) runAnalysis(settingsForAnalysis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCount, settingsForAnalysis?.focus])

  // Remember the days on which the whole daily challenge was completed.
  const challengeDone = !!data?.settings && todaysPlan({ ...data, settings: data.settings }).every((i) => i.complete)
  useEffect(() => {
    if (challengeDone && data && !data.daysDone.includes(dayKey())) db.daysDone.put({ day: dayKey() })
  }, [challengeDone, data])

  if (!data) return null // database still loading (a few ms)
  if (!data.settings) return <Onboarding />
  const app = { ...data, settings: data.settings }

  return (
    <LangContext.Provider value={app.settings.lang}>
      <div className="safe-top mx-auto min-h-screen max-w-xl pb-24">
        <Routes>
          <Route path="/" element={<Dashboard data={app} />} />
          <Route path="/train/*" element={<Train data={app} />} />
          <Route path="/games" element={<Games data={app} />} />
          <Route path="/games/:id" element={<GameReview data={app} />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/coach" element={<Coach data={app} />} />
          <Route path="/analytics" element={<Analytics data={app} />} />
          <Route path="/settings" element={<SettingsPage data={app} />} />
        </Routes>
      </div>
      <BottomNav />
    </LangContext.Provider>
  )
}

const TABS: { to: string; icon: string; label: TKey }[] = [
  { to: '/', icon: '🏠', label: 'nav.home' },
  { to: '/train', icon: '🎯', label: 'nav.train' },
  { to: '/coach', icon: '🤖', label: 'nav.coach' },
  { to: '/games', icon: '♟️', label: 'nav.games' },
  { to: '/settings', icon: '⚙️', label: 'nav.settings' },
]

function BottomNav() {
  const t = useT()
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {t(tab.label)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
