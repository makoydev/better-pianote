import { AlertTriangle, Check, ChevronDown, CopyCheck, FileMusic, Hand, Lightbulb, Loader2, Lock, Play, RefreshCw, SkipForward, Upload } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { Song } from '../../content/songs'
import { toast } from '../../lib/fx'
import type { ProblemGroup } from '../../lib/musicxml'
import { go } from '../../router'
import { persistStorage, replaceEntry, saveEntry, useLibrary } from '../../state/library'
import { batchOf, chooseTarget, closeImport, editImport, nextImport, startImport, useImport } from './importSession'
import { PartSelect, SongDetailsFields } from './SongFields'
import { buildTimeline, previewBars, songScoreInput } from './timeline'

/** Shows what's in the file being imported, and saves it to My songs. Several files take turns. */
export function ImportSheet({ onPickAnother }: { onPickAnother: () => void }) {
  const phase = useImport((s) => s.phase)
  const edits = useImport((s) => s.edits)
  const queue = useImport((s) => s.queue)
  const done = useImport((s) => s.done)
  const target = useImport((s) => s.target)
  const duplicate = useImport((s) => s.duplicate)
  const replacingId = useImport((s) => s.replacing)
  const replacing = useLibrary((s) => s.entries.find((e) => e.id === replacingId))
  const batch = batchOf({ queue, done })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const ready = phase.kind === 'ready' ? phase : null
  const song = ready?.result.song

  const preview = useMemo(() => {
    if (!song) return null
    const tl = buildTimeline(song)
    return songScoreInput(song, tl, { hands: 'both', bars: previewBars(tl, 'both', !!song.pickup, 14), fingers: false })
  }, [song])

  const save = async () => {
    if (!ready || !song || !edits) return
    setSaving(true)
    setSaveError(null)
    const finalSong: Song = { ...song, title: edits.title.trim() || song.title, composer: edits.composer.trim() || song.composer, difficulty: edits.difficulty }
    const source = { name: ready.file.name, bytes: ready.bytes.slice().buffer, partIndex: ready.result.partIndex }
    const id = target ?? finalSong.id
    try {
      // Replacing keeps the old song's id, so its progress and remembered settings carry on.
      if (target) await replaceEntry(target, { song: finalSong, source, version: ready.version })
      else await saveEntry({ id, song: finalSong, source, version: ready.version, addedAt: Date.now() })
      void persistStorage()
      if (batch) {
        // Several files: on to the next one, and you play them from My songs afterwards.
        toast({ kind: 'info', title: target ? 'Replaced in My songs' : 'Saved to My songs', detail: finalSong.title })
        nextImport()
      } else {
        closeImport()
        go(`/songs/${id}`)
      }
    } catch {
      const gone = target && !useLibrary.getState().entries.some((e) => e.id === target)
      setSaveError(
        gone
          ? 'The song this file was going to replace isn’t in My songs any more. Close this and import the file as a new song.'
          : 'Couldn’t save the song on this device. The browser may be in private mode or out of space.',
      )
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    setSaveError(null)
    closeImport()
  }
  const skip = () => {
    setSaveError(null)
    nextImport()
  }
  const pickAnother = () => {
    setSaveError(null)
    onPickAnother()
  }
  const file = phase.kind === 'closed' ? null : phase.file
  const stats = ready?.result.stats
  const verb = target ? 'Replace' : 'Save'

  const title = (
    <>
      {replacing ? 'Replace the file' : 'Import a song'}
      {batch && (
        <span className="ml-2 align-middle font-sans text-base font-extrabold text-ink-mute">
          File {batch.at} of {batch.of}
        </span>
      )}
    </>
  )

  return (
    <Modal open={phase.kind !== 'closed'} onClose={close} title={title} wide>
      {replacing && (
        <p className="-mt-1 mb-4 flex items-center gap-2 text-ink-soft">
          <RefreshCw size={18} className="shrink-0 text-gold" />
          <span>
            A new file for <b className="text-ink">{replacing.song.title}</b>. Its progress and settings stay.
          </span>
        </p>
      )}

      {phase.kind === 'reading' && (
        <div className="flex items-center gap-3 py-10 text-lg font-bold text-ink-soft">
          <Loader2 className="animate-spin text-gold" size={26} /> Reading {file?.name}…
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-ink">
            <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={22} />
            <div className="min-w-0">
              <p className="font-extrabold">{phase.message}</p>
              <p className="mt-1 text-sm text-ink-soft [overflow-wrap:anywhere]">{file?.name}</p>
            </div>
          </div>
          {phase.details && <ProblemDetails {...phase.details} />}
          {/* A MusicXML file that failed for another reason: "which files work" would only mislead. */}
          {!phase.musicXml && <HowToGetFiles />}
          <div className="flex flex-wrap gap-3">
            {queue.length > 0 && (
              <Button icon={SkipForward} onClick={skip}>
                Next file
              </Button>
            )}
            <Button variant={queue.length ? 'secondary' : 'primary'} icon={Upload} onClick={pickAnother}>
              Choose another file
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {ready && song && stats && edits && (
        <div className="space-y-5">
          {preview && (
            <div className="paper overflow-hidden rounded-2xl px-3 py-1">
              <ScoreStaff input={preview} fit sp={12} minSp={7} labels={false} fingers={false} title={`Opening of ${song.title}`} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <Fact>{song.keyName}</Fact>
            <Fact>
              {song.time[0]}/{song.time[1]}
            </Fact>
            <Fact>♩ = {song.bpm}</Fact>
            <Fact>
              {stats.bars} bar{stats.bars === 1 ? '' : 's'}
            </Fact>
            <Fact>
              <Hand size={14} className="mr-1" />
              {song.lh ? 'Both hands' : 'Right hand only'}
            </Fact>
            {stats.voices > (song.lh ? 2 : 1) && <Fact>Two melodies in one hand</Fact>}
          </div>

          {duplicate && !replacing && (
            <div className="space-y-3 rounded-2xl border border-violet/40 bg-violet/10 p-4">
              <p className="flex gap-2.5 text-ink">
                <CopyCheck size={20} className="mt-0.5 shrink-0 text-violet" />
                <span>
                  {duplicate.reason === 'file' ? 'You’ve imported this file before' : 'My songs already has a song with this title and composer'}:{' '}
                  <b>{duplicate.title}</b>.
                </span>
              </p>
              <ChoiceChips
                label="What to do with this file"
                value={target ? 'replace' : 'new'}
                onChange={(v) => chooseTarget(v === 'replace' ? duplicate.id : null)}
                options={[
                  { value: 'replace', label: 'Replace (keep progress)' },
                  { value: 'new', label: 'Add as new' },
                ]}
              />
            </div>
          )}

          {ready.result.parts.length > 1 && (
            <PartSelect
              parts={ready.result.parts}
              value={ready.result.partIndex}
              onChange={(partIndex) => void startImport(ready.file, { partIndex, bytes: ready.bytes })}
            />
          )}

          <SongDetailsFields value={edits} onChange={editImport} />

          {ready.result.warnings.length > 0 && (
            <div className="rounded-2xl border border-gold/30 bg-gold/8 p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-gold">
                <AlertTriangle size={16} /> Good to know
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[0.95rem] text-ink-soft">
                {ready.result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex items-center gap-2 text-sm text-ink-mute">
            <Lock size={15} /> Saved on this device only. Nothing is uploaded.
          </p>
          {saveError && <p className="text-sm font-bold text-coral">{saveError}</p>}

          <div className="flex flex-wrap gap-3">
            <Button icon={batch ? Check : Play} onClick={() => void save()} disabled={saving}>
              {!batch ? `${verb} and play` : queue.length ? `${verb}, next file` : verb}
            </Button>
            {queue.length > 0 && (
              <Button variant="secondary" icon={SkipForward} onClick={skip} disabled={saving}>
                Skip this file
              </Button>
            )}
            <Button variant="ghost" icon={FileMusic} onClick={pickAnother} disabled={saving}>
              Pick a different file
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Two or three big choices that wrap on narrow screens (a radio group). */
function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-12 rounded-2xl border px-4 font-extrabold transition-colors ${
              active ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** "Show details" under an import that failed: the first problems by bar, and what to try. */
function ProblemDetails({ groups, more }: { groups: ProblemGroup[]; more: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-white/8 bg-night-850">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left font-extrabold text-ink-soft transition-colors hover:text-ink"
      >
        <ChevronDown size={20} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4 text-[0.95rem] leading-relaxed">
          {groups.map((g) => (
            <div key={g.fix}>
              <ul className="space-y-1">
                {g.items.map((it) => (
                  <li key={`${it.where}|${it.text}`}>
                    {it.where && <b className="text-ink">{it.where}: </b>}
                    <span className="text-ink-soft">{it.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 flex gap-2 text-sm font-bold text-gold">
                <Lightbulb size={16} className="mt-0.5 shrink-0" /> {g.fix}
              </p>
            </div>
          ))}
          {more > 0 && (
            <p className="text-sm text-ink-mute">
              …and {more} more {more === 1 ? 'problem' : 'problems'}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Fact({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">{children}</span>
}

/** Which files work, and where they come from. */
export function HowToGetFiles() {
  return (
    <div className="rounded-2xl border border-white/8 bg-night-850 p-4 text-[0.95rem] leading-relaxed text-ink-soft">
      <p className="mb-1 font-extrabold text-ink">Which files work?</p>
      <p>
        MusicXML files: <b className="text-ink">.mxl</b>, <b className="text-ink">.musicxml</b> or <b className="text-ink">.xml</b>. Most notation apps can
        save them. In MuseScore it's <b className="text-ink">File → Export → MusicXML</b>. Piano music with two staves gives you both hands.
      </p>
    </div>
  )
}
