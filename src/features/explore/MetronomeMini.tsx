import { Square } from 'lucide-react'
import { motion } from 'motion/react'
import { go, usePath } from '../../router'
import { usePref } from '../../state/prefs'
import { stopMetronome, useMetronome } from './metronomeEngine'

/** While the metronome runs, a chip in the header: the beat, the tempo, and Stop. Tap it to open the Metronome. */
export function MetronomeMini() {
  const running = useMetronome((s) => s.running)
  const beat = useMetronome((s) => s.beat)
  const count = useMetronome((s) => s.count)
  const [bpm] = usePref('metronome:bpm', 90)
  const path = usePath()
  if (!running || path === '/explore/metronome') return null
  return (
    <span className="inline-flex h-11 items-center rounded-full border border-white/10 bg-night-750/90 text-sm font-extrabold text-ink-soft">
      <button type="button" onClick={() => go('/explore/metronome')} className="flex h-full items-center gap-2 pl-3.5 pr-2" title="Metronome">
        <motion.span
          key={count}
          initial={{ scale: 1.6, opacity: 1 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 0.3 }}
          className={`size-2.5 rounded-full ${beat === 0 ? 'bg-gold' : 'bg-violet'}`}
        />
        <span>{bpm}</span>
      </button>
      <button type="button" onClick={stopMetronome} aria-label="Stop the metronome" className="flex size-11 items-center justify-center rounded-full hover:text-ink">
        <Square size={15} className="fill-current" />
      </button>
    </span>
  )
}
