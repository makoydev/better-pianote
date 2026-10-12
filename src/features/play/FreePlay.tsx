import { ArrowUpRight, ChevronLeft, ChevronRight, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { IconButton } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { useElementSize } from '../../hooks/useElementSize'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playChord, playNotes } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { toast } from '../../lib/fx'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import {
  ALL_MAJOR_KEYS,
  ALL_MINOR_KEYS,
  type DetectedChord,
  INVERSION_NAMES,
  type Key,
  type Note,
  bassFor,
  chordSymbol,
  chordToRoman,
  findKey,
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
  voiceProgression,
} from '../../lib/theory'
import { useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { openChord, openJamWith } from '../explore/links'
import { type ChartEntry, addToChart, chartLoop, chartText, collectionGroups, fromEntry, homeKey, inCollection, plainChord, readChart } from './chart'
import { ChordChart } from './ChordChart'
import { Collection } from './Collection'
import { Sounding, nameSounding, withinChord } from './sounding'

const KEY_OPTIONS = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]
const KEY_CHOICES = ['auto', 'none', ...KEY_OPTIONS.map(keyId)]
const NO_CHART: ChartEntry[] = []

/** Narrower than this, all 61 keys come out under ~30px wide: too small to tap. */
const FULL_KEYBOARD_WIDTH = 1100
/** Where the two-octave keyboard can start: C2 … C5, so it stays within the CT-S1's C2–C7. */
const COMPACT_OCTAVES = [2, 3, 4, 5]
/** Seconds per chord when the chart plays back. */
const PLAY_ALL_GAP = 1.4

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
  // Each sound once (older builds saved B♭ and A♯ as two finds).
  const foundCount = useMemo(() => collectionGroups(found).reduce((n, g) => n + g.chords.length, 0), [found])
  const [octave, setOctave] = usePref('free-play:octave', 3, COMPACT_OCTAVES)
  const [keyChoice, setKeyChoice] = usePref('free-play:key', 'auto', KEY_CHOICES)
  const [savedChart, setChart] = usePref<ChartEntry[]>('free-play:chart', NO_CHART)
  const [discovered, setDiscovered] = useState<string | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [area, { height: areaH, width: areaW }] = useElementSize<HTMLDivElement>()

  // The mic hears whole chords here (not just single notes).
  useMicChords()

  // The chart of what you've played, kept between visits.
  const chart = readChart(savedChart)
  const chords = chart.map(fromEntry)

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

  const guessed = useMemo(() => guessKey(readChart(savedChart).map(fromEntry).slice(-8)), [savedChart])
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

  // Once a chord has been held steadily for a moment, add it to the chart (and the collection, by sound).
  const [undo, setUndo] = useState<ChartEntry[] | null>(null)
  const realSymbol = real?.symbol ?? null
  const commitChord = useEffectEvent(() => {
    if (!real) return
    const next = addToChart(chart, real.chord)
    if (next !== chart) {
      setChart(next)
      setUndo(null)
    }
    const p = useProgress.getState()
    if (inCollection(p.chordsFound, real.chord)) return
    const name = chordSymbol(plainChord(real.chord))
    if (p.findChord(name)) {
      p.addXp(5)
      setDiscovered(name)
      window.setTimeout(() => setDiscovered((d) => (d === name ? null : d)), 2600)
    }
  })
  useEffect(() => {
    if (!realSymbol) return
    const id = window.setTimeout(commitChord, 260)
    return () => window.clearTimeout(id)
  }, [realSymbol])

  // Play the chart back in time.
  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])
  const [playingAt, setPlayingAt] = useState<number | null>(null)
  const stopPlayback = useCallback(() => {
    clock.current?.stop()
    clock.current = null
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPlayingAt(null)
  }, [])
  useEffect(() => stopPlayback, [stopPlayback])
  const playAll = () => {
    stopPlayback()
    if (!chords.length) return
    const list = chords
    const voicings = voiceProgression(list, { center: 64, low: 57, high: 79 })
    const basses = list.map((c) => bassFor(c, 40))
    const c = new Clock({
      interval: () => PLAY_ALL_GAP,
      onTick: (i, time) => {
        const at = (fn: () => void) => timers.current.push(audio.at(time, fn))
        if (i >= list.length) {
          c.stop()
          at(() => setPlayingAt(null))
          return
        }
        playNotes([basses[i], ...voicings[i]], { delay: Math.max(0, time - audio.now), dur: PLAY_ALL_GAP * 0.95, strum: 0.02 })
        at(() => setPlayingAt(i))
      },
    })
    clock.current = c
    c.start(0.1)
  }

  const [selected, setSelected] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const copyChart = async () => {
    try {
      await navigator.clipboard.writeText(chartText(chords, key))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ kind: 'info', title: 'Couldn’t copy the chart', detail: 'The browser said no. Tap the page and try again.' })
    }
  }
  const loopInJam = () => {
    if (!chords.length) return
    const loop = chartLoop(chords)
    stopPlayback()
    // In the key you're in; failing that, the key the loop sounds like, or its first chord's.
    openJamWith(loop, key ?? findKey([], loop)?.key ?? homeKey(loop[0]) ?? { tonic: loop[0].root, mode: 'major' })
  }
  const removeChord = (id: number) => {
    setUndo(chart)
    setChart(chart.filter((e) => e.id !== id))
    setSelected(null)
  }
  const clearChart = () => {
    stopPlayback()
    setUndo(chart)
    setChart([])
    setSelected(null)
  }

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
          onChange={(e) => {
            setKeyChoice(e.target.value)
            // Letters play notes here, so don't leave them choosing keys in the list.
            e.target.blur()
          }}
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
          <div className="glass relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-5 pb-12 text-center">
            {keyChoice === 'auto' && guessed && (
              <span className="absolute left-4 top-4 inline-flex gap-1 rounded-full bg-violet/15 px-3 py-1.5 text-sm font-extrabold text-[#c9c0ff]">
                Sounds like <MusicText text={keyName(guessed)} />
              </span>
            )}
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
                  {head && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {roman && (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full bg-violet/15 px-4 py-1 font-display text-2xl font-bold text-[#c9c0ff] transition-opacity ${dim ? 'opacity-60' : ''}`}
                        >
                          <MusicText text={roman} />
                          <span className="font-sans text-sm font-bold text-ink-mute">
                            in <MusicText text={keyName(key!)} />
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openChord(head.chord, Math.max(0, head.inversion))}
                        className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/6 px-4 text-sm font-extrabold text-ink-soft transition-colors hover:bg-white/10 hover:text-ink"
                      >
                        Explore it <ArrowUpRight size={16} />
                      </button>
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
                  className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-linear-to-r from-gold to-coral px-4 py-2 text-sm font-extrabold text-night-900 shadow-lg"
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

        <ChordChart
          entries={chart}
          chords={chords}
          keyOf={key}
          selected={selected}
          playingAt={playingAt}
          copied={copied}
          found={foundCount}
          onTap={(i) => {
            playChord(chords[i])
            setSelected((s) => (s === chart[i].id ? null : chart[i].id))
          }}
          onRemove={removeChord}
          onPlayAll={playAll}
          onStop={stopPlayback}
          onCopy={() => void copyChart()}
          onJam={loopInJam}
          onClear={clearChart}
          onUndo={
            undo
              ? () => {
                  setChart(undo)
                  setUndo(null)
                }
              : null
          }
          onCollection={() => setShowCollection(true)}
        />

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
