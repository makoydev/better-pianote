import { CheckCircle2, Eraser, HelpCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useElementSize } from '../../../hooks/useElementSize'
import { useViewportHeight } from '../../../hooks/useViewport'
import { type Marks, Piano } from '../../../components/piano/Piano'
import type { StaffItem } from '../../../components/staff/Staff'
import { Button } from '../../../components/ui/Button'
import { RichText } from '../../../components/ui/RichText'
import type { KeyboardVisual, PlayStep, Target } from '../../../content/types'
import { audio } from '../../../lib/audio/engine'
import { playNotes, playSequence } from '../../../lib/audio/play'
import { burst } from '../../../lib/fx'
import { heldNow, useNoteEvents } from '../../../lib/input/bus'
import { useMicChords } from '../../../lib/input/mic'
import { micHearsNotes } from '../../../lib/input/micMatch'
import { isBlackKey, mod } from '../../../lib/theory'
import { useLive } from '../../../state/live'
import { useSettings } from '../../../state/settings'
import { chordMatches, feedNote, inChord, initialMatch, targetMidis } from '../match'
import { StaffView } from '../VisualBlock'
import { keyboardHeight, noteMidi, pianoProps } from '../visual'

/** As tall as the space allows (leaving room for sparks and the middle-C label), within sensible limits. */
function pianoHeight(area: number, from: number, to: number) {
  const ideal = keyboardHeight(from, to) + 20
  return Math.round(Math.max(130, Math.min(ideal, area - 64)))
}

