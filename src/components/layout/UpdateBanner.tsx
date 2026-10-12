import { RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { UPDATE_READY_EVENT, applyUpdate } from '../../lib/offline'

/** "A new version is ready": shown when an update has downloaded, so you choose when the app reloads. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener(UPDATE_READY_EVENT, on)
    return () => window.removeEventListener(UPDATE_READY_EVENT, on)
  }, [])
  return (
    <AnimatePresence>
      {ready && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-[65] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-night-800 py-2 pl-5 pr-2 shadow-2xl md:bottom-6"
          role="status"
        >
          <span className="font-bold text-ink">A new version of Tonic is ready</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-gold px-4 font-extrabold text-night-900"
          >
            <RefreshCw size={18} /> Reload
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
