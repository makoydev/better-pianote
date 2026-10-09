import { AudioLines, Play } from 'lucide-react'
import { LayoutGroup, AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, useId } from 'react'
import { playNotes, playSequence } from '../../lib/audio/play'
import { letterColor } from '../../lib/colors'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import {
  CHORD_TYPE,
  type Chord,
  INVERSION_NAMES,
  chordLongName,
  chordSymbol,
  chordTones,
  detectChord,
  midiOf,
  mod,
  parseNote,
  pcOf,
  pitchName,
  spellRoot,
  voicedChord,
} from '../../lib/theory'
import { MusicText } from '../MusicText'
import { type Marks, Piano } from '../piano/Piano'
import { Staff } from '../staff/Staff'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/controls'
import { useMicChords } from '../../lib/input/mic'

/** Choose a root and a chord quality and see/hear the chord, or hold a chord on your keyboard to name it. */

const QUALITIES = [
  { id: 'maj', label: 'Major' },
  { id: 'min', label: 'Minor' },
  { id: 'dim', label: 'Dim' },
  { id: 'aug', label: 'Aug' },
  { id: 'sus2', label: 'Sus2' },
  { id: 'sus4', label: 'Sus4' },
  { id: '7', label: '7' },
  { id: 'maj7', label: 'Maj7' },
  { id: 'm7', label: 'm7' },
  { id: 'add9', label: 'Add9' },
]

const ALIASES: Record<string, string> = { major: 'maj', minor: 'min', diminished: 'dim', augmented: 'aug', dominant7: '7' }

/** Triad fingering for the right hand by inversion; four-note chords use 1 2 3 5. */
const RH_FINGERS: Record<number, number[]> = { 0: [1, 3, 5], 1: [1, 2, 5], 2: [1, 3, 5] }

