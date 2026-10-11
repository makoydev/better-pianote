import { Ear, Flame, Hand, ListMusic, Minus, Pause, Play, Plus, Repeat, RotateCcw, SkipBack, SkipForward, Type, Volume2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import type { LaidEvent, NoteState, StaffNoteSpec } from '../../components/staff/layout'
import { type ScoreLayout, colX } from '../../components/staff/score'
import { Button, IconButton } from '../../components/ui/Button'
import { Segmented, Slider, Toggle } from '../../components/ui/controls'
import { type Song, findSong } from '../../content/songs'
import { useElementSize } from '../../hooks/useElementSize'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playNotes } from '../../lib/audio/play'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { burst, celebrate } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { letterColor } from '../../lib/colors'
import { type Chord, bassFor, noteName, parseNote, voiceLead } from '../../lib/theory'
import { go } from '../../router'
import { useLive } from '../../state/live'
import { useLibrary } from '../../state/library'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { type SongResult, SongResults } from './SongResults'
import { type Cue, type Playhead, advance, buildCues, firstCueAt, ringingAt } from './listen'
import { type Run, carryOn, newRun, stepAt, stepsInBars } from './practice'
import { type Hands, accuracyOf, handsBest, recordSongRun, songKey, starsOf } from './results'
import { type Step, type TimedNote, barAt, buildSteps, buildTimeline, keyboardRange, songScoreInput } from './timeline'

const TICK = 0.25 // listen mode wakes up every sixteenth note (and plays what's due inside it at exact times)
const EPS = 1e-6

export function SongPlayer({ songId }: { songId: string }) {
  const builtIn = useMemo(() => findSong(songId), [songId])
  const mine = useLibrary((s) => s.entries.find((e) => e.id === songId)?.song ?? null)
  const libraryReady = useLibrary((s) => s.ready)
  const song = builtIn ?? mine
  if (!song && !libraryReady) {
    return (
      <div className="min-h-dvh">
        <TopBar back="/songs" title="Loading…" />
      </div>
    )
  }
  if (!song) {
    return (
      <div className="min-h-dvh">
        <TopBar back="/songs" title="Song not found" />
        <div className="mx-auto mt-16 max-w-md text-center">
          <p className="text-lg text-ink-soft">We couldn’t find that song.</p>
          <Button className="mt-6" icon={ListMusic} onClick={() => go('/songs')}>
            All songs
          </Button>
        </div>
      </div>
    )
  }
  return <Player song={song} />
}

function useViewportHeight() {
  const [h, setH] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return h
}

