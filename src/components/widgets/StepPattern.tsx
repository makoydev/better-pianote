import { ChevronRight, Play, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../lib/audio/engine'
import { playNotes } from '../../lib/audio/play'
import { useNoteEvents } from '../../lib/input/bus'
import { type Note, SCALE_TYPE, midiOf, mod, parseNote, pcOf, pitchName, scaleNotes, stepPattern } from '../../lib/theory'
import { MusicText } from '../MusicText'
import { type Marks, Piano } from '../piano/Piano'
import { Staff } from '../staff/Staff'
import { Button } from '../ui/Button'

/** Builds a scale one step at a time from its whole/half-step recipe. */

const MAJOR_STARTS = ['C4', 'G4', 'D4', 'A3', 'E4', 'F4', 'Bb3', 'Eb4']
const MINOR_STARTS = ['A3', 'E4', 'B3', 'D4', 'G3', 'C4', 'F4']

export function StepPattern({ tonic, scale }: { tonic: string; scale: string }) {
  const type = SCALE_TYPE[scale] ?? SCALE_TYPE.major
  const [start, setStart] = useState(tonic)
  const tonicNote = useMemo(() => safeNote(start), [start])
  const notes = useMemo(() => scaleNotes(tonicNote, type), [tonicNote, type])
  const pattern = useMemo(() => stepPattern(type), [type])
  const [shown, setShown] = useState(1)
  const [bad, setBad] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  const done = shown >= notes.length

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const reset = (next = start) => {
    clearTimers()
    setStart(next)
    setShown(1)
  }

  const step = () => {
    if (done) return
    playNotes([midiOf(notes[shown])], { dur: 0.9 })
    setShown((s) => s + 1)
  }

  const autoplay = () => {
    clearTimers()
    setShown(1)
    const ctx = audio.unlock()
    const t0 = ctx.currentTime + 0.1
    notes.forEach((n, i) => {
      audio.play(midiOf(n), { when: t0 + i * 0.42, dur: 0.7 })
      timers.current.push(audio.at(t0 + i * 0.42, () => setShown(i + 1)))
    })
  }

  // Playing the next note on your keyboard advances the scale.
  useNoteEvents((e) => {
    if (e.type !== 'on' || done) return
    if (mod(e.midi, 12) === pcOf(notes[shown])) setShown((s) => s + 1)
    else {
      setBad(e.midi)
      timers.current.push(window.setTimeout(() => setBad(null), 450))
    }
  })

  const lo = midiOf(notes[0])
  const hi = midiOf(notes[notes.length - 1])
  const marks: Marks = {}
  notes.slice(0, shown).forEach((n, i) => {
    marks[midiOf(n)] = { kind: i === 0 || i === notes.length - 1 ? 'root' : 'chord', label: pitchName(n) }
  })
  if (bad !== null) marks[bad] = 'bad'

  const starts = scale === 'major' ? MAJOR_STARTS : scale === 'minor' || scale === 'harmonic-minor' ? MINOR_STARTS : ['C4', 'G4', 'D4', 'A3', 'E4', 'F4']
  const label = `${pitchName(tonicNote)} ${type.name.toLowerCase()}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-3xl font-bold capitalize leading-tight">
            <MusicText text={label} />
          </h3>
          <p className="text-base text-ink-mute">{type.mood}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="md" icon={ChevronRight} onClick={step} disabled={done}>
            Next step
          </Button>
          <Button size="md" variant="secondary" icon={Play} onClick={autoplay}>
            Play it
          </Button>
          <Button size="md" variant="ghost" icon={RotateCcw} onClick={() => reset()}>
            Reset
          </Button>
        </div>
      </div>

      {/* Note → step → note ladder */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/8 bg-night-850 p-3">
        {notes.map((n, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <motion.span
                className="rounded-lg px-1.5 py-1 text-sm font-extrabold"
                animate={{
                  opacity: i < shown ? 1 : i === shown ? 0.9 : 0.3,
                  scale: i === shown ? [1, 1.12, 1] : 1,
                  backgroundColor: i < shown ? (pattern[i - 1] === 'H' ? '#ffc857' : 'rgba(155,140,255,0.25)') : 'rgba(255,255,255,0.05)',
                  color: i < shown && pattern[i - 1] === 'H' ? '#0d0c24' : '#cdc9e6',
                }}
              >
                {pattern[i - 1]}
              </motion.span>
            )}
            <AnimatePresence>
              {i < shown ? (
                <motion.span
                  key="n"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 px-2 text-lg font-extrabold text-ink"
                >
                  <MusicText text={pitchName(n)} />
                </motion.span>
              ) : (
                <span className="flex h-11 min-w-11 items-center justify-center rounded-xl border-2 border-dashed border-white/12 text-lg font-extrabold text-ink-mute">?</span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {done && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-lg font-extrabold text-good">
            {notes.length === 8 ? 'Done! Notice every letter appears exactly once.' : `Done! ${notes.length - 1} notes, then home again.`}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="paper rounded-2xl px-3 py-2">
        <Staff
          clef={lo < 57 ? 'grand' : 'treble'}
          items={notes.map((n, i) =>
            i < shown
              ? { key: `${start}-${i}-r`, notes: [n], dur: 'q' as const, state: i === shown - 1 ? ('active' as const) : undefined }
              : // Not reached yet: a faint natural note, so the sharp or flat appears only when the recipe needs it.
                { key: `${start}-${i}-g`, notes: [{ ...n, acc: 0 }], dur: 'q' as const, state: 'ghost' as const },
          )}
          sp={15}
          minSlot={3.6}
        />
      </div>

      <Piano from={lo} to={hi + 1} marks={marks} labels="marked" height={170} />

      <div>
        <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Same recipe, another start note</div>
        <div className="flex flex-wrap gap-2">
          {starts.map((s) => {
            const n = safeNote(s)
            const on = pcOf(n) === pcOf(tonicNote)
            return (
              <motion.button
                key={s}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => reset(s)}
                className={`h-11 min-w-12 rounded-xl border px-3 text-base font-extrabold ${on ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'}`}
              >
                <MusicText text={pitchName(n)} />
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function safeNote(s: string): Note {
  try {
    return parseNote(s)
  } catch {
    return parseNote('C4')
  }
}
