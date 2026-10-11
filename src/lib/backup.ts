import { libraryBackup, restoreLibrary } from '../state/library'
import { usePrefs } from '../state/prefs'
import { useProgress } from '../state/progress'
import { useSettings } from '../state/settings'

/** Moving progress between devices: a JSON file with settings, progress, remembered choices and imported songs. */

export function exportBackup() {
  const { set: _set, ...settings } = useSettings.getState()
  void _set
  const p = useProgress.getState()
  const progress = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== 'function'))
  const library = libraryBackup()
  const prefs = usePrefs.getState().values
  const blob = new Blob([JSON.stringify({ app: 'tonic', version: 2, exportedAt: new Date().toISOString(), settings, progress, prefs, library })], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `tonic-progress-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  // Safari needs the link a moment longer before it's released.
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Read a file from exportBackup. Returns a message for the user (it never throws). */
export async function importBackup(f: File): Promise<{ ok: boolean; message: string }> {
  try {
    const data = JSON.parse(await f.text())
    if (data?.app !== 'tonic' || !data.progress) throw new Error('not a Tonic file')
    useProgress.setState(data.progress)
    if (data.settings) useSettings.setState(data.settings)
    if (data.prefs && typeof data.prefs === 'object') usePrefs.setState({ values: data.prefs })
    let songs = 0
    try {
      songs = data.library ? await restoreLibrary(data.library) : 0
    } catch {
      return { ok: true, message: 'Progress imported, but this browser wouldn’t store the songs (private browsing?).' }
    }
    return { ok: true, message: songs ? `Progress and ${songs} song${songs === 1 ? '' : 's'} imported. Welcome back!` : 'Progress imported. Welcome back!' }
  } catch {
    return { ok: false, message: 'That file doesn’t look like a Tonic progress file.' }
  }
}
