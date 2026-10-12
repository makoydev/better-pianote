import { BookmarkPlus, Check, ChevronLeft, ChevronRight, Eraser, Info, Library, Minus, Play, Plus, SlidersHorizontal, Square, Target, Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { useElementSize } from '../../hooks/useElementSize'
import { useHandsFree } from '../../hooks/useHandsFree'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playNotes } from '../../lib/audio/play'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import { type Chord, bassFor, chordPcs, chordSymbol, mod, parseNote, pcOf, pitchName, voiceProgression } from '../../lib/theory'
import { heldMidis, useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { spellVoicing } from './chordTools'
import { hat, kick, snare } from './drums'
import {
  CHORD_LENGTHS,
  type ChordLength,
  FEEL_IDS,
  MAX_CHORDS,
  PALETTE_GROUPS,
  PRESETS,
  type PatternId,
  accented,
  cardKeys,
  chordTicks,
  clampJamBpm,
  drumHits,
  isMinorProgression,
  isProgression,
  jamChords,
  jamTonic,
  lengthsFor,
  meterOf,
  moveAt,
  nashville,
  patternHits,
  removeAt,
  replaceAt,
  romanLabel,
  sameRomans,
} from './jam'
import { MIC_CHORD_DELAY, heardTime } from './heard'
import { type SavedProgression, findByRomans, freeName, newSavedId, readSaved, removeFrom, saveTo } from './jamLibrary'
import { JamSettings } from './JamSettings'
import { type JamPos, JamStage, type LoopScore, MicNote, ScorePill, Verdict } from './JamStage'
import { MyProgressions } from './MyProgressions'
import { ChordJudge, type Played, earlyGrace, neededTones } from './playAlong'

const tonicPc = (name: string) => pcOf(parseNote(name))

const RIVER = PRESETS.find((p) => p.id === 'river')!
/** Your own progression (after any edit), kept in "jam:romans"; presets always use their own chords. */
const CUSTOM = 'custom'
const PRESET_IDS = [...PRESETS.map((p) => p.id), CUSTOM]
const KEYS = Array.from({ length: 12 }, (_, pc) => pc)
const NO_CHORDS: string[] = []
const UNDO_STEPS = 30

/** What Undo puts back: the progression on screen, your own one, and the settings a load can change. */
interface Snapshot {
  presetId: string
  own: string[]
  tonic: number
  bpm: number
  pattern: PatternId
  length: ChordLength
}

export function ProgressionJam() {
  const [presetId, setPresetId] = usePref('jam:preset', RIVER.id, PRESET_IDS)
  const [ownRomans, setOwnRomans] = usePref<string[]>('jam:romans', NO_CHORDS)
  const [tonic, setTonic] = usePref('jam:tonic', tonicPc(RIVER.tonic), KEYS)
  const [savedBpm, setBpm] = usePref('jam:bpm', 76)
  const bpm = clampJamBpm(savedBpm)
  const [pattern, setPattern] = usePref<PatternId>('jam:feel', 'ballad', FEEL_IDS)
  const [drums, setDrums] = usePref('jam:drums', false)
  // Sit the band's bass or chords out to play that part yourself.
  const [bassOn, setBassOn] = usePref('jam:bass', true)
  const [chordsOn, setChordsOn] = usePref('jam:chords', true)
  const [loop, setLoop] = usePref('jam:loop', true)
  const [countIn, setCountIn] = usePref('jam:count-in', true)
  const [savedLength, setLength] = usePref<ChordLength>('jam:chord-length', 8, CHORD_LENGTHS)
  const meter = meterOf(pattern)
  // "2 beats" only fits 4/4; the saved choice comes back when you return to a 4/4 feel.
  const length = lengthsFor(meter).includes(savedLength) ? savedLength : 8
  const perChord = chordTicks(length, meter)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState<JamPos | null>(null)
  const [focus, setFocus] = useState(0)
  // The card being edited: numerals then replace it, and ◀ ▶ move it.
  const [selected, setSelected] = useState<number | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  // Set when editing a preset (or loading a saved one) replaced an unsaved progression under Yours, to offer Undo.
  const [replaced, setReplaced] = useState(false)
  const [savedRaw, setSaved] = usePref<unknown>('jam:saved', [])
  const saved = useMemo(() => readSaved(savedRaw), [savedRaw])
  const [library, setLibrary] = useState<'browse' | 'save' | null>(null)
  // Below xl the settings live in a sheet, so the keyboard stays on screen.
  const [sheet, setSheet] = useState(false)
  const [kbArea, { height: kbH }] = useElementSize<HTMLDivElement>()
  const strip = useRef<HTMLDivElement>(null)
  // Playing along: the chords you've played in this pass (✓), how you came in on the latest, and each pass's score.
  const [judge] = useState(() => new ChordJudge())
  const [ticks, setTicks] = useState<{ loop: number; byIndex: Record<number, Played> }>({ loop: 0, byIndex: {} })
  const [lastPlayed, setLastPlayed] = useState<(Played & { id: number }) | null>(null)
  const [loopScore, setLoopScore] = useState<LoopScore | null>(null)
  const timedRun = useRef(true)
  const usb = useLive((s) => s.midi === 'ready' && s.midiDevices.length > 0)
  const micOn = useLive((s) => s.mic === 'on')

  const preset = PRESETS.find((p) => p.id === presetId) ?? null
  const own = isProgression(ownRomans) ? ownRomans : NO_CHORDS
  const romans = preset ? preset.romans : own
  // Yours goes by its saved name once you've saved it.
  const ownName = findByRomans(saved, own)?.name
  // Your progression is safe to replace when it's empty or saved under a name.
  const ownAtRisk = own.length > 0 && !ownName
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
  const needs = useMemo(() => chords.map((c) => ({ need: neededTones(c, false), needMic: neededTones(c, true) })), [chords])

  // The scheduler reads the latest settings on every tick, so changes apply while playing.
  const live = useRef({ voicings, basses, pcsList, needs, pattern, drums, bassOn, chordsOn, loop, length, bpm, countIn })
  useEffect(() => {
    live.current = { voicings, basses, pcsList, needs, pattern, drums, bassOn, chordsOn, loop, length, bpm, countIn }
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

  /** Start the band (or restart it, e.g. in a new metre). Reads its settings from `live`, which handlers update first. */
  const start = () => {
    if (!romans.length) return
    stop()
    setSelected(null)
    // The metre can only change with a restart, so it's fixed for this run.
    const m = meterOf(live.current.pattern)
    const countTicks = live.current.countIn ? m.bar : 0
    const ui = (time: number, fn: () => void) => {
      timers.current = [...timers.current.slice(-40), audio.at(time, fn)]
    }
    judge.reset()
    timedRun.current = true
    setTicks({ loop: 0, byIndex: {} })
    setLastPlayed(null)
    setLoopScore(null)
    /** Score a finished pass once the music gets there (notes up to then still count). */
    const scoreAt = (time: number, loopNo: number) =>
      ui(time, () => setLoopScore({ loop: loopNo, ...judge.score(loopNo), timed: timedRun.current }))
    const c = new Clock({
      interval: () => 60 / live.current.bpm / m.beat,
      onTick: (i, time) => {
        const L = live.current
        const tick = 60 / L.bpm / m.beat
        if (i < countTicks) {
          if (i % m.count === 0) {
            const count = i / m.count
            audio.click(accented(m, count), time + 0.03)
            ui(time, () => setPos({ chord: -1, beat: count, count }))
          }
          return
        }
        const n = L.voicings.length
        if (!n) return
        const per = chordTicks(L.length, m)
        const j = i - countTicks
        const chordNo = Math.floor(j / per)
        if (!L.loop && chordNo >= n) {
          clock.current?.stop()
          scoreAt(time, 0)
          ui(time + tick, stop)
          return
        }
        const ci = chordNo % n
        const t = j % per
        if (t === 0) {
          // Each chord as the band plays it, for ticking off yours; a new pass scores the one before.
          const loopNo = Math.floor(chordNo / n)
          if (ci === 0 && loopNo > 0) {
            scoreAt(time, loopNo - 1)
            // A chord you came in on a moment early already counts for the new pass.
            ui(time, () => setTicks({ loop: loopNo, byIndex: judge.played(loopNo) }))
          }
          judge.setGrace(earlyGrace(60 / L.bpm))
          judge.add({ loop: loopNo, index: ci, start: time, need: L.needs[ci].need, needMic: L.needs[ci].needMic, tones: L.pcsList[ci] })
        }
        for (const h of patternHits(L.pattern, L.voicings[ci], L.basses[ci], L.pcsList[ci], per)) {
          if (h.tick !== t || !(h.part === 'bass' ? L.bassOn : L.chordsOn)) continue
          playNotes(h.notes, { delay: Math.max(0, time - audio.now), dur: h.dur * tick, vel: h.vel })
        }
        if (L.drums) {
          const d = drumHits(j, m.id)
          if (d.kick) kick(time + 0.03)
          // A waltz keeps its 2 and 3 light.
          if (d.snare) snare(time + 0.03, m.id === '3/4' ? 0.5 : 0.9)
          hat(time + 0.03, d.hat)
        }
        if (t % m.count === 0) ui(time, () => setPos({ chord: ci, beat: t / m.count, count: (j % m.bar) / m.count }))
      },
    })
    clock.current = c
    c.start(0.15)
    setPlaying(true)
    // Show the count-in (or the first chord) right away, before the first click arrives.
    setFocus(0)
    setPos(countTicks ? { chord: -1, beat: -1, count: -1 } : null)
  }

  /** Hand new settings to a playing band at once; a new metre or chord length restarts it, so the bars line up. */
  const retune = (patch: { pattern?: PatternId; length?: ChordLength }) => {
    const before = live.current
    const after = { ...before, ...patch }
    live.current = after
    const grid = (s: typeof before) => `${meterOf(s.pattern).id}:${chordTicks(s.length, meterOf(s.pattern))}`
    if (playing && grid(after) !== grid(before)) start()
  }
  const changeFeel = (p: PatternId) => {
    setPattern(p)
    retune({ pattern: p })
  }
  const changeLength = (v: ChordLength) => {
    setLength(v)
    retune({ length: v })
  }

  const remember = () => setHistory((h) => [...h.slice(1 - UNDO_STEPS), { presetId, own, tonic, bpm, pattern, length: savedLength }])
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setPresetId(last.presetId)
    setOwnRomans(last.own)
    setTonic(last.tonic)
    setBpm(last.bpm)
    setPattern(last.pattern)
    setLength(last.length)
    setSelected(null)
    setReplaced(false)
    const back = PRESETS.find((p) => p.id === last.presetId)?.romans ?? last.own
    setFocus((f) => Math.min(f, Math.max(0, back.length - 1)))
    if (!back.length) stop()
    else retune({ pattern: last.pattern, length: last.length })
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
    setReplaced(presetId !== CUSTOM && ownAtRisk && !sameRomans(own, romans))
    setPresetId(CUSTOM)
    setOwnRomans(next)
    setFocus((f) => Math.min(f, Math.max(0, next.length - 1)))
    if (!next.length) stop()
  }
  /** Bring back a saved progression with its key, tempo, feel and chord length. */
  const loadSaved = (p: SavedProgression) => {
    remember()
    setReplaced(ownAtRisk && !sameRomans(own, p.romans))
    setPresetId(CUSTOM)
    setOwnRomans(p.romans)
    setTonic(p.tonic)
    setBpm(p.bpm)
    setPattern(p.feel)
    setLength(p.length)
    setFocus(0)
    setSelected(null)
    setLibrary(null)
    retune({ pattern: p.feel, length: p.length })
  }
  const saveCurrent = (name: string) =>
    setSaved(saveTo(saved, { name, romans: [...romans], tonic, bpm, feel: pattern, length: savedLength }, newSavedId()))
  const tapCard = (i: number) => {
    setFocus(i)
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
    if (selected !== null && selected < romans.length) edit(replaceAt(romans, selected, r))
    else edit([...romans, r])
    playNotes([bassFor(c, 40), ...voiceProgression([c], { center: 64, low: 57, high: 79 })[0]], { dur: 1.2, strum: 0.02 })
  }

  const n = chords.length
  const dialog = library !== null || sheet
  // Space starts and stops the band. Letter keys play notes on the computer keyboard, so they're left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isPlainKey(e) || dialog) return
      // The tempo slider keeps focus after a drag but has no use for Space; a button focused with Tab takes it as a click.
      const slider = e.target instanceof HTMLInputElement && e.target.type === 'range'
      if ((isTypingTarget(e.target) && !slider) || isButtonTarget(e.target)) return
      e.preventDefault()
      if (playing) stop()
      else start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Enter, a deliberate pedal tap or the top C starts the band. Never stops it: you pedal while you play.
  useHandsFree(playing || !n || dialog ? null : start)

  // Tick off the chords you play along. The mic hears chords too late to judge the beat, so it only ticks them.
  useNoteEvents((e) => {
    if (e.type !== 'on' || !playing) return
    const mic = e.source === 'mic'
    const p = judge.note(e.midi, heardTime(e.time) - (mic ? MIC_CHORD_DELAY : 0), heldNow(), { mic, timed: !mic })
    if (!p) return
    if (mic) timedRun.current = false
    setTicks((tk) => (tk.loop === p.loop ? { loop: tk.loop, byIndex: { ...tk.byIndex, [p.index]: p } } : tk))
    setLastPlayed({ ...p, id: e.time })
  })

  const editing = !playing && selected !== null && selected < n ? selected : null
  const keys = cardKeys(romans)
  const cur = pos && pos.chord >= 0 ? pos.chord : Math.min(focus, Math.max(0, n - 1))
  const next = n ? (cur + 1) % n : 0
  const beats = perChord / meter.count
  const hasNext = loop || cur < n - 1
  const lastBeat = !!pos && pos.chord >= 0 && pos.beat === beats - 1 && hasNext

  // Keep the chord that's playing in view in the strip.
  useEffect(() => {
    if (!playing) return
    strip.current?.querySelector(`[data-chord="${cur}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [playing, cur])

  // While the band plays, the keyboard gets the height that's left, so all of it stays on screen.
  const pianoH = playing ? Math.round(Math.max(110, Math.min(210, kbH - 30))) : 170

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

  const settings = (
    <JamSettings
      bpm={bpm}
      setBpm={setBpm}
      pattern={pattern}
      onFeel={changeFeel}
      length={length}
      onLength={changeLength}
      bassOn={bassOn}
      setBassOn={setBassOn}
      chordsOn={chordsOn}
      setChordsOn={setChordsOn}
      drums={drums}
      setDrums={setDrums}
      loop={loop}
      setLoop={setLoop}
      countIn={countIn}
      setCountIn={setCountIn}
      tonic={tonic}
      setTonic={setTonic}
      tonicName={tonicName}
    />
  )

  return (
    <div className={playing ? 'flex h-dvh flex-col' : 'min-h-dvh pb-10'}>
      <TopBar
        back="/explore"
        title="Progression Jam"
        subtitle={<MusicText text={`${preset ? preset.name : (ownName ?? 'Your progression')} · key of ${tonicName(tonic)}${minor ? ' minor' : ''}`} />}
      />
      <main
        className={`mx-auto grid w-full max-w-[1500px] px-3 sm:px-5 xl:grid-cols-[minmax(0,1fr)_380px] ${
          playing ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 py-3 sm:py-4' : 'gap-5 pt-5'
        }`}
      >
        <section className={`flex min-w-0 flex-col ${playing ? 'min-h-0 gap-3' : 'gap-5'}`}>
          {!playing && (
            <Card>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {own.length > 0 && <PresetChip name={ownName ?? 'Yours'} romans={own} active={presetId === CUSTOM} onClick={chooseYours} />}
                {PRESETS.map((p) => (
                  <PresetChip key={p.id} name={p.name} romans={p.romans} active={p.id === presetId} onClick={() => choosePreset(p.id)} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <p className="min-h-6 min-w-0 flex-1 basis-64 text-ink-soft">
                  {preset ? <MusicText text={preset.about} /> : 'Your own progression. Tap a chord to change or move it, or a numeral below to add one.'}
                </p>
                <Button size="sm" variant="secondary" icon={Library} onClick={() => setLibrary('browse')}>
                  My progressions{saved.length ? ` (${saved.length})` : ''}
                </Button>
              </div>
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
                      <span className="min-w-0 flex-1 font-bold text-ink-soft">That replaced your unsaved progression under Yours.</span>
                      <Button size="sm" variant="secondary" icon={Undo2} onClick={undo}>
                        Undo
                      </Button>
                      <IconButton icon={X} label="Dismiss" size={44} onClick={() => setReplaced(false)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {/* Below xl the settings column is a sheet, so the essentials stay up here. */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 xl:hidden">
            {playing ? (
              <Button size="lg" variant="danger" icon={Square} onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button size="lg" icon={Play} onClick={start} disabled={!n}>
                Jam
              </Button>
            )}
            <div className="flex items-center gap-2">
              <IconButton icon={Minus} label="Slower" size={48} onClick={() => setBpm(clampJamBpm(bpm - 4))} />
              <span className="w-12 text-center font-display text-2xl font-bold">{bpm}</span>
              <IconButton icon={Plus} label="Faster" size={48} onClick={() => setBpm(clampJamBpm(bpm + 4))} />
              <span className="text-sm font-extrabold text-ink-mute">BPM</span>
            </div>
            <Button size="lg" variant="secondary" icon={SlidersHorizontal} className="ml-auto" onClick={() => setSheet(true)}>
              Settings
            </Button>
          </div>

          {playing && n > 0 && (
            <>
              <JamStage chords={chords} romans={romans} pos={pos} cur={cur} next={next} hasNext={hasNext} lastBeat={lastBeat} meter={meter} beats={beats}>
                <div className="flex flex-wrap items-center gap-2">
                  {lastPlayed && <Verdict key={lastPlayed.id} played={lastPlayed} chord={chords[lastPlayed.index]} />}
                  {loopScore && <ScorePill score={loopScore} label={`Loop ${loopScore.loop + 1}`} />}
                </div>
                {micOn && !usb && (
                  <div className="mt-2">
                    <MicNote />
                  </div>
                )}
              </JamStage>
              <div ref={strip} className="scrollbar-none -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 pt-2.5">
                {chords.map((ch, i) => {
                  const done = ticks.byIndex[i]
                  return (
                    <div
                      key={keys[i]}
                      data-chord={i}
                      className={`relative flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-1.5 transition-colors ${
                        i === cur && pos && pos.chord >= 0
                          ? 'border-gold bg-gold/15 shadow-[0_0_24px_-8px_#ffc857]'
                          : i === next && lastBeat
                            ? 'border-white/40 bg-night-700'
                            : 'border-white/8 bg-night-800/85'
                      }`}
                    >
                      {done && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full text-night-900 ${
                            done.timing === 'early' || done.timing === 'late' ? 'bg-gold' : 'bg-good'
                          }`}
                          title={done.timing === null ? 'Played' : done.timing === 'on' ? 'Played on the beat' : `Played, a little ${done.timing}`}
                        >
                          <Check size={15} strokeWidth={3} />
                        </motion.span>
                      )}
                      <span className="font-display text-2xl font-bold leading-tight">
                        <MusicText text={chordSymbol(ch)} />
                      </span>
                      <span className="text-xs font-extrabold text-gold">
                        <MusicText text={romanLabel(romans[i])} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!playing &&
            (n === 0 ? (
              <Card className="flex min-h-40 items-center justify-center text-center text-lg text-ink-mute">Tap the numerals below to build a progression.</Card>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                {chords.map((ch, i) => {
                  const isSel = i === editing
                  return (
                    <motion.div
                      key={keys[i]}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                      className={`relative overflow-hidden rounded-3xl border transition-colors ${
                        isSel
                          ? 'border-gold bg-gold/15 shadow-[0_0_0_2px_#ffc857]'
                          : i === cur
                            ? 'border-gold/60 bg-gold/8'
                            : 'border-white/8 bg-night-800/85 hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => tapCard(i)}
                        aria-pressed={isSel}
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
                      <button
                        type="button"
                        aria-label={`Remove chord ${i + 1}`}
                        title="Remove"
                        onClick={() => removeCard(i)}
                        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-ink-mute hover:bg-white/10 hover:text-ink"
                      >
                        <X size={18} />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            ))}

          {!playing && (
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">Build your own</h2>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" icon={Undo2} disabled={!history.length} onClick={undo}>
                    Undo
                  </Button>
                  <Button variant="ghost" size="sm" icon={Eraser} disabled={!romans.length} onClick={() => edit([])}>
                    Clear
                  </Button>
                  <Button variant="ghost" size="sm" icon={BookmarkPlus} disabled={!romans.length} onClick={() => setLibrary('save')}>
                    Save
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
          )}

          <Card className={`pt-4 ${playing ? 'flex min-h-0 flex-1 flex-col pb-3' : ''}`}>
            <div className="mb-3 flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-ink-mute">
                {lastBeat ? 'Next chord coming up: the outlined keys' : 'Play along: right hand on the lit keys, left hand on the root'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* After a run, how the last pass went. */}
                {!playing && loopScore && <ScorePill score={loopScore} label="Last time" />}
                <PlayAlong pcs={n ? pcsList[cur] : []} />
              </div>
            </div>
            <div ref={kbArea} className={playing ? 'flex min-h-0 flex-1 flex-col justify-end-safe' : ''}>
              {/* Names only on the chord's keys, spelled for the chord: you play along by them, so not reading help. */}
              <Piano from={36} to={84} marks={marks} labels="marked" sparks sparkHeight={110} height={pianoH} minKeyWidth={24} octaveLabels />
            </div>
          </Card>
        </section>

        <aside className={`hidden min-h-0 xl:block ${playing ? 'overflow-y-auto' : ''}`}>
          <Card className={`space-y-5 ${playing ? '' : 'xl:sticky xl:top-24'}`}>
            {playing ? (
              <Button size="xl" variant="danger" icon={Square} block onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button size="xl" icon={Play} block onClick={start} disabled={!n}>
                Jam
              </Button>
            )}
            <p className="-mt-2 text-center text-sm font-bold text-ink-mute">Space starts and stops the band; a tap of the pedal starts it.</p>
            {settings}
          </Card>
        </aside>
      </main>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Jam settings">
        {settings}
      </Modal>

      <MyProgressions
        open={library !== null}
        onClose={() => setLibrary(null)}
        saved={saved}
        current={romans.length ? { romans, tonic, bpm, feel: pattern, length: savedLength } : null}
        suggestedName={ownName ?? (preset ? `${preset.name} in ${tonicName(tonic)}${minor ? ' minor' : ''}` : freeName(saved))}
        focusName={library === 'save'}
        onSave={saveCurrent}
        onLoad={loadSaved}
        onDelete={(id) => setSaved(removeFrom(saved, id))}
      />
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
