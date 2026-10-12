import { Check, ChevronLeft, ChevronRight, Drum, Eraser, Info, Minus, Play, Plus, Repeat, Square, Target, Timer, Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Segmented, Slider, Toggle } from '../../components/ui/controls'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playNotes } from '../../lib/audio/play'
import { type Chord, bassFor, chordPcs, chordSymbol, mod, parseNote, pcOf, pitchName, voiceProgression } from '../../lib/theory'
import { heldMidis, useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { spellVoicing } from './chordTools'
import { hat, kick, snare } from './drums'
import {
  MAX_CHORDS,
  PALETTE_GROUPS,
  PRESETS,
  type PatternId,
  cardKeys,
  drumHits,
  isMinorProgression,
  isProgression,
  jamChords,
  jamTonic,
  moveAt,
  nashville,
  patternHits,
  removeAt,
  replaceAt,
  romanLabel,
  sameRomans,
} from './jam'
import { OctavePicker } from './OctavePicker'
import { useMicChords } from '../../lib/input/mic'

const tonicPc = (name: string) => pcOf(parseNote(name))

const RIVER = PRESETS.find((p) => p.id === 'river')!
/** Your own progression (after any edit), kept in "jam:romans"; presets always use their own chords. */
const CUSTOM = 'custom'
const PRESET_IDS = [...PRESETS.map((p) => p.id), CUSTOM]
const KEYS = Array.from({ length: 12 }, (_, pc) => pc)
const FEELS: PatternId[] = ['block', 'fingerstyle', 'ballad']
const NO_CHORDS: string[] = []
const UNDO_STEPS = 30

interface Pos {
  /** Chord index, or -1 during the count-in. */
  chord: number
  beat: number
}

/** What Undo puts back: the progression on screen, your own one, and the settings a load can change. */
interface Snapshot {
  presetId: string
  own: string[]
  tonic: number
  bpm: number
  pattern: PatternId
  perChord: 8 | 4
}

export function ProgressionJam() {
  const [presetId, setPresetId] = usePref('jam:preset', RIVER.id, PRESET_IDS)
  const [ownRomans, setOwnRomans] = usePref<string[]>('jam:romans', NO_CHORDS)
  const [tonic, setTonic] = usePref('jam:tonic', tonicPc(RIVER.tonic), KEYS)
  const [savedBpm, setBpm] = usePref('jam:bpm', 76)
  const bpm = Math.min(160, Math.max(50, savedBpm))
  const [pattern, setPattern] = usePref<PatternId>('jam:feel', 'ballad', FEELS)
  const [drums, setDrums] = usePref('jam:drums', false)
  const [loop, setLoop] = usePref('jam:loop', true)
  const [countIn, setCountIn] = usePref('jam:count-in', true)
  const [perChord, setPerChord] = usePref<8 | 4>('jam:chord-length', 8, [8, 4])
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [focus, setFocus] = useState(0)
  // The card being edited: numerals then replace it, and ◀ ▶ move it.
  const [selected, setSelected] = useState<number | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  // Set when editing a preset replaced the progression under Yours, to offer Undo.
  const [replaced, setReplaced] = useState(false)

  const preset = PRESETS.find((p) => p.id === presetId) ?? null
  const own = isProgression(ownRomans) ? ownRomans : NO_CHORDS
  const romans = preset ? preset.romans : own
  const minor = useMemo(() => isMinorProgression(romans), [romans])
  const tonicName = (pc: number) => pitchName(jamTonic(pc, minor))
  const chords = useMemo(() => jamChords(romans, tonic, minor), [romans, tonic, minor])
  const paletteChords = useMemo(() => {
    const all = PALETTE_GROUPS.flatMap((g) => g.romans)
    const cs = jamChords(all, tonic, minor)
    return Object.fromEntries(all.map((r, i) => [r, cs[i]]))
  }, [tonic, minor])
  const voicings = useMemo(() => voiceProgression(chords, { center: 64, low: 57, high: 79 }), [chords])
  const basses = useMemo(() => chords.map((c) => bassFor(c, 40)), [chords])
  const pcsList = useMemo(() => chords.map((c) => chordPcs(c)), [chords])

  // The scheduler reads the latest settings on every tick, so changes apply while playing.
  const live = useRef({ voicings, basses, pcsList, pattern, drums, loop, perChord, bpm })
  useEffect(() => {
    live.current = { voicings, basses, pcsList, pattern, drums, loop, perChord, bpm }
  })

  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])
  const stop = useCallback(() => {
    clock.current?.stop()
    clock.current = null
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPlaying(false)
    setPos(null)
  }, [])
  useEffect(() => stop, [stop])

  const start = () => {
    if (!romans.length) return
    stop()
    const countTicks = countIn ? 8 : 0
    const ui = (time: number, fn: () => void) => {
      timers.current = [...timers.current.slice(-40), audio.at(time, fn)]
    }
    const c = new Clock({
      interval: () => 60 / live.current.bpm / 2,
      onTick: (i, time) => {
        const L = live.current
        const tick = 60 / L.bpm / 2
        if (i < countTicks) {
          if (i % 2 === 0) {
            audio.click(i === 0, time + 0.03)
            ui(time, () => setPos({ chord: -1, beat: i / 2 }))
          }
          return
        }
        const n = L.voicings.length
        if (!n) return
        const j = i - countTicks
        const chordNo = Math.floor(j / L.perChord)
        if (!L.loop && chordNo >= n) {
          clock.current?.stop()
          ui(time + tick, stop)
          return
        }
        const ci = chordNo % n
        const t = j % L.perChord
        for (const h of patternHits(L.pattern, L.voicings[ci], L.basses[ci], L.pcsList[ci], L.perChord)) {
          if (h.tick === t) playNotes(h.notes, { delay: Math.max(0, time - audio.now), dur: h.dur * tick, vel: h.vel })
        }
        if (L.drums) {
          const d = drumHits(j)
          if (d.kick) kick(time + 0.03)
          if (d.snare) snare(time + 0.03, 0.9)
          hat(time + 0.03, d.hat)
        }
        if (t % 2 === 0) ui(time, () => setPos({ chord: ci, beat: t / 2 }))
      },
    })
    clock.current = c
    c.start(0.15)
    setPlaying(true)
  }

  const remember = () => setHistory((h) => [...h.slice(1 - UNDO_STEPS), { presetId, own, tonic, bpm, pattern, perChord }])
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setPresetId(last.presetId)
    setOwnRomans(last.own)
    setTonic(last.tonic)
    setBpm(last.bpm)
    setPattern(last.pattern)
    setPerChord(last.perChord)
    setSelected(null)
    setReplaced(false)
    const back = PRESETS.find((p) => p.id === last.presetId)?.romans ?? last.own
    setFocus((f) => Math.min(f, Math.max(0, back.length - 1)))
    if (!back.length) stop()
  }

  const choosePreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    if (id !== presetId || tonicPc(p.tonic) !== tonic) remember()
    setPresetId(id)
    setTonic(tonicPc(p.tonic))
    setFocus(0)
    setSelected(null)
    setReplaced(false)
  }
  const chooseYours = () => {
    if (presetId === CUSTOM) return
    remember()
    setPresetId(CUSTOM)
    setFocus(0)
    setSelected(null)
    setReplaced(false)
  }
  /** Any change to the chords makes them your own progression ("Yours"). */
  const edit = (next: string[]) => {
    remember()
    // Editing a preset copies it into Yours, replacing what was there: offer Undo when that loses something.
    setReplaced(presetId !== CUSTOM && own.length > 0 && !sameRomans(own, romans))
    setPresetId(CUSTOM)
    setOwnRomans(next)
    setFocus((f) => Math.min(f, Math.max(0, next.length - 1)))
    if (!next.length) stop()
  }
  const tapCard = (i: number) => {
    setFocus(i)
    if (playing) return
    setSelected((s) => (s === i ? null : i))
    playNotes([basses[i], ...voicings[i]], { dur: 1.6, strum: 0.03 })
  }
  const removeCard = (i: number) => {
    edit(removeAt(romans, i))
    setSelected((s) => (s === null || s === i ? null : s > i ? s - 1 : s))
  }
  const moveCard = (i: number, by: -1 | 1) => {
    edit(moveAt(romans, i, by))
    setSelected(i + by)
    setFocus(i + by)
  }
  /** A numeral chip: replaces the selected chord, or adds one at the end. */
  const pickChip = (r: string, c: Chord) => {
    if (selected !== null && selected < romans.length && !playing) edit(replaceAt(romans, selected, r))
    else edit([...romans, r])
    playNotes([bassFor(c, 40), ...voiceProgression([c], { center: 64, low: 57, high: 79 })[0]], { dur: 1.2, strum: 0.02 })
  }

  const n = chords.length
  const editing = !playing && selected !== null && selected < n ? selected : null
  const keys = cardKeys(romans)
  const cur = pos && pos.chord >= 0 ? pos.chord : Math.min(focus, Math.max(0, n - 1))
  const next = n ? (cur + 1) % n : 0
  const beats = perChord / 2
  const lastBeat = !!pos && pos.chord >= 0 && pos.beat === beats - 1 && (loop || cur < n - 1)

  const marks: Record<number, KeyMark> = {}
  if (n) {
    const rhNotes = spellVoicing(chords[cur], voicings[cur])
    voicings[cur].forEach((m, i) => (marks[m] = { kind: 'chord', label: pitchName(rhNotes[i]) }))
    marks[basses[cur]] = { kind: 'root', label: pitchName(chords[cur].bass ?? chords[cur].root) }
    if (lastBeat && next !== cur) {
      const nextNotes = spellVoicing(chords[next], voicings[next])
      voicings[next].forEach((m, i) => {
        if (!(m in marks)) marks[m] = { kind: 'hint', label: pitchName(nextNotes[i]) }
      })
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <TopBar
        back="/explore"
        title="Progression Jam"
        subtitle={<MusicText text={`${preset ? preset.name : 'Your progression'} · key of ${tonicName(tonic)}${minor ? ' minor' : ''}`} />}
      />
      <main className="mx-auto grid max-w-[1500px] gap-5 px-3 pt-5 sm:px-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-5">
          <Card>
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {own.length > 0 && <PresetChip name="Yours" romans={own} active={presetId === CUSTOM} onClick={chooseYours} />}
              {PRESETS.map((p) => (
                <PresetChip key={p.id} name={p.name} romans={p.romans} active={p.id === presetId} onClick={() => choosePreset(p.id)} />
              ))}
            </div>
            <p className="mt-3 min-h-6 text-ink-soft">
              {preset ? <MusicText text={preset.about} /> : 'Your own progression. Tap a chord to change or move it, or a numeral below to add one.'}
            </p>
            <AnimatePresence>
              {replaced && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 py-1.5 pl-4 pr-1.5">
                    <span className="min-w-0 flex-1 font-bold text-ink-soft">That replaced your earlier progression under Yours.</span>
                    <Button size="sm" variant="secondary" icon={Undo2} onClick={undo}>
                      Undo
                    </Button>
                    <IconButton icon={X} label="Dismiss" size={44} onClick={() => setReplaced(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* On narrower screens the controls column sits below, so keep the essentials up here. */}
          <div className="flex items-center gap-3 xl:hidden">
            {playing ? (
              <Button size="lg" variant="danger" icon={Square} onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button size="lg" icon={Play} onClick={start} disabled={!n}>
                Jam
              </Button>
            )}
            <IconButton icon={Minus} label="Slower" size={44} onClick={() => setBpm(Math.max(50, bpm - 4))} />
            <span className="w-16 text-center font-display text-2xl font-bold">{bpm}</span>
            <IconButton icon={Plus} label="Faster" size={44} onClick={() => setBpm(Math.min(160, bpm + 4))} />
            <span className="text-sm font-extrabold text-ink-mute">BPM</span>
          </div>

          <div className="relative">
            <AnimatePresence>
              {pos?.chord === -1 && (
                <motion.div
                  key={`count-${pos.beat}`}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-night-900/70 font-display text-8xl font-bold text-gold"
                >
                  {pos.beat + 1}
                </motion.div>
              )}
            </AnimatePresence>
            {n === 0 ? (
              <Card className="flex min-h-40 items-center justify-center text-center text-lg text-ink-mute">Tap the numerals below to build a progression.</Card>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                {chords.map((ch, i) => {
                  const isCur = i === cur
                  const isNext = playing && i === next && lastBeat
                  const isSel = i === editing
                  return (
                    <motion.div
                      key={keys[i]}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: isCur && playing ? 1.05 : 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                      className={`relative overflow-hidden rounded-3xl border transition-colors ${
                        isSel
                          ? 'border-gold bg-gold/15 shadow-[0_0_0_2px_#ffc857]'
                          : isCur
                            ? 'border-gold bg-gold/15 shadow-[0_0_44px_-10px_#ffc857]'
                            : isNext
                              ? 'border-white/40 bg-night-700'
                              : 'border-white/8 bg-night-800/85 hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => tapCard(i)}
                        aria-pressed={playing ? undefined : isSel}
                        aria-label={`Chord ${i + 1}: ${chordSymbol(ch)}`}
                        className="block w-full p-4 pr-12 text-left"
                      >
                        <span className="text-xs font-extrabold text-ink-mute">{i + 1}</span>
                        <span className="block font-display text-4xl font-bold leading-tight">
                          <MusicText text={chordSymbol(ch)} />
                        </span>
                        <span className="mt-1 block text-sm font-extrabold">
                          <span className="text-gold">
                            <MusicText text={romanLabel(romans[i])} />
                          </span>
                          <span className="text-ink-mute">
                            {' · '}
                            <MusicText text={nashville(romans[i])} />
                          </span>
                        </span>
                      </button>
                      {isSel && (
                        <div className="flex gap-2 px-3 pb-3">
                          <IconButton icon={ChevronLeft} label={`Move chord ${i + 1} earlier`} size={44} disabled={i === 0} onClick={() => moveCard(i, -1)} />
                          <IconButton icon={ChevronRight} label={`Move chord ${i + 1} later`} size={44} disabled={i === n - 1} onClick={() => moveCard(i, 1)} />
                        </div>
                      )}
                      {isCur && playing && (
                        <div className="absolute inset-x-0 bottom-0 flex gap-1 px-4 pb-2">
                          {Array.from({ length: beats }, (_, b) => (
                            <span key={b} className={`h-1.5 flex-1 rounded-full ${pos && b <= pos.beat ? 'bg-gold' : 'bg-white/15'}`} />
                          ))}
                        </div>
                      )}
                      {!playing && (
                        <button
                          type="button"
                          aria-label={`Remove chord ${i + 1}`}
                          title="Remove"
                          onClick={() => removeCard(i)}
                          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-ink-mute hover:bg-white/10 hover:text-ink"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <Card className="pt-4">
            <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-ink-mute">
                {lastBeat ? 'Next chord coming up: the outlined keys' : 'Play along: right hand on the lit keys, left hand on the root'}
              </div>
              <PlayAlong pcs={n ? pcsList[cur] : []} />
            </div>
            {/* Names only on the chord's keys, spelled for the chord: you play along by them, so not reading help. */}
            <Piano from={36} to={84} marks={marks} labels="marked" sparks sparkHeight={110} height={170} octaveLabels />
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">Build your own</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={Undo2} disabled={!history.length} onClick={undo}>
                  Undo
                </Button>
                <Button variant="ghost" size="sm" icon={Eraser} disabled={!romans.length} onClick={() => edit([])}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 font-bold text-ink-soft">
              {editing !== null ? (
                <>
                  <span className="min-w-0 flex-1">
                    <MusicText text={`Tap a numeral to replace chord ${editing + 1} (${chordSymbol(chords[editing])}).`} />
                  </span>
                  <Button size="sm" variant="secondary" icon={Check} onClick={() => setSelected(null)}>
                    Done
                  </Button>
                </>
              ) : (
                <span>{romans.length >= MAX_CHORDS ? `That’s ${MAX_CHORDS} chords, the most a progression can hold.` : 'Tap a numeral to add it at the end.'}</span>
              )}
            </div>
            <div className="space-y-3">
              {PALETTE_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-mute">{g.title}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.romans.map((r) => {
                      const c = paletteChords[r]
                      return (
                        <motion.button
                          key={r}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          disabled={editing === null && romans.length >= MAX_CHORDS}
                          onClick={() => pickChip(r, c)}
                          className="flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-night-750 px-3 py-1.5 transition-colors hover:border-gold/50 disabled:opacity-40"
                        >
                          <span className="text-sm font-extrabold text-gold">
                            <MusicText text={romanLabel(r)} />
                          </span>
                          <span className="font-display text-lg font-bold">
                            <MusicText text={chordSymbol(c)} />
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex gap-2 text-sm text-ink-mute">
              <Info size={16} className="mt-0.5 shrink-0" />
              <MusicText
                text={
                  'Numerals count up the major scale of the key: uppercase = major chord, lowercase = minor. ♭ numerals borrow chords from the minor key, ' +
                  'and II and III are major chords that pull to V and vi. A slash puts a chord note in the bass: I/3 is the I chord over its 3rd (C/E in C).'
                }
              />
            </p>
          </Card>
        </section>

        <aside className="flex flex-col gap-5">
          <Card className="space-y-5 xl:sticky xl:top-24">
            <div className="flex items-center gap-3">
              {playing ? (
                <Button size="xl" variant="danger" icon={Square} block onClick={stop}>
                  Stop
                </Button>
              ) : (
                <Button size="xl" icon={Play} block onClick={start} disabled={!n}>
                  Jam
                </Button>
              )}
            </div>
            <div className="flex justify-center gap-2" aria-hidden>
              {Array.from({ length: beats }, (_, b) => (
                <motion.span
                  key={b}
                  animate={{ scale: pos && pos.beat === b ? 1.35 : 1, opacity: pos && pos.beat === b ? 1 : 0.35 }}
                  transition={{ duration: 0.12 }}
                  className={`size-4 rounded-full ${b === 0 ? 'bg-gold' : 'bg-violet'}`}
                />
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between">
                <span className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
                  <Timer size={16} /> Tempo
                </span>
                <span className="font-display text-4xl font-bold leading-none">
                  {bpm}
                  <span className="ml-1 font-sans text-sm font-extrabold text-ink-mute">BPM</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <IconButton icon={Minus} label="Slower" size={44} onClick={() => setBpm(Math.max(50, bpm - 4))} />
                <Slider value={bpm} min={50} max={160} onChange={setBpm} label="Tempo" />
                <IconButton icon={Plus} label="Faster" size={44} onClick={() => setBpm(Math.min(160, bpm + 4))} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Feel</div>
              <Segmented
                value={pattern}
                onChange={setPattern}
                className="w-full"
                options={[
                  { value: 'block', label: 'Strum' },
                  { value: 'fingerstyle', label: 'Fingerstyle' },
                  { value: 'ballad', label: 'Ballad' },
                ]}
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Each chord lasts</div>
              <Segmented
                value={perChord}
                onChange={(v) => {
                  setPerChord(v)
                  if (playing) window.setTimeout(start, 0)
                }}
                className="w-full"
                options={[
                  { value: 8, label: '1 bar' },
                  { value: 4, label: '2 beats' },
                ]}
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 font-extrabold text-ink-soft">
                <span className="flex items-center gap-2">
                  <Drum size={18} /> Drums
                </span>
                <Toggle checked={drums} onChange={setDrums} label="Drums" />
              </label>
              <label className="flex items-center justify-between gap-3 font-extrabold text-ink-soft">
                <span className="flex items-center gap-2">
                  <Repeat size={18} /> Loop
                </span>
                <Toggle checked={loop} onChange={setLoop} label="Loop" />
              </label>
              <label className="flex items-center justify-between gap-3 font-extrabold text-ink-soft">
                <span className="flex items-center gap-2">
                  <Timer size={18} /> Count in
                </span>
                <Toggle checked={countIn} onChange={setCountIn} label="Count in" />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">Key</span>
                <div className="flex items-center gap-2">
                  <IconButton icon={Minus} label="Transpose down a half step" size={48} onClick={() => setTonic((tonic + 11) % 12)} />
                  <span className="w-12 text-center font-display text-2xl font-bold">
                    <MusicText text={tonicName(tonic)} />
                  </span>
                  <IconButton icon={Plus} label="Transpose up a half step" size={48} onClick={() => setTonic((tonic + 1) % 12)} />
                </div>
              </div>
              <OctavePicker value={tonic} onChange={setTonic} height={96} label="Key" names={(p) => ({ main: tonicName(p) })} />
            </div>
          </Card>
        </aside>
      </main>
    </div>
  )
}

/** A preset (or your own progression) in the strip at the top: its name and first few numerals. */
function PresetChip({ name, romans, active, onClick }: { name: string; romans: string[]; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-colors ${
        active ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
      }`}
    >
      <span className="block text-base font-extrabold leading-tight">{name}</span>
      <span className={`block text-xs font-bold ${active ? 'text-night-700' : 'text-ink-mute'}`}>
        <MusicText text={romans.slice(0, 4).map(romanLabel).join('–') + (romans.length > 4 ? '…' : '')} />
      </span>
    </motion.button>
  )
}

/** Tells you if what you're holding fits the current chord. */
function PlayAlong({ pcs }: { pcs: number[] }) {
  // Through the mic, listen for whole chords to check what you play along.
  useMicChords()
  const held = useLive((s) => s.held)
  const heldPcs = new Set(heldMidis(held).map((m) => mod(m, 12)))
  if (!heldPcs.size || !pcs.length) return null
  const target = new Set(pcs)
  const allIn = [...heldPcs].every((p) => target.has(p))
  const full = allIn && pcs.slice(0, 3).every((p) => heldPcs.has(p))
  const [cls, Icon, text] = full
    ? ['bg-good/15 text-good', Target, 'Spot on!']
    : allIn
      ? ['bg-teal/15 text-teal', Check, 'Chord tones']
      : ['bg-white/8 text-ink-mute', Info, 'Try the lit keys']
  return (
    <motion.span
      key={text}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold ${cls}`}
    >
      <Icon size={16} /> {text}
    </motion.span>
  )
}
