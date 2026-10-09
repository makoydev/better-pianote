import { Play, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { playNotes, playSequence } from '../../lib/audio/play'
import { letterColor } from '../../lib/colors'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import {
  IV,
  INTERVAL_SONGS,
  type Interval,
  LETTERS,
  type Note,
  fromMidi,
  intervalBetween,
  midiOf,
  noteName,
  transpose,
} from '../../lib/theory'
import { MusicText } from '../MusicText'
import { Piano } from '../piano/Piano'
import { Staff } from '../staff/Staff'
import { Button } from '../ui/Button'

/** Pick two notes (tap them, or play them on your keyboard) and see the interval between them. */

const SIMPLE: Interval[] = [IV.P1, IV.m2, IV.M2, IV.m3, IV.M3, IV.P4, IV.A4, IV.P5, IV.m6, IV.M6, IV.m7, IV.M7, IV.P8]
const QUICK = [
  { semis: 1, label: 'm2' },
  { semis: 2, label: 'M2' },
  { semis: 3, label: 'm3' },
  { semis: 4, label: 'M3' },
  { semis: 5, label: 'P4' },
  { semis: 6, label: 'TT' },
  { semis: 7, label: 'P5' },
  { semis: 8, label: 'm6' },
  { semis: 9, label: 'M6' },
  { semis: 10, label: 'm7' },
  { semis: 11, label: 'M7' },
  { semis: 12, label: 'Oct' },
]

function ivFor(semis: number): Interval {
  if (semis <= 12) return SIMPLE[semis]
  const base = SIMPLE[semis % 12]
  return { num: base.num + 7 * Math.floor(semis / 12), semis }
}

/** Spell the pair so the name matches the distance (C–E♭ is a minor 3rd, not C–D♯). */
function spellPair(a: number, b: number): [Note, Note] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const low = fromMidi(lo)
  return [low, transpose(low, ivFor(hi - lo))]
}

export function IntervalLab() {
  const [a, setA] = useState<number | null>(60)
  const [b, setB] = useState<number | null>(64)

  const pick = (m: number) => {
    if (a === null || (a !== null && b !== null)) {
      setA(m)
      setB(null)
    } else if (m !== a) {
      setB(m)
    }
  }

  useNoteEvents((e) => {
    if (e.type !== 'on') return
    const held = heldNow()
    if (held.length === 2) {
      setA(held[0])
      setB(held[1])
    } else pick(e.midi)
  })

  const pair = a !== null && b !== null ? spellPair(a, b) : null
  const semis = pair ? midiOf(pair[1]) - midiOf(pair[0]) : 0
  const info = pair ? intervalBetween(pair[0], pair[1]) : null
  const letters = pair ? countLetters(pair[0], pair[1]) : []
  const song = semis >= 1 && semis <= 12 ? INTERVAL_SONGS[semis] : undefined
  const marks: Record<number, { kind: 'root' | 'chord'; label: string }> = {}
  if (a !== null) marks[a] = { kind: 'root', label: '1' }
  if (b !== null && info) marks[b] = { kind: 'chord', label: String(info.num) }

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-soft">
        Tap two keys, or play two notes on your keyboard. Quick picks start from middle C:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <motion.button
            key={q.label}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setA(60)
              setB(60 + q.semis)
              playSequence([60, 60 + q.semis], { gap: 0.45 })
            }}
            className={`h-11 min-w-12 rounded-xl border px-2.5 text-base font-extrabold transition-colors ${
              pair && midiOf(pair[0]) === 60 && semis === q.semis ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'
            }`}
            title={`${q.semis} half steps`}
          >
            {q.label}
          </motion.button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-white/8 bg-night-850 p-4">
          <AnimatePresence mode="wait">
            {pair && info ? (
              <motion.div key={`${midiOf(pair[0])}-${semis}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="font-display text-4xl font-bold leading-tight text-gold">{info.name}</h3>
                  {semis === 6 && <span className="text-lg font-bold text-ink-mute">(the tritone)</span>}
                </div>
                <p className="mt-1 text-lg font-bold text-ink">
                  <MusicText text={noteName(pair[0])} /> → <MusicText text={noteName(pair[1])} />
                </p>
                <div className="mt-3">
                  <div className="mb-1 text-sm font-extrabold uppercase tracking-wider text-ink-mute">{semis} half step{semis === 1 ? '' : 's'}</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: semis }, (_, i) => (
                      <motion.span
                        key={i}
                        className="h-3 w-5 rounded-full bg-violet"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.035 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Count the letters → {ordinal(info.num)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {letters.map((l, i) => (
                      <span
                        key={i}
                        className="flex size-9 items-center justify-center rounded-lg text-base font-extrabold"
                        style={{ background: `${letterColor(l)}22`, color: letterColor(l), border: `1px solid ${letterColor(l)}55` }}
                      >
                        {LETTERS[l]}
                      </span>
                    ))}
                  </div>
                </div>
                {song && (
                  <p className="mt-3 text-base text-ink-soft">
                    <span className="font-extrabold text-teal">Sounds like:</span> {song}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="md" icon={Play} onClick={() => playSequence([midiOf(pair[0]), midiOf(pair[1])], { gap: 0.5 })}>
                    One after the other
                  </Button>
                  <Button size="md" variant="secondary" onClick={() => playNotes([midiOf(pair[0]), midiOf(pair[1])], { dur: 1.6 })}>
                    Together
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center text-lg font-bold text-ink-mute">
                {a === null ? 'Pick the first note…' : 'Now pick a second note.'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="paper flex items-center rounded-2xl px-3 py-2">
          {pair ? (
            <Staff
              clef={midiOf(pair[0]) < 57 ? 'grand' : 'treble'}
              items={[
                { key: 'a', notes: [pair[0]], dur: 'w' },
                { key: 'b', notes: [pair[1]], dur: 'w' },
                { bar: 'single' },
                { key: 'ab', notes: [pair[0], pair[1]], dur: 'w' },
              ]}
              sp={14}
              animate={false}
            />
          ) : (
            <p className="w-full py-8 text-center font-bold text-[#6b6585]">Your interval will appear here</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => {
            setA(null)
            setB(null)
          }}>
          Clear
        </Button>
      </div>
      <Piano from={60} to={84} mode="toggle" onToggle={pick} marks={marks} height={170} />
    </div>
  )
}

function countLetters(lo: Note, hi: Note): number[] {
  const steps = lo.oct * 7 + lo.letter
  const end = hi.oct * 7 + hi.letter
  const out: number[] = []
  for (let s = steps; s <= end && out.length < 16; s++) out.push(s % 7)
  return out
}

function ordinal(n: number): string {
  if (n === 1) return 'unison'
  if (n === 8) return 'octave'
  const suffix = n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}
