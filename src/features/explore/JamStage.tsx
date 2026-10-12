import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MusicText } from '../../components/MusicText'
import { type Chord, chordSymbol } from '../../lib/theory'
import { type Meter, accented, nashville, romanLabel } from './jam'

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
              className="font-display text-6xl font-bold leading-tight text-gold sm:text-7xl [@media(min-height:860px)]:text-8xl"
            >
              {pos && pos.beat >= 0 ? pos.beat + 1 : '…'}
            </motion.div>
          ) : (
            <motion.div key={`now-${cur}`} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="truncate font-display text-6xl font-bold leading-tight sm:text-7xl [@media(min-height:860px)]:text-8xl">
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
            <div className="truncate font-display text-4xl font-bold leading-tight text-ink-soft sm:text-5xl">
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
