import { Ear, Flame, Hand, ListMusic, Minus, Pause, Play, Plus, Repeat, RotateCcw, Type, X } from 'lucide-react'
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
import { burst, celebrate } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { letterColor } from '../../lib/colors'
import { type Chord, bassFor, noteName, parseNote, voiceLead } from '../../lib/theory'
import { go } from '../../router'
import { useLive } from '../../state/live'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { type SongResult, SongResults } from './SongResults'
import { type ChordChange, type TimedNote, barAt, buildSteps, buildTimeline, keyboardRange, songScoreInput } from './timeline'

const TICK = 0.25 // listen-mode scheduling grid: one sixteenth note
const EPS = 1e-6

export function SongPlayer({ songId }: { songId: string }) {
  const song = useMemo(() => findSong(songId), [songId])
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
  const [hands, setHands] = useState<'rh' | 'both'>('rh')
  const [loop, setLoop] = useState(false)
  const [loopBars, setLoopBars] = useState<[number, number]>([firstFullBar, Math.min(song.rh.length - 1, firstFullBar + 3)])
  const [backing, setBacking] = useState(true)
  const [bpm, setBpm] = useState(song.bpm)

  // Wait mode
  const allSteps = useMemo(() => buildSteps(tl, hands), [tl, hands])
  const steps = useMemo(
    () => (loop ? allSteps.filter((s) => s.bar >= loopBars[0] && s.bar <= loopBars[1]) : allSteps),
    [allSteps, loop, loopBars],
  )
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
  const startedAt = useRef<number | null>(null)
  const [started, setStarted] = useState(false)
  const lastCorrectAt = useRef(0)
  const prevPad = useRef<number[] | null>(null)
  /** Wait-mode progress, updated synchronously so fast repeated notes are judged in order. */
  const run = useRef({ idx: 0, sat: new Set<number>(), mistakes: 0, combo: 0, best: 0, loops: 0, done: false })
  const sync = () => {
    const r = run.current
    setStepIdx(r.idx)
    setSatisfied(new Set(r.sat))
    setMistakes(r.mistakes)
    setCombo(r.combo)
    setLoops(r.loops)
  }

  // Listen mode
  const [playing, setPlaying] = useState(false)
  /** Where the listen-mode playhead is, in beats. */
  const [listenAt, setListenAt] = useState(0)
  const [sounding, setSounding] = useState<Record<number, 'rh' | 'lh'>>({})
  const clockRef = useRef<Clock | null>(null)
  const bpmRef = useRef(bpm)
  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  const mic = useLive((s) => s.mic)
  const staffLabels = useSettings((s) => s.staffLabels)
  const uiSounds = useSettings((s) => s.uiSounds)
  const setSettings = useSettings((s) => s.set)
  const best = useProgress((s) => s.games[`song-${song.id}`]?.best ?? 0)

  const vh = useViewportHeight()
  const [viewRef, view] = useElementSize<HTMLDivElement>()
  const paperRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ScoreLayout | null>(null)
  const onLayout = useCallback((l: ScoreLayout) => setLayout(l), [])

  const step = mode === 'wait' && !finished ? steps[stepIdx] : undefined
  const cursorTime = mode === 'wait' ? (steps[stepIdx]?.start ?? tl.total) : listenAt

  const stopListen = useCallback(() => {
    clockRef.current?.stop()
    clockRef.current = null
    setPlaying(false)
    setSounding({})
  }, [])
  useEffect(() => () => clockRef.current?.stop(), [])

  const reset = () => {
    stopListen()
    run.current = { idx: 0, sat: new Set(), mistakes: 0, combo: 0, best: 0, loops: 0, done: false }
    sync()
    setFlash({})
    setWrongAt(null)
    setResult(null)
    setFinished(false)
    setListenAt(loop ? (tl.bars[loopBars[0]]?.start ?? 0) : 0)
    startedAt.current = null
    setStarted(false)
    prevPad.current = null
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
    const total = steps.length
    const accuracy = total / (total + r.mistakes)
    const stars = r.mistakes === 0 ? 3 : accuracy >= 0.85 ? 2 : 1
    const seconds = startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0
    const prog = useProgress.getState()
    const key = `song-${song.id}`
    const first = !prog.games[key]
    const xp = (first ? 20 : 6) + stars * (first ? 5 : 2) + (hands === 'both' ? 10 : 0)
    prog.addXp(xp)
    const { isBest } = prog.recordGame(key, Math.round(accuracy * 100))
    setResult({ stars, accuracy, mistakes: r.mistakes, seconds, xp, isBest, bestCombo: r.best, hands })
    setFinished(true)
    if (uiSounds) audio.ui('complete')
    if (stars === 3) celebrate()
    else burst(paperRef.current)
  }

  const completeStep = (cur: (typeof steps)[number]) => {
    const r = run.current
    r.combo++
    r.best = Math.max(r.best, r.combo)
    r.sat = new Set()
    if (backing && cur.chord && mic !== 'on') playNotes(padVoicing(cur.chord.chord, hands === 'rh'), { dur: 1.8, vel: 0.34, strum: 0.012 })
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

  // ---- Listen mode: the app plays it, on the audio clock ----
  const schedule = useMemo(() => {
    const map = new Map<number, { notes: TimedNote[]; chord?: ChordChange; at?: number }>()
    const slot = (t: number) => {
      const k = Math.round(t / TICK)
      let s = map.get(k)
      if (!s) map.set(k, (s = { notes: [] }))
      return s
    }
    for (const n of tl.notes) if (!n.cont) slot(n.start).notes.push(n)
    for (const c of tl.chords) slot(c.start).chord = c
    for (const c of tl.cols) slot(c).at = c
    return map
  }, [tl])

  const startListen = () => {
    stopListen()
    const from = loop ? tl.bars[loopBars[0]] : tl.bars[0]
    const last = loop ? tl.bars[loopBars[1]] : tl.bars[tl.bars.length - 1]
    const fromTick = Math.round(from.start / TICK)
    const toTick = Math.round((last.start + last.dur) / TICK)
    const span = Math.max(1, toTick - fromTick)
    const looping = loop
    const withChords = backing
    prevPad.current = null
    const clock = new Clock({
      interval: () => (60 / bpmRef.current) * TICK,
      onTick: (i, time) => {
        let k = fromTick + i
        if (looping) k = fromTick + (i % span)
        else if (k >= toTick) {
          if (k === toTick)
            audio.at(time + 0.5, () => {
              clock.stop()
              setPlaying(false)
              setSounding({})
            })
          return
        }
        const s = schedule.get(k)
        if (!s) return
        const spb = 60 / bpmRef.current
        const delay = Math.max(0, time - audio.now - 0.03)
        for (const n of s.notes) {
          const dur = Math.max(0.12, n.dur * spb * 0.96)
          playNotes([n.midi], { dur, vel: n.hand === 'rh' ? 0.82 : 0.55, delay })
          audio.at(time, () => setSounding((x) => ({ ...x, [n.midi]: n.hand })))
          audio.at(time + dur, () =>
            setSounding((x) => {
              const y = { ...x }
              delete y[n.midi]
              return y
            }),
          )
        }
        if (s.chord && withChords) playNotes(padVoicing(s.chord.chord, !song.lh), { dur: s.chord.dur * spb * 0.95, vel: 0.3, delay })
        if (s.at !== undefined) {
          const at = s.at
          audio.at(time, () => setListenAt(at))
        }
      },
    })
    clockRef.current = clock
    clock.start(0.2)
    setPlaying(true)
  }

  const toggleListen = () => (playing ? stopListen() : startListen())

  // Space plays/pauses in Listen mode; R restarts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.repeat || !t || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName)) return
      if (e.code === 'Space' && mode === 'listen') {
        e.preventDefault()
        toggleListen()
      }
      if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) reset()
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
    if (cur.notes.includes(n)) {
      if (satisfied.has(n.id)) return 'done'
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
  if (mode === 'listen') for (const [m, hand] of Object.entries(sounding)) marks[Number(m)] = hand === 'rh' ? 'chord' : 'root'
  for (const [m, f] of Object.entries(flash)) marks[Number(m)] = f
  const pianoHeight = Math.round(Math.max(110, Math.min(210, vh * (showBass ? 0.18 : 0.21))))

  const barLabel = (i: number) => (song.pickup ? (i === 0 ? 'Pickup' : `${i}`) : `${i + 1}`)
  const fullBars = song.rh.length - firstFullBar
  const curBar = mode === 'wait' ? (steps[stepIdx]?.bar ?? song.rh.length - 1) : barAt(tl, listenAt)
  const progress = mode === 'wait' ? (finished ? 1 : stepIdx / Math.max(1, steps.length)) : tl.total ? Math.min(1, listenAt / tl.total) : 0

  const changeMode = (m: 'wait' | 'listen') => {
    reset()
    setMode(m)
  }
  const changeHands = (h: 'rh' | 'both') => {
    reset()
    setHands(h)
  }
  const changeLoop = (on: boolean) => {
    reset()
    setLoop(on)
  }
  const changeLoopBars = (b: [number, number]) => {
    reset()
    setLoopBars(b)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        back="/songs"
        title={song.title}
        subtitle={`${song.composer} · ${song.keyName} · ${song.time[0]}/${song.time[1]}`}
      >
        <IconButton icon={RotateCcw} label="Start again (R)" onClick={reset} />
        <IconButton
          icon={Type}
          label={staffLabels ? 'Hide note names' : 'Show note names'}
          onClick={() => setSettings({ staffLabels: !staffLabels })}
          className={staffLabels ? '!border-gold/40 !text-gold' : ''}
        />
      </TopBar>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2.5 px-3 pb-3 pt-3 sm:px-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
          {mode === 'listen' && (
            <>
              <Button size="md" icon={playing ? Pause : Play} onClick={toggleListen} variant={playing ? 'secondary' : 'primary'}>
                {playing ? 'Pause' : 'Play'}
              </Button>
              <label className="flex w-52 items-center gap-3 rounded-2xl border border-white/8 bg-night-850 px-3 py-2">
                <span className="w-16 shrink-0 text-sm font-extrabold text-ink-soft">♩ = {bpm}</span>
                <Slider value={bpm} min={40} max={160} onChange={setBpm} label="Tempo" />
              </label>
            </>
          )}
          <label className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-night-850 px-3 py-2">
            <Toggle checked={backing && !(mode === 'wait' && mic === 'on')} onChange={setBacking} label="Backing chords" />
            <span className="text-sm font-extrabold text-ink-soft">Chords</span>
          </label>
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
              <Button size="sm" icon={RotateCcw} onClick={reset}>
                Play again
              </Button>
            </motion.div>
          ) : mode === 'listen' ? (
            <span className="text-base font-semibold text-ink-soft">
              {playing ? 'Watch the notes light up and follow along.' : 'Press Play (or Space) to hear it at your tempo.'}
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
        onAgain={reset}
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
