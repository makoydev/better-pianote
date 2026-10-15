import {
  ALargeSmall,
  ArrowLeft,
  Check,
  Ear,
  Expand,
  Flame,
  Hand,
  ListMusic,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shrink,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Type,
  Volume2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionPill } from '../../components/layout/ConnectionPill'
import { MicPrompt } from '../../components/layout/MicPrompt'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import type { LaidEvent, NoteState, StaffNoteSpec } from '../../components/staff/layout'
import { Button, IconButton } from '../../components/ui/Button'
import { Segmented, Toggle } from '../../components/ui/controls'
import { type Song, findSong } from '../../content/songs'
import { useElementSize } from '../../hooks/useElementSize'
import { useHandsFree } from '../../hooks/useHandsFree'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { MIC_DELAY, heardTime } from '../../lib/audio/heard'
import { playNotes } from '../../lib/audio/play'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { burst, celebrate, toast } from '../../lib/fx'
import { recentNotes, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import { micHearsNotes } from '../../lib/input/micMatch'
import { letterColor } from '../../lib/colors'
import { nameNote } from '../../lib/naming'
import { type Chord, bassFor, isBlackKey, mod, parseNote, voiceLead } from '../../lib/theory'
import { go, goBack } from '../../router'
import { useLive } from '../../state/live'
import { useLibrary } from '../../state/library'
import { getPref, usePref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { AlongStatus } from './AlongStatus'
import { LoopControls, LoopPasses } from './LoopControls'
import { ScoreView } from './ScoreView'
import { type SongResult, SongResults } from './SongResults'
import { TempoPresets, TempoStepper } from './TempoControl'
import { LISTEN_PARTS, type ListenPart, accompaniment, handFilter, listenHand, otherHand } from './accompany'
import { AlongSession, alongScore, alongStars } from './along'
import { barName, barTitle, countedStraight } from './bars'
import { handSpans, judgeKey, micChordHeard, otherHandKey } from './hearing'
import { isAppleTouch } from './files'
import { useSongRuns } from './history'
import { type LoopMemory, continueBar, rememberBar, rememberedLoop, songPref } from './memory'
import { type CountIn, type Cue, type NoteFilter, type Playhead, advance, beatClicks, buildCues, countIn, firstCueAt, ringingAt } from './listen'
import { CLEAN_GOAL, type Run, aroundBar, carryOn, endPass, firstStepIn, newRun, passXp, runFrom, stepAt, stepsInBars, tally, worstStretch } from './practice'
import { HANDS, type Hands, accuracyOf, alongKey, handsBest, recordAlongRun, recordSongRun, songKey, starsOf } from './results'
import { MIN_KEY_WIDTH, SCORE_SIZES, type ScoreSize, keyboardHeight } from './systems'
import { clampTempo, loopSpeedUp, tempoPct } from './tempo'
import { type Step, type TimedNote, barAt, buildSteps, buildTimeline, keyboardRange, plays } from './timeline'

const TICK = 0.25 // listen mode wakes up every sixteenth note (and plays what's due inside it at exact times)
const EPS = 1e-6

/** Practice waits for each note; Play along keeps going at your tempo and judges your timing; Listen plays it all. */
type Mode = 'wait' | 'along' | 'listen'

/** Playing along with nobody accompanying you, the app plays none of the notes (just clicks and chords). */
const NO_NOTES: NoteFilter = () => false

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

/** The browser's full screen (on a computer it hides the tabs and address bar); null where there isn't one (iPad). */
function useFullscreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const change = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', change)
    return () => {
      document.removeEventListener('fullscreenchange', change)
      // Leaving the song leaves full screen too.
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])
  if (!document.fullscreenEnabled || isAppleTouch()) return null
  const toggle = () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  return { on, toggle }
}

