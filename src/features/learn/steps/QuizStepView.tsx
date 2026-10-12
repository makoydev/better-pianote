import { CheckCircle2, Piano, Volume2, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { MusicText } from '../../../components/MusicText'
import { MicPrompt } from '../../../components/layout/MicPrompt'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'
import { RichText } from '../../../components/ui/RichText'
import type { QuizStep } from '../../../content/types'
import { audio } from '../../../lib/audio/engine'
import { playSequence } from '../../../lib/audio/play'
import { isPlainKey, isTypingTarget } from '../../../lib/focus'
import { burst } from '../../../lib/fx'
import { type NoteSource, heldNow, useNoteEvents } from '../../../lib/input/bus'
import { useMicChords } from '../../../lib/input/mic'
import { nameNote } from '../../../lib/naming'
import { detectChord, fromMidi, mod } from '../../../lib/theory'
import { useSettings } from '../../../state/settings'
import { optionForChord, optionsForNote, playableQuiz } from '../quizPlay'
import { optionOrder } from '../quizOrder'
import { VisualBlock } from '../VisualBlock'
import { noteMidi } from '../visual'

export function QuizStepView({
  step,
  solved,
  onSolved,
  onMistake,
}: {
  step: QuizStep
  solved: boolean
  onSolved: () => void
  onMistake: () => void
}) {
  const uiSounds = useSettings((s) => s.uiSounds)
  const naming = useSettings((s) => s.naming)
  const [wrong, setWrong] = useState<number[]>([])
  const [shake, setShake] = useState<number[]>([])
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Shown order (indices into step.options), fixed for this visit to the question.
  const [order] = useState(() => optionOrder(step.options, step.ordered))
  // Note and chord questions can be answered on the keyboard too.
  const playable = useMemo(() => playableQuiz(step.options, step.answer), [step.options, step.answer])
  useMicChords(playable?.kind === 'chord')
  // What you played when it isn't one of the options ("That's G.").
  const [heard, setHeard] = useState<string | null>(null)
  const heardTimer = useRef(0)
  const lastPlayed = useRef(-Infinity)
  // Keys still held from the step before don't count until they're let go.
  const stale = useRef(new Set(heldNow()))
  useEffect(() => () => window.clearTimeout(heardTimer.current), [])
  const say = (text: string | null) => {
    setHeard(text)
    window.clearTimeout(heardTimer.current)
    if (text) heardTimer.current = window.setTimeout(() => setHeard(null), 2600)
  }

  const listen = () => {
    if (!step.listen) return
    const steps = step.listen.notes.map((n) => (Array.isArray(n) ? n.map(noteMidi) : noteMidi(n)))
    playSequence(steps, { gap: step.listen.gap ?? 0.6, dur: step.listen.dur })
  }
  // Play the sound once, when the question appears.
  const listenOnce = useEffectEvent(listen)
  useEffect(() => {
    const id = window.setTimeout(listenOnce, 450)
    return () => window.clearTimeout(id)
  }, [])

  /** Tapped or played: the right answer solves it; a wrong one is marked (both, when two options share a key). */
  const answer = (picks: number[], source?: NoteSource) => {
    if (solved) return
    if (picks.includes(step.answer)) {
      say(null)
      onSolved()
      if (uiSounds) audio.ui('correct')
      burst(optionRefs.current[step.answer], { count: 45 })
      return
    }
    const fresh = picks.filter((k) => !wrong.includes(k))
    if (fresh.length === 0) return
    setWrong((w) => [...w, ...fresh])
    setShake(fresh)
    window.setTimeout(() => setShake([]), 450)
    onMistake()
    // No buzz for the mic: the app's own sound makes it deaf for a moment while your note still rings.
    if (uiSounds && source !== 'mic') audio.ui('wrong')
  }
  const choose = (i: number) => answer([i])

  // A held chord: once its notes have landed together (no new note for a moment), which option does it make?
  const checkChord = useEffectEvent((source: NoteSource) => {
    if (!playable || solved) return
    const held = heldNow().filter((m) => !stale.current.has(m))
    const k = optionForChord(playable, held, source === 'mic')
    if (k !== null) return answer([k], source)
    // A whole chord that isn't one of the options: say what it was (the mic's guesses are too rough for that).
    const chord = source !== 'mic' && new Set(held.map((m) => mod(m, 12))).size >= 3 ? detectChord(held) : null
    if (chord) say(`That's ${chord.symbol}.`)
  })
  const [chordNote, setChordNote] = useState<{ n: number; source: NoteSource } | null>(null)
  useEffect(() => {
    if (!chordNote) return
    const id = window.setTimeout(() => checkChord(chordNote.source), 250)
    return () => window.clearTimeout(id)
  }, [chordNote])

  useNoteEvents((e) => {
    if (!playable || solved) return
    if (e.type === 'off') {
      stale.current.delete(e.midi)
      return
    }
    if (playable.kind === 'chord') {
      setChordNote((c) => ({ n: (c?.n ?? 0) + 1, source: e.source }))
      return
    }
    // A chord (or a slip of the hand) on a note question is one answer: its first note.
    if (e.time - lastPlayed.current < 300) return
    lastPlayed.current = e.time
    const picks = optionsForNote(playable, e.midi, e.source === 'mic')
    if (picks.length > 0) return answer(picks, e.source)
    const n = fromMidi(e.midi)
    say(`That's ${nameNote(n, naming, { octave: playable.notes.some((o) => o.midi !== null) })}.`)
  })

  // Number keys 1–4 pick the answer shown in that place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || isTypingTarget(e.target)) return
      const n = Number(e.key)
      if (n >= 1 && n <= order.length) choose(order[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Three options share one row (a pair plus an orphan looks unfinished); long ones stack instead.
  const cols = step.options.length === 3 ? (step.options.some((o) => o.length > 22) ? '' : 'sm:grid-cols-3') : 'sm:grid-cols-2'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="text-center">
        <h2 tabIndex={-1} data-step-heading className="font-display text-3xl font-bold leading-tight outline-none sm:text-4xl">
          <RichText text={step.question} />
        </h2>
        {step.body && <RichText text={step.body} className="mt-2 text-lg text-ink-soft" />}
      </div>
      {step.listen && (
        <div className="flex justify-center">
          <Button variant="secondary" size="xl" icon={Volume2} onClick={listen}>
            {step.listen.label || 'Listen again'}
          </Button>
        </div>
      )}
      {step.visual && <VisualBlock v={step.visual} />}
      <div className={`grid gap-3 ${cols}`}>
        {order.map((i, place) => {
          const o = step.options[i]
          const isRight = solved && i === step.answer
          const isWrong = wrong.includes(i)
          return (
            <motion.button
              key={i}
              ref={(el) => {
                optionRefs.current[i] = el
              }}
              type="button"
              onClick={() => choose(i)}
              disabled={solved && !isRight}
              whileTap={{ scale: 0.97 }}
              animate={shake.includes(i) ? { x: [0, -10, 10, -7, 7, 0] } : isRight ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={`flex min-h-18 items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-xl font-extrabold transition-colors ${
                isRight
                  ? 'border-good bg-good/15 text-good'
                  : isWrong
                    ? 'border-bad/50 bg-bad/10 text-bad/80'
                    : 'border-white/10 bg-night-750 text-ink hover:border-gold/60 hover:bg-night-700'
              } ${solved && !isRight ? 'opacity-50' : ''}`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base ${
                  isRight ? 'bg-good text-night-900' : isWrong ? 'bg-bad/30' : 'bg-white/8 text-ink-mute'
                }`}
              >
                {isRight ? <CheckCircle2 size={20} /> : isWrong ? <XCircle size={20} /> : place + 1}
              </span>
              <MusicText text={o} />
            </motion.button>
          )
        })}
      </div>
      {playable && !solved && (
        <div className="-mt-2 flex flex-col items-center gap-1.5 text-center">
          <p className="flex items-center gap-2 text-base font-semibold text-ink-mute">
            <Piano size={18} aria-hidden /> …or play your answer{playable.kind === 'chord' ? ' (hold the chord)' : ''}
          </p>
          <p aria-live="polite" className="min-h-7 text-lg font-bold text-ink-soft">
            {heard && <MusicText text={heard} />}
          </p>
          <MicPrompt />
        </div>
      )}
      <AnimatePresence>
        {solved && step.explain && (
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <Callout kind="info" title="Why" text={step.explain} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