function Player({ song }: { song: Song }) {
  const tl = useMemo(() => buildTimeline(song), [song])
  const firstFullBar = song.pickup ? 1 : 0

  const [mode, setMode] = useState<'wait' | 'listen'>('wait')
  // Your own imports open with both hands (that's why you imported them); built-in songs start with the melody.
  const [hands, setHands] = useState<Hands>(() => (song.lh && (song.imported || !tl.notes.some((n) => n.hand === 'rh')) ? 'both' : 'rh'))
  const [loop, setLoop] = useState(false)
  const [loopBars, setLoopBars] = useState<[number, number]>([firstFullBar, Math.min(song.rh.length - 1, firstFullBar + 3)])
  const [backing, setBacking] = useState(true)
  const [bpm, setBpm] = useState(song.bpm)

  /** The part that plays: the whole song, or the looped bars. */
  const rangeOf = (on: boolean, bars: [number, number]): [number, number] => {
    if (!on) return [0, tl.total]
    const a = tl.bars[bars[0]]
    const b = tl.bars[bars[1]]
    return [a?.start ?? 0, b ? b.start + b.dur : tl.total]
  }
  const listenRange = () => rangeOf(loop, loopBars)

  // Wait mode
  const allSteps = useMemo(() => buildSteps(tl, hands), [tl, hands])
  const steps = useMemo(() => stepsInBars(allSteps, loop ? loopBars : null), [allSteps, loop, loopBars])
  const [stepIdx, setStepIdx] = useState(0)
  const [satisfied, setSatisfied] = useState<Set<number>>(() => new Set())
  const [mistakes, setMistakes] = useState(0)
  const [combo, setCombo] = useState(0)
  const [loops, setLoops] = useState(0)
  const [flash, setFlash] = useState<Record<number, 'good' | 'bad'>>({})
  /** The moment of the step where you just played a wrong note (it shakes red). */
  const [wrongAt, setWrongAt] = useState<number | null>(null)
  const [result, setResult] = useState<SongResult | null>(null)
  const [finished, setFinished] = useState(false)
  /** When the current stretch of practice started (null in Listen, or before the first right note). */
  const startedAt = useRef<number | null>(null)
  const [started, setStarted] = useState(false)
  const lastCorrectAt = useRef(0)
  const prevPad = useRef<number[] | null>(null)
  const run = useRef<Run>(newRun(hands))
  const sync = () => {
    const r = run.current
    setStepIdx(r.idx)
    setSatisfied(new Set(r.sat))
    setMistakes(r.mistakes)
    setCombo(r.combo)
    setLoops(r.loops)
  }

  // Listen mode (and Practice's "Hear this bar")
  const [playing, setPlaying] = useState(false)
  /** Where the listen-mode playhead is, in beats. */
  const [listenAt, setListenAt] = useState(0)
  const [sounding, setSounding] = useState<Record<number, 'rh' | 'lh'>>({})
  const clockRef = useRef<Clock | null>(null)
  /** Pending playhead/key-light updates, cancelled on pause. */
  const timers = useRef<number[]>([])
  const bpmRef = useRef(bpm)
  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  const mic = useLive((s) => s.mic)
  const staffLabels = useSettings((s) => s.staffLabels)
  const uiSounds = useSettings((s) => s.uiSounds)
  const setSettings = useSettings((s) => s.set)
  const best = useProgress((s) => handsBest(s.games, song.id, hands))

  const vh = useViewportHeight()
  const [viewRef, view] = useElementSize<HTMLDivElement>()
  const paperRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ScoreLayout | null>(null)
  const onLayout = useCallback((l: ScoreLayout) => setLayout(l), [])

  const step = mode === 'wait' && !finished ? steps[stepIdx] : undefined
  const cursorTime = mode === 'wait' ? (steps[stepIdx]?.start ?? tl.total) : listenAt

  const stopPlayback = useCallback(() => {
    clockRef.current?.stop()
    clockRef.current = null
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
    setPlaying(false)
    setSounding({})
  }, [])
  useEffect(() => stopPlayback, [stopPlayback])

  /** A fresh practice run from the first step. */
  const resetRun = (h = hands) => {
    run.current = newRun(h)
    sync()
    setFlash({})
    setWrongAt(null)
    setResult(null)
    setFinished(false)
    startedAt.current = null
    setStarted(false)
    prevPad.current = null
  }

  /** Start again: a fresh run, and Listen back to the start (of the loop, when looping). */
  const reset = (from = listenRange()[0]) => {
    stopPlayback()
    resetRun()
    setListenAt(from)
  }

  /**
   * Carry on from step i after switching modes or hands. Back on the first step it's a fresh run; a run that
   * jumps ahead (or starts part-way) or changes hands no longer counts as a best.
   */
  const moveTo = (i: number, h: Hands) => {
    if (i === 0 || run.current.done) resetRun(h)
    if (i === 0) return
    run.current = carryOn(run.current, i, h)
    sync()
    setFlash({})
    setWrongAt(null)
  }

  // ---- Backing chords (soft, below the melody) ----
  const padVoicing = (c: Chord, withBass: boolean) => {
    const tri = voiceLead(prevPad.current, c, { center: 55, low: 48, high: 62 })
    prevPad.current = tri
    return withBass ? [bassFor(c, 36), ...tri] : tri
  }

  // ---- Wait mode: check each note you play ----
  const flashKey = (m: number, kind: 'good' | 'bad') => {
    setFlash((f) => ({ ...f, [m]: kind }))
    window.setTimeout(
      () =>
        setFlash((f) => {
          const x = { ...f }
          delete x[m]
          return x
        }),
      kind === 'good' ? 260 : 420,
    )
  }

  const finish = () => {
    const r = run.current
    const accuracy = accuracyOf(r.notes, r.mistakes)
    const stars = starsOf(r.notes, r.mistakes)
    const seconds = (r.ms + (startedAt.current === null ? 0 : performance.now() - startedAt.current)) / 1000
    const prog = useProgress.getState()
    const first = r.whole && !prog.games[songKey(song.id)]
    // Notes you skipped or jumped past earn nothing.
    const total = steps.reduce((n, s) => n + s.notes.length, 0)
    const share = total ? Math.min(1, r.notes / total) : 1
    const xp = Math.round(((first ? 20 : 6) + stars * (first ? 5 : 2) + (hands === 'both' ? 10 : 0)) * share)
    prog.addXp(xp)
    const isBest = r.whole && recordSongRun(song.id, hands, Math.round(accuracy * 100))
    setResult({ stars, accuracy, mistakes: r.mistakes, seconds, xp, isBest, bestCombo: r.best, hands, whole: r.whole })
    setFinished(true)
    if (uiSounds) audio.ui('complete')
    if (stars === 3) celebrate()
    else burst(paperRef.current)
  }

  /** On to the next step: round again when looping, the results at the end. */
  const nextStep = () => {
    const r = run.current
    r.sat = new Set()
    if (r.idx + 1 < steps.length) {
      r.idx++
      return
    }
    if (loop) {
      r.idx = 0
      r.loops++
      burst(paperRef.current, { count: 30 })
      return
    }
    r.done = true
    finish()
  }

  const completeStep = (cur: Step) => {
    const r = run.current
    r.combo++
    r.best = Math.max(r.best, r.combo)
    if (backing && cur.chord && mic !== 'on') playNotes(padVoicing(cur.chord.chord, hands === 'rh'), { dur: 1.8, vel: 0.34, strum: 0.012 })
    nextStep()
  }

  /** Skip: on to the next step without playing it. It counts as a slip and breaks the combo. */
  const skip = () => {
    const r = run.current
    if (mode !== 'wait' || r.done || !steps[r.idx]) return
    r.mistakes++
    r.combo = 0
    nextStep()
    sync()
  }

  useNoteEvents((e) => {
    const r = run.current
    if (e.type !== 'on' || mode !== 'wait' || r.done) return
    const cur = steps[r.idx]
    if (!cur) return
    const strict = useSettings.getState().strictOctave
    const same = (a: number, b: number) => (strict ? a === b : (a - b) % 12 === 0)
    const hit = cur.notes.find((n) => !r.sat.has(n.id) && same(n.midi, e.midi))
    if (hit) {
      lastCorrectAt.current = performance.now()
      if (startedAt.current === null) {
        startedAt.current = performance.now()
        setStarted(true)
      }
      flashKey(e.midi, 'good')
      r.sat.add(hit.id)
      r.notes++
      if (r.sat.size >= cur.notes.length) completeStep(cur)
      sync()
      return
    }
    // Pressing a note you already got for this step again isn't a mistake.
    if (cur.notes.some((n) => r.sat.has(n.id) && same(n.midi, e.midi))) return
    // The mic can hear overtones of the note you just played; give it a moment.
    if (e.source === 'mic' && performance.now() - lastCorrectAt.current < 450) return
    r.mistakes++
    r.combo = 0
    sync()
    flashKey(e.midi, 'bad')
    setWrongAt(cur.start)
    window.setTimeout(() => setWrongAt(null), 420)
  })

  // ---- Playback on the audio clock: Listen mode, and "Hear this bar" in Practice ----
  const cues = useMemo(() => buildCues(tl), [tl])

  /**
   * Play [lo, hi) from `from`. Listen plays everything and moves the playhead; a bar heard in Practice plays only
   * the hands you're practising.
   */
  const startPlayback = ({ from, lo, hi, looping, bar }: { from: number; lo: number; hi: number; looping: boolean; bar: boolean }) => {
    stopPlayback()
    const head: Playhead = { pos: from, next: firstCueAt(cues, from) }
    const heard = (n: TimedNote) => !bar || hands === 'both' || n.hand === 'rh'
    const withChords = backing && !bar
    prevPad.current = null
    let first = true
    let ended = false
    const later = (when: number, fn: () => void) => timers.current.push(audio.at(when, fn))
    const delayTo = (when: number) => Math.max(0, when - audio.now - 0.03)
    const sound = (n: TimedNote, when: number, beats: number, spb: number) => {
      const dur = Math.max(0.12, beats * spb * 0.96)
      playNotes([n.midi], { dur, vel: n.hand === 'rh' ? 0.82 : 0.55, delay: delayTo(when) })
      later(when, () => setSounding((x) => ({ ...x, [n.midi]: n.hand })))
      later(when + dur, () =>
        setSounding((x) => {
          const y = { ...x }
          delete y[n.midi]
          return y
        }),
      )
    }
    const pad = (c: Chord, when: number, beats: number, spb: number) =>
      playNotes(padVoicing(c, !song.lh), { dur: beats * spb * 0.95, vel: 0.3, delay: delayTo(when) })
    // Nothing rings on past the part that plays (a tie into the next bar, the end of the loop).
    const play = (c: Cue, when: number, spb: number) => {
      for (const n of c.notes) if (heard(n)) sound(n, when, Math.min(n.dur, hi - c.t), spb)
      if (c.chord && withChords) pad(c.chord.chord, when, Math.min(c.chord.dur, hi - c.t), spb)
      if (c.col && !bar) later(when, () => setListenAt(c.t))
    }
    const clock = new Clock({
      interval: () => (60 / bpmRef.current) * TICK,
      onTick: (_i, time) => {
        if (ended) return
        const spb = 60 / bpmRef.current
        if (first) {
          first = false
          // Starting in the middle: bring in what's still ringing there (a held bass note, the chord).
          for (const n of ringingAt(tl, from)) if (heard(n)) sound(n, time, Math.min(n.start + n.dur, hi) - from, spb)
          const ch = tl.chords.find((c) => c.start < from - EPS && c.start + c.dur > from + EPS)
          if (ch && withChords) pad(ch.chord, time, Math.min(ch.start + ch.dur, hi) - from, spb)
        }
        const { due, end } = advance(cues, head, TICK, lo, hi, looping)
        for (const d of due) play(d.cue, time + d.offset * spb, spb)
        if (end !== undefined) {
          // The end: stop, and (in Listen) rewind so Play starts from the top next time.
          ended = true
          later(time + end * spb + 0.5, () => {
            clock.stop()
            clockRef.current = null
            timers.current = []
            setPlaying(false)
            setSounding({})
            if (!bar) setListenAt(lo)
          })
        }
      },
    })
    clockRef.current = clock
    if (!bar) setListenAt(from)
    clock.start(0.2)
    setPlaying(true)
  }

  /** Play from `from`, or carry on from the playhead (back to the start if it's outside the part that plays). */
  const startListen = (from?: number) => {
    const [lo, hi] = listenRange()
    let pos = from ?? listenAt
    if (pos < lo - EPS || pos >= hi - EPS) pos = lo
    startPlayback({ from: pos, lo, hi, looping: loop, bar: false })
  }

  const toggleListen = () => (playing ? stopPlayback() : startListen())
  const listenFromStart = () => startListen(listenRange()[0])
  /** Paused somewhere after the start, so Play carries on from there. */
  const pausedMidway = mode === 'listen' && !playing && listenAt > listenRange()[0] + EPS

  /** Hear this bar: the bar you're on, at your tempo, with the hands you're practising. */
  const hearBar = () => {
    const r = run.current
    const cur = steps[r.idx]
    if (mode !== 'wait' || r.done || !cur) return
    const b = tl.bars[cur.bar]
    startPlayback({ from: b.start, lo: b.start, hi: b.start + b.dur, looping: false, bar: true })
  }

  /** Start again (R): Listen goes back to the beginning (still playing if it was); Practice starts a fresh run. */
  const restart = () => (mode === 'listen' && playing ? listenFromStart() : reset())

  // Space plays/pauses in Listen and plays the bar in Practice; R starts again. Not while typing or on a slider,
  // and Space is left to a focused button (keyboard users press it to click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || isTypingTarget(e.target)) return
      if (e.code === 'Space') {
        if (isButtonTarget(e.target)) return
        e.preventDefault()
        if (mode === 'listen') toggleListen()
        else hearBar()
      } else if (e.code === 'KeyR') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- Notation ----
  const scoreInput = useMemo(() => songScoreInput(song, tl, { hands }), [song, tl, hands])
  const noteById = useMemo(() => new Map(tl.notes.map((n) => [n.id, n])), [tl])
  const cur = mode === 'wait' && !finished ? steps[stepIdx] : undefined
  const loopFrom = loop ? (tl.bars[loopBars[0]]?.start ?? 0) : 0
  const noteState = (spec: StaffNoteSpec): NoteState | undefined => {
    const n = spec.id === undefined ? undefined : noteById.get(spec.id)
    if (!n) return undefined
    if (mode === 'listen') return playing && listenAt >= n.start - EPS && listenAt < n.start + n.dur - EPS ? 'active' : undefined
    if (finished) return 'done'
    if (!cur) return undefined
    // A note two voices share is one key in the step, so both noteheads light up together.
    const key = !n.cont && Math.abs(n.start - cur.start) < EPS ? cur.notes.find((x) => x.midi === n.midi) : undefined
    if (key) {
      if (satisfied.has(key.id)) return 'done'
      return wrongAt !== null && Math.abs(wrongAt - cur.start) < EPS ? 'wrong' : 'active'
    }
    if (n.start < cur.start - EPS) return n.start < loopFrom - EPS ? undefined : 'done'
    return undefined
  }
  const eventState = (e: LaidEvent): NoteState | undefined => {
    if (mode === 'listen' || e.start === undefined) return undefined
    if (finished) return 'done'
    if (!cur) return undefined
    if (e.start < cur.start - EPS) return e.start < loopFrom - EPS ? undefined : 'done'
    return undefined
  }

  const showBass = hands === 'both' && !!song.lh
  const sp = Math.round(Math.max(12, Math.min(22, vh / 46)) * (showBass ? 0.8 : 1))
  const cursorX = layout ? colX(layout, cursorTime) : 0
  const scrollX = useMemo(() => {
    if (!layout || !view.width) return 0
    const max = Math.max(0, layout.width + 32 - view.width)
    return Math.max(0, Math.min(max, cursorX - view.width * 0.33))
  }, [layout, view.width, cursorX])
  // Long pieces only draw what's on screen (plus a screen either side while it scrolls).
  const clip: [number, number] | undefined = view.width ? [scrollX - view.width, scrollX + 2 * view.width] : undefined

  // ---- Keyboard ----
  const range = useMemo(
    () => keyboardRange(tl.notes.filter((n) => mode === 'listen' || hands === 'both' || n.hand === 'rh').map((n) => n.midi)),
    [tl, hands, mode],
  )
  const marks: Marks = {}
  const fingers: Record<number, number> = {}
  if (step) {
    for (const n of step.notes) {
      if (satisfied.has(n.id)) continue
      marks[n.midi] = n.hand === 'rh' ? 'target' : { kind: 'root', label: 'L' }
      if (n.finger) fingers[n.midi] = n.finger
    }
  }
  for (const [m, hand] of Object.entries(sounding)) marks[Number(m)] = hand === 'rh' ? 'chord' : 'root'
  for (const [m, f] of Object.entries(flash)) marks[Number(m)] = f
  const pianoHeight = Math.round(Math.max(110, Math.min(210, vh * (showBass ? 0.18 : 0.21))))

  const barLabel = (i: number) => (song.pickup ? (i === 0 ? 'Pickup' : `${i}`) : `${i + 1}`)
  const barName = (i: number) => (i < firstFullBar ? 'the pickup' : `bar ${i - firstFullBar + 1}`)
  const fullBars = song.rh.length - firstFullBar
  const curBar = mode === 'wait' ? (steps[stepIdx]?.bar ?? song.rh.length - 1) : barAt(tl, listenAt)
  const progress = mode === 'wait' ? (finished ? 1 : stepIdx / Math.max(1, steps.length)) : tl.total ? Math.min(1, listenAt / tl.total) : 0

  // Switching modes or hands keeps your place in the piece.
  const changeMode = (m: 'wait' | 'listen') => {
    if (m === mode) return
    stopPlayback()
    if (m === 'listen') {
      // Listen starts from the step you're on; the practice clock stops meanwhile.
      const r = run.current
      if (startedAt.current !== null) {
        r.ms += performance.now() - startedAt.current
        startedAt.current = null
      }
      setListenAt(!r.done && r.idx > 0 ? (steps[r.idx]?.start ?? 0) : listenRange()[0])
    } else {
      // Practice carries on from the first step at or after where Listen got to.
      moveTo(stepAt(steps, listenAt, loop), hands)
    }
    setMode(m)
  }
  const changeHands = (h: Hands) => {
    if (h === hands) return
    if (mode === 'wait') {
      // Keep your bar: the first step at or after this moment, in the new hands' steps.
      stopPlayback()
      const r = run.current
      const at = r.done || r.idx === 0 ? listenRange()[0] : (steps[r.idx]?.start ?? 0)
      moveTo(stepAt(stepsInBars(buildSteps(tl, h), loop ? loopBars : null), at, loop), h)
    }
    setHands(h)
  }
  const changeLoop = (on: boolean) => {
    reset(rangeOf(on, loopBars)[0])
    setLoop(on)
  }
  const changeLoopBars = (b: [number, number]) => {
    reset(rangeOf(loop, b)[0])
    setLoopBars(b)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        back="/songs"
        title={song.title}
        subtitle={`${song.composer} · ${song.keyName} · ${song.time[0]}/${song.time[1]}`}
      >
        <IconButton icon={RotateCcw} label="Start again (R)" onClick={restart} />
        <IconButton
          icon={Type}
          label={staffLabels ? 'Hide note names' : 'Show note names'}
          onClick={() => setSettings({ staffLabels: !staffLabels })}
          className={staffLabels ? '!border-gold/40 !text-gold' : ''}
        />
      </TopBar>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2.5 px-3 pb-3 pt-3 sm:px-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <Segmented
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'wait', label: <span className="inline-flex items-center gap-1.5"><Hand size={18} /> Practice</span> },
              { value: 'listen', label: <span className="inline-flex items-center gap-1.5"><Ear size={18} /> Listen</span> },
            ]}
          />
          {song.lh && (
            <Segmented
              value={hands}
              onChange={changeHands}
              options={[
                { value: 'rh', label: 'Right hand' },
                { value: 'both', label: 'Both hands' },
              ]}
            />
          )}
          {mode === 'wait' && (
            <div className="flex items-center gap-2">
              <Button size="lg" variant="secondary" icon={Volume2} onClick={hearBar} disabled={!step} title="Hear this bar at your tempo (Space)">
                Hear this bar
              </Button>
              <Button size="lg" variant="secondary" icon={SkipForward} onClick={skip} disabled={!step} title="Skip this note (counts as a wrong note)">
                Skip
              </Button>
            </div>
          )}
          {mode === 'listen' && (
            <>
              <div className="flex items-center gap-2">
                <IconButton icon={SkipBack} size={56} label="Restart: play from the beginning" onClick={listenFromStart} />
                <Button
                  icon={playing ? Pause : Play}
                  onClick={toggleListen}
                  variant={playing ? 'secondary' : 'primary'}
                  className="min-w-38"
                >
                  {playing ? 'Pause' : pausedMidway ? 'Resume' : 'Play'}
                </Button>
              </div>
              <label className="flex w-44 items-center gap-3 rounded-2xl border border-white/8 bg-night-850 px-3 py-2">
                <span className="w-16 shrink-0 text-sm font-extrabold text-ink-soft">♩ = {bpm}</span>
                <Slider value={bpm} min={40} max={160} onChange={setBpm} label="Tempo" />
              </label>
            </>
          )}
          {tl.chords.length > 0 && (
            <label className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-night-850 px-3 py-2">
              <Toggle checked={backing && !(mode === 'wait' && mic === 'on')} onChange={setBacking} label="Backing chords" />
              <span className="text-sm font-extrabold text-ink-soft">Chords</span>
            </label>
          )}
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-night-850 px-3 py-2">
            <Toggle checked={loop} onChange={changeLoop} label="Loop some bars" />
            <Repeat size={18} className={loop ? 'text-gold' : 'text-ink-mute'} />
            {loop ? (
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                <Stepper
                  label="First bar"
                  text={barLabel(loopBars[0])}
                  onMinus={() => changeLoopBars([Math.max(0, loopBars[0] - 1), loopBars[1]])}
                  onPlus={() => changeLoopBars([Math.min(loopBars[1], loopBars[0] + 1), loopBars[1]])}
                />
                <span className="text-ink-mute">to</span>
                <Stepper
                  label="Last bar"
                  text={barLabel(loopBars[1])}
                  onMinus={() => changeLoopBars([loopBars[0], Math.max(loopBars[0], loopBars[1] - 1)])}
                  onPlus={() => changeLoopBars([loopBars[0], Math.min(song.rh.length - 1, loopBars[1] + 1)])}
                />
              </span>
            ) : (
              <span className="text-sm font-extrabold text-ink-soft">Loop</span>
            )}
          </div>
        </div>

        {/* The music tape */}
        <div ref={paperRef} className="relative">
          <div ref={viewRef} className="paper relative overflow-hidden rounded-3xl pb-2 pt-1">
            <motion.div
              className="w-max px-4"
              initial={false}
              animate={{ x: -scrollX }}
              transition={{ type: 'spring', stiffness: 110, damping: 22, mass: 0.9 }}
            >
              <ScoreStaff
                input={scoreInput}
                sp={sp}
                cursorTime={cursorTime}
                noteState={noteState}
                eventState={eventState}
                clip={clip}
                onLayout={onLayout}
                reserveBelow={showBass ? 1.2 : 2.5}
                title={showBass ? song.title : `${song.title}, right hand`}
              />
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-paper to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-paper to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-night-900/10">
              <motion.div
                className="h-full rounded-r-full bg-linear-to-r from-gold to-coral"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        </div>

        {/* What to play next, and how it's going */}
        <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          {mode === 'wait' && step ? (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={stepIdx}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">{!started && stepIdx === 0 ? 'Play to start' : 'Next'}</span>
                {step.notes.map((n) => (
                  <NotePill key={n.id} note={n} done={satisfied.has(n.id)} />
                ))}
              </motion.div>
            </AnimatePresence>
          ) : mode === 'wait' && finished ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3">
              <span className="text-base font-extrabold text-good">Finished!</span>
              <Button size="sm" icon={RotateCcw} onClick={() => reset()}>
                Play again
              </Button>
            </motion.div>
          ) : mode === 'listen' ? (
            <span className="text-base font-semibold text-ink-soft">
              {playing
                ? 'Watch the notes light up and follow along.'
                : pausedMidway
                  ? `Resume (or Space) plays from ${barName(barAt(tl, listenAt))}; ⏮ plays it from the beginning.`
                  : 'Press Play (or Space) to hear it at your tempo.'}
            </span>
          ) : null}
          {mode === 'wait' && mic === 'on' && <span className="text-sm text-sky">Mic: play one note at a time.</span>}
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {mode === 'wait' && (
              <AnimatePresence>
                {combo >= 3 && (
                  <motion.span
                    key={combo}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-3 py-1 text-sm font-extrabold text-coral"
                  >
                    <Flame size={16} className="animate-flicker" /> {combo} in a row
                  </motion.span>
                )}
              </AnimatePresence>
            )}
            {mode === 'wait' && loop && loops > 0 && <span className="text-sm font-extrabold text-teal">Loop ×{loops}</span>}
            <span className="text-sm font-extrabold text-ink-soft">
              {curBar < firstFullBar ? 'Pickup' : `Bar ${curBar - firstFullBar + 1} of ${fullBars}`}
            </span>
            {mode === 'wait' && (
              <span className={`inline-flex items-center gap-1 text-sm font-extrabold ${mistakes ? 'text-bad' : 'text-ink-mute'}`} title="Wrong notes">
                <X size={16} strokeWidth={3} /> {mistakes}
              </span>
            )}
            {best > 0 && <span className="text-sm font-bold text-ink-mute">Best {best}%</span>}
          </div>
        </div>

        <div className="mt-auto">
          <Piano from={range.from} to={range.to} marks={marks} fingers={fingers} height={pianoHeight} sparks sparkHeight={110} />
        </div>
      </main>

      <SongResults
        song={song}
        result={result}
        onAgain={() => reset()}
        onClose={() => setResult(null)}
        onSongs={() => go('/songs')}
      />
    </div>
  )
}

function Stepper({ label, text, onMinus, onPlus }: { label: string; text: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <IconButton icon={Minus} label={`${label} earlier`} size={30} onClick={onMinus} />
      <span className="min-w-[3.2rem] text-center">{text}</span>
      <IconButton icon={Plus} label={`${label} later`} size={30} onClick={onPlus} />
    </span>
  )
}

function NotePill({ note, done }: { note: TimedNote; done: boolean }) {
  const n = parseNote(note.name)
  const color = letterColor(n.letter)
  return (
    <motion.span
      layout
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-lg font-extrabold transition-opacity ${done ? 'opacity-40' : ''}`}
      style={{ color, borderColor: `${color}66`, background: `${color}1c` }}
    >
      <MusicText text={noteName(n)} />
      {note.hand === 'lh' && <span className="rounded-md bg-white/10 px-1.5 text-xs text-ink-soft">left hand</span>}
      {note.finger !== undefined && (
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-sm text-night-900" title="Finger">
          {note.finger}
        </span>
      )}
    </motion.span>
  )
}