function Player({ song }: { song: Song }) {
  const tl = useMemo(() => buildTimeline(song), [song])
  const firstFullBar = song.pickup ? 1 : 0

  const [mode, setMode] = useState<Mode>('wait')
  // Each song remembers its hands, loop, backing and accompaniment (and tempo). The first time, your own imports
  // open with both hands (that's why you imported them); built-in songs start with the melody.
  const [savedHands, setHands] = usePref<Hands>(
    songPref(song.id, 'hands'),
    song.lh && (song.imported || !tl.notes.some((n) => n.hand === 'rh')) ? 'both' : 'rh',
    HANDS,
  )
  const hands: Hands = song.lh ? savedHands : 'rh'
  const [savedLoop, setSavedLoop] = usePref<unknown>(songPref(song.id, 'loop'), null)
  const { on: loop, bars: loopBars } = useMemo(
    () => rememberedLoop(savedLoop, song.rh.length, [firstFullBar, Math.min(song.rh.length - 1, firstFullBar + 3)]),
    [savedLoop, song.rh.length, firstFullBar],
  )
  const saveLoop = (on: boolean, bars: [number, number]) => setSavedLoop({ on, from: bars[0], to: bars[1] } satisfies LoopMemory)
  /** Where you were last time, offered as "Continue from bar 37" until you start (not while a loop is on). */
  const [resumeBar, setResumeBar] = useState(() => (loop ? null : continueBar(getPref(songPref(song.id, 'bar'), 0), song.rh.length, firstFullBar)))
  const [backing, setBacking] = usePref(songPref(song.id, 'backing'), true)
  /** Practising one hand, the app can play the other along with you; Listen can play one hand or both. */
  const [accompany, setAccompany] = usePref(songPref(song.id, 'accompany'), false)
  const [listenPart, setListenPart] = usePref<ListenPart>(songPref(song.id, 'listen'), 'all', LISTEN_PARTS)
  // The tempo is remembered per song; the count-in, metronome and speed-up for every song.
  const [savedBpm, setBpm] = usePref(songPref(song.id, 'bpm'), song.bpm)
  const bpm = clampTempo(savedBpm, song.bpm)
  const [countInOn, setCountInOn] = usePref('songs:count-in', true)
  const [metronome, setMetronome] = usePref('songs:metronome', false)
  const [speedUp, setSpeedUp] = usePref('songs:speed-up', false)
  // Playing along, the clicks go on by default (they're how you keep in time).
  const [alongClick, setAlongClick] = usePref('songs:along-click', true)

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
  /** When the step on screen became the one to play (the mic hears a chord as the notes since then). */
  const stepSince = useRef(0)
  const syncedIdx = useRef(-1)
  const prevPad = useRef<number[] | null>(null)
  /** XP earned this visit from clean loop passes (capped). */
  const loopXp = useRef(0)
  const run = useRef<Run>(newRun(hands))
  /** The bar the run started from, when you chose one (Start from this bar). */
  const [fromBar, setFromBar] = useState<number | undefined>(undefined)
  /** Looping: how the last passes went, and clean ones in a row. */
  const [passes, setPasses] = useState<number[]>([])
  const [cleanInARow, setCleanInARow] = useState(0)
  const sync = () => {
    const r = run.current
    if (r.idx !== syncedIdx.current) {
      syncedIdx.current = r.idx
      stepSince.current = performance.now()
    }
    setStepIdx(r.idx)
    setSatisfied(new Set(r.sat))
    setMistakes(r.mistakes)
    setCombo(r.combo)
    setLoops(r.loops)
    setFromBar(r.fromBar)
    setPasses(r.passes)
    setCleanInARow(r.cleanInARow)
  }

  // Listen mode (and Practice's "Hear this bar")
  const [playing, setPlaying] = useState(false)
  /** Where the listen-mode playhead is, in beats. */
  const [listenAt, setListenAt] = useState(0)
  /**
   * Where Practice was when you switched to Listen, and whether Listen then played to the end (rewinding itself).
   * Back in Practice you carry on from where Listen paused, or from where you were if it just played to the end.
   */
  const practiceAt = useRef(0)
  const listenEnded = useRef(false)
  const [sounding, setSounding] = useState<Record<number, 'rh' | 'lh'>>({})
  /** The count-in beat on screen (k makes each click a new number, even when it repeats). */
  const [counting, setCounting] = useState<{ beat: number; k: number } | null>(null)
  const clockRef = useRef<Clock | null>(null)
  /** Pending playhead/key-light updates, cancelled on pause. */
  const timers = useRef<number[]>([])
  const bpmRef = useRef(bpm)
  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])
  /** Read on every tick, so these apply while it plays. */
  const live = useRef({ metronome, speedUp, alongClick })
  useEffect(() => {
    live.current = { metronome, speedUp, alongClick }
  })

  // Play along: the music moves at your tempo while your notes are judged early or late. The run lives in a ref
  // for the playback and your notes, and in state for drawing it.
  const along = useRef<AlongSession | null>(null)
  const [shownRun, setShownRun] = useState<AlongSession | null>(null)
  const setAlong = (s: AlongSession | null) => {
    along.current = s
    setShownRun(s)
  }
  /** Bumped when how your notes went changes (the run changes in place), so it's redrawn. */
  const [, setAlongRev] = useState(0)
  const bumpAlong = () => setAlongRev((v) => v + 1)
  /** You played a note before pressing Play. */
  const [alongNudge, setAlongNudge] = useState(false)

  const mic = useLive((s) => s.mic)
  const staffLabels = useSettings((s) => s.staffLabels)
  const naming = useSettings((s) => s.naming)
  const uiSounds = useSettings((s) => s.uiSounds)
  const setSettings = useSettings((s) => s.set)
  const best = useProgress((s) => handsBest(s.games, song.id, hands))
  const alongBest = useProgress((s) => s.games[alongKey(song.id, hands)]?.best ?? 0)

  const vh = useViewportHeight()
  const [kbRef, kb] = useElementSize<HTMLDivElement>()
  const paperRef = useRef<HTMLDivElement>(null)
  const [scoreSize, setScoreSize] = usePref<ScoreSize>('songs:score-size', 'M', SCORE_SIZES)
  // Focus view: the title and controls fold away (a panel brings them back), so the music gets the screen.
  const [focus, setFocus] = usePref<boolean>('songs:focus', false)
  const [panel, setPanel] = useState(false)
  const fullscreen = useFullscreen()

  const step = mode === 'wait' && !finished ? steps[stepIdx] : undefined
  const cursorTime = mode === 'wait' ? (steps[stepIdx]?.start ?? tl.total) : listenAt

  const stopPlayback = useCallback(() => {
    clockRef.current?.stop()
    clockRef.current = null
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
    setPlaying(false)
    setSounding({})
    setCounting(null)
    // A run played along stops too: how it went so far stays on the music.
    if (along.current && !along.current.over) {
      along.current.stop(heardTime(performance.now()))
      setAlongRev((v) => v + 1)
    }
  }, [])
  useEffect(() => stopPlayback, [stopPlayback])

  /** A fresh practice run (from the first step, unless given one that starts elsewhere). */
  const resetRun = (fresh = newRun(hands)) => {
    stopAccompaniment()
    run.current = fresh
    sync()
    setFlash({})
    setWrongAt(null)
    setResult(null)
    setFinished(false)
    startedAt.current = null
    setStarted(false)
    prevPad.current = null
  }

  /** The practice clock runs from your first note (or skip). */
  const startClock = () => {
    if (startedAt.current !== null) return
    startedAt.current = performance.now()
    setStarted(true)
    // Playing from where you are answers "Continue from bar …?"
    setResumeBar(null)
  }

  /** Start again: a fresh run, and Listen back to the start (of the loop, when looping). It answers "Continue?" too. */
  const reset = (from = listenRange()[0]) => {
    stopPlayback()
    resetRun()
    clearAlong()
    setResumeBar(null)
    listenEnded.current = false
    setListenAt(from)
  }

  /** Clear how the last run played along went off the music. */
  const clearAlong = () => setAlong(null)

  /** Carry on from step i of `list` after switching modes or hands (see carryOn for what counts as the same run). */
  const moveTo = (i: number, h: Hands, list: Step[]) => {
    const next = carryOn(run.current, i, h, loop, list[i]?.bar)
    if (next === run.current) return
    // Nothing played in it yet: a fresh run, so the last one's results and clock go too.
    if (!next.notes && !next.mistakes) return resetRun(next)
    run.current = next
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

  // ---- Accompany me: the other hand plays along, up to your next step ----
  const accTimers = useRef<number[]>([])
  const stopAccompaniment = () => {
    for (const id of accTimers.current) window.clearTimeout(id)
    accTimers.current = []
  }
  useEffect(() => () => accTimers.current.forEach((id) => window.clearTimeout(id)), [])
  /** Light a key while the app plays it (as in Listen). */
  const lightKey = (n: TimedNote, seconds: number) => {
    setSounding((x) => ({ ...x, [n.midi]: n.hand }))
    window.setTimeout(
      () =>
        setSounding((x) => {
          const y = { ...x }
          delete y[n.midi]
          return y
        }),
      seconds * 1000,
    )
  }
  /** You've played the step at `cur`: the other hand's notes from there to your next step, at your tempo. */
  const accompanyStep = (cur: Step, next: number) => {
    const hand = otherHand(hands)
    stopAccompaniment()
    if (!hand || !accompany || mic === 'on') return
    const spb = 60 / bpm
    const end = listenRange()[1]
    for (const { note, at } of accompaniment(tl, hand, cur.start, next, cur.notes.map((n) => n.midi))) {
      const dur = Math.max(0.15, Math.min(note.dur, end - note.start) * spb * 0.96)
      const play = () => {
        playNotes([note.midi], { dur, vel: hand === 'rh' ? 0.7 : 0.5 })
        lightKey(note, dur)
      }
      // Ones still to come wait for their beat (and are dropped if you get to your next step first).
      if (at < EPS) play()
      else accTimers.current.push(window.setTimeout(play, at * spb * 1000))
    }
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
    const pct = tempoPct(bpm, song.bpm)
    useSongRuns.getState().addRun(song.id, {
      at: Date.now(),
      hands,
      accuracy: Math.round(accuracy * 100),
      bpm: Math.round(bpm),
      pct,
      ...(r.fromBar === undefined ? {} : { from: r.fromBar }),
    })
    setResult({
      stars,
      accuracy,
      mistakes: r.mistakes,
      seconds,
      xp,
      isBest,
      bestCombo: r.best,
      hands,
      whole: r.whole,
      from: r.fromBar === undefined ? undefined : barName(song, r.fromBar),
      slips: tl.bars.map((_, b) => r.barSlips[b] ?? 0),
      played: [r.fromBar ?? steps[0]?.bar ?? 0, steps[steps.length - 1]?.bar ?? tl.bars.length - 1],
      worst: worstStretch(r.barSlips),
      pct,
    })
    setFinished(true)
    if (uiSounds) audio.ui('complete')
    if (stars === 3) celebrate()
    else burst(paperRef.current)
  }

  /** On to the next step: round again when looping, the results at the end. */
  const nextStep = () => {
    const r = run.current
    r.sat = new Set()
    // The next step starts now (even when it's the same one, in a loop of one chord), so the mic hears it afresh.
    stepSince.current = performance.now()
    if (r.idx + 1 < steps.length) {
      r.idx++
      return
    }
    if (loop) {
      // Looping never reaches the results, so a clean pass earns a little XP (and counts for the day's goal).
      const xp = endPass(r, loopXp.current)
      if (xp) {
        loopXp.current += xp
        useProgress.getState().addXp(xp)
      }
      if (r.cleanInARow === CLEAN_GOAL) {
        celebrate()
        // Not through the mic: it would go deaf, then hear your chord still ringing as a new one.
        if (uiSounds && mic !== 'on') audio.ui('complete')
        toast({ kind: 'info', title: `${CLEAN_GOAL} clean passes in a row!`, detail: 'Try it a little faster, or loop the next bars.' })
      } else burst(paperRef.current, { count: 30 })
      return
    }
    r.done = true
    finish()
  }

  const completeStep = (cur: Step) => {
    const r = run.current
    r.combo++
    r.best = Math.max(r.best, r.combo)
    // The chord gets a bass note when nobody plays the left hand (you, or the app accompanying you).
    const lhPlayed = hands !== 'rh' || (accompany && !!song.lh)
    if (backing && cur.chord && mic !== 'on') playNotes(padVoicing(cur.chord.chord, !lhPlayed), { dur: 1.8, vel: 0.34, strum: 0.012 })
    accompanyStep(cur, steps[r.idx + 1]?.start ?? listenRange()[1])
    nextStep()
  }

  /** Skip: on to the next step without playing it. It counts as a slip and breaks the combo. */
  const skip = () => {
    const r = run.current
    if (mode !== 'wait' || r.done || !steps[r.idx]) return
    stopAccompaniment()
    startClock()
    tally(r, 'slip', steps[r.idx].bar)
    r.combo = 0
    nextStep()
    sync()
  }

  // Through the mic, steps of two or more notes are heard as chords.
  useMicChords(mic === 'on' && mode === 'wait' && (step?.notes.length ?? 0) > 1)
  const spans = useMemo(() => handSpans(tl), [tl])
  const [octaveHint, setOctaveHint] = useState(false)
  const octaveTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(octaveTimer.current), [])

  useNoteEvents((e) => {
    // Playing folds Focus view's controls panel away.
    if (e.type === 'on') setPanel(false)
    if (mode === 'along') {
      if (e.type !== 'on') return
      const session = along.current
      if (!playing || !session) {
        // Not started yet: say how to (the results being up counts as finished).
        if (!playing && !result) setAlongNudge(true)
        return
      }
      // Practising one hand, the other hand's part is yours to play along with or leave out.
      if (hands !== 'both' && otherHandKey(spans, hands, barAt(tl, listenAt), e.midi)) return
      const viaMic = e.source === 'mic'
      // The written octave from a keyboard, as in Practice; the mic can't be sure of octaves (and hears a little late).
      const exact = e.source === 'midi' || e.source === 'screen' || (e.source === 'keys' && useSettings.getState().strictOctave)
      const k = session.play(e.midi, heardTime(e.time) - (viaMic ? MIC_DELAY : 0), { mic: viaMic, exact }, (pos) => barAt(tl, pos))
      if (k === null) return
      if (k === 'wrong') {
        if (!viaMic) flashKey(e.midi, 'bad')
      } else flashKey(e.midi, session.mark(k) === 'off' ? 'bad' : 'good')
      bumpAlong()
      return
    }
    const r = run.current
    if (e.type !== 'on' || mode !== 'wait' || r.done) return
    const cur = steps[r.idx]
    if (!cur) return
    const viaMic = e.source === 'mic'
    const target = cur.notes.map((n) => n.midi)
    if (viaMic && target.length > 1) {
      // A chord through the mic: the notes heard since the step began, less ones still ringing from the step
      // before, checked as a whole (the mic may miss a chord's 5th). Stray notes never count as slips.
      if (target.some((m) => mod(m - e.midi, 12) === 0)) flashKey(e.midi, 'good')
      const since = Math.min(1500, performance.now() - stepSince.current)
      // The step before (going round a loop, that's its last one) may still be ringing.
      const before = steps[r.idx - 1] ?? (loop ? steps[steps.length - 1] : undefined)
      if (!micHearsNotes(micChordHeard(recentNotes(since), target, before?.notes.map((n) => n.midi) ?? []), target)) return
      startClock()
      for (const n of cur.notes) {
        if (r.sat.has(n.id)) continue
        r.sat.add(n.id)
        tally(r, 'note')
      }
      completeStep(cur)
      sync()
      return
    }
    // A keyboard (USB or on screen) must play the written octave. The mic can't be sure of octaves, and computer keys
    // only reach an octave and a half, so they follow the "exact octave" setting.
    const exact = e.source === 'midi' || e.source === 'screen' || (e.source === 'keys' && useSettings.getState().strictOctave)
    const otherHand = hands === 'both' ? undefined : (m: number) => otherHandKey(spans, hands, cur.bar, m)
    const { verdict, note } = judgeKey(cur, r.sat, e.midi, exact, otherHand)
    if (verdict === 'hit' && note) {
      startClock()
      flashKey(e.midi, 'good')
      r.sat.add(note.id)
      tally(r, 'note')
      if (r.sat.size >= cur.notes.length) completeStep(cur)
      sync()
      return
    }
    if (verdict === 'octave') {
      flashKey(e.midi, 'bad')
      setOctaveHint(true)
      window.clearTimeout(octaveTimer.current)
      octaveTimer.current = window.setTimeout(() => setOctaveHint(false), 2200)
      return
    }
    // Pressed again, the other hand's part, or (through the mic) most likely an overtone or a note still ringing.
    if (verdict !== 'wrong' || viaMic) return
    tally(r, 'slip', cur.bar)
    r.combo = 0
    sync()
    flashKey(e.midi, 'bad')
    setWrongAt(cur.start)
    window.setTimeout(() => setWrongAt(null), 420)
  })

  // ---- Playback on the audio clock: Listen mode, and "Hear this bar" in Practice ----
  const clicks = useMemo(() => beatClicks(song, tl), [song, tl])
  const cues = useMemo(() => buildCues(tl, clicks), [tl, clicks])

  /**
   * Play [lo, hi) from `from`. Listen plays the part you chose (both hands, one, or the one you're not practising),
   * moves the playhead and can count in, click along and speed up each loop; a bar heard in Practice plays only the
   * hands you're practising. Playing along (`along`), the app plays only the other hand if you've asked it to
   * accompany you, and keeps the run's judge in step with the tempo. `part` and `withHands` stand in for a choice just
   * made (state catches up next render).
   */
  const startPlayback = (opts: {
    from: number
    lo: number
    hi: number
    looping: boolean
    bar: boolean
    count?: CountIn
    part?: ListenPart
    withHands?: Hands
    along?: AlongSession
  }) => {
    const { from, lo, hi, looping, bar, count, along: session } = opts
    const h = opts.withHands ?? hands
    stopPlayback()
    stopAccompaniment()
    // Through the mic, the app plays none of it while you play along (the mic would take the app's notes for yours).
    const quiet = !!session && mic === 'on'
    const partner = otherHand(h)
    // One hand leaves the other out before shared notes merge (so none go missing); Listen keeps its clicks.
    const only = session
      ? accompany && partner && !quiet
        ? handFilter(partner)
        : NO_NOTES
      : handFilter(bar ? (h === 'both' ? 'all' : h) : listenHand(opts.part ?? listenPart, h))
    const list = only ? buildCues(tl, bar ? [] : clicks, only) : cues
    const head: Playhead = { pos: from, next: firstCueAt(list, from) }
    const withChords = backing && !bar && !quiet
    if (session) setAlong(session)
    /** Playing along: beats since the music started (they keep counting round a loop), and the time round it is. */
    let beatsIn = 0
    let pass = 0
    prevPad.current = null
    let first = true
    let ended = false
    /** Count-in: beats still to click before the music, and the next click. */
    let lead = count?.beats ?? 0
    let nextClick = 0
    /** Seconds per beat, fixed for each tick so a tempo change lands cleanly on the next one. */
    let spb = 60 / bpmRef.current
    const later = (when: number, fn: () => void) => timers.current.push(audio.at(when, fn))
    const delayTo = (when: number) => Math.max(0, when - audio.now - 0.03)
    const sound = (n: TimedNote, when: number, beats: number) => {
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
    const pad = (c: Chord, when: number, beats: number) =>
      playNotes(padVoicing(c, !song.lh), { dur: beats * spb * 0.95, vel: 0.3, delay: delayTo(when) })
    // Nothing rings on past the part that plays (a tie into the next bar, the end of the loop).
    const play = (c: Cue, when: number) => {
      for (const n of c.notes) sound(n, when, Math.min(n.dur, hi - c.t))
      if (c.chord && withChords) pad(c.chord.chord, when, Math.min(c.chord.dur, hi - c.t))
      if (c.click && !bar && (session ? live.current.alongClick : live.current.metronome)) audio.click(c.click === 'bar', when)
      if (c.col && !bar)
        later(when, () => {
          setListenAt(c.t)
          if (session) judgeDue(session)
        })
    }
    const clock = new Clock({
      interval: () => spb * TICK,
      onTick: (_i, time) => {
        if (ended) return
        spb = 60 / bpmRef.current
        // The count-in takes the first ticks; the music starts where it ends (`off` beats into this tick).
        let off = 0
        if (count && lead > EPS) {
          const done = count.beats - lead
          off = Math.min(TICK, lead)
          for (; nextClick < count.clicks.length && count.clicks[nextClick].at < done + off - EPS; nextClick++) {
            const c = count.clicks[nextClick]
            const when = time + (c.at - done) * spb
            const k = nextClick
            audio.click(c.beat === 1, when)
            later(when, () => setCounting({ beat: c.beat, k }))
          }
          lead -= off
          if (lead > EPS) return
          later(time + off * spb, () => setCounting(null))
        }
        const start = time + off * spb
        if (session) {
          // The judge follows the music's tempo (− and + work while you play along).
          if (!session.tempo) session.begin(start, spb)
          else session.tempo.set(start, beatsIn, spb)
        }
        if (first) {
          first = false
          // Starting in the middle: bring in what's still ringing there (a held bass note, the chord).
          for (const n of ringingAt(tl, from, only)) sound(n, start, Math.min(n.start + n.dur, hi) - from)
          const ch = tl.chords.find((c) => c.start < from - EPS && c.start + c.dur > from + EPS)
          if (ch && withChords) pad(ch.chord, start, Math.min(ch.start + ch.dur, hi) - from)
        }
        const { due, end, wraps } = advance(list, head, TICK - off, lo, hi, looping)
        for (const d of due) play(d.cue, start + d.offset * spb)
        // Playing along, only a pass with every note in time so far speeds up (it's decided as the pass ends).
        const clean = !session || !wraps.length || session.cleanSoFar(pass)
        if (session) {
          for (const w of wraps) {
            // Round again: the pass after this one gets its notes now, and the music shows the new pass as it starts.
            session.addPass()
            const p = ++pass
            later(start + w * spb, () => {
              if (along.current !== session) return
              session.show(p)
              bumpAlong()
            })
          }
          beatsIn += TICK - off
        }
        // Speed up each loop: 5 % faster from the tick after each pass, up to the song's tempo (and remembered).
        const faster = wraps.length && !bar && live.current.speedUp && clean ? loopSpeedUp(bpmRef.current, song.bpm) : bpmRef.current
        if (faster !== bpmRef.current) {
          bpmRef.current = faster
          setBpm(faster)
        }
        if (end !== undefined) {
          // The end: stop, and (in Listen) rewind so Play starts from the top next time. Playing along, the last
          // notes get a beat to come in late before the results.
          ended = true
          later(start + end * spb + (session ? Math.max(0.5, spb) : 0.5), () => {
            clock.stop()
            clockRef.current = null
            timers.current = []
            setPlaying(false)
            setSounding({})
            if (bar) return
            setListenAt(lo)
            listenEnded.current = true
            if (session && along.current === session) finishAlong(session)
          })
        }
      },
    })
    clockRef.current = clock
    if (!bar) {
      setListenAt(from)
      listenEnded.current = false
    }
    clock.start(0.2)
    setPlaying(true)
  }

  /** Play from `from`, or carry on from the playhead (back to the start if it's outside the part that plays). */
  const startListen = (from?: number) => {
    const [lo, hi] = listenRange()
    let pos = from ?? listenAt
    if (pos < lo - EPS || pos >= hi - EPS) pos = lo
    startPlayback({ from: pos, lo, hi, looping: loop, bar: false, count: countInOn ? countIn(song, tl, pos) : undefined })
  }

  const toggleListen = () => (playing ? stopPlayback() : startListen())
  /** While Listen plays, a new part (or hands, for "the other hand") carries on from where it is. */
  const replayWith = (change: { part?: ListenPart; withHands?: Hands }) => {
    if (mode !== 'listen' || !playing) return
    const [lo, hi] = listenRange()
    startPlayback({ from: Math.max(lo, Math.min(listenAt, hi)), lo, hi, looping: loop, bar: false, ...change })
  }
  const changeListenPart = (p: ListenPart) => {
    setListenPart(p)
    replayWith({ part: p })
  }
  const listenFromStart = () => startListen(listenRange()[0])
  /** Paused somewhere after the start, so Play carries on from there. */
  const pausedMidway = mode === 'listen' && !playing && listenAt > listenRange()[0] + EPS

  // ---- Play along: the music keeps going at your tempo, and your notes are judged early or late ----
  /**
   * Where Play along starts: the loop's first bar when looping, otherwise the start of the bar the cursor is in
   * (where you stopped, or where you were in Practice), and the top once it's at the end.
   */
  const alongStartAt = () => {
    const [lo, hi] = listenRange()
    if (loop) return lo
    const at = tl.bars[barAt(tl, listenAt)]?.start ?? lo
    return at < lo - EPS || at >= hi - EPS ? lo : at
  }

  /** Count in and play along from `from` (a bar's start): round the loop, or to the end (`noLoop`: Start from this bar). */
  const startAlong = (opts: { from?: number; noLoop?: boolean } = {}) => {
    const looping = loop && !opts.noLoop
    const [lo, hi] = rangeOf(looping, loopBars)
    const from = opts.from ?? alongStartAt()
    setResult(null)
    setAlongNudge(false)
    setResumeBar(null)
    const session = new AlongSession(allSteps, { from, lo, hi, looping })
    startPlayback({ from, lo, hi, looping, bar: false, count: countIn(song, tl, from), along: session })
    bumpAlong()
  }
  const toggleAlong = () => (playing ? stopPlayback() : startAlong())
  const alongFromStart = () => startAlong({ from: listenRange()[0] })

  /** Notes it's now too late to play are missed, and each pass round the loop is scored once the music leaves it. */
  const judgeDue = (session: AlongSession) => {
    if (along.current !== session) return
    session.close(heardTime(performance.now()))
    for (const p of session.finishedPasses()) {
      if (!p.clean) continue
      const xp = passXp(true, loopXp.current)
      if (xp) {
        loopXp.current += xp
        useProgress.getState().addXp(xp)
      }
      if (p.inARow === CLEAN_GOAL) {
        celebrate()
        // Not through the mic: it would go deaf for a moment, in the middle of your playing.
        if (uiSounds && mic !== 'on') audio.ui('complete')
        toast({ kind: 'info', title: `${CLEAN_GOAL} clean passes in a row!`, detail: 'Every note in time. Try it a little faster, or loop the next bars.' })
      } else burst(paperRef.current, { count: 30 })
    }
  }

  /** The end of a run played along: XP, your best, the run's history and the results. */
  const finishAlong = (session: AlongSession) => {
    session.end()
    const st = session.stats()
    const score = alongScore(st)
    const stars = alongStars(score)
    const { from, hi } = session.range
    // Only a run from the top counts as a best (as in Practice).
    const whole = from < EPS
    const fromBar = whole ? undefined : barAt(tl, from)
    // Nothing played at all (the keyboard or mic wasn't heard, say): the results show it, but it's not a run to keep.
    const played = st.judged > st.missed || st.wrong > 0
    const prog = useProgress.getState()
    const first = whole && played && !prog.games[alongKey(song.id, hands)]
    // As in Practice, XP goes with the notes you played (in time); ones a run didn't reach earn nothing.
    const total = allSteps.reduce((n, x) => n + x.notes.length, 0)
    const share = total ? Math.min(1, st.inTime / total) : 1
    const xp = Math.round(((first ? 20 : 6) + stars * (first ? 5 : 2) + (hands === 'both' ? 10 : 0)) * share)
    prog.addXp(xp)
    const isBest = whole && played && recordAlongRun(song.id, hands, Math.round(score * 100))
    const tempo = bpmRef.current
    const pct = tempoPct(tempo, song.bpm)
    if (played)
      useSongRuns.getState().addRun(song.id, {
        at: Date.now(),
        hands,
        accuracy: Math.round(score * 100),
        bpm: Math.round(tempo),
        pct,
        mode: 'along',
        ...(fromBar === undefined ? {} : { from: fromBar }),
      })
    const slips = session.slipsByBar()
    setResult({
      stars,
      accuracy: score,
      mistakes: st.wrong,
      seconds: session.tempo ? Math.max(0, heardTime(performance.now()) - session.tempo.time(0)) : 0,
      xp,
      isBest,
      bestCombo: session.bestStreak(),
      hands,
      whole,
      from: fromBar === undefined ? undefined : barName(song, fromBar),
      slips: tl.bars.map((_, b) => slips[b] ?? 0),
      played: [barAt(tl, from), barAt(tl, hi - EPS)],
      worst: worstStretch(slips),
      pct,
      along: { onBeat: st.onBeat, close: st.early + st.late, off: st.off, missed: st.missed, total: st.total, mean: session.drift(Infinity) },
    })
    bumpAlong()
    if (uiSounds) audio.ui('complete')
    if (stars === 3) celebrate()
    else burst(paperRef.current)
  }

  /** Hear this bar: the bar you're on, at your tempo, with the hands you're practising. */
  const hearBar = () => {
    const r = run.current
    const cur = steps[r.idx]
    if (mode !== 'wait' || r.done || !cur) return
    const b = tl.bars[cur.bar]
    startPlayback({ from: b.start, lo: b.start, hi: b.start + b.dur, looping: false, bar: true })
  }

  /**
   * Start again (R): Practice starts a fresh run; Listen goes back to the beginning (still playing if it was), and so
   * does Play along (counting in again), clearing the last run off the music.
   */
  const restart = () => {
    if (mode === 'wait') reset()
    else if (mode === 'along') {
      if (playing) alongFromStart()
      else {
        clearAlong()
        listenEnded.current = false
        setListenAt(listenRange()[0])
      }
    } else if (playing) listenFromStart()
    else {
      listenEnded.current = false
      setListenAt(listenRange()[0])
    }
  }

  // Space plays/pauses in Listen and plays the bar in Practice; R starts again. Not while typing or on a slider,
  // and Space is left to a focused button (keyboard users press it to click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || isTypingTarget(e.target)) return
      if (e.code === 'Space') {
        if (isButtonTarget(e.target)) return
        e.preventDefault()
        if (mode === 'listen') toggleListen()
        else if (mode === 'along') toggleAlong()
        else hearBar()
      } else if (e.code === 'KeyR') restart()
      else if (e.key === 'Escape') setPanel(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- Notation ----
  const noteById = useMemo(() => new Map(tl.notes.map((n) => [n.id, n])), [tl])
  const cur = mode === 'wait' && !finished ? steps[stepIdx] : undefined
  // Notes before where this stretch of practice began (the loop, or a bar you started from) stay as they are.
  const startBar = loop ? loopBars[0] : fromBar
  const loopFrom = startBar === undefined ? 0 : (tl.bars[startBar]?.start ?? 0)
  const listenH = listenHand(listenPart, hands)
  const noteState = (spec: StaffNoteSpec): NoteState | undefined => {
    const n = spec.id === undefined ? undefined : noteById.get(spec.id)
    if (!n) return undefined
    if (mode === 'listen') {
      const heard = listenH === 'all' || n.hand === listenH
      return heard && playing && listenAt >= n.start - EPS && listenAt < n.start + n.dur - EPS ? 'active' : undefined
    }
    if (mode === 'along') {
      // How each of your notes went this time round: green on the beat, amber a little off, red too far off or
      // missed. The ones due now glow until you play them.
      const session = shownRun
      const k = session && plays(hands, n.hand) && !n.cont ? session.noteFor(n) : undefined
      if (k === undefined) return undefined
      const m = session!.mark(k)
      if (m) return m === 'onBeat' ? 'correct' : m === 'close' ? 'close' : 'wrong'
      return playing && Math.abs(n.start - listenAt) < EPS ? 'active' : undefined
    }
    if (finished) return 'done'
    if (!cur) return undefined
    // A note two voices share is one key in the step, so both noteheads light up together.
    const key = plays(hands, n.hand) && !n.cont && Math.abs(n.start - cur.start) < EPS ? cur.notes.find((x) => x.midi === n.midi) : undefined
    if (key) {
      if (satisfied.has(key.id)) return 'done'
      return wrongAt !== null && Math.abs(wrongAt - cur.start) < EPS ? 'wrong' : 'active'
    }
    if (n.start < cur.start - EPS) return n.start < loopFrom - EPS ? undefined : 'done'
    return undefined
  }
  const eventState = (e: LaidEvent): NoteState | undefined => {
    if (mode !== 'wait' || e.start === undefined) return undefined
    if (finished) return 'done'
    if (!cur) return undefined
    if (e.start < cur.start - EPS) return e.start < loopFrom - EPS ? undefined : 'done'
    return undefined
  }

  const showBass = hands !== 'rh' && !!song.lh

  // ---- Keyboard: keys get narrower for wide pieces before it scrolls, and its height suits its keys ----
  const range = useMemo(
    () => keyboardRange(tl.notes.filter((n) => mode === 'listen' || plays(hands, n.hand)).map((n) => n.midi)),
    [tl, hands, mode],
  )
  const whiteKeys = useMemo(() => Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i).filter((m) => !isBlackKey(m)).length, [range])
  const marks: Marks = {}
  const fingers: Record<number, number> = {}
  // The step after this one shows faintly (with its fingers), so you can see where your hand goes next.
  const upNext = step ? (steps[stepIdx + 1] ?? (loop && steps[0] !== step ? steps[0] : undefined)) : undefined
  for (const n of upNext?.notes ?? []) {
    marks[n.midi] = 'hint'
    if (n.finger) fingers[n.midi] = n.finger
  }
  if (step) {
    for (const n of step.notes) {
      if (satisfied.has(n.id)) continue
      marks[n.midi] = n.hand === 'rh' ? 'target' : { kind: 'root', label: 'L' }
      if (n.finger) fingers[n.midi] = n.finger
    }
  }
  // Playing along: the keys of the notes due now light up until you play them, the next ones faintly.
  if (mode === 'along' && playing && shownRun) {
    const session = shownRun
    const i = steps.findIndex((x) => x.start >= listenAt - EPS)
    const at = i >= 0 ? i : loop ? 0 : -1
    const due = at >= 0 && Math.abs(steps[at].start - listenAt) < EPS ? steps[at] : undefined
    const next = due ? (steps[at + 1] ?? (loop ? steps[0] : undefined)) : at >= 0 ? steps[at] : undefined
    for (const n of next?.notes ?? []) {
      marks[n.midi] = 'hint'
      if (n.finger) fingers[n.midi] = n.finger
    }
    for (const n of due?.notes ?? []) {
      const k = session.noteFor(n)
      if (k !== undefined && session.judged(k)) continue
      marks[n.midi] = n.hand === 'rh' ? 'target' : { kind: 'root', label: 'L' }
      if (n.finger) fingers[n.midi] = n.finger
    }
  }
  for (const [m, hand] of Object.entries(sounding)) marks[Number(m)] = hand === 'rh' ? 'chord' : 'root'
  for (const [m, f] of Object.entries(flash)) marks[Number(m)] = f
  const pianoHeight = keyboardHeight(kb.width, whiteKeys, vh, showBass, focus)

  const straight = useMemo(() => countedStraight(song), [song])
  const fullBars = song.rh.length - firstFullBar
  const curBar = mode === 'wait' ? (steps[stepIdx]?.bar ?? song.rh.length - 1) : barAt(tl, listenAt)
  // While you practise, remember the bar (for "Continue from bar …" here, and Continue on Home and the song list);
  // once you've played to the end, next time starts from the top.
  useEffect(() => {
    if (mode === 'wait' && started && !finished) rememberBar(song, curBar)
  }, [mode, started, finished, curBar, song])
  useEffect(() => {
    if (finished) rememberBar(song, 0)
  }, [finished, song])
  const offerResume = resumeBar !== null && mode === 'wait' && !started && !loop
  const alongFrom = mode === 'along' ? alongStartAt() : 0
  const progress = mode === 'wait' ? (finished ? 1 : stepIdx / Math.max(1, steps.length)) : tl.total ? Math.min(1, listenAt / tl.total) : 0

  // Switching modes or hands keeps your place in the piece.
  const changeMode = (m: Mode) => {
    if (m === mode) return
    stopPlayback()
    stopAccompaniment()
    setResumeBar(null)
    clearAlong()
    setAlongNudge(false)
    if (mode === 'wait') {
      // Listen and Play along start from the step you're on; the practice clock stops meanwhile.
      const r = run.current
      if (startedAt.current !== null) {
        r.ms += performance.now() - startedAt.current
        startedAt.current = null
      }
      practiceAt.current = !r.done && r.idx > 0 ? (steps[r.idx]?.start ?? 0) : listenRange()[0]
      listenEnded.current = false
      setListenAt(practiceAt.current)
    } else if (m === 'wait') {
      // Practice carries on from the first step at or after where Listen paused (or where it was, if Listen just
      // played to the end and rewound).
      moveTo(stepAt(steps, listenEnded.current ? practiceAt.current : listenAt, loop), hands, steps)
    }
    setMode(m)
  }
  const changeHands = (h: Hands) => {
    if (h === hands) return
    setResumeBar(null)
    if (mode === 'wait') {
      // Keep your bar: the first step at or after this moment, in the new hands' steps.
      stopPlayback()
      stopAccompaniment()
      const r = run.current
      const at = r.done || r.idx === 0 ? listenRange()[0] : (steps[r.idx]?.start ?? 0)
      const next = stepsInBars(buildSteps(tl, h), loop ? loopBars : null)
      moveTo(stepAt(next, at, loop), h, next)
    } else if (mode === 'along') {
      // Other hands, other notes to play: the run stops.
      stopPlayback()
      clearAlong()
    } else if (listenPart === 'other') replayWith({ withHands: h })
    setHands(h)
  }
  const changeLoop = (on: boolean) => {
    reset(rangeOf(on, loopBars)[0])
    saveLoop(on, loopBars)
  }
  const changeLoopBars = (b: [number, number]) => {
    reset(rangeOf(loop, b)[0])
    saveLoop(loop, b)
  }
  /** Bars picked on the music (or "Loop around here", or "Practise these bars" on the results): loop them. */
  const pickBars = (b: [number, number]) => {
    reset(rangeOf(true, b)[0])
    saveLoop(true, b)
  }
  /**
   * Start from this bar: the loop goes off and you play (Listen) or practise from there to the end. The practice
   * run says where it started and doesn't count as a best.
   */
  const startFrom = (bar: number) => {
    const from = tl.bars[bar]?.start ?? 0
    stopPlayback()
    setResumeBar(null)
    if (loop) saveLoop(false, loopBars)
    if (mode === 'wait') {
      resetRun(runFrom(hands, firstStepIn(allSteps, bar), bar))
      listenEnded.current = false
      setListenAt(from)
      return
    }
    if (mode === 'along') return startAlong({ from, noLoop: true })
    startPlayback({ from, lo: 0, hi: tl.total, looping: false, bar: false, count: countInOn ? countIn(song, tl, from) : undefined })
  }

  // Hands-free (Enter, a deliberate pedal tap or the top C): Play again once you've finished (from the results or
  // after closing them), Continue while that's offered, or Play along (not while it plays: the pedal is yours
  // then). Enter on a focused button just clicks it, and the note or pedal that finished the run can't also
  // restart it.
  useHandsFree(
    mode === 'wait' && finished
      ? () => reset()
      : offerResume
        ? () => startFrom(resumeBar)
        : mode === 'along' && !playing
          ? () => startAlong()
          : null,
  )

  // Focus view's panel folds away again once the music plays.
  const [panelPlaying, setPanelPlaying] = useState(playing)
  if (playing !== panelPlaying) {
    setPanelPlaying(playing)
    if (playing) setPanel(false)
  }
  const leaveFocus = () => {
    setPanel(false)
    setFocus(false)
    if (fullscreen?.on) fullscreen.toggle()
  }

  const topActions = (
    <>
      <IconButton icon={RotateCcw} label="Start again (R)" onClick={restart} />
      <ScoreSizeButton size={scoreSize} onChange={setScoreSize} />
      <IconButton
        icon={Type}
        label={staffLabels ? 'Hide note names' : 'Show note names'}
        onClick={() => setSettings({ staffLabels: !staffLabels })}
        className={staffLabels ? '!border-gold/40 !text-gold' : ''}
      />
    </>
  )

  // How you practise (mode, hands, chords), then playing, tempo and the loop: above the music, or in Focus view's panel.
  const controls = (
    <>
      {/* Controls: how you practise, then playing and tempo */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <Segmented
          value={mode}
          onChange={changeMode}
          // The icons only where there's room: on an iPad the hands still fit beside the three modes without them.
          options={[
            { value: 'wait', label: <span className="inline-flex items-center gap-1.5"><Hand size={18} className="hidden xl:block" /> Practice</span> },
            { value: 'along', label: <span className="inline-flex items-center gap-1.5"><Music size={18} className="hidden xl:block" /> Play along</span> },
            { value: 'listen', label: <span className="inline-flex items-center gap-1.5"><Ear size={18} className="hidden xl:block" /> Listen</span> },
          ]}
        />
        {song.lh && (
          <Segmented
            value={hands}
            onChange={changeHands}
            options={[
              { value: 'rh', label: 'Right hand' },
              { value: 'lh', label: 'Left hand' },
              { value: 'both', label: 'Both hands' },
            ]}
          />
        )}
        {tl.chords.length > 0 && (
          <TogglePill checked={backing && !(mode !== 'listen' && mic === 'on')} onChange={setBacking} label="Backing chords">
            Chords
          </TogglePill>
        )}
        {song.lh && mode !== 'listen' && hands !== 'both' && (
          <TogglePill
            checked={accompany && mic !== 'on'}
            onChange={setAccompany}
            label={
              mic === 'on'
                ? 'Accompany me: off while the mic listens (it would hear the app)'
                : `Accompany me: the app plays the ${hands === 'rh' ? 'left' : 'right'} hand along with you`
            }
          >
            Accompany me
          </TogglePill>
        )}
        {song.lh && mode === 'listen' && (
          <label
            className="flex h-[3.25rem] items-center gap-2 rounded-2xl border border-white/8 bg-night-850 px-3 text-sm font-extrabold"
            title="What Listen plays (the other hand: the one you're not practising)"
          >
            <Volume2 size={18} className="text-ink-mute" aria-hidden />
            <span className="text-ink-mute">Plays</span>
            <select
              value={listenPart === 'other' && hands === 'both' ? 'all' : listenPart}
              // Let go of focus, so Space plays and pauses again straight away.
              onChange={(e) => {
                changeListenPart(e.target.value as ListenPart)
                e.currentTarget.blur()
              }}
              className="min-h-11 cursor-pointer rounded-lg bg-night-850 pr-1 text-ink outline-none"
            >
              <option value="all">both hands</option>
              <option value="rh">the right hand</option>
              <option value="lh">the left hand</option>
              {hands !== 'both' && <option value="other">the other hand</option>}
            </select>
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        {mode === 'wait' ? (
          <div className="flex items-center gap-2">
            <Button size="lg" variant="secondary" icon={Volume2} onClick={hearBar} disabled={!step} title="Hear this bar at your tempo (Space)">
              Hear this bar
            </Button>
            <Button size="lg" variant="secondary" icon={SkipForward} onClick={skip} disabled={!step} title="Skip this note (counts as a wrong note)">
              Skip
            </Button>
          </div>
        ) : mode === 'along' ? (
          <div className="flex items-center gap-2">
            <IconButton icon={SkipBack} size={56} label="Play along from the beginning" onClick={alongFromStart} />
            <Button icon={playing ? Square : Play} onClick={toggleAlong} variant={playing ? 'secondary' : 'primary'} className="min-w-38" title="Space">
              {playing ? 'Stop' : alongFrom > listenRange()[0] + EPS ? `Play from ${barName(song, barAt(tl, alongFrom))}` : 'Play along'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <IconButton icon={SkipBack} size={56} label="Restart: play from the beginning" onClick={listenFromStart} />
            <Button icon={playing ? Pause : Play} onClick={toggleListen} variant={playing ? 'secondary' : 'primary'} className="min-w-38">
              {playing ? 'Pause' : pausedMidway ? 'Resume' : 'Play'}
            </Button>
          </div>
        )}
        <TempoStepper bpm={bpm} songBpm={song.bpm} onChange={setBpm} />
        {mode === 'listen' && (
          <>
            <TempoPresets bpm={bpm} songBpm={song.bpm} onChange={setBpm} />
            <span className="flex flex-wrap items-center gap-2">
              <Chip on={countInOn} onChange={setCountInOn} label="Count-in: a bar of clicks before the music starts">
                Count-in
              </Chip>
              <Chip on={metronome} onChange={setMetronome} label="Metronome: clicks while it plays">
                Metronome
              </Chip>
              {loop && (
                <Chip on={speedUp} onChange={setSpeedUp} label="Speed up each loop: 5% faster each time round, up to the song's tempo">
                  Speed up
                </Chip>
              )}
            </span>
          </>
        )}
        {mode === 'along' && (
          <>
            <TempoPresets bpm={bpm} songBpm={song.bpm} onChange={setBpm} />
            <span className="flex flex-wrap items-center gap-2">
              <Chip on={alongClick} onChange={setAlongClick} label="Metronome: clicks while you play along (a bar of them always counts you in)">
                Metronome
              </Chip>
              {loop && (
                <Chip on={speedUp} onChange={setSpeedUp} label="Speed up: 5% faster after each pass with every note in time, up to the song's tempo">
                  Speed up
                </Chip>
              )}
            </span>
          </>
        )}
        <LoopControls
          song={song}
          loop={loop}
          bars={loopBars}
          onLoop={changeLoop}
          onBars={changeLoopBars}
          onAround={() => pickBars(aroundBar(curBar, song.rh.length))}
          onStartFrom={startFrom}
        />
      </div>
    </>
  )

  return (
    // The screen's height, shared out: controls, the music (whatever's left), the keyboard. It only scrolls when
    // the controls alone don't fit (a phone).
    <div className="flex h-dvh flex-col overflow-y-auto">
      {focus ? (
        // Focus view: one slim bar (back, the title, the main button, the controls panel, full screen, leave).
        <header className="sticky top-0 z-30 border-b border-white/6 bg-night-900/85 pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:px-5">
            <IconButton icon={ArrowLeft} label="Back" size={44} onClick={() => goBack('/songs')} />
            <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold">{song.title}</h1>
            {mode === 'wait' ? (
              <Button size="sm" variant="secondary" icon={Volume2} onClick={hearBar} disabled={!step} title="Hear this bar at your tempo (Space)">
                Hear bar
              </Button>
            ) : (
              <Button
                size="sm"
                icon={playing ? (mode === 'along' ? Square : Pause) : Play}
                variant={playing ? 'secondary' : 'primary'}
                onClick={mode === 'along' ? toggleAlong : toggleListen}
                title="Space"
              >
                {playing ? (mode === 'along' ? 'Stop' : 'Pause') : mode === 'along' ? 'Play along' : 'Play'}
              </Button>
            )}
            <Button
              size="sm"
              variant={panel ? 'primary' : 'secondary'}
              icon={SlidersHorizontal}
              onClick={() => setPanel(!panel)}
              aria-expanded={panel}
              title="Mode, hands, tempo, loop and the rest"
            >
              Controls
            </Button>
            {fullscreen && (
              <IconButton
                icon={fullscreen.on ? Shrink : Expand}
                label={fullscreen.on ? 'Leave full screen' : 'Full screen (hides the browser’s bars)'}
                size={44}
                onClick={fullscreen.toggle}
                className={fullscreen.on ? '!border-gold/40 !text-gold' : ''}
              />
            )}
            <IconButton icon={Minimize2} label="Leave Focus view (show all the controls)" size={44} onClick={leaveFocus} />
          </div>
        </header>
      ) : (
        <TopBar back="/songs" title={song.title} subtitle={`${song.composer} · ${song.keyName} · ${song.time[0]}/${song.time[1]}`}>
          <IconButton icon={Maximize2} label="Focus view: fold the controls away, bigger music" onClick={() => setFocus(true)} />
          {topActions}
        </TopBar>
      )}

      <main className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2.5 px-3 pb-3 pt-3 sm:px-5">
        {!focus && controls}
        {/* Focus view: the controls in a panel over the music, until you play or tap outside it */}
        <AnimatePresence>
          {focus && panel && (
            <>
              <motion.div
                key="shade"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-night-900/50"
                onClick={() => setPanel(false)}
              />
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.16 }}
                className="absolute inset-x-3 top-3 z-20 flex flex-col gap-3 rounded-3xl border border-white/10 bg-night-800 p-3 shadow-2xl sm:inset-x-5 sm:p-4"
              >
                {controls}
                <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  {topActions}
                  <span className="ml-auto">
                    <ConnectionPill />
                  </span>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* The music: the room left between the controls and the keyboard (lines when two or more fit) */}
        <div ref={paperRef} className="relative flex min-h-[6.5rem] flex-1 flex-col">
          <ScoreView
            song={song}
            tl={tl}
            hands={hands}
            size={scoreSize}
            cursorTime={cursorTime}
            noteState={noteState}
            eventState={eventState}
            dim={hands === 'lh' ? 'treble' : undefined}
            loopBars={loop ? loopBars : null}
            onPickBars={pickBars}
            judged={mode === 'along'}
            title={hands === 'both' || !song.lh ? song.title : `${song.title}, ${hands === 'rh' ? 'right' : 'left'} hand`}
            className="paper flex-1 rounded-3xl"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-b-3xl bg-night-900/10">
            <motion.div
              className="h-full rounded-r-full bg-linear-to-r from-gold to-coral"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          {/* The count-in, big over the music */}
          {counting && (
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-night-900/55">
              <motion.span
                key={counting.k}
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                className="font-display text-8xl font-bold text-gold"
              >
                {counting.beat}
              </motion.span>
            </div>
          )}
          {/* Practised this before: carry on where you were, or start again */}
          {offerResume && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-night-900/45 p-3">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-night-800 p-4 shadow-2xl"
              >
                <Button icon={Play} onClick={() => startFrom(resumeBar)}>
                  Continue from {barName(song, resumeBar)}
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={() => setResumeBar(null)}>
                  Start from the beginning
                </Button>
              </motion.div>
            </div>
          )}
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
                  <NotePill key={n.id} note={n} done={satisfied.has(n.id)} tagHand={hands === 'both'} />
                ))}
                {upNext && (
                  <span className="text-sm font-bold text-ink-mute">
                    then: <MusicText text={upNext.notes.map((n) => nameNote(parseNote(n.name), naming, { octave: true })).join(' ')} />
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          ) : mode === 'wait' && finished ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3">
              <span className="text-base font-extrabold text-good">Finished!</span>
              <Button size="sm" icon={RotateCcw} onClick={() => reset()}>
                Play again
              </Button>
            </motion.div>
          ) : mode === 'along' ? (
            <AlongStatus session={shownRun} playing={playing} nudge={alongNudge} loop={loop} />
          ) : mode === 'listen' ? (
            <span className="text-base font-semibold text-ink-soft">
              {playing
                ? 'Watch the notes light up and follow along.'
                : pausedMidway
                  ? `Resume (or Space) plays from ${barName(song, barAt(tl, listenAt))}; ⏮ plays it from the beginning.`
                  : 'Press Play (or Space) to hear it at your tempo.'}
            </span>
          ) : null}
          {mode === 'wait' && octaveHint && <span className="text-sm font-bold text-coral">Right note, wrong octave: play the key that’s lit.</span>}
          {/* No USB keyboard: offer the mic (on an iPad it's how the app hears you), then show what it hears */}
          {mode !== 'listen' && <MicPrompt />}
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
            {mode === 'wait' && loop && loops > 0 && <LoopPasses loops={loops} passes={passes} clean={cleanInARow} />}
            {mode === 'along' && loop && shownRun && shownRun.shown > 0 && (
              <LoopPasses loops={shownRun.shown} passes={shownRun.passScores} clean={shownRun.cleanInARow} />
            )}
            <span className="text-sm font-extrabold text-ink-soft">
              {/* As printed on the score: "Bar 14 (2nd time)" for an imported piece whose repeats are written out. */}
              {straight && curBar >= firstFullBar ? `Bar ${curBar - firstFullBar + 1} of ${fullBars}` : barTitle(song, curBar)}
            </span>
            {mode === 'wait' && (
              <span className={`inline-flex items-center gap-1 text-sm font-extrabold ${mistakes ? 'text-bad' : 'text-ink-mute'}`} title="Wrong notes">
                <X size={16} strokeWidth={3} /> {mistakes}
              </span>
            )}
            {mode === 'along'
              ? alongBest > 0 && <span className="text-sm font-bold text-ink-mute">Best {alongBest}% in time</span>
              : best > 0 && <span className="text-sm font-bold text-ink-mute">Best {best}%</span>}
          </div>
        </div>

        <div ref={kbRef}>
          <Piano
            from={range.from}
            to={range.to}
            marks={marks}
            fingers={fingers}
            height={pianoHeight}
            minKeyWidth={MIN_KEY_WIDTH}
            sparks
            sparkHeight={110}
          />
        </div>
      </main>

      <SongResults
        song={song}
        result={result}
        onAgain={() => (result?.along ? alongFromStart() : reset())}
        onClose={() => setResult(null)}
        onSongs={() => go('/songs')}
        onPractise={pickBars}
      />
    </div>
  )
}

