import { Check, Copy, Disc3, Eraser, Layers, type LucideIcon, Play, Square, Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { MusicText } from '../../components/MusicText'
import { type Chord, type Key, chordSymbol, chordToRoman } from '../../lib/theory'
import type { ChartEntry } from './chart'

/** A round-ish toolbar button: icon always, its word when there's room (and always for screen readers). */
function Tool({ icon: Icon, label, onClick, disabled, wide, active }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; wide?: boolean; active?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition-colors disabled:opacity-40 ${
        active ? 'bg-gold/20 text-gold' : 'bg-white/6 text-ink-soft hover:bg-white/10 hover:text-ink'
      }`}
    >
      <Icon size={17} />
      <span className={wide ? '' : 'hidden min-[1150px]:inline'}>{label}</span>
    </motion.button>
  )
}

/**
 * The "You played" chart: the chords you've played, like a chord chart, newest on the right. Tap a chord to hear it
 * (and get its ×), and use the tools to hear it all in time, copy it, loop it in the Jam or clear it.
 */
export function ChordChart({
  entries,
  chords,
  keyOf,
  selected,
  playingAt,
  copied,
  found,
  onTap,
  onRemove,
  onPlayAll,
  onStop,
  onCopy,
  onJam,
  onClear,
  onUndo,
  onCollection,
}: {
  entries: ChartEntry[]
  chords: Chord[]
  keyOf: Key | null
  selected: number | null
  playingAt: number | null
  copied: boolean
  found: number
  onTap: (index: number) => void
  onRemove: (id: number) => void
  onPlayAll: () => void
  onStop: () => void
  onCopy: () => void
  onJam: () => void
  onClear: () => void
  onUndo: (() => void) | null
  onCollection: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const newest = entries[entries.length - 1]?.id

  // Keep the newest chord in view as the chart grows…
  useEffect(() => {
    const el = scroller.current
    if (el && newest !== undefined) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [newest])
  // …and the one playing while you listen back.
  useEffect(() => {
    if (playingAt === null) return
    scroller.current?.querySelector(`[data-index="${playingAt}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [playingAt])

  const empty = entries.length === 0
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
      <div ref={scroller} className="flex min-w-0 flex-1 basis-[18rem] items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        <span className="shrink-0 text-sm font-extrabold uppercase tracking-widest text-ink-mute">You played</span>
        {empty && <span className="text-sm text-ink-mute">Chords you play will line up here, like a chord chart.</span>}
        <AnimatePresence initial={false}>
          {entries.map((e, i) => {
            const c = chords[i]
            const symbol = chordSymbol(c)
            const isSelected = selected === e.id
            return (
              <motion.div
                key={e.id}
                layout
                data-index={i}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onTap(i)}
                  aria-pressed={isSelected}
                  aria-label={`${symbol}${keyOf ? `, ${chordToRoman(c, keyOf)}` : ''}: play it`}
                  className={`flex min-h-11 flex-col items-center justify-center border px-3 py-1 transition-colors ${isSelected ? 'rounded-l-xl' : 'rounded-xl'} ${
                    playingAt === i ? 'border-gold bg-gold/20' : isSelected ? 'border-white/40 bg-night-700' : 'border-white/10 bg-night-750 hover:border-gold/50'
                  }`}
                >
                  <span className="font-display text-xl font-bold leading-tight">
                    <MusicText text={symbol} />
                  </span>
                  {keyOf && (
                    <span className="text-xs font-bold text-[#c9c0ff]">
                      <MusicText text={chordToRoman(c, keyOf)} />
                    </span>
                  )}
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => onRemove(e.id)}
                    aria-label={`Remove ${symbol} from the chart`}
                    title="Remove"
                    className="flex w-11 items-center justify-center rounded-r-xl border border-l-0 border-white/40 bg-night-700 text-ink-mute transition-colors hover:text-bad"
                  >
                    <X size={18} />
                  </button>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {playingAt !== null ? (
          <Tool icon={Square} label="Stop" onClick={onStop} active />
        ) : (
          <Tool icon={Play} label="Play all" onClick={onPlayAll} disabled={empty} />
        )}
        <Tool icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy chart'} onClick={onCopy} disabled={empty} active={copied} />
        <Tool icon={Disc3} label="Loop in Jam" onClick={onJam} disabled={empty} />
        {onUndo && <Tool icon={Undo2} label="Undo" onClick={onUndo} wide />}
        {!empty && <Tool icon={Eraser} label="Clear" onClick={onClear} />}
        <Tool icon={Layers} label={`${found} found`} onClick={onCollection} wide />
      </div>
    </div>
  )
}
