import { audio } from './engine'

/** The mic names a single note a moment after it starts (two readings 40 ms apart), as Rhythm Tap allows for. */
export const MIC_DELAY = 0.07

/** Hearing a chord takes the mic longer: it waits for the strike to settle before reading the notes. */
export const MIC_CHORD_DELAY = 0.25

/**
 * When you played a note (a performance.now() time), on the audio clock as you heard the app: getOutputTimestamp
 * maps the moment sound leaves the speakers, so output latency is accounted for. The same conversion Rhythm Tap uses.
 */
export function heardTime(perfMs: number): number {
  const ctx = audio.ctx
  if (!ctx) return 0
  const ts = ctx.getOutputTimestamp?.()
  if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.contextTime + (perfMs - ts.performanceTime) / 1000
  }
  return ctx.currentTime - (performance.now() - perfMs) / 1000 - (ctx.outputLatency || ctx.baseLatency || 0)
}