const SIZE_NAME: Record<ScoreSize, string> = { S: 'small', M: 'medium', L: 'large' }

/** The size of the music: small, medium or large, a tap goes round them (remembered for every song). */
function ScoreSizeButton({ size, onChange }: { size: ScoreSize; onChange: (s: ScoreSize) => void }) {
  const next = SCORE_SIZES[(SCORE_SIZES.indexOf(size) + 1) % SCORE_SIZES.length]
  const label = `Music size: ${SIZE_NAME[size]} (tap for ${SIZE_NAME[next]})`
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onChange(next)}
      className="relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-night-700/80 text-ink-soft transition-colors hover:bg-night-600 hover:text-ink"
      style={{ width: 48, height: 48 }}
    >
      <ALargeSmall size={22} strokeWidth={2.4} />
      <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-gold text-[0.7rem] font-extrabold text-night-900">
        {size}
      </span>
    </motion.button>
  )
}

/** A compact on/off button (Listen's count-in, metronome and speed-up), ticked when on. */
function Chip({ on, onChange, label, children }: { on: boolean; onChange: (v: boolean) => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={label}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-extrabold transition-colors ${
        on ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'
      }`}
    >
      {on && <Check size={16} strokeWidth={3} aria-hidden />}
      {children}
    </button>
  )
}

/** A switch and its name in one pill (tapping the name flips it too). */
function TogglePill({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-night-850 px-3 py-2" title={label}>
      <Toggle checked={checked} onChange={onChange} label={label} />
      <span className="text-sm font-extrabold text-ink-soft">{children}</span>
    </label>
  )
}

function NotePill({ note, done, tagHand }: { note: TimedNote; done: boolean; tagHand: boolean }) {
  const naming = useSettings((s) => s.naming)
  const n = parseNote(note.name)
  const color = letterColor(n.letter)
  return (
    <motion.span
      layout
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-lg font-extrabold transition-opacity ${done ? 'opacity-40' : ''}`}
      style={{ color, borderColor: `${color}66`, background: `${color}1c` }}
    >
      <MusicText text={nameNote(n, naming, { octave: true })} />
      {tagHand && note.hand === 'lh' && <span className="rounded-md bg-white/10 px-1.5 text-xs text-ink-soft">left hand</span>}
      {note.finger !== undefined && (
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-sm text-night-900" title="Finger">
          {note.finger}
        </span>
      )}
    </motion.span>
  )
}
