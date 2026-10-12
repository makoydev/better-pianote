import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Download,
  FileMusic,
  FileUp,
  Hand,
  LayoutGrid,
  List,
  type LucideIcon,
  Music,
  Pencil,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Page } from '../../components/layout/Page'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/controls'
import { Modal } from '../../components/ui/Modal'
import { Stars } from '../../components/ui/progress'
import { DIFFICULTY_LABEL, SONGS, type Song, findSong, starsForScore } from '../../content/songs'
import { go } from '../../router'
import { type LibraryEntry, removeEntry, useLibrary } from '../../state/library'
import { usePref } from '../../state/prefs'
import { type GameRecord, useProgress } from '../../state/progress'
import { ActionMenu, type MenuItem } from './ActionMenu'
import { SORTS, SORT_LABEL, type SongSort, type SongView, VIEWS, agoText, bestsText, continueFrom, fadeDelay, matchesSearch, practiceText, readLastSong, sortSongs } from './browse'
import { EditSong } from './EditSong'
import { downloadFile, scoreAccept } from './files'
import { HowToGetFiles, ImportSheet } from './ImportSheet'
import { onImportRequest, requestImport, takeImportRequest } from './importRequest'
import { replaceImport, startImports, startReplace } from './importSession'
import { songKey } from './results'
import { INPUT } from './SongFields'
import { buildTimeline, previewBars, songScoreInput } from './timeline'

const LEVEL_COLOR: Record<Song['difficulty'], [string, string]> = {
  1: ['#3ee6c8', '#5cc8ff'],
  2: ['#ffc857', '#ff9a3c'],
  3: ['#ff7b6b', '#ff8fc8'],
}

type Filter = 'all' | 1 | 2 | 3 | 'mine'
const FILTERS: readonly Filter[] = ['all', 1, 2, 3, 'mine']

