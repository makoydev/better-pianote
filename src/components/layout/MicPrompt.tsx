import { Mic } from 'lucide-react'
import { startMic } from '../../lib/input/mic'
import { nameNote } from '../../lib/naming'
import { fromMidi } from '../../lib/theory'
import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { MusicText } from '../MusicText'
import { Button } from '../ui/Button'

/**
 * For screens where you play notes: with no USB keyboard connected, offer the microphone right there (on an iPad
 * it's the only way to play your real keyboard), and once it's listening show what it hears and how loud.
 */
export function MicPrompt({ className = '' }: { className?: string }) {
  const usb = useLive((s) => s.midi === 'ready' && s.midiDevices.length > 0)
  const mic = useLive((s) => s.mic)
  if (usb || mic === 'unsupported') return null
  if (mic === 'on') return <Heard className={className} />
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-ink-mute ${className}`}>
      <span>Playing on your keyboard?</span>
      <Button size="sm" variant="violet" icon={Mic} onClick={() => void startMic()} disabled={mic === 'starting'}>
        {mic === 'starting' ? 'Starting…' : mic === 'denied' ? 'Allow the mic' : 'Start listening'}
      </Button>
    </div>
  )
}

/** "Heard: E4" and a level bar, so you can tell the mic is picking you up. */
function Heard({ className }: { className: string }) {
  const level = useLive((s) => s.micLevel)
  const note = useLive((s) => (s.lastSource === 'mic' ? s.lastNote : null))
  const naming = useSettings((s) => s.naming)
  return (
    <div className={`flex items-center justify-center gap-3 text-sm font-bold text-ink-soft ${className}`} aria-live="polite">
      <Mic size={16} className="text-violet" />
      <span className="min-w-24">{note === null ? 'Listening…' : <MusicText text={`Heard: ${nameNote(fromMidi(note), naming, { octave: true })}`} />}</span>
      <span className="flex h-2 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span className="h-full bg-violet transition-[width] duration-75" style={{ width: `${Math.min(1, level) * 100}%` }} />
      </span>
    </div>
  )
}
