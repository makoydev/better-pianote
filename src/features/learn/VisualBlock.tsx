import { Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Piano } from '../../components/piano/Piano'
import { Staff } from '../../components/staff/Staff'
import { Paper } from '../../components/ui/Card'
import { WidgetView } from '../../components/widgets/WidgetView'
import type { AudioClip, KeyboardVisual, StaffVisual, Visual } from '../../content/types'
import { keyboardHeight, noteMidi, pianoProps } from './visual'
import { playSequence } from '../../lib/audio/play'

export function KeyboardView({ k, sparks = true }: { k: KeyboardVisual; sparks?: boolean }) {
  const p = pianoProps(k)
  return (
    <div className="pt-10">
      <Piano {...p} sparks={sparks} sparkHeight={120} height={keyboardHeight(p.from, p.to)} />
    </div>
  )
}

export function StaffView({ s, className = '', sp = 20 }: { s: StaffVisual; className?: string; sp?: number }) {
  return (
    <Paper className={className}>
      <Staff
        clef={s.clef}
        items={s.items}
        keySig={s.keySig}
        time={s.time}
        labels={s.labels}
        spacing={s.spacing ?? (s.time ? 'proportional' : 'even')}
        sp={sp}
        endBar={!!s.time}
      />
    </Paper>
  )
}

export function AudioButtons({ clips }: { clips: AudioClip[] }) {
  const [playing, setPlaying] = useState<number | null>(null)
  const play = (c: AudioClip, i: number) => {
    const steps = c.notes.map((n) => (Array.isArray(n) ? n.map(noteMidi) : noteMidi(n)))
    const gap = c.gap ?? 0.5
    const total = playSequence(steps, { gap, dur: c.dur ?? gap * 1.5 })
    setPlaying(i)
    window.setTimeout(() => setPlaying((p) => (p === i ? null : p)), total * 1000)
  }
  return (
    <div className="flex flex-wrap gap-3">
      {clips.map((c, i) => (
        <motion.button
          key={i}
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => play(c, i)}
          className={`inline-flex min-h-13 items-center gap-2.5 rounded-2xl border px-5 text-lg font-extrabold transition-colors ${
            playing === i ? 'border-teal bg-teal/20 text-teal' : 'border-white/12 bg-night-750 text-ink hover:border-teal/50'
          }`}
        >
          <Volume2 size={22} className={playing === i ? 'animate-pulse' : ''} />
          {c.label}
        </motion.button>
      ))}
    </div>
  )
}

/** Everything a lesson step can show: widget, staff, keyboard and listen buttons. */
export function VisualBlock({ v }: { v: Visual }) {
  return (
    <div className="space-y-5">
      {v.widget && <WidgetView widget={v.widget} />}
      {v.staff && <StaffView s={v.staff} />}
      {v.audio && <AudioButtons clips={v.audio} />}
      {v.keyboard && <KeyboardView k={v.keyboard} />}
    </div>
  )
}
