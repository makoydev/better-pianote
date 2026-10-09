import { CheckCircle2, Volume2, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { MusicText } from '../../../components/MusicText'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'
import { RichText } from '../../../components/ui/RichText'
import type { QuizStep } from '../../../content/types'
import { audio } from '../../../lib/audio/engine'
import { playSequence } from '../../../lib/audio/play'
import { burst } from '../../../lib/fx'
import { useSettings } from '../../../state/settings'
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
  const [wrong, setWrong] = useState<number[]>([])
  const [shake, setShake] = useState<number | null>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

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

  const choose = (i: number) => {
    if (solved || wrong.includes(i)) return
    if (i === step.answer) {
      onSolved()
      if (uiSounds) audio.ui('correct')
      burst(optionRefs.current[i], { count: 45 })
    } else {
      setWrong((w) => [...w, i])
      setShake(i)
      window.setTimeout(() => setShake(null), 450)
      onMistake()
      if (uiSounds) audio.ui('wrong')
    }
  }

  // Number keys 1–4 pick an answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= step.options.length) choose(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
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
      <div className={`grid gap-3 ${step.options.length > 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
        {step.options.map((o, i) => {
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
              animate={shake === i ? { x: [0, -10, 10, -7, 7, 0] } : isRight ? { scale: [1, 1.05, 1] } : {}}
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
                {isRight ? <CheckCircle2 size={20} /> : isWrong ? <XCircle size={20} /> : i + 1}
              </span>
              <MusicText text={o} />
            </motion.button>
          )
        })}
      </div>
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
