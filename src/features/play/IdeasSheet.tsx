import { Download, Lightbulb, Pencil, Play, Square, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { Button, IconButton } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { audio } from '../../lib/audio/engine'
import { playNotes, stopDemos } from '../../lib/audio/play'
import { keyName, parseKey } from '../../lib/theory'
import { downloadFile } from '../songs/files'
import { type Idea, ideaToMidi, lengthText, soundsOf, useIdeas } from './ideas'

/** Notes are handed to the audio a moment before they're due (not all at once), so Stop is immediate. */
const AHEAD_MS = 600

/** Plays one idea at a time, through the app or the keyboard (like the lessons' demos). `at`: ms played so far. */
function useIdeaPlayer() {
  const [playing, setPlaying] = useState<{ id: number; at: number } | null>(null)
  const timer = useRef(0)
  const stop = useCallback(() => {
    window.clearInterval(timer.current)
    stopDemos()
    setPlaying(null)
  }, [])
  useEffect(() => () => window.clearInterval(timer.current), [])

  const play = (idea: Idea) => {
    stop()
    const sounds = soundsOf(idea.events, idea.ms)
    const start = audio.unlock().currentTime + 0.15
    let next = 0
    const tick = () => {
      const played = (audio.now - start) * 1000
      for (; next < sounds.length && sounds[next].at < played + AHEAD_MS; next++) {
        const s = sounds[next]
        playNotes([s.midi], { dur: s.dur / 1000, vel: 0.25 + s.vel * 0.7, delay: Math.max(0, start + s.at / 1000 - audio.now) })
      }
      if (played > idea.ms + 400) {
        window.clearInterval(timer.current)
        setPlaying(null)
        return
      }
      setPlaying({ id: idea.id, at: Math.max(0, played) })
    }
    tick()
    timer.current = window.setInterval(tick, 150)
  }
  return { playing, play, stop }
}

const when = (id: number) =>
  new Date(id).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** The ideas you've saved in Free Play: play them back, rename them, save them as MIDI files, or delete them. */
export function IdeasSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ideas = useIdeas((s) => s.ideas)
  const remove = useIdeas((s) => s.remove)
  const restore = useIdeas((s) => s.restore)
  const { playing, play, stop } = useIdeaPlayer()
  const [deleted, setDeleted] = useState<Idea | null>(null)
  // Closing the sheet stops a playback.
  useEffect(() => {
    if (!open) stop()
  }, [open, stop])

  return (
    <Modal open={open} onClose={onClose} title={`Your ideas (${ideas.length})`} wide>
      {ideas.length === 0 ? (
        <div className="flex items-start gap-3 text-ink-soft">
          <Lightbulb className="mt-0.5 shrink-0 text-gold" size={22} />
          <p>
            Nothing saved yet. Free Play keeps the last two minutes of what you play: when something sounds good, tap <b className="text-ink">Save that!</b>{' '}
            (or press Enter) and it’s kept here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              at={playing?.id === idea.id ? playing.at : null}
              onPlay={() => play(idea)}
              onStop={stop}
              onDelete={() => {
                if (playing?.id === idea.id) stop()
                remove(idea.id)
                setDeleted(idea)
              }}
            />
          ))}
        </ul>
      )}
      {deleted && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-night-850 px-4 py-2 text-sm font-bold text-ink-soft">
          <span>
            Deleted “<MusicText text={deleted.name} />”.
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              restore(deleted)
              setDeleted(null)
            }}
          >
            Undo
          </Button>
        </div>
      )}
    </Modal>
  )
}

function IdeaRow({ idea, at, onPlay, onStop, onDelete }: { idea: Idea; at: number | null; onPlay: () => void; onStop: () => void; onDelete: () => void }) {
  const rename = useIdeas((s) => s.rename)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(idea.name)
  const key = idea.key ? parseKey(idea.key) : null
  const meta = [when(idea.id), lengthText(idea.ms), key ? keyName(key) : '', idea.chords?.length ? idea.chords.slice(0, 8).join(' ') + (idea.chords.length > 8 ? ' …' : '') : '']
    .filter(Boolean)
    .join(' · ')
  const save = () => {
    const n = name.trim()
    if (n && n !== idea.name) rename(idea.id, n)
    else setName(idea.name)
    setEditing(false)
  }
  const midi = () => {
    const bytes = ideaToMidi(idea)
    const file = `${idea.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Idea'}.mid`
    downloadFile(file, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  }
  const playingNow = at !== null
  return (
    <li className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition-colors ${playingNow ? 'border-gold/60 bg-gold/8' : 'border-white/8 bg-night-850'}`}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={playingNow ? onStop : onPlay}
        aria-label={playingNow ? `Stop ${idea.name}` : `Play ${idea.name}`}
        className={`flex size-14 shrink-0 items-center justify-center rounded-full ${playingNow ? 'bg-night-700 text-ink' : 'bg-linear-to-b from-gold to-gold-deep text-night-900'}`}
      >
        {playingNow ? <Square size={22} /> : <Play size={24} className="ml-0.5" />}
      </motion.button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setName(idea.name)
                setEditing(false)
              }
            }}
            maxLength={60}
            aria-label="Name"
            className="w-full rounded-lg border border-gold/50 bg-night-900 px-2 py-1 text-lg font-extrabold text-ink outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-2 text-left" aria-label={`Rename ${idea.name}`}>
            <span className="truncate text-lg font-extrabold">
              <MusicText text={idea.name} />
            </span>
            <Pencil size={14} className="shrink-0 text-ink-mute group-hover:text-ink" />
          </button>
        )}
        <div className="truncate text-sm font-semibold text-ink-mute">
          <MusicText text={meta} />
        </div>
      </div>
      <IconButton icon={Download} label={`Save ${idea.name} as a MIDI file`} size={44} onClick={midi} />
      <IconButton icon={Trash2} label={`Delete ${idea.name}`} size={44} onClick={onDelete} />
      {playingNow && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
          <span className="block h-full bg-linear-to-r from-gold to-coral" style={{ width: `${Math.min(100, (at / Math.max(1, idea.ms)) * 100)}%` }} />
        </span>
      )}
    </li>
  )
}
