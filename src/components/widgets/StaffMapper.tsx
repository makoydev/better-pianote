import { useState } from 'react'
import { useNoteEvents } from '../../lib/input/bus'
import { fromMidi, noteName } from '../../lib/theory'
import { MusicText } from '../MusicText'
import { Piano } from '../piano/Piano'
import { Staff, type StaffItem } from '../staff/Staff'
import { Paper } from '../ui/Card'

const RANGES = { treble: [60, 84], bass: [36, 60], grand: [41, 79] } as const

/** Play (or tap) any key and watch where it lands on the staff. */
export function StaffMapper({ clef }: { clef: 'treble' | 'bass' | 'grand' }) {
  const [played, setPlayed] = useState<{ midi: number; id: number }[]>([])
  const [from, to] = RANGES[clef]

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
    <div className="glass rounded-3xl p-4 sm:p-5">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
        <Paper>
          <Staff clef={clef} items={items.length ? items : [{ key: 'empty', dur: 'w', hidden: true }]} sp={19} minSlot={5} reserveAbove={3.5} reserveBelow={3.5} />
        </Paper>
        <div className="min-w-40 text-center">
          <div className="text-sm font-extrabold uppercase tracking-widest text-ink-mute">You played</div>
          <div className="font-display text-6xl font-bold text-gold">{last ? <MusicText text={noteName(fromMidi(last.midi))} /> : '–'}</div>
          <div className="text-sm text-ink-mute">{last ? '' : 'Play any key'}</div>
        </div>
      </div>
      <div className="pt-14">
        <Piano from={from} to={to} labels="c" sparks sparkHeight={70} height={170} />
      </div>
    </div>
  )
}