export function SongList() {
  const games = useProgress((s) => s.games)
  // How you like to browse is remembered: level, sort, cards or list, and what you searched for.
  const [filter, setFilter] = usePref<Filter>('songs:filter', 'all', FILTERS)
  const [sort, setSort] = usePref<SongSort>('songs:sort', 'recent', SORTS)
  const [view, setView] = usePref<SongView>('songs:view', 'cards', VIEWS)
  const [query, setQuery] = usePref('songs:search', '')
  const [lastPref] = usePref<unknown>('songs:last', null)
  const entries = useLibrary((s) => s.entries)
  const libraryError = useLibrary((s) => s.error)
  const [removing, setRemoving] = useState<Song | null>(null)
  const [editing, setEditing] = useState<LibraryEntry | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  /** What to do with the files the picker returns: import them, swap the open import, or replace a song's file. */
  const onPicked = useRef<(files: File[]) => void>(startImports)
  const pickFiles = (then: (files: File[]) => void, many = true) => {
    const input = fileInput.current
    if (!input) return
    onPicked.current = then
    input.multiple = many
    input.click()
  }
  const pickFile = () => pickFiles(startImports)

  const byId = new Map(entries.map((e) => [e.id, e]))
  const last = readLastSong(lastPref)
  const lastSong = last ? (findSong(last.id) ?? byId.get(last.id)?.song) : undefined

  const searching = query.trim() !== ''
  const shown = (s: Song) => (filter === 'all' || filter === 'mine' || s.difficulty === filter) && matchesSearch(s, query)
  const order = (songs: Song[]) => sortSongs(songs, sort, { games, addedAt: (id) => byId.get(id)?.addedAt, last })
  const mine = order(entries.map((e) => e.song).filter(shown))
  const builtIn = filter === 'mine' ? [] : order(SONGS.filter(shown))
  /** "My songs" picked, and nothing imported yet: how to bring songs in. */
  const noSongsYet = filter === 'mine' && !entries.length
  const noMatch = searching && !noSongsYet && !mine.length && !builtIn.length

  /** What you can do with one of your own songs (the ⋯ menu on its card). */
  const manage = (song: Song): MenuItem[] => {
    const entry = byId.get(song.id)
    if (!entry) return []
    return [
      { label: 'Edit', icon: Pencil, onSelect: () => setEditing(entry) },
      { label: 'Replace file', icon: FileUp, onSelect: () => pickFiles((files) => files[0] && startReplace(files[0], entry.id), false) },
      {
        label: 'Download original file',
        icon: Download,
        disabled: !entry.source,
        onSelect: () => entry.source && downloadFile(entry.source.name, entry.source.bytes),
      },
      { label: 'Remove', icon: Trash2, danger: true, onSelect: () => setRemoving(entry.song) },
    ]
  }

  // Files dropped on another page (the app sends them here), now or while this page is open.
  useEffect(() => {
    const take = () => startImports(takeImportRequest())
    take()
    return onImportRequest(take)
  }, [])

  // Drop files anywhere on the page to import them.
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
      // Through the same hand-over as drops on other pages, so a drop both handlers see imports once.
      if (e.dataTransfer) requestImport(Array.from(e.dataTransfer.files))
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
        accept={scoreAccept()}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          onPicked.current(files)
        }}
      />

      {last && lastSong && !searching && <ContinueCard song={lastSong} bar={last.bar} at={last.at} />}

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={query} onChange={setQuery} />
          <label className="relative flex items-center">
            <span className="sr-only">Sort songs by</span>
            <ArrowDownUp size={18} className="pointer-events-none absolute left-4 text-ink-mute" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SongSort)}
              className="h-12 appearance-none rounded-2xl border border-white/10 bg-night-850 pl-11 pr-10 font-extrabold text-ink outline-none focus:border-gold/60"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3.5 text-ink-mute" />
          </label>
          <Segmented<SongView>
            value={view}
            onChange={setView}
            options={[
              { value: 'cards', label: <IconLabel icon={LayoutGrid}>Cards</IconLabel> },
              { value: 'list', label: <IconLabel icon={List}>List</IconLabel> },
            ]}
          />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmented<Filter>
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
      </div>
      {libraryError && <p className="mb-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{libraryError}</p>}

      {(mine.length > 0 || noSongsYet) && (
        <Section title="My songs" hint="Imported from your own files. They stay on this device.">
          {mine.length ? <SongGroup songs={mine} view={view} games={games} menuFor={manage} /> : <EmptyMine onImport={pickFile} />}
        </Section>
      )}

      {builtIn.length > 0 && (
        <Section title={entries.length ? 'Song library' : undefined}>
          <SongGroup songs={builtIn} view={view} games={games} />
        </Section>
      )}

      {noMatch && (
        <div className="glass mb-10 max-w-2xl space-y-4 rounded-3xl p-6">
          <p className="text-lg text-ink-soft">
            No songs {filter === 'all' || filter === 'mine' ? '' : 'at this level '}match <b className="text-ink">“{query.trim()}”</b>. Search looks at titles,
            composers and tags like “Both hands” or “3/4 time”.
          </p>
          <Button variant="secondary" icon={X} onClick={() => setQuery('')}>
            Clear search
          </Button>
        </div>
      )}

      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-mute">
        The built-in pieces are all in the public domain. Have sheet music for something else? Import its MusicXML file with{' '}
        <b className="text-ink-soft">Import song</b> (or drop files on this page). It stays on this device.
      </p>

      <ImportSheet onPickAnother={() => pickFiles(replaceImport)} />
      <EditSong entry={editing} onClose={() => setEditing(null)} />
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
              <p className="text-ink-soft">MusicXML files (.mxl, .musicxml or .xml), one or several</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

function IconLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={18} /> {children}
    </span>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative min-w-[14rem] flex-1">
      <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && onChange('')}
        placeholder="Search title, composer or tag"
        aria-label="Search songs"
        enterKeyHint="search"
        className={`${INPUT} pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-mute transition-colors hover:text-ink"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

/** Where you left off: the song you practised last, from the bar you got to. */
function ContinueCard({ song, bar, at }: { song: Song; bar: number; at: number }) {
  return (
    <motion.button
      type="button"
      onClick={() => go(`/songs/${song.id}`)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="glass group mb-6 flex w-full items-center gap-4 rounded-3xl p-4 text-left transition-colors hover:border-white/15 sm:p-5"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-b from-gold to-gold-deep text-night-900 shadow-[0_5px_0_#b9761f]">
        <Play size={26} strokeWidth={2.6} className="ml-0.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold uppercase tracking-wider text-gold">Continue</span>
        <span className="block font-display text-2xl font-bold leading-tight [overflow-wrap:anywhere]">
          {song.title} <span className="font-sans text-lg font-extrabold text-ink-soft">{continueFrom(bar)}</span>
        </span>
        <span className="block text-sm font-semibold text-ink-mute">Practised {agoText(at)}</span>
      </span>
      <ChevronRight size={26} strokeWidth={2.6} className="shrink-0 text-gold opacity-80 transition-opacity group-hover:opacity-100" />
    </motion.button>
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

/** A group of songs as big cards with the opening bars, or as a compact list for a long library. */
function SongGroup({ songs, view, games, menuFor }: { songs: Song[]; view: SongView; games: Record<string, GameRecord>; menuFor?: (song: Song) => MenuItem[] }) {
  if (view === 'list') {
    return (
      <ul className="space-y-2.5">
        {songs.map((song, i) => (
          <SongRow key={song.id} song={song} games={games} index={i} menu={menuFor?.(song)} />
        ))}
      </ul>
    )
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {songs.map((song, i) => (
        <SongCard key={song.id} song={song} games={games} index={i} menu={menuFor?.(song)} />
      ))}
    </div>
  )
}

function EmptyMine({ onImport }: { onImport: () => void }) {
  return (
    <div className="glass max-w-2xl space-y-4 rounded-3xl p-6">
      <p className="text-lg text-ink-soft">Bring in any piece you have as a MusicXML file, and practise it here with both hands.</p>
      <HowToGetFiles />
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

function LevelBadge({ level }: { level: Song['difficulty'] }) {
  const [c1, c2] = LEVEL_COLOR[level]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-night-900"
      style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}
    >
      <Music size={13} strokeWidth={2.8} /> {DIFFICULTY_LABEL[level]}
    </span>
  )
}

function SongCard({ song, games, index, menu }: { song: Song; games: Record<string, GameRecord>; index: number; menu?: MenuItem[] }) {
  const [c1] = LEVEL_COLOR[song.difficulty]
  const best = games[songKey(song.id)]?.best ?? 0
  const bests = bestsText(games, song.id)
  const practised = practiceText(games[songKey(song.id)])
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
      transition={{ delay: fadeDelay(index), type: 'spring', stiffness: 260, damping: 26 }}
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
          <LevelBadge level={song.difficulty} />
          <h3 className="mt-2.5 font-display text-2xl font-bold leading-tight">{song.title}</h3>
          <p className="mt-0.5 text-sm font-semibold text-ink-mute">
            {song.composer} · {song.imported ? 'My song' : song.year}
          </p>
        </div>
        <span className={menu ? 'mr-14' : ''}>
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
          {bests ?? 'Play'} <ChevronRight size={18} strokeWidth={2.6} />
        </span>
      </div>
      {practised && <p className="relative mt-2.5 text-sm font-bold text-ink-soft">{practised}</p>}
      <p className="relative mt-3 line-clamp-2 text-sm leading-relaxed text-ink-mute [overflow-wrap:anywhere]">{song.about}</p>
    </motion.button>
  )
  if (!menu) return card
  return (
    <div className="relative">
      {card}
      <ActionMenu label={`Manage ${song.title}`} items={menu} className="absolute right-4 top-4" />
    </div>
  )
}

/** One line per song, for long libraries: no score preview, just what you need to pick one. */
function SongRow({ song, games, index, menu }: { song: Song; games: Record<string, GameRecord>; index: number; menu?: MenuItem[] }) {
  const best = games[songKey(song.id)]?.best ?? 0
  const bests = bestsText(games, song.id)
  const practised = practiceText(games[songKey(song.id)])
  return (
    <li className="relative">
      <motion.button
        type="button"
        onClick={() => go(`/songs/${song.id}`)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: fadeDelay(index), type: 'spring', stiffness: 300, damping: 30 }}
        whileTap={{ scale: 0.99 }}
        className={`glass group flex min-h-16 w-full items-center gap-3 rounded-2xl py-3 pl-3 text-left transition-colors hover:border-white/15 sm:gap-4 sm:pl-4 ${menu ? 'pr-16' : 'pr-3 sm:pr-4'}`}
      >
        <span aria-hidden className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: `linear-gradient(${LEVEL_COLOR[song.difficulty].join(', ')})` }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl font-bold leading-tight">{song.title}</span>
          <span className="block truncate text-sm font-semibold text-ink-mute">
            {song.composer} · {DIFFICULTY_LABEL[song.difficulty]}
            {practised && <span className="text-ink-soft"> · {practised}</span>}
          </span>
        </span>
        {bests && <span className="hidden shrink-0 text-sm font-extrabold text-gold sm:block">{bests}</span>}
        <span className="shrink-0">
          <Stars value={starsForScore(best)} size={18} />
        </span>
        {!menu && <ChevronRight size={20} strokeWidth={2.6} className="shrink-0 text-gold opacity-70 transition-opacity group-hover:opacity-100" />}
      </motion.button>
      {/* Centred with a margin, not a transform, so the open menu isn't trapped under the rows below. */}
      {menu && <ActionMenu label={`Manage ${song.title}`} items={menu} className="absolute right-2 top-1/2 -mt-6" />}
    </li>
  )
}
