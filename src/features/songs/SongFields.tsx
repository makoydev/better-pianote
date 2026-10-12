import type { ReactNode } from 'react'
import { Segmented } from '../../components/ui/controls'
import type { Song } from '../../content/songs'
import type { ImportPart } from '../../lib/musicxml'

/** The parts of an imported song you can change: when importing it, and later from its card. */

export const INPUT = 'h-12 w-full rounded-2xl border border-white/10 bg-night-850 px-4 text-lg font-bold text-ink outline-none focus:border-gold/60'

export interface SongDetails {
  title: string
  composer: string
  difficulty: Song['difficulty']
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold uppercase tracking-wider text-ink-mute">{label}</span>
      {children}
    </label>
  )
}

/** Title, composer and level. */
export function SongDetailsFields({ value, onChange }: { value: SongDetails; onChange: (patch: Partial<SongDetails>) => void }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input className={INPUT} value={value.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Composer">
          <input className={INPUT} value={value.composer} onChange={(e) => onChange({ composer: e.target.value })} maxLength={80} />
        </Field>
      </div>
      <Field label="Level">
        <Segmented<Song['difficulty']>
          value={value.difficulty}
          onChange={(difficulty) => onChange({ difficulty })}
          options={[
            { value: 1, label: 'Beginner' },
            { value: 2, label: 'Intermediate' },
            { value: 3, label: 'Advanced' },
          ]}
        />
      </Field>
    </>
  )
}

/** Which part of a score with several (a piano, a voice, a violin…) becomes the song. */
export function PartSelect({ parts, value, onChange, disabled }: { parts: ImportPart[]; value: number; onChange: (index: number) => void; disabled?: boolean }) {
  return (
    <Field label="Which part do you want to learn?">
      <select className={INPUT} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
        {parts.map((p, i) => (
          <option key={p.id} value={i}>
            {p.name || `Part ${i + 1}`} ({p.staves >= 2 ? 'two staves' : 'one staff'}, {p.notes} notes)
          </option>
        ))}
      </select>
    </Field>
  )
}
