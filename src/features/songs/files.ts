/** Score files on this device: which ones the file picker offers, and saving an original back out. */

/** What the importer reads. */
export const SCORE_TYPES = '.mxl,.musicxml,.xml'

/** iPhone or iPad. iPadOS says it's a Mac, but Macs don't have touch screens. */
export function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * The file picker's `accept`: score files only on computers. iOS greys out file types it doesn't know
 * (.mxl and .musicxml among them), so there the picker shows every file.
 */
export const scoreAccept = (): string | undefined => (isAppleTouch() ? undefined : SCORE_TYPES)

const MIME: Record<string, string> = {
  mxl: 'application/vnd.recordare.musicxml',
  musicxml: 'application/vnd.recordare.musicxml+xml',
  xml: 'application/xml',
  mid: 'audio/midi',
}

export const mimeFor = (name: string) => MIME[/\.([^.]+)$/.exec(name)?.[1].toLowerCase() ?? ''] ?? 'application/octet-stream'

/** Save a file to the device: a download on computers, the save sheet on iPad. */
export function downloadFile(name: string, bytes: ArrayBuffer) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: mimeFor(name) }))
  a.download = name
  a.click()
  // Safari needs the link a moment longer before it's released.
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
