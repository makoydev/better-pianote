export const SHORTCUTS_EVENT = 'tonic:shortcuts'

/** Open the shortcut sheet (it lives in App, so any screen can ask for it). */
export function openShortcuts() {
  window.dispatchEvent(new Event(SHORTCUTS_EVENT))
}
