import { ChevronLeft, ChevronRight, Eraser, Footprints, Layers, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { IconButton } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { useElementSize } from '../../hooks/useElementSize'
import { playChord } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import {
  ALL_MAJOR_KEYS,
  ALL_MINOR_KEYS,
  CHORD_TYPES,
  type Chord,
  type DetectedChord,
  INVERSION_NAMES,
  type Key,
  type Note,
  chordSymbol,
  chordToRoman,
  guessKey,
  intervalBetween,
  keyFifths,
  keyId,
  keyName,
  midiOf,
  noteName,
  parseKey,
  pitchName,
  spellInKey,
} from '../../lib/theory'
import { useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { Sounding, nameSounding, withinChord } from './sounding'

interface HistoryItem {
  id: number
  chord: Chord
  symbol: string
}

const KEY_OPTIONS = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]
const KEY_CHOICES = ['auto', 'none', ...KEY_OPTIONS.map(keyId)]

/** Narrower than this, all 61 keys come out under ~30px wide: too small to tap. */
const FULL_KEYBOARD_WIDTH = 1100
/** Where the two-octave keyboard can start: C2 … C5, so it stays within the CT-S1's C2–C7. */
const COMPACT_OCTAVES = [2, 3, 4, 5]

/** A few notes that aren't a chord, in words: "E5", "C + E · Major 3rd", "C D E". */
function describeNotes(notes: Note[]): string {
  if (notes.length === 1) return noteName(notes[0])
  if (notes.length === 2) return `${pitchName(notes[0])} + ${pitchName(notes[1])} · ${intervalBetween(notes[0], notes[1]).name}`
  return notes.map((n) => pitchName(n)).join(' ')
}

export function FreePlay() {
  const sustain = useLive((s) => s.sustain)
  const mic = useLive((s) => s.mic)
  const midiKeyboards = useLive((s) => s.midiDevices.length)
  const found = useProgress((s) => s.chordsFound)
  const [octave, setOctave] = usePref('free-play:octave', 3, COMPACT_OCTAVES)
  const [keyChoice, setKeyChoice] = usePref('free-play:key', 'auto', KEY_CHOICES)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [discovered, setDiscovered] = useState<string | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [area, { height: areaH, width: areaW }] = useElementSize<HTMLDivElement>()
  const nextId = useRef(1)

  // The mic hears whole chords here (not just single notes).
  useMicChords()

  // What's sounding: held keys, plus notes ringing under the pedal or played as a broken chord.
  const [tracker] = useState(() => {
    const s = new Sounding()
    const t = performance.now()
    s.setPedal(useLive.getState().sustain)
    for (const m of heldNow()) s.noteOn(m, t)
    return s
  })
  const [sound, setSound] = useState(() => ({ all: tracker.notes(performance.now()), held: tracker.heldNotes() }))
  const look = useCallback(() => setSound({ all: tracker.notes(performance.now()), held: tracker.heldNotes() }), [tracker])
  useNoteEvents((e) => {
    if (e.type === 'on') tracker.noteOn(e.midi, e.time)
    else tracker.noteOff(e.midi, e.time)
    look()
  })
  // The pedal, straight from the input store: lifting it stops what was ringing.
  useEffect(
    () =>
      useLive.subscribe((s, prev) => {
        if (s.sustain === prev.sustain) return
        tracker.setPedal(s.sustain)
        look()
      }),
    [tracker, look],
  )
  // A broken chord fades out on its own: look again when it does.
  useEffect(() => {
    const t = performance.now()
    const at = tracker.nextExpiry(t)
    if (at === null) return
    const id = window.setTimeout(look, at - t + 20)
    return () => window.clearTimeout(id)
  }, [sound, tracker, look])

  const guessed = useMemo(() => guessKey(history.slice(-8).map((h) => h.chord)), [history])
  const key: Key | null = keyChoice === 'none' ? null : keyChoice === 'auto' ? guessed : parseKey(keyChoice)
  const prefer = key ? (keyFifths(key) < 0 ? 'flat' : keyFifths(key) > 0 ? 'sharp' : undefined) : undefined

  // Name it. A partial arpeggio of the last chord (or its bass struck again) is still that chord; once you let
  // go, the last chord stays on screen, dimmed, until the next one.
  const named = nameSounding(sound.all, sound.held, { pedal: sustain, prefer, mic: mic === 'on' })
  const real = named && named.det.chord.type.ivs.length >= 3 ? named.det : null
  const [last, setLast] = useState<DetectedChord | null>(null)
  const current = real ?? (last && withinChord(sound.all, last.chord) ? last : (named?.det ?? null))
  // Remembered as you play (React's "information from previous renders" pattern, no effect needed).
  if (current && current.symbol !== last?.symbol) setLast(current)

  // Once a chord has been held steadily for a moment, add it to the history (and the collection).
  const realSymbol = real?.symbol ?? null
  const commitChord = useEffectEvent(() => {
    if (!real) return
    setHistory((h) => (h[h.length - 1]?.symbol === real.symbol ? h : [...h.slice(-23), { id: nextId.current++, chord: real.chord, symbol: real.symbol }]))
    const base = chordSymbol({ ...real.chord, bass: undefined })
    const p = useProgress.getState()
    if (p.findChord(base)) {
      p.addXp(5)
      setDiscovered(base)
      window.setTimeout(() => setDiscovered((d) => (d === base ? null : d)), 2600)
    }
  })
  useEffect(() => {
    if (!realSymbol) return
    const id = window.setTimeout(commitChord, 260)
    return () => window.clearTimeout(id)
  }, [realSymbol])

  // What the big name shows: the chord you're playing, else the last one (dimmed), else the notes.
  const head = current ?? last
  const dim = !current && !!last
  const spelledNow = sound.all.map((m) => current?.notes.find((n) => midiOf(n) === m) ?? spellInKey(m, key))
  let headline = ''
  let sub = ''
  // Under a faded chord, what you're playing now (a melody note, say) takes the line below it.
  let now = ''
  if (head) {
    headline = head.symbol
    sub = `${head.name}${head.inversion > 0 ? ` · ${INVERSION_NAMES[head.inversion]}` : ''}${head.no5 ? ' · no 5th' : ''}`
    if (current && named?.det === current && named.fifthGuessed) sub += ' · 5th not heard'
    if (dim && spelledNow.length) now = `Now: ${describeNotes(spelledNow)}`
  } else if (spelledNow.length === 1) {
    headline = noteName(spelledNow[0])
    sub = 'Add more notes to make a chord'
  } else if (spelledNow.length === 2) {
    headline = spelledNow.map((n) => pitchName(n)).join(' + ')
    sub = intervalBetween(spelledNow[0], spelledNow[1]).name
  } else if (spelledNow.length > 2) {
    headline = spelledNow.map((n) => pitchName(n)).join(' ')
    sub = 'Not a standard chord name. Try moving one note.'
  }
  const roman = head && key ? chordToRoman(head.chord, key) : null

  const staffNotes = spelledNow.length ? spelledNow : (last?.notes ?? [])
  const staffItems: StaffItem[] = staffNotes.length ? [{ key: 'now', notes: staffNotes.map((n) => noteName(n)), dur: 'w' }] : [{ key: 'empty', dur: 'w', hidden: true }]

  // All 61 keys, like the CT-S1, when it's plugged in or the screen is wide. Otherwise (mic, or tapping the
  // keys on an iPad) two big octaves that ◀ ▶ move along. Phones always get the two octaves.
  const compact = areaW > 0 && (areaW < 640 || (midiKeyboards === 0 && areaW < FULL_KEYBOARD_WIDTH))
  const from = compact ? (octave + 1) * 12 : 36
  const pianoH = Math.round(compact ? Math.max(120, Math.min(240, areaH - 100)) : Math.max(120, Math.min(200, areaH - 40)))

  return (
    <div className="flex h-dvh flex-col">
      <TopBar back="/" title="Free Play" subtitle="Play anything. See what it is.">
        <select
          value={keyChoice}
          onChange={(e) => setKeyChoice(e.target.value)}
          aria-label="Key"
          className="hidden h-11 rounded-full border border-white/10 bg-night-750 px-4 text-sm font-extrabold text-ink-soft sm:block"
        >
          <option value="auto">Key: auto-detect</option>
          <option value="none">Key: none</option>
          {KEY_OPTIONS.map((k) => (
            <option key={keyId(k)} value={keyId(k)}>
              {keyName(k)}
            </option>
          ))}
        </select>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 pt-4 sm:px-6">
        <div className="grid shrink-0 gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* What you're playing */}
          <div className="glass relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-5 pb-10 text-center">
            <AnimatePresence mode="popLayout">
              {headline ? (
                <motion.div
                  key={headline}
                  initial={{ scale: 0.85, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <div
                    className={`font-display text-6xl font-bold leading-none transition-opacity duration-300 sm:text-7xl [@media(min-height:820px)]:sm:text-8xl ${dim ? 'opacity-50' : ''}`}
                    style={{ color: head ? '#f7f3ea' : spelledNow[0] ? noteColor(sound.all[0]) : undefined, textShadow: head && !dim ? '0 0 40px rgba(255,200,87,.35)' : undefined }}
                  >
                    <MusicText text={headline} />
                  </div>
                  <div className={`mt-3 text-xl font-bold first-letter:uppercase ${now ? 'text-ink' : 'text-ink-soft'} ${dim && !now ? 'opacity-60' : ''}`}>
                    <MusicText text={now || sub} />
                  </div>
                  {roman && (
                    <div
                      className={`mt-3 inline-flex items-center gap-2 rounded-full bg-violet/15 px-4 py-1.5 font-display text-2xl font-bold text-[#c9c0ff] transition-opacity ${dim ? 'opacity-60' : ''}`}
                    >
                      <MusicText text={roman} />
                      <span className="font-sans text-sm font-bold text-ink-mute">
                        in <MusicText text={keyName(key!)} />
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md">
                  <Sparkles className="mx-auto mb-3 text-gold" size={40} />
                  <div className="font-display text-4xl font-bold">Play anything</div>
                  <p className="mt-2 text-lg text-ink-soft">
                    A chord you know, a song you play by ear, a random cluster. This shows its name and how it’s written, live.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {discovered && (
                <motion.div
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-linear-to-r from-gold to-coral px-4 py-2 text-sm font-extrabold text-night-900 shadow-lg"
                >
                  <Wand2 size={18} /> New chord discovered: <MusicText text={discovered} /> · +5 XP
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-4 right-5 flex items-center gap-2 text-sm font-bold">
              <span className={`rounded-full px-3 py-1 transition-colors ${sustain ? 'bg-teal/20 text-teal' : 'bg-white/5 text-ink-mute'}`}>Pedal {sustain ? 'down' : 'up'}</span>
            </div>
          </div>

          {/* On the staff (the last chord, faded, once you let go) */}
          <Paper className={`flex items-center transition-opacity ${!sound.all.length && last ? 'opacity-60' : ''}`}>
            <Staff clef="grand" items={staffItems} sp={16} minSlot={6} reserveAbove={2.6} reserveBelow={2.6} animate={false} />
          </Paper>
        </div>

        {/* Progression history */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="shrink-0 text-sm font-extrabold uppercase tracking-widest text-ink-mute">You played</span>
            {history.length === 0 && <span className="text-sm text-ink-mute">Chords you hold will line up here, like a chord chart.</span>}
            <AnimatePresence initial={false}>
              {history.map((h) => (
                <motion.button
                  key={h.id}
                  layout
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  type="button"
                  onClick={() => playChord(h.chord)}
                  className="flex shrink-0 flex-col items-center rounded-xl border border-white/10 bg-night-750 px-3 py-1.5 hover:border-gold/50"
                >
                  <span className="font-display text-xl font-bold leading-tight">
                    <MusicText text={h.symbol} />
                  </span>
                  {key && (
                    <span className="text-xs font-bold text-[#c9c0ff]">
                      <MusicText text={chordToRoman(h.chord, key)} />
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          {keyChoice === 'auto' && guessed && (
            <span className="hidden shrink-0 gap-1 rounded-full bg-violet/15 px-3 py-1.5 text-sm font-extrabold text-[#c9c0ff] md:inline-flex">
              Sounds like <MusicText text={keyName(guessed)} />
            </span>
          )}
          {history.length > 0 && (
            <button type="button" onClick={() => setHistory([])} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-ink-mute hover:bg-white/5 hover:text-ink">
              <Eraser size={16} /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCollection(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-sm font-extrabold text-ink-soft hover:bg-white/10"
          >
            <Layers size={16} /> {found.length} found
          </button>
        </div>

        <div ref={area} className="flex min-h-[200px] flex-1 flex-col justify-end">
          {/* Octave buttons for the two-octave keyboard, drawn over the light trails that rise behind them. */}
          {compact && (
            <div className="relative z-10 mb-2 flex items-center justify-between gap-3">
              <IconButton icon={ChevronLeft} label="Octave down" size={52} disabled={octave <= COMPACT_OCTAVES[0]} onClick={() => setOctave(octave - 1)} />
              <span className="font-display text-xl font-bold text-ink-soft">
                C{octave} – C{octave + 2}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Octave up"
                size={52}
                disabled={octave >= COMPACT_OCTAVES[COMPACT_OCTAVES.length - 1]}
                onClick={() => setOctave(octave + 1)}
              />
            </div>
          )}
          <Piano
            from={from}
            to={compact ? from + 24 : 96}
            trails
            trailHeight={Math.max(60, areaH - pianoH - 30)}
            height={pianoH}
            minKeyWidth={20}
            octaveLabels={compact}
          />
        </div>
      </div>

      <Collection open={showCollection} onClose={() => setShowCollection(false)} found={found} />
    </div>
  )
}

function Collection({ open, onClose, found }: { open: boolean; onClose: () => void; found: string[] }) {
  // Group what you've found by chord type, using the symbol suffix.
  const groups = CHORD_TYPES.map((t) => ({
    type: t,
    chords: found.filter((s) => {
      const suffix = s.replace(/^[A-G](♯|♭)?/, '')
      return suffix === t.suffix
    }),
  })).filter((g) => g.chords.length)
  return (
    <Modal open={open} onClose={onClose} title={`Your chord collection (${found.length})`} wide>
      {found.length === 0 ? (
        <p className="text-ink-soft">Every new chord you play in Free Play gets added here. Hold three or more notes to discover your first one!</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.type.id}>
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-ink-mute">
                <Footprints size={14} /> {g.type.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.chords.map((c) => (
                  <span key={c} className="rounded-xl border border-white/10 bg-night-750 px-3 py-1.5 font-display text-lg font-bold">
                    <MusicText text={c} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
