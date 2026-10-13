import { motion } from 'motion/react'
import { type AlongSession, tendency } from './along'

/**
 * Under the music while you play along: what to do before you start, then how this run (or this time round the
 * loop) is going, and where your latest notes land against the beat.
 */
export function AlongStatus({ session, playing, nudge, loop }: { session: AlongSession | null; playing: boolean; nudge: boolean; loop: boolean }) {
  if (!session?.judge) {
    if (playing) return <span className="text-base font-semibold text-ink-soft">Come in on the beat after the clicks.</span>
    return (
      <span className={`text-base font-semibold ${nudge ? 'text-gold' : 'text-ink-soft'}`}>
        {nudge
          ? 'Press Play first (or Space, Enter or a pedal tap), then play along.'
          : 'Press Play (or Space): a bar of clicks counts you in, then play your part with the music.'}
      </span>
    )
  }
  const s = session.stats(loop ? session.shown : undefined)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Count n={s.inTime} label="in time" tone="text-good" />
      {s.early > 0 && <Count n={s.early} label="early" tone="text-gold" />}
      {s.late > 0 && <Count n={s.late} label="late" tone="text-gold" />}
      {s.off > 0 && <Count n={s.off} label="off the beat" tone="text-coral" />}
      {s.missed > 0 && <Count n={s.missed} label="missed" tone="text-ink-soft" />}
      {s.wrong > 0 && <Count n={s.wrong} label="wrong" tone="text-bad" />}
      {playing && <TimingNeedle drift={session.drift()} />}
    </div>
  )
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className={`rounded-full bg-white/6 px-3 py-1 text-sm font-extrabold ${tone}`}>
      <span className="tabular-nums">{n}</span> {label}
    </span>
  )
}

/** Where your latest notes land: the dot moves left of the middle when you rush, right when you drag (150 ms = the end). */
function TimingNeedle({ drift }: { drift: number | null }) {
  const x = drift === null ? 0 : Math.max(-1, Math.min(1, drift / 0.15))
  const lean = tendency(drift)
  const word = drift === null ? null : lean === 'rushing' ? 'Rushing' : lean === 'dragging' ? 'Dragging' : 'On the beat'
  const ms = drift === null ? 0 : Math.round(Math.abs(drift) * 1000)
  return (
    <span
      className="inline-flex items-center gap-2 text-sm font-extrabold"
      role="img"
      aria-label={drift === null ? 'Your timing shows here as you play' : `${word}: your latest notes are about ${ms} ms ${drift < 0 ? 'early' : 'late'}`}
    >
      <span className="text-ink-mute">Early</span>
      <span className="relative h-2.5 w-28 rounded-full bg-white/10">
        <span className="absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/40" />
        {drift !== null && (
          <motion.span
            className="absolute top-1/2 -ml-[7px] size-3.5 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_10px_#ffc857]"
            initial={false}
            animate={{ left: `${50 + x * 50}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          />
        )}
      </span>
      <span className="text-ink-mute">Late</span>
      {word && <span className={lean ? 'text-gold' : 'text-good'}>{word}</span>}
    </span>
  )
}
