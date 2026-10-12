import { BookmarkPlus, Check, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { Button, IconButton } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { chordSymbol, pitchName } from '../../lib/theory'
import { FEELS, LENGTH_LABEL, isMinorProgression, jamChords, jamTonic, lengthsFor, meterOf } from './jam'
import { NAME_LENGTH, type SavedProgression, findByName } from './jamLibrary'

type Settings = Omit<SavedProgression, 'id' | 'name'>

/** "C – G – Am – F · D minor · 90 BPM · Ballad · 1 bar": what a saved progression plays. */
function summary(p: Settings): string {
  const minor = isMinorProgression(p.romans)
  const symbols = jamChords(p.romans, p.tonic, minor).map(chordSymbol)
  const chords = symbols.slice(0, 8).join(' – ') + (symbols.length > 8 ? ' …' : '')
  const feel = FEELS.find((f) => f.id === p.feel)?.label ?? ''
  const length = lengthsFor(meterOf(p.feel)).includes(p.length) ? p.length : 8
  return `${chords} · ${pitchName(jamTonic(p.tonic, minor))} ${minor ? 'minor' : 'major'} · ${p.bpm} BPM · ${feel} · ${LENGTH_LABEL[length]}`
}

/** My progressions: save what's on screen under a name, load one back (with its key and settings), delete one. */
export function MyProgressions({
  open,
  onClose,
  saved,
  current,
  suggestedName,
  focusName,
  onSave,
  onLoad,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  saved: SavedProgression[]
  /** The progression on screen, which Save keeps (null when there are no chords). */
  current: Settings | null
  suggestedName: string
  /** Opened with Save: put the cursor in the name field. */
  focusName: boolean
  onSave: (name: string) => void
  onLoad: (p: SavedProgression) => void
  onDelete: (id: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="My progressions" wide>
      {/* A fresh form each time it opens. */}
      {open && <SaveAndLoad {...{ saved, current, suggestedName, focusName, onSave, onLoad, onDelete }} />}
    </Modal>
  )
}

function SaveAndLoad({
  saved,
  current,
  suggestedName,
  focusName,
  onSave,
  onLoad,
  onDelete,
}: {
  saved: SavedProgression[]
  current: Settings | null
  suggestedName: string
  focusName: boolean
  onSave: (name: string) => void
  onLoad: (p: SavedProgression) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(suggestedName)
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const clash = findByName(saved, name)
  const trimmed = name.trim()

  return (
    <div className="space-y-5">
      {current && (
        <form
          className="rounded-2xl border border-white/8 bg-night-850 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!trimmed) return
            onSave(trimmed)
            setSavedAs(trimmed)
          }}
        >
          <label htmlFor="jam-save-name" className="mb-2 block text-sm font-extrabold uppercase tracking-wider text-ink-mute">
            Save what’s on screen
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="jam-save-name"
              type="text"
              value={name}
              maxLength={NAME_LENGTH}
              autoFocus={focusName}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setName(e.target.value)
                setSavedAs(null)
              }}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-night-800 px-4 text-lg font-bold text-ink outline-none focus:border-gold"
            />
            <Button type="submit" size="md" icon={BookmarkPlus} disabled={!trimmed}>
              {clash && savedAs === null ? 'Replace' : 'Save'}
            </Button>
          </div>
          <p className="mt-2 text-sm text-ink-mute">
            <MusicText text={summary(current)} />
          </p>
          <AnimatePresence mode="wait">
            {savedAs !== null ? (
              <motion.p key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-1.5 font-extrabold text-good" role="status">
                <Check size={18} /> <MusicText text={`Saved as “${savedAs}”.`} />
              </motion.p>
            ) : (
              clash && (
                <motion.p key="clash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm font-bold text-gold">
                  <MusicText text={`You already have “${clash.name}”: saving replaces it.`} />
                </motion.p>
              )
            )}
          </AnimatePresence>
        </form>
      )}

      {saved.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-ink-soft">
          Nothing saved yet. Build a progression or pick a preset, set the key and tempo you like, then save it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {saved.map((p) => (
            <li key={p.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => onLoad(p)}
                className="min-h-16 min-w-0 flex-1 rounded-2xl border border-white/10 bg-night-750 px-4 py-2.5 text-left transition-colors hover:border-gold/50"
              >
                <MusicText text={p.name} className="block truncate text-lg font-extrabold" />
                <span className="block text-sm font-semibold text-ink-mute">
                  <MusicText text={summary(p)} />
                </span>
              </button>
              {confirm === p.id ? (
                <div className="flex shrink-0 flex-col justify-center gap-1.5 sm:flex-row sm:items-center">
                  <Button size="sm" variant="danger" onClick={() => onDelete(p.id)}>
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <IconButton icon={Trash2} label={`Delete ${p.name}`} size={48} className="self-center" onClick={() => setConfirm(p.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
