import { useEffect, useState } from 'react'
import { isTypingTarget } from '../../lib/focus'
import { SHORTCUTS_EVENT } from '../../lib/shortcuts'
import { Modal } from '../ui/Modal'

const ROWS: [string, string][] = [
  ['Enter · tap the pedal · top C (C7)', 'The main button on screen: Continue, Start, Play again'],
  ['Space', 'Play / pause, hear it again, skip a note in Note Rush'],
  ['← →', 'Back and forward through lesson steps'],
  ['1 – 4', 'Pick an answer'],
  ['R', 'Start the song again'],
  ['T', 'Tap the tempo (Metronome)'],
  ['Esc', 'Close a window'],
  ['A S D F G H J K L ;', 'Play white keys (W E T Y U O P: black keys, Z / X: octave)'],
]

/** "?" anywhere opens the list of keyboard and hands-free shortcuts. */
export function ShortcutSheet() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      setOpen(true)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(SHORTCUTS_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(SHORTCUTS_EVENT, onOpen)
    }
  }, [])
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Shortcuts" wide>
      <p className="mb-4 text-ink-soft">Keep your hands on the piano: most screens can be driven without touching the screen.</p>
      <dl className="divide-y divide-white/6 rounded-2xl border border-white/8 bg-night-850">
        {ROWS.map(([keys, what]) => (
          <div key={keys} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
            <dt className="font-extrabold text-ink">{keys}</dt>
            <dd className="text-ink-soft">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink-mute">The top C works through the microphone too. Turn it off in Settings if you play that note in your music.</p>
    </Modal>
  )
}
