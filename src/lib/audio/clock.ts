import { audio } from './engine'

export interface ClockOptions {
  /** Seconds between ticks (read every tick, so tempo changes apply immediately). */
  interval: () => number
  onTick: (index: number, time: number) => void
}

/**
 * A look-ahead scheduler ("A Tale of Two Clocks"): wakes every 25 ms and schedules any ticks
 * due in the next 120 ms on the audio clock, so timing stays tight even if the UI is busy.
 */
export class Clock {
  private timer = 0
  private next = 0
  private i = 0
  running = false
  private opts: ClockOptions

  constructor(opts: ClockOptions) {
    this.opts = opts
  }

  start(delay = 0.12) {
    const ctx = audio.unlock()
    this.stop()
    this.next = ctx.currentTime + delay
    this.i = 0
    this.running = true
    this.timer = window.setInterval(this.pump, 25)
    this.pump()
  }

  /** Audio time the first tick was (or will be) played. */
  get startedAt() {
    return this.next - this.i * this.opts.interval()
  }

  stop() {
    window.clearInterval(this.timer)
    this.running = false
  }

  private pump = () => {
    const ctx = audio.ctx
    if (!ctx) return
    while (this.next < ctx.currentTime + 0.12) {
      this.opts.onTick(this.i, this.next)
      this.next += this.opts.interval()
      this.i++
    }
  }
}
