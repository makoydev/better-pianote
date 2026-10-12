/** Score files on this device: which ones the file picker offers. */

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
