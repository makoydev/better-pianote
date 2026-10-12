import { Check, Mic, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MusicText } from '../../components/MusicText'
import { type Chord, chordSymbol } from '../../lib/theory'
import { type Meter, accented, nashville, romanLabel } from './jam'
import type { Played } from './playAlong'

/** How a pass through the progression went. `timed` is false when the mic heard it (no beat check). */
export interface LoopScore {
  loop: number
  played: number
  onTime: number
  total: number
  timed: boolean
}

/** Where the band is: the chord (-1 during the count-in), the count within the chord, and the count within the bar. */
export interface JamPos {
  chord: number
  beat: number
  count: number
}

/** While the band plays: the chord now and the one coming, big enough to read from the piano, and the beat. */
export function JamStage({
  chords,
  romans,
  pos,
  cur,
  next,
  hasNext,
  lastBeat,
  meter,
  beats,
  children,
}: {
  chords: Chord[]
  romans: string[]
  pos: JamPos | null
  cur: number
  next: number
  /** False on the last chord when the progression doesn't loop. */
  hasNext: boolean
  /** The last count of this chord: the next one is about to come in. */
  lastBeat: boolean
  meter: Meter
  /** Counts in each chord. */
  beats: number
  /** Play-along feedback under the beat. */
  children?: ReactNode
}) {
  const counting = !!pos && pos.chord < 0
  const barCounts = meter.bar / meter.count
  const bars = beats / barCounts
  const bar = pos && !counting ? Math.floor(pos.beat / barCounts) : 0

  return (
    <div className="glass relative grid shrink-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-x-4 gap-y-3 overflow-hidden rounded-3xl p-4 sm:p-5">
      <div className="min-w-0">
        <div className="text-xs font-extrabold uppercase tracking-widest text-gold">{counting ? 'Count-in' : 'Now'}</div>
        <AnimatePresence mode="popLayout" initial={false}>
          {counting ? (
            <motion.div
              key={`count-${pos?.beat ?? 0}`}
              initial={{ scale: 1.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-display text-6xl font-bold leading-tight text-gold [@media(min-height:820px)]:sm:text-7xl [@media(min-height:960px)]:sm:text-8xl"
            >
              {pos && pos.beat >= 0 ? pos.beat + 1 : '…'}
            </motion.div>
          ) : (
            <motion.div key={`now-${cur}`} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="truncate font-display text-6xl font-bold leading-tight [@media(min-height:820px)]:sm:text-7xl [@media(min-height:960px)]:sm:text-8xl">
                <MusicText text={chordSymbol(chords[cur])} />
              </div>
              <div className="text-base font-extrabold">
                <span className="text-gold">
                  <MusicText text={romanLabel(romans[cur])} />
                </span>
                <span className="text-ink-mute">
                  {' · '}
                  <MusicText text={nashville(romans[cur])} />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`min-w-0 rounded-2xl border px-3 py-2 transition-colors ${lastBeat ? 'border-gold/70 bg-gold/10' : 'border-white/8'}`}>
        <div className="text-xs font-extrabold uppercase tracking-widest text-ink-mute">{counting ? 'First' : 'Next'}</div>
        {hasNext || counting ? (
          <motion.div key={`next-${counting ? 0 : next}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="truncate font-display text-4xl font-bold leading-tight text-ink-soft [@media(min-height:820px)]:sm:text-5xl">
              <MusicText text={chordSymbol(chords[counting ? 0 : next])} />
            </div>
            <div className="text-sm font-extrabold text-ink-mute">
              <MusicText text={romanLabel(romans[counting ? 0 : next])} />
            </div>
          </motion.div>
        ) : (
          <div className="font-display text-3xl font-bold leading-tight text-ink-mute">The end</div>
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <BeatDots meter={meter} count={pos?.count ?? -1} />
        {bars > 1 && !counting && (
          <span className="text-sm font-extrabold text-ink-mute">
            Bar {bar + 1} of {bars}
          </span>
        )}
        {children && <div className="min-w-0 flex-1">{children}</div>}
      </div>
    </div>
  )
}

/** "✓ On the beat", "✓ 120 ms early": how you came in on the chord you just played. */
export function Verdict({ played, chord }: { played: Played; chord: Chord | undefined }) {
  const ms = played.error === null ? null : Math.round(Math.abs(played.error) * 1000)
  const text = played.timing === null ? 'played' : played.timing === 'on' ? 'on the beat' : `${ms} ms ${played.timing}`
  const good = played.timing === null || played.timing === 'on'
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold ${good ? 'bg-good/15 text-good' : 'bg-gold/15 text-gold'}`}
      role="status"
    >
      <Check size={16} strokeWidth={3} />
      {chord && <MusicText text={chordSymbol(chord)} />}
      <span>{text}</span>
    </motion.span>
  )
}

/** "Loop 2: 7 of 8 chords · 5 on the beat". */
export function ScorePill({ score, label }: { score: LoopScore; label: string }) {
  const all = score.played === score.total && (!score.timed || score.onTime === score.total)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold ${all ? 'bg-gold/15 text-gold' : 'bg-white/8 text-ink-soft'}`}>
      {all && <Trophy size={16} />}
      {label}: {score.played} of {score.total} chords{score.timed ? ` · ${score.onTime} on the beat` : ''}
    </span>
  )
}

/** The mic hears the band too (playing your very notes), so say why chords may not tick through it. */
export function MicNote() {
  return (
    <p className="flex items-start gap-1.5 text-sm font-semibold text-ink-mute">
      <Mic size={16} className="mt-0.5 shrink-0 text-violet" />
      Through the mic, the band’s own sound gets in the way of hearing you, so your chords may not tick off. A USB cable works, or turn the
      band’s bass, chords and drums off.
    </p>
  )
}

/** One bar's counts, Metronome-sized: numbered, the beat starts in gold, the current one lit. */
export function BeatDots({ meter, count }: { meter: Meter; count: number }) {
  const n = meter.bar / meter.count
  return (
    <div className="flex gap-2" aria-hidden>
      {Array.from({ length: n }, (_, b) => {
        const on = b === count
        const acc = accented(meter, b)
        return (
          <motion.span
            key={b}
            animate={{ scale: on ? 1.22 : 1, opacity: on ? 1 : 0.35 }}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
            className={`flex size-10 items-center justify-center rounded-full text-sm font-extrabold text-night-900 ${acc ? 'bg-gold' : 'bg-violet'}`}
            style={on ? { boxShadow: `0 0 22px ${acc ? '#ffc857' : '#9b8cff'}` } : undefined}
          >
            {b + 1}
          </motion.span>
        )
      })}
    </div>
  )
}
