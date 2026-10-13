import { CheckCircle2, Eraser, HelpCircle, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useElementSize } from '../../../hooks/useElementSize'
import { useViewportHeight } from '../../../hooks/useViewport'
import { MusicText } from '../../../components/MusicText'
import { MicPrompt } from '../../../components/layout/MicPrompt'
import { type Marks, Piano } from '../../../components/piano/Piano'
import type { StaffItem, StaffNoteSpec } from '../../../components/staff/Staff'
import { Button } from '../../../components/ui/Button'
import { RichText } from '../../../components/ui/RichText'
import type { KeyboardVisual, PlayStep, Target } from '../../../content/types'
import { audio } from '../../../lib/audio/engine'
import { playNotes, playSequence, playTimed } from '../../../lib/audio/play'
import { burst } from '../../../lib/fx'
import { type NoteSource, heldNow, useNoteEvents } from '../../../lib/input/bus'
import { useMicChords } from '../../../lib/input/mic'
import { micHearsNotes } from '../../../lib/input/micMatch'
import { type Note, isBlackKey, mod } from '../../../lib/theory'
import { useLive } from '../../../state/live'
import { useSettings } from '../../../state/settings'
import { useDemoLights } from '../demoLights'
import { chordMessage, wrongNoteMessage } from '../feedback'
import { chordMatches, chordStatus, feedNote, inChord, initialMatch, targetMidis, wrongOctave } from '../match'
import { stepRhythm } from '../rhythm'
import { StaffView } from '../VisualBlock'
import { keyboardHeight, noteMidi, pianoProps, pictureSp } from '../visual'
import { TimedPanel } from './TimedPanel'
import { useTimedStep } from './useTimedStep'

/** As tall as the space allows (leaving room for sparks and the middle-C label), within sensible limits. */
function pianoHeight(area: number, from: number, to: number) {
  const ideal = keyboardHeight(from, to) + 20
  return Math.round(Math.max(130, Math.min(ideal, area - 64)))
}

const PRAISE = ['Nice!', 'Perfect!', 'You got it!', 'Spot on!', 'Beautiful!', 'Nailed it!']

/** Tempo for "Show me" on a staff with a time signature (a step not played in time). */
const DEMO_BPM = 96

/** Notes a little early or late, still in time, on the staff. */
const CLOSE_COLOR = '#d97706'

const tint = (n: string | Note | StaffNoteSpec, color: string): StaffNoteSpec => (typeof n === 'string' || 'letter' in n ? { note: n, color } : { ...n, color })

/** A keyboard range that fits every target note, whole octaves C…B. */
function defaultKeyboard(t: Target): KeyboardVisual {
  const ms = targetMidis(t)
  if (t.anyOctave) return { from: 'C3', to: 'B4' }
  const lo = Math.min(...ms)
  const hi = Math.max(...ms)
  const from = Math.min(48, lo - mod(lo, 12))
  const to = Math.max(71, hi + (11 - mod(hi, 12)))
  const name = (m: number) => `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mod(m, 12)]}${Math.floor(m / 12) - 1}`
  return { from: name(from), to: name(to) }
}

