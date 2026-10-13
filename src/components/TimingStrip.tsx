import { type LucideIcon, ArrowLeft, ArrowRight, Check, Hand, Minus, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { StepResult, Verdict } from '../lib/timing'

const LOOK: Record<Verdict, { icon: LucideIcon; cls: string; word: string }> = {
  perfect: { icon: Check, cls: 'bg-good text-night-900', word: 'right on the beat' },
  good: { icon: Check, cls: 'bg-good/70 text-night-900', word: 'on the beat' },
  early: { icon: ArrowLeft, cls: 'bg-gold text-night-900', word: 'early' },
  late: { icon: ArrowRight, cls: 'bg-gold text-night-900', word: 'late' },
  wrong: { icon: X, cls: 'bg-bad text-white', word: 'a wrong note' },
  miss: { icon: Minus, cls: 'bg-white/12 text-ink-soft', word: 'missed' },
  oneHand: { icon: Hand, cls: 'bg-white/12 text-ink-soft', word: 'one hand only' },
}

/**
 * One square per note: ✓ on the beat, ← early, → late, ✕ a wrong note, – missed. The note being played is outlined.
 * With `inTime` (lessons), early and late notes outside the window that still counts turn red, and `short` rings
 * the long notes let go too soon.
 */
export function TimingStrip({
  results,
  step,
  names,
  inTime,
  short,
}: {
  results: StepResult[]
  step: number | null
  names: string[]
  inTime?: boolean[]
  short?: boolean[]
}) {
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="How each note went">
      {results.map((r, k) => {
        const look = r.verdict ? LOOK[r.verdict] : null
        const offBeat = r.verdict === 'early' || r.verdict === 'late'
        const far = offBeat && !!inTime && !inTime[k]
        const ms = r.error === null ? '' : ` by ${Math.abs(Math.round(r.error * 1000))} ms`
        const said = look ? `${far ? 'too ' : ''}${look.word}${offBeat ? ms : ''}${short?.[k] ? ', let go too soon' : ''}` : 'to come'
        return (
          <motion.span
            key={k}
            role="listitem"
            title={`${names[k]}: ${said}`}
            aria-label={`${names[k]}: ${said}`}
            initial={false}
            animate={{ scale: look ? [1.25, 1] : 1 }}
            className={`flex size-7 items-center justify-center rounded-md ${look ? (far ? 'bg-bad text-white' : look.cls) : k === step ? 'border-2 border-gold bg-gold/10' : 'bg-white/6'} ${short?.[k] ? 'ring-2 ring-gold ring-offset-2 ring-offset-night-800' : ''}`}
          >
            {look && <look.icon size={16} strokeWidth={3} aria-hidden />}
          </motion.span>
        )
      })}
    </div>
  )
}
