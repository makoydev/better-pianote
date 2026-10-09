import { ChevronRight, FileMusic, Hand, Music, Trash2, Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Page } from '../../components/layout/Page'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button, IconButton } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/controls'
import { Modal } from '../../components/ui/Modal'
import { Stars } from '../../components/ui/progress'
import { DIFFICULTY_LABEL, SONGS, type Song, starsForScore } from '../../content/songs'
import { go } from '../../router'
import { removeEntry, useLibrary } from '../../state/library'
import { useProgress } from '../../state/progress'
import { HowToGetFiles, ImportSheet } from './ImportSheet'
import { startImport } from './importSession'
import { buildTimeline, previewBars, songScoreInput } from './timeline'

const LEVEL_COLOR: Record<Song['difficulty'], [string, string]> = {
  1: ['#3ee6c8', '#5cc8ff'],
  2: ['#ffc857', '#ff9a3c'],
  3: ['#ff7b6b', '#ff8fc8'],
}

type Filter = 'all' | 1 | 2 | 3 | 'mine'

export function SongList() {
  const games = useProgress((s) => s.games)
  const [filter, setFilter] = useState<Filter>('all')
  const entries = useLibrary((s) => s.entries)
  const libraryError = useLibrary((s) => s.error)
  const [removing, setRemoving] = useState<Song | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pickFile = () => fileInput.current?.click()

  const matches = (s: Song) => filter === 'all' || filter === 'mine' || s.difficulty === filter
  const mine = entries.map((e) => e.song).filter(matches)
  const builtIn = filter === 'mine' ? [] : SONGS.filter(matches)
  const best = (s: Song) => games[`song-${s.id}`]?.best ?? 0

  // Drop a file anywhere on the page to import it.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) void startImport(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return (
    <Page
      title="Songs"
      subtitle="Real pieces with the music scrolling past. Practice mode waits for each note; Listen mode plays it for you."
      actions={
        <Button size="md" icon={Upload} onClick={pickFile}>
          Import song
        </Button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void startImport(f)
          e.target.value = ''
        }}
      />
      <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
        <Segmented<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 1, label: 'Beginner' },
            { value: 2, label: 'Intermediate' },
            { value: 3, label: 'Advanced' },
            { value: 'mine', label: 'My songs' },
          ]}
        />
      </div>
      {libraryError && <p className="mb-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{libraryError}</p>}

      {(mine.length > 0 || filter === 'mine') && (
        <Section title="My songs" hint="Imported from your own files. They stay on this device.">
          {mine.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {mine.map((song, i) => (
                <SongCard key={song.id} song={song} best={best(song)} index={i} onRemove={() => setRemoving(song)} />
              ))}
            </div>
          ) : (
            <EmptyMine onImport={pickFile} filtered={entries.length > 0} />
          )}
        </Section>
      )}

      {builtIn.length > 0 && (
        <Section title={entries.length ? 'Song library' : undefined}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {builtIn.map((song, i) => (
              <SongCard key={song.id} song={song} best={best(song)} index={i} />
            ))}
          </div>
        </Section>
      )}

      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-mute">
        The built-in pieces are all in the public domain. Have sheet music for something else? Import its MusicXML file with{' '}
        <b className="text-ink-soft">Import song</b> (or drop the file on this page). It stays on this device.
      </p>

      <ImportSheet onPickAnother={pickFile} />
      <RemoveSong song={removing} onClose={() => setRemoving(null)} />
      <AnimatePresence>
        {dragging && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-60 flex items-center justify-center bg-night-950/75 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3 rounded-[2rem] border-4 border-dashed border-gold/70 px-12 py-10 text-center">
              <FileMusic size={48} className="text-gold" />
              <p className="font-display text-3xl font-bold">Drop to import</p>
              <p className="text-ink-soft">MusicXML (.mxl, .musicxml or .xml)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

function Section({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      {title && (
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {hint && <p className="text-sm text-ink-mute">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

function EmptyMine({ onImport, filtered }: { onImport: () => void; filtered: boolean }) {
  return (
    <div className="glass max-w-2xl space-y-4 rounded-3xl p-6">
      <p className="text-lg text-ink-soft">
        {filtered ? 'None of your songs are at this level.' : 'Bring in any piece you have as a MusicXML file, and practise it here with both hands.'}
      </p>
      {!filtered && <HowToGetFiles />}
      <Button icon={Upload} onClick={onImport}>
        Import song
      </Button>
    </div>
  )
}

function RemoveSong({ song, onClose }: { song: Song | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    if (!song) return
    setBusy(true)
    try {
      await removeEntry(song.id)
    } finally {
      setBusy(false)
      onClose()
    }
  }
  return (
    <Modal open={!!song} onClose={onClose} title="Remove this song?">
      <p className="text-lg text-ink-soft">
        <b className="text-ink">{song?.title}</b> will be removed from this device. You can import the file again any time.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="danger" icon={Trash2} onClick={() => void remove()} disabled={busy}>
          Remove
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
      </div>
    </Modal>
  )
}

function SongCard({ song, best, index, onRemove }: { song: Song; best: number; index: number; onRemove?: () => void }) {
  const [c1, c2] = LEVEL_COLOR[song.difficulty]
  // The first couple of bars as a preview, without fingers or note names.
  const preview = useMemo(() => {
    const tl = buildTimeline(song)
    return songScoreInput(song, tl, { hands: 'rh', bars: previewBars(tl, 'rh', !!song.pickup), fingers: false })
  }, [song])
  const card = (
    <motion.button
      type="button"
      onClick={() => go(`/songs/${song.id}`)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="glass group relative flex h-full w-full flex-col overflow-hidden rounded-3xl p-5 text-left transition-colors hover:border-white/15"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-50"
        style={{ background: c1 }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-night-900"
            style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}
          >
            <Music size={13} strokeWidth={2.8} /> {DIFFICULTY_LABEL[song.difficulty]}
          </span>
          <h3 className="mt-2.5 font-display text-2xl font-bold leading-tight">{song.title}</h3>
          <p className="mt-0.5 text-sm font-semibold text-ink-mute">
            {song.composer} · {song.imported ? 'My song' : song.year}
          </p>
        </div>
        <span className={onRemove ? 'mr-12' : ''}>
          <Stars value={starsForScore(best)} size={20} />
        </span>
      </div>
      <div className="paper pointer-events-none relative mt-4 rounded-2xl px-3 py-1">
        <ScoreStaff input={preview} fit sp={11} minSp={6} labels={false} fingers={false} reserveAbove={1.5} reserveBelow={1.5} title={`Opening of ${song.title}`} />
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">{song.keyName}</span>
        <span className="rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">
          {song.time[0]}/{song.time[1]}
        </span>
        {song.lh && (
          <span className="inline-flex items-center gap-1 rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">
            <Hand size={14} /> Both hands
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-gold opacity-80 transition-opacity group-hover:opacity-100">
          {best > 0 ? `Best ${best}%` : 'Play'} <ChevronRight size={18} strokeWidth={2.6} />
        </span>
      </div>
      <p className="relative mt-3 line-clamp-2 text-sm leading-relaxed text-ink-mute [overflow-wrap:anywhere]">{song.about}</p>
    </motion.button>
  )
  if (!onRemove) return card
  return (
    <div className="relative">
      {card}
      <IconButton icon={Trash2} label={`Remove ${song.title}`} size={40} onClick={onRemove} className="absolute right-4 top-4" />
    </div>
  )
}
