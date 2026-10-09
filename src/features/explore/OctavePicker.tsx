import { motion } from 'motion/react'
import { MusicText } from '../../components/MusicText'
import { playNotes } from '../../lib/audio/play'

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK = [
  { pc: 1, after: 0, shift: -0.06 },
  { pc: 3, after: 1, shift: 0.06 },
  { pc: 6, after: 3, shift: -0.08 },
  { pc: 8, after: 4, shift: 0 },
  { pc: 10, after: 5, shift: 0.08 },
]

/**
 * Pick a note name by tapping a one-octave keyboard. `names(pc)` gives the label for each key;
 * black keys can show two names (e.g. "C♯" over "D♭").
 */
export function OctavePicker({
  value,
  onChange,
  names,
  height = 112,
  sound = true,
  label = 'Choose a note',
}: {
  value: number
  onChange: (pc: number) => void
  names: (pc: number) => { main: string; alt?: string }
  height?: number
  sound?: boolean
  label?: string
}) {
  const W = 100 / 7
  const pick = (pc: number) => {
    onChange(pc)
    if (sound) playNotes([60 + pc], { dur: 0.8, vel: 0.6 })
  }
  return (
    <div role="radiogroup" aria-label={label} className="relative w-full select-none" style={{ height }}>
      {WHITE_PCS.map((pc, i) => {
        const on = pc === value
        const n = names(pc)
        return (
          <motion.button
            key={pc}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={n.main}
            whileTap={{ y: 2 }}
            onClick={() => pick(pc)}
            className="absolute top-0 bottom-0 px-[2px]"
            style={{ left: `${i * W}%`, width: `${W}%` }}
          >
            <span
              className={`flex h-full flex-col items-center justify-end rounded-b-xl pb-2 font-display text-xl font-bold transition-colors sm:text-2xl ${
                on ? 'text-night-900' : 'text-night-700'
              }`}
              style={{
                background: on ? 'linear-gradient(180deg,#fff6dc,#ffc857)' : 'linear-gradient(180deg,#e4ddcf 0%,#fffdf8 6%,#f1ebdf 100%)',
                boxShadow: on ? '0 0 22px -2px #ffc857, inset 0 -4px 0 #e0a63e' : 'inset 0 -5px 0 #dcd3c2, inset 0 0 0 1px rgba(20,18,40,.25)',
              }}
            >
              <MusicText text={n.main} />
            </span>
          </motion.button>
        )
      })}
      {BLACK.map(({ pc, after, shift }) => {
        const on = pc === value
        const n = names(pc)
        return (
          <motion.button
            key={pc}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={n.alt ? `${n.main} or ${n.alt}` : n.main}
            whileTap={{ y: 2 }}
            onClick={() => pick(pc)}
            className="absolute top-0 z-10 flex flex-col items-center justify-end rounded-b-lg pb-1.5 text-center font-display text-sm font-bold leading-tight transition-colors"
            style={{
              left: `${(after + 1) * W - W * 0.31 + shift * W}%`,
              width: `${W * 0.62}%`,
              height: '60%',
              color: on ? '#1f1b33' : '#e9e5ff',
              background: on ? 'linear-gradient(180deg,#fff0c2,#ffc857)' : 'linear-gradient(180deg,#3a3856,#15142b)',
              boxShadow: on ? '0 0 20px -2px #ffc857' : '0 4px 0 #06050f, inset 0 1px 0 rgba(255,255,255,.15)',
            }}
          >
            <MusicText text={n.main} />
            {n.alt && (
              <span className="text-[0.7rem] opacity-70">
                <MusicText text={n.alt} />
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
