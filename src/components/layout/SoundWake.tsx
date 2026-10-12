import { Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { audio } from '../../lib/audio/engine'

/**
 * After the iPad locks (or another app takes the sound), iOS pauses the app's audio, and with it the mic.
 * It comes back on the next tap; this chip says so instead of leaving a silent app.
 */
export function SoundWake() {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const check = () => {
      const state = audio.ctx?.state
      setPaused(document.visibilityState === 'visible' && (state === 'suspended' || (state as string) === 'interrupted'))
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !audio.ctx) return check()
      // Try straight away; iOS may still want a tap, which the chip asks for.
      void audio.ctx.resume().catch(() => {}).finally(check)
    }
    document.addEventListener('visibilitychange', onVisible)
    const off = audio.onState(check)
    check()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      off()
    }
  }, [])
  return (
    <AnimatePresence>
      {paused && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          onClick={() => audio.unlock()}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[65] flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-gold px-5 font-extrabold text-night-900 shadow-[0_10px_30px_-8px_rgba(255,200,87,.7)]"
        >
          <Volume2 size={20} /> Sound is paused · tap to wake it
        </motion.button>
      )}
    </AnimatePresence>
  )
}
