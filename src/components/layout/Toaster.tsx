import { Flame, type LucideIcon, Info, Trophy, Unplug, Usb } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { audio } from '../../lib/audio/engine'
import { type Toast, burst, onToast } from '../../lib/fx'
import { useSettings } from '../../state/settings'

const LOOK: Record<Toast['kind'], { icon: LucideIcon; bg: string; fg: string }> = {
  level: { icon: Trophy, bg: 'linear-gradient(110deg, #ffd66b, #ff8a6b)', fg: '#0d0c24' },
  goal: { icon: Flame, bg: 'linear-gradient(110deg, #ff8a6b, #ff8fc8)', fg: '#0d0c24' },
  connected: { icon: Usb, bg: '#1d3b31', fg: '#6fe3ae' },
  disconnected: { icon: Unplug, bg: '#3b2a12', fg: '#ffc857' },
  info: { icon: Info, bg: '#262552', fg: '#e8e6ff' },
}

/** Messages that drop in at the top: a new level, the daily goal, keyboard plugged in or out. */
export function Toaster() {
  const [items, setItems] = useState<(Toast & { id: number })[]>([])
  useEffect(() => {
    let id = 0
    return onToast((t) => {
      const key = ++id
      setItems((xs) => [...xs.filter((x) => x.kind !== t.kind), { ...t, id: key }])
      const big = t.kind === 'level' || t.kind === 'goal'
      if (big) {
        if (useSettings.getState().uiSounds) audio.ui('levelup')
        burst(null, { count: 70, spread: 100 })
      }
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== key)), big ? 3600 : 3000)
    })
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => {
          const look = LOOK[t.kind]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="flex max-w-md items-center gap-3 rounded-2xl px-5 py-3 shadow-[0_14px_40px_-10px_rgba(0,0,0,.7)]"
              style={{ background: look.bg, color: look.fg }}
            >
              <look.icon size={26} strokeWidth={2.4} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-tight">{t.title}</div>
                {t.detail && <div className="text-sm font-bold opacity-80">{t.detail}</div>}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
