import { useState } from 'react'
import { mod } from '../../lib/theory'
import { type Marks, Piano } from '../piano/Piano'
import { Chips } from '../ui/controls'

type Mode = 'twos' | 'threes' | 'cs' | 'middle'

const MODES: { value: Mode; label: string }[] = [
  { value: 'twos', label: 'Groups of 2' },
  { value: 'threes', label: 'Groups of 3' },
  { value: 'cs', label: 'All the Cs' },
  { value: 'middle', label: 'Middle C' },
]

/** The whole 61-key CT-S1 (C2–C7), with the patterns that help you find your way. */
export function KeyboardMap() {
  const [mode, setMode] = useState<Mode>('twos')
  const marks: Marks = {}
  for (let m = 36; m <= 96; m++) {
    const pc = mod(m, 12)
    if (mode === 'twos' && (pc === 1 || pc === 3)) marks[m] = { kind: 'chord', label: '' }
    if (mode === 'threes' && (pc === 6 || pc === 8 || pc === 10)) marks[m] = { kind: 'chord', label: '' }
    if (mode === 'cs' && pc === 0) marks[m] = 'target'
  }
  if (mode === 'middle') marks[60] = 'root'
  return (
    <div className="glass rounded-3xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips value={mode} options={MODES} onChange={setMode} />
        <span className="text-sm font-bold text-ink-mute">61 keys · 36 white · 25 black · C2 to C7</span>
      </div>
      <div className="pt-16">
        <Piano from={36} to={96} marks={marks} labels="c" octaveLabels height={170} sparks sparkHeight={80} minKeyWidth={22} />
      </div>
    </div>
  )
}
