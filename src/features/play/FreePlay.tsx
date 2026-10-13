import { ArrowUpRight, BookmarkPlus, ChevronLeft, ChevronRight, Lightbulb, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { Button, IconButton } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { useElementSize } from '../../hooks/useElementSize'
import { useHandsFree } from '../../hooks/useHandsFree'
import { useViewportHeight } from '../../hooks/useViewport'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playChord, playNotes } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { toast } from '../../lib/fx'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import { nameNote } from '../../lib/naming'
import {
  ALL_MAJOR_KEYS,
  ALL_MINOR_KEYS,
  type DetectedChord,
  INVERSION_NAMES,
  type Key,
  type KeyFound,
  type Note,
  bassFor,
  chordSymbol,
  chordToRoman,
  findKey,
  intervalBetween,
  keyFifths,
  keyId,
  keyName,
  keyScale,
  midiOf,
  mod,
  nextChords,
  noteName,
  parseKey,
  pcOf,
  spellChordInKey,
  spellInKey,
  voiceProgression,
} from '../../lib/theory'
import { useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { type Naming, useSettings } from '../../state/settings'
import { guitarVoicings } from '../explore/guitar'
import { GuitarDiagram } from '../explore/GuitarDiagram'
import { openChord, openJamWith } from '../explore/links'
import { ChordChart } from './ChordChart'
import { Collection } from './Collection'
import { IdeasSheet } from './IdeasSheet'
import { PEDAL, lengthText, recorder, useIdeas } from './ideas'
import {
  type ChartEntry,
  type NoteSpan,
  addToChart,
  chartLoop,
  chartText,
  collectionGroups,
  fromEntry,
  homeKey,
  inCollection,
  noteWeights,
  plainChord,
  readChart,
} from './chart'
import { KeyBar } from './KeyBar'
import { Sounding, nameSounding, respelled, sameVoicing, withinChord } from './sounding'

const KEY_OPTIONS = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]
const KEY_CHOICES = ['auto', 'none', ...KEY_OPTIONS.map(keyId)]
const NO_CHART: ChartEntry[] = []

/** Narrower than this, all 61 keys come out under ~30px wide: too small to tap. */
const FULL_KEYBOARD_WIDTH = 1100
/** Where the two-octave keyboard can start: C2 … C5, so it stays within the CT-S1's C2–C7. */
const COMPACT_OCTAVES = [2, 3, 4, 5]
/** Notes remembered for finding the key: the last 64, from the last minute and a half. */
const KEY_NOTES = 64
const KEY_MEMORY_MS = 90_000
/** Seconds per chord when the chart plays back. */
const PLAY_ALL_GAP = 1.4

