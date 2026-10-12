import { GitMerge, Replace } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { type Backup, applyBackup, summarize } from '../../lib/backup'
import { useLibrary } from '../../state/library'
import { useProgress } from '../../state/progress'

const ago = (iso?: string) => {
  if (!iso) return 'an unknown date'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** What's in a backup file next to what's on this device, then Merge (the best of both) or Replace. */
export function ImportPreview({ backup, onClose }: { backup: Backup | null; onClose: () => void }) {
  const progress = useProgress()
  const songs = useLibrary((s) => s.entries.length)
  const [busy, setBusy] = useState(false)
  if (!backup) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const here = summarize(progress, songs)
  const file = summarize(backup.progress, Array.isArray(backup.library) ? backup.library.length : 0)
  const apply = (mode: 'merge' | 'replace') => {
    setBusy(true)
    void applyBackup(backup, mode)
  }
  const rows: [string, keyof typeof here][] = [
    ['XP', 'xp'],
    ['Lessons done', 'lessons'],
    ['Stars', 'stars'],
    ['Imported songs', 'songs'],
  ]
  return (
    <Modal open onClose={onClose} title="Import progress">
      <p className="text-ink-soft">This file was saved {ago(backup.exportedAt)}.</p>
      <table className="mt-4 w-full text-left">
        <thead>
          <tr className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">
            <th className="py-2" />
            <th className="py-2">This device</th>
            <th className="py-2">The file</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {rows.map(([label, key]) => (
            <tr key={key}>
              <td className="py-2 font-bold text-ink-soft">{label}</td>
              <td className="py-2 font-extrabold">{here[key]}</td>
              <td className="py-2 font-extrabold">{file[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 space-y-3">
        <Button icon={GitMerge} block onClick={() => apply('merge')} disabled={busy}>
          Merge (keep the best of both)
        </Button>
        <Button variant="secondary" icon={Replace} block onClick={() => apply('replace')} disabled={busy}>
          Replace this device’s progress
        </Button>
      </div>
      <p className="mt-3 text-sm text-ink-mute">
        Merge keeps every lesson and best score from either device. Replace makes this device match the file. Either way, device settings like text size and
        the mic stay as they are, and you can undo it from Settings until you close the app.
      </p>
    </Modal>
  )
}
