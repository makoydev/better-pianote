import { Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Staff } from '../../components/staff/Staff'
import { Paper } from '../../components/ui/Card'
import { WidgetView } from '../../components/widgets/WidgetView'
import type { AudioClip, KeyboardVisual, StaffVisual, Visual } from '../../content/types'
import { keyboardHeight, noteMidi, pianoProps } from './visual'
import { playSequence } from '../../lib/audio/play'
import { type DemoTiming, useDemoLights } from './demoLights'

export function KeyboardView({ k, sparks = true, lit = [] }: { k: KeyboardVisual; sparks?: boolean; lit?: number[] }) {
  const p = pianoProps(k)
  // Keys a listen clip is playing right now.
  const marks: Marks = { ...p.marks }
  for (const m of lit) if (m >= p.from && m <= p.to) marks[m] = 'chord'
  return (
    <div className="pt-10">
      <Piano {...p} marks={marks} sparks={sparks} sparkHeight={120} height={keyboardHeight(p.from, p.to)} />
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

export function AudioButtons({ clips, onPlay }: { clips: AudioClip[]; onPlay?: (steps: (number | number[])[], timing: DemoTiming) => void }) {
  const [playing, setPlaying] = useState<number | null>(null)
  const play = (c: AudioClip, i: number) => {
    const steps = c.notes.map((n) => (Array.isArray(n) ? n.map(noteMidi) : noteMidi(n)))
    const gap = c.gap ?? 0.5
    const dur = c.dur ?? gap * 1.5
    const total = playSequence(steps, { gap, dur })
    onPlay?.(steps, { gap, dur })
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

/**
 * Everything a lesson step can show: widget, staff, keyboard and listen buttons. A listen clip lights its keys on
 * the keyboard as they sound, unless `lights` is off (a quiz, where that would give the answer away).
 */
export function VisualBlock({ v, lights = true }: { v: Visual; lights?: boolean }) {
  const demo = useDemoLights()
  return (
    <div className="space-y-5">
      {v.widget && <WidgetView widget={v.widget} />}
      {v.staff && <StaffView s={v.staff} />}
      {v.audio && <AudioButtons clips={v.audio} onPlay={lights && v.keyboard ? demo.show : undefined} />}
      {v.keyboard && <KeyboardView k={v.keyboard} lit={demo.lit} />}
    </div>
  )
}
