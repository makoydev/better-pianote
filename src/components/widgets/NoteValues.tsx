import { Play } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useEffect, useRef, useState, useId } from 'react'
import { audio } from '../../lib/audio/engine'
import { Staff, type Duration, type StaffItem } from '../staff/Staff'
import { Segmented } from '../ui/controls'

/** Whole → half → quarter → eighth → sixteenth: each row is one bar of 4/4, tap to hear it against the beat. */

interface Row {
  dur: Duration
  name: string
  beats: string
  count: number
  each: number
  color: string
}

const ROWS: Row[] = [
  { dur: 'w', name: 'Whole', beats: '4 beats', count: 1, each: 4, color: '#ffc857' },
  { dur: 'h', name: 'Half', beats: '2 beats', count: 2, each: 2, color: '#ff7b6b' },
  { dur: 'q', name: 'Quarter', beats: '1 beat', count: 4, each: 1, color: '#9b8cff' },
  { dur: '8', name: 'Eighth', beats: '½ beat', count: 8, each: 0.5, color: '#3ee6c8' },
  { dur: '16', name: 'Sixteenth', beats: '¼ beat', count: 16, each: 0.25, color: '#5cc8ff' },
]

const BPM = 76

export function NoteValues() {
  const [mode, setMode] = useState<'notes' | 'rests'>('notes')
  const [active, setActive] = useState<{ row: number; idx: number } | null>(null)
  const [beat, setBeat] = useState<number | null>(null)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clear, [])

  const play = (rowIndex: number) => {
    clear()
    const row = ROWS[rowIndex]
    const ctx = audio.unlock()
    const spb = 60 / BPM
    const t0 = ctx.currentTime + 0.15
    for (let b = 0; b < 4; b++) {
      audio.click(b === 0, t0 + b * spb)
      timers.current.push(audio.at(t0 + b * spb, () => setBeat(b)))
    }
    for (let k = 0; k < row.count; k++) {
      const t = t0 + k * row.each * spb
      if (mode === 'notes') audio.play(72, { when: t, dur: Math.max(0.1, row.each * spb * 0.92), vel: 0.62 })
      timers.current.push(audio.at(t, () => setActive({ row: rowIndex, idx: k })))
    }
    timers.current.push(
      audio.at(t0 + 4 * spb, () => {
        setActive(null)
        setBeat(null)
      }),
    )
  }

  // Scope animated highlights so two copies of this widget don't share them.
  const layoutGroup = useId()
  return (
    <LayoutGroup id={layoutGroup}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-ink-soft">Each row is one bar of 4 beats. Tap a row to hear it with the metronome.</p>
          <Segmented
            size="sm"
            value={mode}
            onChange={(m) => {
              clear()
              setActive(null)
              setBeat(null)
              setMode(m)
            }}
            options={[
              { value: 'notes', label: 'Notes' },
              { value: 'rests', label: 'Rests' },
            ]}
          />
        </div>
        <div className="space-y-2.5">
          {ROWS.map((row, r) => {
            const items: StaffItem[] = Array.from({ length: row.count }, (_, k) => ({
              key: `${mode}-${k}`,
              notes: mode === 'notes' ? ['B4'] : undefined,
              dur: row.dur,
              state: active?.row === r && active.idx === k ? 'active' : undefined,
            }))
            const playing = active?.row === r
            return (
              <motion.div
                key={row.dur}
                role="button"
                tabIndex={0}
                aria-label={`Play ${row.name.toLowerCase()} ${mode === 'rests' ? 'rests' : 'notes'}`}
                onClick={() => play(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    play(r)
                  }
                }}
                whileTap={{ scale: 0.985 }}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 text-left transition-colors sm:grid-cols-[8.5rem_1fr_auto] ${
                  playing ? 'border-white/25 bg-white/8' : 'border-white/8 bg-night-850 hover:border-white/15'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold leading-tight" style={{ color: row.color }}>
                    {row.name} {mode === 'rests' ? 'rest' : 'note'}
                  </span>
                  <span className="text-sm font-bold text-ink-mute">
                    {row.beats} · {row.count} per bar
                  </span>
                </span>
                <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <span className="paper block rounded-xl px-2 py-1">
                    <Staff
                      clef="rhythm"
                      items={items}
                      time={[4, 4]}
                      showClef={false}
                      spacing="proportional"
                      sp={15}
                      minSp={6}
                      reserveAbove={1.5}
                      reserveBelow={1}
                      colorNotes={false}
                      animate={false}
                    />
                  </span>
                  <BeatRuler row={row} activeIdx={playing ? active!.idx : null} beat={playing ? beat : null} rests={mode === 'rests'} />
                </span>
                <span className="col-start-2 row-start-1 flex size-12 items-center justify-center rounded-full bg-gold text-night-900 shadow-[0_4px_0_#b9761f] sm:col-start-3">
                  <Play size={22} strokeWidth={2.6} className="ml-0.5 fill-night-900" />
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </LayoutGroup>
  )
}

/** Four beat boxes with a coloured bar for each note, so you can see how long it lasts. */
function BeatRuler({ row, activeIdx, beat, rests }: { row: Row; activeIdx: number | null; beat: number | null; rests: boolean }) {
  return (
    <span className="relative mt-2 block h-9">
      <span className="absolute inset-0 grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className={`flex items-end justify-center rounded-lg pb-0.5 text-xs font-extrabold transition-colors ${beat === b ? 'bg-white/20 text-ink' : 'bg-white/5 text-ink-mute'}`}
          >
            {b + 1}
          </span>
        ))}
      </span>
      {Array.from({ length: row.count }, (_, k) => (
        <motion.span
          key={k}
          className="absolute top-1 h-3.5 rounded-full"
          style={{
            left: `calc(${(k * row.each * 100) / 4}% + 2px)`,
            width: `calc(${(row.each * 100) / 4}% - 4px)`,
            background: rests ? 'transparent' : row.color,
            border: rests ? `2px dashed ${row.color}` : 'none',
          }}
          animate={{ opacity: activeIdx === null || activeIdx === k ? 1 : 0.35, scaleY: activeIdx === k ? 1.35 : 1 }}
          transition={{ duration: 0.12 }}
        />
      ))}
    </span>
  )
}
