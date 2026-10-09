import { AlertTriangle, FileMusic, Hand, Loader2, Lock, Play, Upload } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/controls'
import { Modal } from '../../components/ui/Modal'
import type { Song } from '../../content/songs'
import { go } from '../../router'
import { saveEntry } from '../../state/library'
import { closeImport, editImport, startImport, useImport } from './importSession'
import { buildTimeline, previewBars, songScoreInput } from './timeline'

/** Shows what's in the file being imported, and saves it to My songs. */
export function ImportSheet({ onPickAnother }: { onPickAnother: () => void }) {
  const phase = useImport((s) => s.phase)
  const edits = useImport((s) => s.edits)
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
    try {
      await saveEntry({
        id: finalSong.id,
        song: finalSong,
        source: { name: ready.file.name, bytes: ready.bytes.slice().buffer, partIndex: ready.result.partIndex },
        version: ready.version,
        addedAt: Date.now(),
      })
      closeImport()
      go(`/songs/${finalSong.id}`)
    } catch {
      setSaveError('Couldn’t save the song on this device. The browser may be in private mode or out of space.')
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    setSaveError(null)
    closeImport()
  }
  const file = phase.kind === 'closed' ? null : phase.file
  const stats = ready?.result.stats

  return (
    <Modal open={phase.kind !== 'closed'} onClose={close} title="Import a song" wide>
      {phase.kind === 'reading' && (
        <div className="flex items-center gap-3 py-10 text-lg font-bold text-ink-soft">
          <Loader2 className="animate-spin text-gold" size={26} /> Reading {file?.name}…
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-ink">
            <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={22} />
            <div>
              <p className="font-extrabold">{phase.message}</p>
              <p className="mt-1 text-sm text-ink-soft">{file?.name}</p>
            </div>
          </div>
          <HowToGetFiles />
          <div className="flex flex-wrap gap-3">
            <Button icon={Upload} onClick={onPickAnother}>
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

          {ready.result.parts.length > 1 && (
            <Field label="Which part do you want to learn?">
              <select
                className={INPUT}
                value={ready.result.partIndex}
                onChange={(e) => void startImport(ready.file, Number(e.target.value), ready.bytes)}
              >
                {ready.result.parts.map((p, i) => (
                  <option key={p.id} value={i}>
                    {p.name || `Part ${i + 1}`} ({p.staves >= 2 ? 'two staves' : 'one staff'}, {p.notes} notes)
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input className={INPUT} value={edits.title} onChange={(e) => editImport({ title: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Composer">
              <input className={INPUT} value={edits.composer} onChange={(e) => editImport({ composer: e.target.value })} maxLength={80} />
            </Field>
          </div>

          <Field label="Level">
            <Segmented<Song['difficulty']>
              value={edits.difficulty}
              onChange={(difficulty) => editImport({ difficulty })}
              options={[
                { value: 1, label: 'Beginner' },
                { value: 2, label: 'Intermediate' },
                { value: 3, label: 'Advanced' },
              ]}
            />
          </Field>

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
            <Button icon={Play} onClick={() => void save()} disabled={saving}>
              Save and play
            </Button>
            <Button variant="ghost" icon={FileMusic} onClick={onPickAnother}>
              Pick a different file
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const INPUT = 'h-12 w-full rounded-2xl border border-white/10 bg-night-850 px-4 text-lg font-bold text-ink outline-none focus:border-gold/60'

function Fact({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">{children}</span>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold uppercase tracking-wider text-ink-mute">{label}</span>
      {children}
    </label>
  )
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