/** A few notes that aren't a chord, in words, named as you chose in Settings: "E5", "C + E · Major 3rd", "C D E". */
function describeNotes(notes: Note[], naming: Naming): string {
  if (notes.length === 1) return nameNote(notes[0], naming, { octave: true })
  if (notes.length === 2) return `${nameNote(notes[0], naming)} + ${nameNote(notes[1], naming)} · ${intervalBetween(notes[0], notes[1]).name}`
  return notes.map((n) => nameNote(n, naming)).join(' ')
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
  const [showKey, setShowKey] = usePref('free-play:show-key', false)
  const [guitar, setGuitar] = usePref('free-play:guitar', false)
  const [discovered, setDiscovered] = useState<string | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [area, { height: areaH, width: areaW }] = useElementSize<HTMLDivElement>()
  // The staff keeps one height whatever you play (room for three note names above and below), so the keyboard
  // under it doesn't jump from chord to chord; it's drawn a little smaller on short screens.
  const short = useViewportHeight() < 900
  const reserve = useSettings((s) => s.staffLabels) ? 4.8 : 2.4
  const naming = useSettings((s) => s.naming)

  // The mic hears whole chords here (not just single notes).
  useMicChords()

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

  // The key you're in, found from recent notes (and how long each sounded) plus the last chords added this visit:
  // yesterday's chart shouldn't decide today's key (entries are stamped with when they were added).
  const spans = useRef<NoteSpan[]>([])
  const [heard, setHeard] = useState<KeyFound | null>(null)
  const [visitStart] = useState(() => Date.now())
  const listen = (chartNow: ChartEntry[]) => {
    const fresh = chartNow.filter((e) => e.id >= visitStart).map(fromEntry)
    setHeard((prev) => findKey(noteWeights(spans.current, performance.now()), fresh.slice(-12), prev?.key ?? null))
  }
  const changeChart = (next: ChartEntry[]) => {
    setChart(next)
    listen(next)
  }

  useNoteEvents((e) => {
    // Everything you play here is kept for a couple of minutes, for Save that!
    recorder.add(e.time, e.midi, e.type === 'on' ? Math.min(127, Math.max(1, Math.round(e.velocity * 127))) : 0)
    if (e.type === 'on') {
      tracker.noteOn(e.midi, e.time)
      const keep = spans.current.filter((n) => e.time - n.on < KEY_MEMORY_MS).slice(-(KEY_NOTES - 1))
      spans.current = [...keep, { midi: e.midi, on: e.time, off: null }]
    } else {
      tracker.noteOff(e.midi, e.time)
      const open = spans.current.findLast((n) => n.midi === e.midi && n.off === null)
      if (open) open.off = e.time
      listen(chart)
    }
    look()
  })
  // The pedal, straight from the input store: lifting it stops what was ringing.
  useEffect(
    () =>
      useLive.subscribe((s, prev) => {
        if (s.sustain === prev.sustain) return
        tracker.setPedal(s.sustain)
        recorder.add(performance.now(), PEDAL, s.sustain ? 1 : 0)
        look()
      }),
    [tracker, look],
  )
  // The pedal as it is now: it may have gone up or down while you were on another screen.
  useEffect(() => recorder.add(performance.now(), PEDAL, useLive.getState().sustain ? 1 : 0), [])
  // A broken chord fades out on its own: look again when it does.
  useEffect(() => {
    const t = performance.now()
    const at = tracker.nextExpiry(t)
    if (at === null) return
    const id = window.setTimeout(look, at - t + 20)
    return () => window.clearTimeout(id)
  }, [sound, tracker, look])

  // The key: the one heard, unless you've locked one (or chosen none).
  const key: Key | null = keyChoice === 'none' ? null : keyChoice === 'auto' ? (heard?.key ?? null) : parseKey(keyChoice)
  const prefer = key ? (keyFifths(key) < 0 ? 'flat' : keyFifths(key) > 0 ? 'sharp' : undefined) : undefined
  // The chart as the key spells it, so chords played before the key was known read right (D♯m, iii in B major).
  const keyChords = chords.map((c) => spellChordInKey(c, key))

  // Name it. A partial arpeggio of the last chord (or its bass struck again) is still that chord; once you let
  // go, the last chord stays on screen, dimmed, until the next one.
  const named = nameSounding(sound.all, sound.held, { pedal: sustain, prefer, mic: mic === 'on' })
  const real = named && named.det.chord.type.ivs.length >= 3 ? named.det : null
  const [last, setLast] = useState<DetectedChord | null>(null)
  const current = real ?? (last && withinChord(sound.all, last.chord) ? last : (named?.det ?? null))
  // Remembered as you play, voicing and all, for the faded staff (React's "information from previous renders"
  // pattern, no effect needed).
  if (current && !(last && sameVoicing(current, last))) setLast(current)

  // Once a chord has been held steadily for a moment, add it to the chart (and the collection, by sound).
  const [undo, setUndo] = useState<ChartEntry[] | null>(null)
  const realSymbol = real?.symbol ?? null
  const commitChord = useEffectEvent(() => {
    if (!real) return
    const next = addToChart(chart, real.chord)
    if (next !== chart) {
      changeChart(next)
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
      await navigator.clipboard.writeText(chartText(keyChords, key))
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
    const k = key ?? findKey([], loop)?.key ?? homeKey(loop[0]) ?? { tonic: loop[0].root, mode: 'major' }
    openJamWith(
      loop.map((c) => spellChordInKey(c, k)),
      k,
    )
  }
  // Removing or restoring chords moves the chips, so stop a playback that's lighting them up.
  const removeChord = (id: number) => {
    stopPlayback()
    setUndo(chart)
    changeChart(chart.filter((e) => e.id !== id))
    setSelected(null)
  }
  const clearChart = () => {
    stopPlayback()
    setUndo(chart)
    changeChart([])
    setSelected(null)
  }

  // ---- Save that!: the last couple of minutes of playing, kept as an idea ----
  const ideaCount = useIdeas((s) => s.ideas.length)
  const [showIdeas, setShowIdeas] = useState(false)
  const saveThat = () => {
    const now = performance.now()
    const take = recorder.take(now)
    if (!take) {
      toast({
        kind: 'info',
        title: ideaCount ? 'Nothing new to save' : 'Nothing to save yet',
        detail: 'Play something first: Free Play keeps the last two minutes (since your last save).',
      })
      return
    }
    const id = Date.now()
    // The chart's chords that came in while you played it, as the key spells them.
    const began = id - (now - take.from) - 300
    const chordsIn = chart.filter((e) => e.id >= began).map((e) => chordSymbol(spellChordInKey(fromEntry(e), key)))
    const base = key ? `Idea in ${keyName(key)}` : 'Idea'
    const names = new Set(useIdeas.getState().ideas.map((i) => i.name))
    let name = base
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`
    let kept = false
    try {
      kept = useIdeas.getState().add({ id, name, ms: take.ms, events: take.events, ...(key ? { key: keyId(key) } : {}), ...(chordsIn.length ? { chords: chordsIn } : {}) })
    } catch {
      // The browser wouldn't store it: don't show an idea that isn't really kept.
      useIdeas.setState((st) => ({ ideas: st.ideas.filter((i) => i.id !== id) }))
    }
    if (!kept) {
      toast({ kind: 'info', title: 'No room to save that', detail: 'Your ideas fill the space set aside for them. Delete a few in Your ideas, then try again.' })
      return
    }
    recorder.saved(now)
    toast({ kind: 'info', title: `Saved: ${name}`, detail: `${lengthText(take.ms)} of playing, kept in Your ideas.` })
  }
  // Enter saves too (the pedal and the top C are for playing here).
  useHandsFree(saveThat, { pedal: false, topC: false })

  // What the big name shows, spelled for the key: the chord you're playing, else the last one (dimmed), else the notes.
  const currentInKey = current && respelled(current, key)
  const head = currentInKey ?? (last && respelled(last, key))
  const dim = !current && !!last
  const spelledNow = sound.all.map((m) => currentInKey?.notes.find((n) => midiOf(n) === m) ?? spellInKey(m, key))
  let headline = ''
  let sub = ''
  // Under a faded chord, what you're playing now (a melody note, say) takes the line below it.
  let now = ''
  if (head) {
    headline = head.symbol
    sub = `${head.name}${head.inversion > 0 ? ` · ${INVERSION_NAMES[head.inversion]}` : ''}${head.no5 ? ' · no 5th' : ''}`
    if (current && named?.det === current && named.fifthGuessed) sub += ' · 5th not heard'
    if (dim && spelledNow.length) now = `Now: ${describeNotes(spelledNow, naming)}`
  } else if (spelledNow.length === 1) {
    headline = nameNote(spelledNow[0], naming, { octave: true })
    sub = 'Add more notes to make a chord'
  } else if (spelledNow.length === 2) {
    headline = spelledNow.map((n) => nameNote(n, naming)).join(' + ')
    sub = intervalBetween(spelledNow[0], spelledNow[1]).name
  } else if (spelledNow.length > 2) {
    headline = spelledNow.map((n) => nameNote(n, naming)).join(' ')
    sub = 'Not a standard chord name. Try moving one note.'
  }
  const roman = head && key ? chordToRoman(head.chord, key) : null
  const voicing = guitar && head ? guitarVoicings(head.chord)[0] : null
  // Without a key, suggest as if the chord were home.
  const nextKey = key ?? (head ? homeKey(head.chord) : null)
  const suggestions = head && nextKey ? nextChords(head.chord, nextKey) : []

  const staffNotes = spelledNow.length ? spelledNow : (head?.notes ?? [])
  const staffItems: StaffItem[] = staffNotes.length ? [{ key: 'now', notes: staffNotes.map((n) => noteName(n)), dur: 'w' }] : [{ key: 'empty', dur: 'w', hidden: true }]

  // All 61 keys, like the CT-S1, when it's plugged in or the screen is wide. Otherwise (mic, or tapping the
  // keys on an iPad) two big octaves that ◀ ▶ move along. Phones always get the two octaves.
  const compact = areaW > 0 && (areaW < 640 || (midiKeyboards === 0 && areaW < FULL_KEYBOARD_WIDTH))
  const from = compact ? (octave + 1) * 12 : 36
  const to = compact ? from + 24 : 96
  const pianoH = Math.round(compact ? Math.max(120, Math.min(240, areaH - 100)) : Math.max(120, Math.min(200, areaH - 40)))

  // "Show key": a dot on every note of the key, named the way the key spells it.
  const marks: Record<number, KeyMark> = {}
  if (showKey && key) {
    const pcs = new Set(keyScale(key).map(pcOf))
    for (let m = from; m <= to; m++) if (pcs.has(mod(m, 12))) marks[m] = { kind: 'scale', label: nameNote(spellInKey(m, key), naming) }
  }

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
          <div className="glass relative flex flex-col gap-2 overflow-hidden rounded-[2rem] p-4">
            <KeyBar
              choice={keyChoice}
              found={heard}
              keyOf={key}
              onLock={(k) => setKeyChoice(keyId(k))}
              onAuto={() => setKeyChoice('auto')}
              showKey={showKey}
              onShowKey={setShowKey}
              guitar={guitar}
              onGuitar={setGuitar}
            />
            <div className="flex min-h-40 flex-1 items-center justify-center gap-5 text-center">
              <AnimatePresence mode="popLayout">
                {headline ? (
                  <motion.div
                    key={headline}
                    initial={{ scale: 0.85, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="min-w-0"
                  >
                    <div
                      className={`font-display text-5xl font-bold leading-none transition-opacity duration-300 sm:text-6xl [@media(min-height:900px)]:sm:text-7xl ${dim ? 'opacity-50' : ''}`}
                      style={{ color: head ? '#f7f3ea' : spelledNow[0] ? noteColor(sound.all[0]) : undefined, textShadow: head && !dim ? '0 0 40px rgba(255,200,87,.35)' : undefined }}
                    >
                      <MusicText text={headline} />
                    </div>
                    <div className={`mt-2 text-lg font-bold first-letter:uppercase ${now ? 'text-ink' : 'text-ink-soft'} ${dim && !now ? 'opacity-60' : ''}`}>
                      <MusicText text={now || sub} />
                    </div>
                    {head && (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
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
                    <Sparkles className="mx-auto mb-2 text-gold" size={36} />
                    <div className="font-display text-4xl font-bold">Play anything</div>
                    <p className="mt-2 text-base text-ink-soft">
                      A chord you know, a song you play by ear, a random cluster. This shows its name and how it’s written, live.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {voicing && (
                <div className={`shrink-0 transition-opacity ${dim ? 'opacity-50' : ''}`} title="On guitar">
                  <GuitarDiagram voicing={voicing} size={92} />
                </div>
              )}
            </div>
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              {suggestions.length > 0 && (
                <>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-ink-mute">
                    {/* No key yet: say which key the suggestions assume. */}
                    Try next{!key && nextKey ? <MusicText text={` in ${keyName(nextKey)}`} /> : null}
                  </span>
                  {suggestions.map((s) => (
                    <motion.button
                      key={s.roman}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => playChord(s.chord)}
                      aria-label={`Try ${chordSymbol(s.chord)}, ${s.roman}: play it`}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-night-750 px-3 transition-colors hover:border-gold/50"
                    >
                      <span className="font-display text-lg font-bold">
                        <MusicText text={chordSymbol(s.chord)} />
                      </span>
                      <span className="text-xs font-bold text-[#c9c0ff]">
                        <MusicText text={s.roman} />
                      </span>
                    </motion.button>
                  ))}
                </>
              )}
              {/* Save that!: what you just played, kept as an idea (Enter does it too). Kept together, on the right. */}
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" icon={BookmarkPlus} onClick={saveThat} title="Keep what you just played (up to the last two minutes) as an idea (Enter)">
                  Save that!
                </Button>
                <span className="relative">
                  <IconButton icon={Lightbulb} label={`Your ideas (${ideaCount})`} size={44} onClick={() => setShowIdeas(true)} />
                  {ideaCount > 0 && (
                    <span className="pointer-events-none absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-gold text-[0.7rem] font-extrabold text-night-900">
                      {ideaCount}
                    </span>
                  )}
                </span>
                <span className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${sustain ? 'bg-teal/20 text-teal' : 'bg-white/5 text-ink-mute'}`}>
                  Pedal {sustain ? 'down' : 'up'}
                </span>
              </span>
            </div>
            <AnimatePresence>
              {discovered && (
                <motion.div
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-linear-to-r from-gold to-coral px-4 py-2 text-sm font-extrabold text-night-900 shadow-lg"
                >
                  <Wand2 size={18} /> New chord discovered: <MusicText text={discovered} /> · +5 XP
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* On the staff (the last chord, faded, once you let go) */}
          <Paper className="flex items-center">
            {/* The music fades, not the paper: a grey card would look switched off. */}
            <div className={`w-full transition-opacity ${!sound.all.length && last ? 'opacity-45' : ''}`}>
              <Staff clef="grand" items={staffItems} sp={short ? 13 : 16} minSlot={6} reserveAbove={reserve} reserveBelow={reserve} animate={false} />
            </div>
          </Paper>
        </div>

        <ChordChart
          entries={chart}
          chords={keyChords}
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
                  stopPlayback()
                  changeChart(undo)
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
          <Piano from={from} to={to} marks={marks} trails trailHeight={Math.max(60, areaH - pianoH - 30)} height={pianoH} minKeyWidth={20} octaveLabels={compact} />
        </div>
      </div>

      <Collection open={showCollection} onClose={() => setShowCollection(false)} found={found} />
      <IdeasSheet open={showIdeas} onClose={() => setShowIdeas(false)} />
    </div>
  )
}