const PRAISE = ['Nice!', 'Perfect!', 'You got it!', 'Spot on!', 'Beautiful!', 'Nailed it!']

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
}: {
  step: PlayStep
  solved: boolean
  onSolved: () => void
  onMistake: () => void
}) {
  const t = step.target
  const uiSounds = useSettings((s) => s.uiSounds)
  const mic = useLive((s) => s.mic)
  const [state, setState] = useState(initialMatch)
  const [flash, setFlash] = useState<Record<number, 'good' | 'bad'>>({})
  const [wrong, setWrong] = useState(0)
  const [hintAsked, setHintAsked] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)])
  const kbRef = useRef<HTMLDivElement>(null)
  const [areaRef, { height: areaH }] = useElementSize<HTMLDivElement>()
  // On short screens the staff shrinks so the keyboard always stays fully visible.
  const vh = useViewportHeight()
  const staffSp = vh < 720 ? 13 : vh < 880 ? 16 : 20

  const k = step.keyboard ?? defaultKeyboard(t)
  const p = pianoProps(k)
  const targets = useMemo(() => targetMidis(t), [t])
  const showHint = !solved && (wrong >= 2 || hintAsked)
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
  const mistake = (m: number) => {
    flashKey(m, 'bad')
    setWrong((w) => w + 1)
    onMistake()
    if (uiSounds) audio.ui('wrong')
  }
  const succeed = () => {
    onSolved()
    if (uiSounds) audio.ui('correct')
    burst(kbRef.current, { count: 50 })
  }

  const checkChord = (extra: number[]) => {
    if (chordMatches(t, [...extra, ...heldNow()])) succeed()
  }

  useNoteEvents((e) => {
    if (solved || e.type !== 'on') return
    if (t.type === 'chord') {
      if (e.source === 'mic') {
        // The mic can miss a chord's 5th or hear a stray overtone, so be forgiving and don't count mistakes.
        if (inChord({ ...t, anyOctave: true }, e.midi)) flashKey(e.midi, 'good')
        if (micHearsNotes([...heldNow(), ...selected], targets, t.bass ? noteMidi(t.bass) : undefined)) succeed()
        return
      }
      if (!inChord(t, e.midi)) mistake(e.midi)
      else flashKey(e.midi, 'good')
      checkChord(selected)
      return
    }
    const r = feedNote(t, state, e.midi)
    setState(r.state)
    if (r.verdict === 'good') flashKey(e.midi, 'good')
    if (r.verdict === 'bad') mistake(e.midi)
    if (r.state.done) succeed()
  })

  const onToggle = (m: number) => {
    if (solved) return
    const on = !selected.includes(m)
    const next = on ? [...selected, m] : selected.filter((x) => x !== m)
    setSelected(next)
    if (on && !inChord(t, m)) mistake(m)
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
  if (step.showTargets || showHint) {
    const kind = step.showTargets ? 'target' : 'hint'
    if (t.type === 'sequence') {
      if (!state.done) markPc(targets[state.index], kind)
    } else if (t.type === 'set') {
      targets.forEach((x, i) => !state.found.includes(i) && markPc(x, kind))
    } else targets.forEach((x) => markPc(x, kind))
  }
  if (t.type === 'set') state.found.forEach((i) => visible(targets[i]) && (marks[targets[i]] = 'good'))
  selected.forEach((m) => (marks[m] = inChord(t, m) ? 'selected' : 'bad'))
  for (const [m, kind] of Object.entries(flash)) marks[Number(m)] = kind
  if (solved && t.type === 'chord') targets.forEach((m) => visible(m) && (marks[m] = 'good'))

  // Staff: highlight where you are in a sequence, turn green when solved.
  const staff = step.staff
  const staffItems = useMemo(() => {
    if (!staff) return null
    let ev = 0
    return staff.items.map((it): StaffItem => {
      if ('bar' in it) return it
      const idx = ev++
      if (solved) return { ...it, state: 'correct' }
      if (t.type === 'sequence') {
        if (idx < state.index) return { ...it, state: 'done' }
        if (idx === state.index) return { ...it, state: 'active' }
      }
      return it
    })
  }, [staff, solved, state.index, t.type])

  const hasProgress = t.type === 'set' || t.type === 'sequence'
  const count = t.type === 'set' ? state.found.length : state.index
  const onScreenChord = t.type === 'chord'

  const showMe = () => {
    setHintAsked(true)
    onMistake()
    if (t.type === 'chord') playNotes(targets, { dur: 1.6, strum: 0.04 })
    else if (t.type === 'note') playNotes([targets[0]])
    else playSequence(targets, { gap: 0.45 })
  }

  return (
    <div className="flex min-h-full flex-1 flex-col gap-4">
      <div className="text-center">
        {step.title && <div className="mb-1 text-sm font-extrabold uppercase tracking-[0.18em] text-gold">{step.title}</div>}
        <h2 className={`mx-auto max-w-3xl font-display font-bold leading-tight ${vh < 720 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
          <RichText text={step.prompt} />
        </h2>
        {step.body && <RichText text={step.body} className="mx-auto mt-2 max-w-2xl text-lg text-ink-soft" />}
      </div>

      {staffItems && staff && <StaffView s={{ ...staff, items: staffItems }} sp={staffSp} className="mx-auto w-full max-w-4xl" />}

      <div className="mx-auto flex min-h-14 w-full max-w-3xl flex-col items-center justify-center gap-2">
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
          ) : hasProgress ? (
            <motion.div key="dots" className="flex flex-wrap justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {targets.map((_, i) => (
                <motion.span
                  key={i}
                  animate={{ scale: i < count ? [1, 1.4, 1] : 1 }}
                  className={`size-4 rounded-full ${i < count ? 'bg-good shadow-[0_0_12px_#3ddc97]' : 'bg-white/15'}`}
                />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {!solved && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-ink-mute">
            {onScreenChord && (mic === 'on' ? 'Play the chord and let it ring.' : 'Hold the notes together, or tap each key on screen.')}
            {onScreenChord && selected.length > 0 && (
              <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setSelected([])}>
                Clear
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={HelpCircle} onClick={showMe}>
              Show me
            </Button>
          </div>
        )}
      </div>

      {/* The keyboard takes whatever height is left, so it's always fully on screen. */}
      <div ref={areaRef} className="flex min-h-[190px] flex-1 flex-col justify-end">
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
