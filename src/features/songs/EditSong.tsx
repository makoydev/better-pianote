import { Check, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { Song } from '../../content/songs'
import type { ImportPart } from '../../lib/musicxml'
import { type LibraryEntry, saveEntry } from '../../state/library'
import { PartSelect, type SongDetails, SongDetailsFields } from './SongFields'
import { buildTimeline, previewBars, songScoreInput } from './timeline'

/** Change an imported song after the fact: title, composer, level, and which part of its file it plays. */
export function EditSong({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  // Keep showing the song while the sheet closes.
  const [shown, setShown] = useState(entry)
  if (entry && entry !== shown) setShown(entry)
  return (
    <Modal open={!!entry} onClose={onClose} title="Edit song" wide>
      {shown && <EditForm key={shown.id} entry={shown} onClose={onClose} />}
    </Modal>
  )
}

/** The stored original file, read again with one of its parts. */
async function readOriginal(source: NonNullable<LibraryEntry['source']>, partIndex: number) {
  const { IMPORTER_VERSION, importScoreFile } = await import('../../lib/musicxml')
  const result = await importScoreFile(new Uint8Array(source.bytes), source.name, { partIndex })
  return { result, version: IMPORTER_VERSION }
}

const readError = (e: unknown) => (e instanceof Error && e.name === 'ImportError' ? e.message : 'Couldn’t read the original file again.')

function EditForm({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const source = entry.source
  const [details, setDetails] = useState<SongDetails>({ title: entry.song.title, composer: entry.song.composer, difficulty: entry.song.difficulty })
  const [partIndex, setPartIndex] = useState(source?.partIndex ?? 0)
  /** The parts in the original file, once it has been read again. */
  const [parts, setParts] = useState<ImportPart[] | null>(null)
  /** The song read again with another part (null keeps the one saved). */
  const [reread, setReread] = useState<{ song: Song; version: number } | null>(null)
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(source ? 'reading' : null)
  const [error, setError] = useState<string | null>(null)
  /** Only the latest read counts (picking parts quickly). */
  const ticket = useRef(0)

  // As the sheet opens: which parts the original file has.
  useEffect(() => {
    if (!source) return
    const mine = ++ticket.current
    readOriginal(source, source.partIndex).then(
      ({ result }) => {
        if (mine !== ticket.current) return
        setParts(result.parts)
        setBusy(null)
      },
      (e) => {
        if (mine !== ticket.current) return
        setError(readError(e))
        setBusy(null)
      },
    )
  }, [source])

  const pickPart = async (index: number) => {
    if (!source) return
    const mine = ++ticket.current
    setPartIndex(index)
    setBusy('reading')
    setError(null)
    try {
      const { result, version } = await readOriginal(source, index)
      if (mine !== ticket.current) return
      setReread(index === source.partIndex ? null : { song: result.song, version })
    } catch (e) {
      if (mine !== ticket.current) return
      setError(readError(e))
      setReread(null)
      setPartIndex(source.partIndex)
    } finally {
      if (mine === ticket.current) setBusy(null)
    }
  }

  const song = reread?.song ?? entry.song
  const preview = useMemo(() => {
    const tl = buildTimeline(song)
    return songScoreInput(song, tl, { hands: 'both', bars: previewBars(tl, 'both', !!song.pickup, 14), fingers: false })
  }, [song])

  const save = async () => {
    setBusy('saving')
    setError(null)
    const next: Song = {
      ...song,
      id: entry.id,
      imported: entry.song.imported,
      title: details.title.trim() || entry.song.title,
      composer: details.composer.trim() || entry.song.composer,
      difficulty: details.difficulty,
    }
    try {
      // Same id: the progress and remembered settings stay with the song.
      await saveEntry({ ...entry, song: next, source: source && { ...source, partIndex }, version: reread?.version ?? entry.version })
      onClose()
    } catch {
      setError('Couldn’t save the changes on this device.')
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="paper overflow-hidden rounded-2xl px-3 py-1">
        <ScoreStaff input={preview} fit sp={12} minSp={7} labels={false} fingers={false} title={`Opening of ${song.title}`} />
      </div>

      {parts && parts.length > 1 && (
        <PartSelect
          parts={parts}
          value={partIndex}
          disabled={busy !== null}
          onChange={(i) => void pickPart(i)}
        />
      )}
      {busy === 'reading' && (
        <p className="flex items-center gap-2 text-sm font-bold text-ink-mute">
          <Loader2 size={16} className="animate-spin" /> Reading the original file…
        </p>
      )}

      <SongDetailsFields value={details} onChange={(patch) => setDetails((d) => ({ ...d, ...patch }))} />

      {!source && <p className="text-sm text-ink-mute">The original file isn’t stored with this song, so its part can’t be changed here.</p>}
      {error && <p className="text-sm font-bold text-coral">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button icon={Check} onClick={() => void save()} disabled={busy !== null}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
