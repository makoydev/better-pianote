import { Minus, Plus } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { MAX_PCT, MIN_PCT, TEMPO_PRESETS, bpmAt, stepTempo, tempoPct } from './tempo'

interface TempoProps {
  bpm: number
  /** The song's own tempo (100 %). */
  songBpm: number
  onChange: (bpm: number) => void
}

/** − 72 · 75 % +: the tempo in beats per minute and as a % of the song's, in 5 % steps. */
export function TempoStepper({ bpm, songBpm, onChange }: TempoProps) {
  const pct = tempoPct(bpm, songBpm)
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-night-850 p-1">
      <IconButton icon={Minus} size={44} label="Slower" onClick={() => onChange(stepTempo(bpm, songBpm, -1))} disabled={pct <= MIN_PCT} />
      <span className="min-w-[7.5rem] whitespace-nowrap text-center font-extrabold" aria-live="polite">
        <span className="text-lg">♩ = {Math.round(bpm)}</span>
        <span className="text-sm text-ink-mute"> · {pct}%</span>
      </span>
      <IconButton icon={Plus} size={44} label="Faster" onClick={() => onChange(stepTempo(bpm, songBpm, 1))} disabled={pct >= MAX_PCT} />
    </div>
  )
}

/** Quick tempos as a % of the song's tempo. */
export function TempoPresets({ bpm, songBpm, onChange }: TempoProps) {
  const pct = tempoPct(bpm, songBpm)
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Tempo">
      {TEMPO_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={p === pct}
          title={`♩ = ${Math.round(bpmAt(songBpm, p))}`}
          onClick={() => onChange(bpmAt(songBpm, p))}
          className={`min-h-11 min-w-11 rounded-xl border px-1.5 text-sm font-extrabold transition-colors ${
            p === pct ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'
          }`}
        >
          {p}%
        </button>
      ))}
    </div>
  )
}
