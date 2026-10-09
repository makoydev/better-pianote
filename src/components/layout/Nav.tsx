import { Compass, Flame, Gamepad2, GraduationCap, House, ListMusic, type LucideIcon, Piano, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { levelFor } from '../../lib/levels'
import { go } from '../../router'
import { liveStreak, useProgress } from '../../state/progress'
import { Logo } from './Logo'

export type Tab = 'home' | 'learn' | 'practice' | 'explore' | 'songs' | 'settings' | 'play'

const NAV: { id: Tab; label: string; icon: LucideIcon; path: string }[] = [
  { id: 'home', label: 'Home', icon: House, path: '/' },
  { id: 'learn', label: 'Learn', icon: GraduationCap, path: '/learn' },
  { id: 'practice', label: 'Practice', icon: Gamepad2, path: '/practice' },
  { id: 'explore', label: 'Explore', icon: Compass, path: '/explore' },
  { id: 'songs', label: 'Songs', icon: ListMusic, path: '/songs' },
]

export function Sidebar({ active }: { active: Tab }) {
  const xp = useProgress((s) => s.xp)
  const streak = useProgress(liveStreak)
  const level = levelFor(xp)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col border-r border-white/6 bg-night-900/70 px-3 py-5 md:flex lg:w-64 lg:px-4">
      <button type="button" onClick={() => go('/')} className="mb-7 flex justify-center lg:justify-start lg:px-2">
        <span className="lg:hidden">
          <Logo compact />
        </span>
        <span className="hidden lg:inline">
          <Logo />
        </span>
      </button>
      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => (
          <NavButton key={item.id} item={item} active={active === item.id} />
        ))}
      </nav>
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => go('/play')}
        className={`relative mt-5 flex items-center justify-center gap-3 overflow-hidden rounded-2xl px-3 py-4 font-extrabold text-night-900 lg:justify-start ${active === 'play' ? 'ring-2 ring-white/60' : ''}`}
        style={{ background: 'linear-gradient(135deg, #ffd66b, #ff8a6b 55%, #ff8fc8)' }}
      >
        <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.45)_50%,transparent_70%)] bg-[length:200%_100%]" />
        <Piano size={26} strokeWidth={2.4} className="relative" />
        <span className="relative hidden text-lg lg:inline">Free Play</span>
      </motion.button>
      <div className="mt-auto flex flex-col gap-3">
        <div className="hidden rounded-2xl border border-white/8 bg-night-850 p-3 lg:block">
          <div className="flex items-center justify-between text-sm font-extrabold">
            <span className="text-gold">Level {level.level}</span>
            <span className="flex items-center gap-1 text-coral">
              <Flame size={16} className="animate-flicker" /> {streak}
            </span>
          </div>
          <div className="mt-0.5 text-xs font-bold text-ink-mute">{level.title}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-linear-to-r from-gold to-coral" style={{ width: `${level.progress * 100}%` }} />
          </div>
        </div>
        <NavButton item={{ id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }} active={active === 'settings'} />
      </div>
    </aside>
  )
}

function NavButton({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const I = item.icon
  return (
    <button
      type="button"
      onClick={() => go(item.path)}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-14 items-center justify-center gap-3.5 rounded-2xl px-3 text-lg font-extrabold transition-colors lg:justify-start ${
        active ? 'text-ink' : 'text-ink-mute hover:bg-white/5 hover:text-ink'
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-2xl border border-gold/30 bg-gold/12"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      <I size={26} strokeWidth={2.3} className={`relative ${active ? 'text-gold' : ''}`} />
      <span className="relative hidden lg:inline">{item.label}</span>
    </button>
  )
}

/** Bottom tab bar on phones. */
export function TabBar({ active }: { active: Tab }) {
  const items = [...NAV.slice(0, 2), { id: 'play' as Tab, label: 'Play', icon: Piano, path: '/play' }, ...NAV.slice(2, 4)]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-night-900/95 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => {
          const I = item.icon
          const on = active === item.id
          const play = item.id === 'play'
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.path)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-extrabold ${on ? 'text-gold' : 'text-ink-mute'}`}
            >
              {play ? (
                <span className="-mt-6 flex size-14 items-center justify-center rounded-2xl text-night-900 shadow-lg" style={{ background: 'linear-gradient(135deg, #ffd66b, #ff8a6b 55%, #ff8fc8)' }}>
                  <I size={28} strokeWidth={2.4} />
                </span>
              ) : (
                <I size={25} strokeWidth={2.3} />
              )}
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
