import { Footprints } from 'lucide-react'
import { motion } from 'motion/react'
import { MusicText } from '../../components/MusicText'
import { Modal } from '../../components/ui/Modal'
import { playChord } from '../../lib/audio/play'
import { chordSymbol } from '../../lib/theory'
import { collectionGroups } from './chart'

/** Every chord sound you've found in Free Play, grouped by type. Tap one to hear it. */
export function Collection({ open, onClose, found }: { open: boolean; onClose: () => void; found: string[] }) {
  const groups = collectionGroups(found)
  const count = groups.reduce((n, g) => n + g.chords.length, 0)
  return (
    <Modal open={open} onClose={onClose} title={`Your chord collection (${count})`} wide>
      {count === 0 ? (
        <p className="text-ink-soft">Every new chord you play in Free Play gets added here. Hold three or more notes to discover your first one!</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-mute">Tap a chord to hear it.</p>
          {groups.map((g) => (
            <div key={g.type.id}>
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-ink-mute">
                <Footprints size={14} /> {g.type.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.chords.map((c) => {
                  const symbol = chordSymbol(c)
                  return (
                    <motion.button
                      key={symbol}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => playChord(c)}
                      aria-label={`${symbol}: play it`}
                      className="min-h-11 rounded-xl border border-white/10 bg-night-750 px-3 font-display text-lg font-bold transition-colors hover:border-gold/50"
                    >
                      <MusicText text={symbol} />
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