export function ChordBuilder({ root = 'C', quality = 'maj' }: { root?: string; quality?: string }) {
  // Through the mic, listen for whole chords.
  useMicChords()
  const [rootPc, setRootPc] = useState(() => pcOf(safeRoot(root)))
  const [typeId, setTypeId] = useState(() => {
    const id = ALIASES[quality] ?? quality
    return CHORD_TYPE[id] ? id : 'maj'
  })
  const [inversion, setInversion] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)

  const type = CHORD_TYPE[typeId]
  const chord: Chord = useMemo(() => ({ root: spellRoot(rootPc, type), type }), [rootPc, type])
  const toneCount = Math.min(type.ivs.length, 4)
  // Sus and add9 chords aren't usually named by inversion, so they stay in root position here.
  const canInvert = !['sus2', 'sus4', 'add9'].includes(typeId)
  const inv = canInvert ? Math.min(inversion, toneCount - 1) : 0
  // Keep the voicing in the middle of the keyboard: roots F–B start in octave 3.
  const oct = rootPc >= 5 ? 3 : 4
  const voiced = useMemo(
    () => (typeId === 'add9' ? chordTones({ ...chord.root, oct }, type) : voicedChord(chord, oct, inv)),
    [chord, oct, inv, typeId, type],
  )
  const midis = voiced.map(midiOf)
  const tones = chordTones(chord.root, type)
  const degreeOf = (n: { letter: number; acc: number }) => type.degrees[tones.findIndex((t) => pcOf(t) === pcOf({ ...n, oct: 4 }))] ?? ''

  const marks: Marks = {}
  voiced.forEach((n) => {
    const d = degreeOf(n)
    marks[midiOf(n)] = { kind: d === '1' ? 'root' : 'chord', label: d === '1' ? 'R' : d }
  })
  const fingers: Record<number, number> = {}
  const fingerSet = voiced.length === 3 ? RH_FINGERS[inv] : voiced.length === 4 ? [1, 2, 3, 5] : null
  if (fingerSet) voiced.forEach((n, i) => (fingers[midiOf(n)] = fingerSet[i]))

  // Root-position gaps in half steps between neighbouring chord tones (for triads and 7ths).
  const rootPos = tones.filter((_, i) => type.ivs[i].num <= 7)
  const gaps = rootPos.slice(1).map((t, i) => mod(midiOf(t) - midiOf(rootPos[i]), 12))

  // Hold a chord on your keyboard: name it and show it here.
  useNoteEvents(() => {
    const held = heldNow()
    if (held.length < 3) return
    const d = detectChord(held)
    if (!d) {
      setHeard(null)
      return
    }
    setHeard(d.symbol)
    if (QUALITIES.some((q) => q.id === d.chord.type.id)) {
      setRootPc(pcOf(d.chord.root))
      setTypeId(d.chord.type.id)
      setInversion(Math.max(0, d.inversion))
    }
  })

  const symbol = chordSymbol(chord)
  const invOptions = INVERSION_NAMES.slice(0, toneCount).map((name, i) => ({ value: i, label: i === 0 ? 'Root' : name.replace(' inversion', '') }))

  // Scope animated highlights so two copies of this widget don't share them.
  const layoutGroup = useId()
  return (
    <LayoutGroup id={layoutGroup}>
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Root">
              {Array.from({ length: 12 }, (_, pc) => {
                const on = pc === rootPc
                return (
                  <motion.button
                    key={pc}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setRootPc(pc)}
                    className={`h-11 min-w-11 rounded-xl border px-2 text-base font-extrabold ${on ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'}`}
                  >
                    <MusicText text={pitchName(spellRoot(pc, type))} />
                  </motion.button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Chord quality">
              {QUALITIES.map((q) => {
                const on = q.id === typeId
                return (
                  <motion.button
                    key={q.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setTypeId(q.id)}
                    className={`h-11 rounded-xl border px-3 text-base font-extrabold ${on ? 'border-violet bg-violet text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'}`}
                  >
                    {q.label}
                  </motion.button>
                )
              })}
            </div>
          </div>
          {canInvert ? <Segmented size="sm" value={inv} onChange={setInversion} options={invOptions} /> : <span />}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/8 bg-night-850 p-4">
            <AnimatePresence mode="wait">
              <motion.div key={`${symbol}-${inv}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <div className="font-display text-5xl font-bold leading-none text-gold">
                  <MusicText text={symbol} />
                </div>
                <p className="mt-1.5 text-lg font-bold capitalize text-ink">
                  <MusicText text={chordLongName(chord)} />
                  {inv > 0 && <span className="text-ink-mute"> · {INVERSION_NAMES[inv].toLowerCase()}</span>}
                </p>
                <p className="text-base text-ink-mute">{type.mood}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {rootPos.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-sm font-extrabold text-ink-mute">+{gaps[i - 1]}</span>}
                  <span
                    className="flex h-11 min-w-11 flex-col items-center justify-center rounded-xl px-2 leading-none"
                    style={{ background: `${letterColor(t.letter)}22`, border: `1px solid ${letterColor(t.letter)}66` }}
                  >
                    <span className="text-base font-extrabold" style={{ color: letterColor(t.letter) }}>
                      <MusicText text={pitchName(t)} />
                    </span>
                    <span className="mt-0.5 text-[0.7rem] font-bold text-ink-mute">{type.degrees[i]}</span>
                  </span>
                </div>
              ))}
              {tones.length > rootPos.length &&
                tones.slice(rootPos.length).map((t, i) => (
                  <span key={`x${i}`} className="ml-1 rounded-xl border border-dashed border-white/20 px-2 py-2 text-base font-extrabold text-ink-soft">
                    + <MusicText text={pitchName(t)} /> <span className="text-xs text-ink-mute">({type.degrees[rootPos.length + i]})</span>
                  </span>
                ))}
            </div>
            <p className="mt-2 text-sm text-ink-mute">Numbers between notes = half steps.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="md" icon={Play} onClick={() => playNotes(midis, { dur: 1.8, strum: 0.02 })}>
                Play
              </Button>
              <Button size="md" variant="secondary" icon={AudioLines} onClick={() => playSequence(midis, { gap: 0.2, dur: 1.4 })}>
                Arpeggio
              </Button>
            </div>
          </div>
          <div className="paper flex items-center rounded-2xl px-3 py-2">
            <Staff clef={midis[0] < 57 ? 'grand' : 'treble'} items={[{ key: `${symbol}-${inv}`, notes: voiced, dur: 'w', chord: symbol }]} sp={16} minSlot={6} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-base text-ink-soft">
          <span className="size-2 rounded-full bg-teal" />
          {heard ? (
            <span>
              You’re holding <b className="text-teal"><MusicText text={heard} /></b>
            </span>
          ) : (
            <span>Hold any chord on your keyboard and it shows up here.</span>
          )}
        </div>
        <Piano from={48} to={84} marks={marks} fingers={fingers} labels="marked" height={170} />
      </div>
    </LayoutGroup>
  )
}

function safeRoot(s: string) {
  try {
    return parseNote(s)
  } catch {
    return parseNote('C')
  }
}
