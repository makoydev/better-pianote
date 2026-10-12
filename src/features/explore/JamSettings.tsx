import { Drum, KeyboardMusic, Minus, Music2, Plus, Repeat, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { MusicText } from '../../components/MusicText'
import { IconButton } from '../../components/ui/Button'
import { Chips, Segmented, Slider, Toggle } from '../../components/ui/controls'
import { type ChordLength, FEELS, LENGTH_LABEL, type PatternId, clampJamBpm, lengthsFor, meterOf } from './jam'
import { OctavePicker } from './OctavePicker'

export interface JamSettingsProps {
  bpm: number
  setBpm: (v: number) => void
  pattern: PatternId
  onFeel: (p: PatternId) => void
  /** The chord length in effect (a 4/4 choice falls back to a bar in 3/4 and 6/8). */
  length: ChordLength
  onLength: (v: ChordLength) => void
  bassOn: boolean
  setBassOn: (v: boolean) => void
  chordsOn: boolean
  setChordsOn: (v: boolean) => void
  drums: boolean
  setDrums: (v: boolean) => void
  loop: boolean
  setLoop: (v: boolean) => void
  countIn: boolean
  setCountIn: (v: boolean) => void
  tonic: number
  setTonic: (pc: number) => void
  /** The key's name for a pitch class, spelled for the progression's mode. */
  tonicName: (pc: number) => string
}

const Heading = ({ children }: { children: ReactNode }) => <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">{children}</div>

function Switch({ icon, label, note, checked, onChange }: { icon: ReactNode; label: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 font-extrabold text-ink-soft">
      <span className="flex items-center gap-2">
        {icon} {label}
        {note && <span className="font-semibold text-ink-mute">({note})</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

/** Tempo, feel, chord length, what the band plays, and the key: the aside on wide screens, a sheet on narrow ones. */
export function JamSettings(p: JamSettingsProps) {
  const meter = meterOf(p.pattern)
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-end justify-between">
          <span className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
            <Timer size={16} /> Tempo
          </span>
          <span className="font-display text-4xl font-bold leading-none">
            {p.bpm}
            <span className="ml-1 font-sans text-sm font-extrabold text-ink-mute">BPM</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <IconButton icon={Minus} label="Slower" size={48} onClick={() => p.setBpm(clampJamBpm(p.bpm - 4))} />
          <Slider value={p.bpm} min={50} max={160} onChange={p.setBpm} label="Tempo" />
          <IconButton icon={Plus} label="Faster" size={48} onClick={() => p.setBpm(clampJamBpm(p.bpm + 4))} />
        </div>
      </div>

      <div>
        <Heading>Feel</Heading>
        <Chips value={p.pattern} onChange={p.onFeel} options={FEELS.map((f) => ({ value: f.id, label: f.label }))} />
        {meter.id === '6/8' && <p className="mt-2 text-sm text-ink-mute">In 6/8 the tempo counts dotted quarters: two beats a bar, six eighths.</p>}
      </div>

      <div>
        <Heading>Each chord lasts</Heading>
        <Segmented value={p.length} onChange={p.onLength} className="w-full" options={lengthsFor(meter).map((v) => ({ value: v, label: LENGTH_LABEL[v] }))} />
      </div>

      <div>
        <Heading>The band plays</Heading>
        <div className="space-y-1">
          <Switch icon={<Music2 size={18} />} label="Bass" note="left hand" checked={p.bassOn} onChange={p.setBassOn} />
          <Switch icon={<KeyboardMusic size={18} />} label="Chords" note="right hand" checked={p.chordsOn} onChange={p.setChordsOn} />
          <Switch icon={<Drum size={18} />} label="Drums" checked={p.drums} onChange={p.setDrums} />
        </div>
        {!p.bassOn && !p.chordsOn && (
          <p className="mt-1 text-sm text-ink-mute">{p.drums ? 'Just the drums' : 'The band sits out'}: play the chords and the bass yourself.</p>
        )}
      </div>

      <div className="space-y-1">
        <Switch icon={<Repeat size={18} />} label="Loop" checked={p.loop} onChange={p.setLoop} />
        <Switch icon={<Timer size={18} />} label="Count in" checked={p.countIn} onChange={p.setCountIn} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">Key</span>
          <div className="flex items-center gap-2">
            <IconButton icon={Minus} label="Transpose down a half step" size={48} onClick={() => p.setTonic((p.tonic + 11) % 12)} />
            <span className="w-12 text-center font-display text-2xl font-bold">
              <MusicText text={p.tonicName(p.tonic)} />
            </span>
            <IconButton icon={Plus} label="Transpose up a half step" size={48} onClick={() => p.setTonic((p.tonic + 1) % 12)} />
          </div>
        </div>
        <OctavePicker value={p.tonic} onChange={p.setTonic} height={96} label="Key" names={(pc) => ({ main: p.tonicName(pc) })} />
      </div>
    </div>
  )
}