export function PlayStepView({
  step,
  solved,
  onSolved,
  onMistake,
  onRetry,
  handsFree = true,
}: {
  step: PlayStep
  solved: boolean
  onSolved: () => void
  /** Count slips (for the stars). */
  onMistake: (n: number) => void
  /** Offered when you come back to a step you already solved. */
  onRetry?: () => void
  /** Enter, a pedal tap or the top C can start a run in time (they don't continue the lesson right now). */
  handsFree?: boolean
}) {
  const t = step.target
  const uiSounds = useSettings((s) => s.uiSounds)
  const naming = useSettings((s) => s.naming)
  const mic = useLive((s) => s.mic)
  const [state, setState] = useState(initialMatch)
  const [flash, setFlash] = useState<Record<number, 'good' | 'bad'>>({})
  const [wrong, setWrong] = useState(0)
  const [hintAsked, setHintAsked] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)])
  // What you just played, or what's left to fix ("That's D.", "2 of 3 notes… keep going.").
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef(0)
  const lastSlipAt = useRef(-Infinity)
  const lastWrong = useRef<{ midi: number; at: number } | null>(null)
  const kbRef = useRef<HTMLDivElement>(null)
  const [areaRef, { height: areaH }] = useElementSize<HTMLDivElement>()
  // On short screens (a 13" MacBook) the staff, heading and gaps shrink so the keyboard always stays fully visible.
  const vh = useViewportHeight()
  const short = vh < 880

  const k = step.keyboard ?? defaultKeyboard(t)
  const p = pianoProps(k)
  const targets = useMemo(() => targetMidis(t), [t])
  // When each note falls, from the staff's time signature and note lengths (or a note a beat, played in time).
  const rhythm = useMemo(() => stepRhythm(step), [step])
  // "Show me" lights each key as it sounds.
  const demo = useDemoLights()
  // Through the mic, chord steps listen for whole chords.
  useMicChords(t.type === 'chord')

  const flashKey = (m: number, kind: 'good' | 'bad') => {
    setFlash((f) => ({ ...f, [m]: kind }))
    window.setTimeout(
      () =>
        setFlash((f) => {
          if (f[m] !== kind) return f
          const next = { ...f }
          delete next[m]
          return next
        }),
      kind === 'good' ? 450 : 700,
    )
  }
  const say = (text: string | null) => {
    setFeedback(text)
    window.clearTimeout(feedbackTimer.current)
    if (text) feedbackTimer.current = window.setTimeout(() => setFeedback(null), 2600)
  }
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])

  const mistake = (m: number, source: NoteSource) => {
    // Free-practice steps ask you to play other things first, so wrong notes don't count there.
    if (step.free) return
    const now = performance.now()
    // The mic keeps hearing a wrong note while it rings: one wrong note is one slip.
    if (source === 'mic' && lastWrong.current?.midi === m && now - lastWrong.current.at < 1500) return
    lastWrong.current = { midi: m, at: now }
    flashKey(m, 'bad')
    say(wrongNoteMessage(t, m, naming))
    // One slip per attempt: a wrong chord (several keys at once) counts once.
    if (now - lastSlipAt.current < 700) return
    lastSlipAt.current = now
    setWrong((w) => w + 1)
    onMistake(1)
    // No buzz for the mic: the app's own sound makes it deaf for a moment while your note still rings.
    if (uiSounds && source !== 'mic') audio.ui('wrong')
  }
  const succeed = () => {
    say(null)
    onSolved()
    if (uiSounds) audio.ui('correct')
    burst(kbRef.current, { count: 50 })
  }

  // Rhythm steps are played in time: a run that keeps the beat solves the step, one that doesn't is a slip.
  const ts = useTimedStep({
    step,
    rhythm,
    handsFree,
    solved,
    onPass: succeed,
    onFail: () => {
      onMistake(1)
      if (uiSounds) audio.ui('wrong')
    },
  })
  const showHint = !solved && ((ts.on ? ts.fails : wrong) >= 2 || hintAsked)

  /** After each chord note: done, or say what's still missing (wrong notes are flagged separately). */
  const checkChord = (extra: number[]) => {
    const notes = [...extra, ...heldNow()]
    if (chordMatches(t, notes)) return succeed()
    if (step.free) return
    const msg = chordMessage(t, chordStatus(t, notes), notes, naming)
    if (msg) say(msg)
  }

  useNoteEvents((e) => {
    // In time, the run judges the notes (and between runs they're yours to try out).
    if (solved || e.type !== 'on' || ts.on) return
    if (t.type === 'chord') {
      if (e.source === 'mic') {
        // The mic can miss a chord's 5th or hear a stray overtone, so be forgiving and don't count mistakes.
        if (inChord({ ...t, anyOctave: true }, e.midi)) flashKey(e.midi, 'good')
        if (micHearsNotes([...heldNow(), ...selected], targets, t.bass ? noteMidi(t.bass) : undefined)) succeed()
        return
      }
      if (inChord(t, e.midi)) flashKey(e.midi, 'good')
      // The right note an octave off isn't a slip: the feedback line says so.
      else if (wrongOctave(t, e.midi)) return say(wrongNoteMessage(t, e.midi, naming))
      else return mistake(e.midi, e.source)
      checkChord(selected)
      return
    }
    const r = feedNote(t, state, e.midi)
    setState(r.state)
    if (r.verdict === 'good') {
      flashKey(e.midi, 'good')
      say(null)
    }
    if (r.verdict === 'bad') mistake(e.midi, e.source)
    if (r.state.done) succeed()
  })

  const onToggle = (m: number) => {
    if (solved) return
    const on = !selected.includes(m)
    const next = on ? [...selected, m] : selected.filter((x) => x !== m)
    setSelected(next)
    if (on && !inChord(t, m) && !wrongOctave(t, m)) return mistake(m, 'screen')
    checkChord(next)
  }

  // Which keys to light up, from lowest to highest priority.
  const marks: Marks = { ...p.marks }
  const visible = (m: number) => m >= p.from && m <= p.to
  // Exact key when the octave matters (and for chords, the written voicing); otherwise every key with that name.
  const markPc = (target: number, kind: 'target' | 'hint') => {
    const exact = t.type === 'chord' ? visible(target) : !t.anyOctave && visible(target)
    if (exact) {
      marks[target] = kind
      return
    }
    for (let m = p.from; m <= p.to; m++) if (mod(m, 12) === mod(target, 12)) marks[m] = kind
  }
  if (!ts.on && (step.showTargets || showHint)) {
    const kind = step.showTargets ? 'target' : 'hint'
    if (t.type === 'sequence') {
      if (!state.done) markPc(targets[state.index], kind)
    } else if (t.type === 'set') {
      targets.forEach((x, i) => !state.found.includes(i) && markPc(x, kind))
    } else targets.forEach((x) => markPc(x, kind))
  }
  if (t.type === 'set') state.found.forEach((i) => visible(targets[i]) && (marks[targets[i]] = 'good'))
  // The demo's keys, as they sound (the same key in another octave when the written one isn't shown).
  for (const m of demo.lit) {
    if (visible(m)) marks[m] = 'chord'
    else for (let x = p.from; x <= p.to; x++) if (mod(x, 12) === mod(m, 12)) marks[x] = 'chord'
  }
  // In time: the demo's keys, a flash for each note you play, and as a hint the next note's key.
  const run = ts.timed.run
  if (ts.on && run) {
    for (const m of run.lit) if (visible(m)) marks[m] = 'chord'
    if (showHint && ts.timed.running && !run.demo) {
      const next = run.results.findIndex((r) => r.verdict === null)
      if (next >= 0) markPc(targets[next], 'hint')
    }
    if (run.hitAt !== null) marks[run.hitAt] = 'good'
    if (run.wrongAt !== null) marks[run.wrongAt] = 'bad'
  }
  selected.forEach((m) => (marks[m] = inChord(t, m) ? 'selected' : 'bad'))
  for (const [m, kind] of Object.entries(flash)) marks[Number(m)] = kind
  if (solved && t.type === 'chord') targets.forEach((m) => visible(m) && (marks[m] = 'good'))

  // Staff: highlight where you are in a sequence, turn green when solved. In time, each note shows how it went:
  // green on the beat, amber a little off, red too far off, wrong or missed.
  const staff = step.staff
  const timedOn = ts.on
  const running = ts.timed.running
  const staffItems = useMemo(() => {
    if (!staff) return null
    // Which note each event is (rests are none), when the staff spells out the rhythm.
    const noteAt = new Map((rhythm?.notes ?? []).map((n, k) => [n.event, k]))
    let ev = 0
    return staff.items.map((it): StaffItem => {
      if ('bar' in it) return it
      const idx = ev++
      const k = rhythm ? noteAt.get(idx) : idx
      if (timedOn) {
        if (k === undefined || !run) return solved && k !== undefined ? { ...it, state: 'correct' } : it
        if (run.demo) return k === run.step ? { ...it, state: 'active' } : it
        const r = run.results[k]
        if (r.verdict === null) return running && k === run.step ? { ...it, state: 'active' } : it
        if (r.verdict === 'perfect' || r.verdict === 'good') return { ...it, state: 'correct' }
        if ((r.verdict === 'early' || r.verdict === 'late') && run.inTime[k]) return { ...it, notes: it.notes?.map((n) => tint(n, CLOSE_COLOR)) }
        return { ...it, state: 'wrong' }
      }
      if (solved) return { ...it, state: 'correct' }
      if (t.type === 'sequence' && k !== undefined) {
        if (k < state.index) return { ...it, state: 'done' }
        if (k === state.index) return { ...it, state: 'active' }
      }
      return it
    })
  }, [staff, solved, state.index, t.type, rhythm, timedOn, run, running])

  const hasProgress = t.type === 'set' || t.type === 'sequence'
  const count = t.type === 'set' ? state.found.length : state.index
  const onScreenChord = t.type === 'chord'

  const showMe = () => {
    // Asking for help costs one slip; hearing it again is free.
    if (!hintAsked) onMistake(1)
    setHintAsked(true)
    // In time: a count-in, then the notes with the clicks, the way you'll play it.
    if (ts.on) return ts.demo()
    if (t.type === 'chord') {
      playNotes(targets, { dur: 1.6, strum: 0.04 })
      demo.show([targets], { gap: 0, dur: 1.6, strum: 0.04 })
    } else if (t.type === 'note') {
      playNotes([targets[0]], { dur: 1.4 })
      demo.show([targets[0]], { gap: 0, dur: 1.4 })
    } else if (rhythm) {
      // The rhythm as it's written, at an easy tempo. A key goes out just before it plays again.
      const beat = 60 / DEMO_BPM
      const notes = rhythm.notes.map((n) => ({ midis: [n.midi], at: n.at * beat, dur: Math.max(0.2, n.len * beat * 0.92) }))
      playTimed(notes)
      demo.showEvents(notes.map((n, k) => ({ midi: n.midis[0], on: n.at, off: n.at + Math.min(n.dur, ((notes[k + 1]?.at ?? Infinity) - n.at) * 0.85) })))
    } else {
      playSequence(targets, { gap: 0.45 })
      demo.show(targets, { gap: 0.45, dur: 0.45 * 1.5 })
    }
  }

  const feedbackLine = (
    <p aria-live="polite" className={`text-center text-lg font-bold text-ink-soft ${short ? '' : 'min-h-7'}`}>
      {feedback && <MusicText text={feedback} />}
    </p>
  )

  return (
    <div className={`flex min-h-full flex-1 flex-col ${short ? (ts.on ? 'gap-2' : 'gap-3') : 'gap-4'}`}>
      <div className="text-center">
        {step.title && <div className="mb-1 text-sm font-extrabold uppercase tracking-[0.18em] text-gold">{step.title}</div>}
        <h2
          tabIndex={-1}
          data-step-heading
          className={`mx-auto font-display font-bold leading-tight outline-none ${short ? 'max-w-4xl text-2xl sm:text-3xl' : 'max-w-3xl text-3xl sm:text-4xl'}`}
        >
          <RichText text={step.prompt} />
        </h2>
        {step.body && <RichText text={step.body} className={`mx-auto mt-2 text-lg text-ink-soft ${short ? 'max-w-3xl' : 'max-w-2xl'}`} />}
      </div>

      {/* Played in time on a short screen, the staff takes the next size down, making room to say how it went. */}
      {staffItems && staff && (
        <StaffView s={{ ...staff, items: staffItems }} sp={pictureSp(ts.on && short ? Math.min(vh, 719) : vh, staff.clef)} className="mx-auto w-full max-w-4xl" />
      )}

      {/* shrink-0: when room runs out the page scrolls; this never gets squeezed over the keyboard. */}
      <div className={`mx-auto flex w-full shrink-0 flex-col items-center justify-center gap-2 ${ts.on ? '' : 'min-h-14'} ${short ? 'max-w-4xl' : 'max-w-3xl'}`}>
        {ts.on ? (
          <>
            <TimedPanel ts={ts} step={step} solved={solved} praise={praise} onShowMe={showMe} extra={short && !solved ? <MicPrompt /> : null} compact={short} />
            {!solved && !short && <MicPrompt />}
          </>
        ) : (
          <>
            <AnimatePresence mode="wait">
              {solved ? (
                <motion.div
                  key="ok"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                  className="flex items-center gap-2.5 rounded-2xl bg-good/15 px-5 py-3 text-xl font-extrabold text-good"
                >
                  <CheckCircle2 size={28} /> {step.success ?? praise}
                </motion.div>
              ) : showHint && step.hint ? (
                <motion.div key="hint" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-2xl bg-gold/12 px-5 py-3 text-center text-lg font-bold text-gold">
                  <RichText text={step.hint} />
                </motion.div>
              ) : null}
            </AnimatePresence>
            {/* The progress dots stay visible when a hint appears. */}
            {!solved && hasProgress && (
              <div className="flex flex-wrap justify-center gap-2">
                {targets.map((_, i) => (
                  <motion.span
                    key={i}
                    animate={{ scale: i < count ? [1, 1.4, 1] : 1 }}
                    className={`size-4 rounded-full ${i < count ? 'bg-good shadow-[0_0_12px_#3ddc97]' : 'bg-white/15'}`}
                  />
                ))}
              </div>
            )}
            {!solved && !short && feedbackLine}
            {solved && onRetry && (
              <Button size="md" variant="ghost" icon={RotateCcw} onClick={onRetry}>
                Play it again
              </Button>
            )}
            {!solved && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-ink-mute">
                {/* On a short screen what you just played shares this row too. */}
                {short && feedbackLine}
                {onScreenChord && (mic === 'on' ? 'Play the chord and let it ring.' : 'Hold the notes together, or tap each key on screen.')}
                {onScreenChord && selected.length > 0 && (
                  <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setSelected([])}>
                    Clear
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={HelpCircle} onClick={showMe}>
                  Show me
                </Button>
                {/* On a short screen the mic shares this row rather than taking one of its own. */}
                {short && <MicPrompt />}
              </div>
            )}
            {!solved && !short && <MicPrompt />}
          </>
        )}
      </div>

      {/* The keyboard takes whatever height is left, so it's always fully on screen. */}
      {/* In time, room for the whole keyboard is kept, so a result line above it is never covered. */}
      <div ref={areaRef} className={`flex flex-1 flex-col justify-end ${short ? (ts.on ? 'min-h-[160px]' : 'min-h-[140px]') : 'min-h-[190px]'}`}>
        <div ref={kbRef}>
          <Piano
            {...p}
            marks={marks}
            sparks
            sparkHeight={Math.max(40, Math.min(120, areaH - pianoHeight(areaH, p.from, p.to) - 30))}
            mode={onScreenChord ? 'toggle' : 'play'}
            onToggle={onToggle}
            height={pianoHeight(areaH, p.from, p.to)}
            labels={p.labels ?? (targets.some(isBlackKey) ? 'all' : undefined)}
          />
        </div>
      </div>
    </div>
  )
}
