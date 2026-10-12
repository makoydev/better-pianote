import { Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Staff } from '../../components/staff/Staff'
import { Paper } from '../../components/ui/Card'
import { InStep, useFitKeyboard, useSpaceKey } from '../../components/widgets/fit'
import { WidgetView } from '../../components/widgets/WidgetView'
import { useViewportHeight } from '../../hooks/useViewport'
import type { AudioClip, KeyboardVisual, StaffVisual, Visual } from '../../content/types'
import { keyboardHeight, noteMidi, pianoProps, pictureSp } from './visual'
import { playSequence } from '../../lib/audio/play'
import { type DemoTiming, useDemoLights } from './demoLights'

export function KeyboardView({ k, sparks = true, lit = [] }: { k: KeyboardVisual; sparks?: boolean; lit?: number[] }) {
  const p = pianoProps(k)
  // Full height for its size, or less in a lesson step that's short of room.
  const [kbRef, kb] = useFitKeyboard(keyboardHeight(p.from, p.to), { below: 24, room: 40 })
  // Keys a listen clip is playing right now.
  const marks: Marks = { ...p.marks }
  for (const m of lit) if (m >= p.from && m <= p.to) marks[m] = 'chord'
  return (
    <div ref={kbRef} className={kb.className} style={kb.style}>
      <Piano {...p} marks={marks} sparks={sparks} sparkHeight={120} height={kb.piano} />
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
  // The clip Space plays: the last one you played (the first to begin with).
  const [last, setLast] = useState(0)
  const play = (c: AudioClip, i: number) => {
    const steps = c.notes.map((n) => (Array.isArray(n) ? n.map(noteMidi) : noteMidi(n)))
    const gap = c.gap ?? 0.5
    const dur = c.dur ?? gap * 1.5
    const total = playSequence(steps, { gap, dur })
    onPlay?.(steps, { gap, dur })
    setPlaying(i)
    setLast(i)
    window.setTimeout(() => setPlaying((p) => (p === i ? null : p)), total * 1000)
  }
  useSpaceKey(clips[last] ? () => play(clips[last], last) : null)
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
 *
 * `fit`: fill the space the step leaves (the parent is a flex column), shrinking keyboards to fit; `center` sets the
 * picture in the middle of that space (beside the text) instead of at the top.
 */
export function VisualBlock({ v, lights = true, fit = false, center = false }: { v: Visual; lights?: boolean; fit?: boolean; center?: boolean }) {
  const demo = useDemoLights()
  const vh = useViewportHeight()
  return (
    <InStep value={fit}>
      <div className={fit ? `flex flex-1 flex-col gap-5 ${center ? 'justify-center' : ''}` : 'space-y-5'}>
        {v.widget && <WidgetView widget={v.widget} />}
        {v.staff && <StaffView s={v.staff} sp={fit ? pictureSp(vh) : 20} />}
        {v.audio && <AudioButtons clips={v.audio} onPlay={lights && v.keyboard ? demo.show : undefined} />}
        {v.keyboard && <KeyboardView k={v.keyboard} lit={demo.lit} />}
      </div>
    </InStep>
  )
}
