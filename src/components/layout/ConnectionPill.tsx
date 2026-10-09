import { Keyboard, Mic, Usb } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useLive } from '../../state/live'
import { ConnectSheet } from './ConnectSheet'

/** Shows how you're playing (USB keyboard, mic, on-screen) and opens the connect guide. */
export function ConnectionPill({ compact = false }: { compact?: boolean }) {
  const midi = useLive((s) => s.midi)
  const devices = useLive((s) => s.midiDevices)
  const mic = useLive((s) => s.mic)
  const [open, setOpen] = useState(false)

  let dot = '#938fbb'
  let label = 'Connect keyboard'
  let Icon = Usb
  if (midi === 'ready' && devices.length) {
    dot = '#3ddc97'
    label = devices[0]
  } else if (mic === 'on') {
    dot = '#5cc8ff'
    label = 'Listening'
    Icon = Mic
  } else if (midi === 'ready') {
    dot = '#ffc857'
    label = 'No keyboard found'
  } else if (midi === 'unsupported') {
    label = 'On-screen keys'
    Icon = Keyboard
  }

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 max-w-[15rem] items-center gap-2 rounded-full border border-white/10 bg-night-750/90 px-3.5 text-sm font-extrabold text-ink-soft transition-colors hover:border-white/20 hover:text-ink"
        title="Keyboard connection"
      >
        <span className="relative flex size-2.5 shrink-0">
          {dot === '#3ddc97' && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: dot }} />}
          <span className="relative size-2.5 rounded-full" style={{ background: dot }} />
        </span>
        <Icon size={17} strokeWidth={2.5} className="shrink-0" />
        {!compact && <span className="truncate">{label}</span>}
      </motion.button>
      <ConnectSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
