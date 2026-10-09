import { Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { onXp } from '../../lib/fx'

/** "+15 XP" bubbles that float up whenever you earn XP. */
export function XpToaster() {
  const [items, setItems] = useState<{ id: number; n: number }[]>([])
  useEffect(() => {
    let id = 0
    return onXp((n) => {
      const key = ++id
      setItems((xs) => [...xs, { id: key, n }])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== key)), 1800)
    })
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[60] flex flex-col items-end gap-2">
      <AnimatePresence>
        {items.map((x) => (
          <motion.div
            key={x.id}
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-gold to-coral px-4 py-2 text-lg font-extrabold text-night-900 shadow-[0_10px_30px_-8px_rgba(255,200,87,.7)]"
          >
            <Zap size={20} strokeWidth={2.6} className="fill-night-900" /> +{x.n} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
