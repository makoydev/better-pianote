import { useState } from 'react'
import { useNoteEvents } from '../../lib/input/bus'
import { nameNote } from '../../lib/naming'
import { fromMidi, noteName } from '../../lib/theory'
import { useSettings } from '../../state/settings'
import { MusicText } from '../MusicText'
import { Piano } from '../piano/Piano'
import { Staff, type StaffItem } from '../staff/Staff'
import { Paper } from '../ui/Card'
import { useFitKeyboard, useShortScreen } from './fit'

const RANGES = { treble: [60, 84], bass: [36, 60], grand: [41, 79] } as const

/** Play (or tap) any key and watch where it lands on the staff. */
export function StaffMapper({ clef }: { clef: 'treble' | 'bass' | 'grand' }) {
  const [played, setPlayed] = useState<{ midi: number; id: number }[]>([])
  const [from, to] = RANGES[clef]
  // In a lesson on a short screen the staff gives up some room so the keyboard stays in view (the grand staff, twice
  // as tall, the most).
  const short = useShortScreen()
  const [kbRef, kb] = useFitKeyboard(170, { below: 24, room: 56, min: short ? 92 : 100 })
  const tight = kb.fit && short
  const naming = useSettings((s) => s.naming)

  useNoteEvents((e) => {
    if (e.type !== 'on') return
    setPlayed((xs) => [...xs.slice(-5), { midi: e.midi, id: e.time }])
  })

  const items: StaffItem[] = played.map((p, i) => ({
    key: p.id,
    notes: [noteName(fromMidi(p.midi))],
    dur: 'w',
    state: i === played.length - 1 ? 'active' : 'normal',
  }))
  const last = played[played.length - 1]

  return (
    <div className={`glass rounded-3xl ${tight ? 'p-3' : 'p-4 sm:p-5'} ${kb.fit ? 'flex flex-1 flex-col' : ''}`}>
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
        <Paper>
          <Staff
            clef={clef}
            items={items.length ? items : [{ key: 'empty', dur: 'w', hidden: true }]}
            sp={tight ? (clef === 'grand' ? 11 : 15) : 19}
            minSlot={5}
            reserveAbove={tight ? 3 : 3.5}
            reserveBelow={tight ? 3 : 3.5}
          />
        </Paper>
        <div className="min-w-40 text-center">
          <div className="text-sm font-extrabold uppercase tracking-widest text-ink-mute">You played</div>
          <div className="font-display text-6xl font-bold text-gold">{last ? <MusicText text={nameNote(fromMidi(last.midi), naming, { octave: true })} /> : '–'}</div>
          <div className="text-sm text-ink-mute">{last ? '' : 'Play any key'}</div>
        </div>
      </div>
      <div ref={kbRef} className={kb.className} style={kb.style}>
        <Piano from={from} to={to} labels="c" sparks sparkHeight={70} height={kb.piano} />
      </div>
    </div>
  )
}
