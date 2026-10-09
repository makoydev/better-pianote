/**
 * The app's piano: Salamander Grand Piano samples (one every minor third, repitched in between),
 * with a soft synth that covers the moment before the samples finish loading.
 */

interface Voice {
  midi: number
  gain: GainNode
  sources: AudioScheduledSourceNode[]
}

const SAMPLE_BASE = `${import.meta.env.BASE_URL}samples/piano/`

/** [file name, MIDI number] for every sample we ship (A0 … C8). */
const SAMPLES: [string, number][] = (() => {
  const out: [string, number][] = [['A0', 21]]
  for (let oct = 1; oct <= 7; oct++) {
    const c = (oct + 1) * 12
    out.push([`C${oct}`, c], [`Ds${oct}`, c + 3], [`Fs${oct}`, c + 6], [`A${oct}`, c + 9])
  }
  out.push(['C8', 108])
  return out
})()

type AudioSessionType = 'auto' | 'playback' | 'play-and-record'

/**
 * Safari (iPad/iPhone) can silence web audio in silent mode. Declaring the page a music player
 * ("playback") keeps the piano audible; the mic needs "play-and-record" while it's listening.
 */
export function setAudioSession(type: AudioSessionType, onlyIfUnset = false) {
  const nav = navigator as Navigator & { audioSession?: { type: AudioSessionType } }
  try {
    if (!nav.audioSession || (onlyIfUnset && nav.audioSession.type !== 'auto')) return
    nav.audioSession.type = type
  } catch {
    // Not supported here; nothing to do.
  }
}

const velocityGain = (v: number) => 0.06 + 0.94 * Math.pow(Math.min(1, Math.max(0, v)), 1.6)

export type SampleStatus = 'idle' | 'loading' | 'ready' | 'error'

class AudioEngine {
  ctx: AudioContext | null = null
  private input!: GainNode
  private master!: GainNode
  private wet!: GainNode
  private clicks!: GainNode
  private buffers = new Map<number, AudioBuffer>()
  private held = new Map<number, Voice>()
  private sustained = new Set<number>()
  private sustainDown = false
  private statusListeners = new Set<(s: SampleStatus) => void>()
  status: SampleStatus = 'idle'
  /** AudioContext time until which the app is making sound (the mic ignores input until then). */
  busyUntil = 0
  private volume = 0.85
  private reverb = 0.22

  /** Create or resume the AudioContext. Call from a user gesture the first time (browsers require it). */
  unlock(): AudioContext {
    if (!this.ctx) {
      // Don't override the mic's "play-and-record" if it got there first.
      setAudioSession('playback', true)
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      this.ctx = ctx
      this.build(ctx)
      void this.loadSamples()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0
  }

  onStatus(fn: (s: SampleStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  private setStatus(s: SampleStatus) {
    this.status = s
    this.statusListeners.forEach((fn) => fn(s))
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.setTargetAtTime(v, this.now, 0.05)
  }

  setReverb(on: boolean) {
    this.reverb = on ? 0.22 : 0
    if (this.wet) this.wet.gain.setTargetAtTime(this.reverb, this.now, 0.05)
  }

  private build(ctx: AudioContext) {
    this.input = ctx.createGain()
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.knee.value = 18
    comp.ratio.value = 3
    comp.attack.value = 0.003
    comp.release.value = 0.25
    const dry = ctx.createGain()
    dry.gain.value = 0.9
    const verb = ctx.createConvolver()
    verb.buffer = this.impulse(ctx, 2.4, 3.4)
    this.wet = ctx.createGain()
    this.wet.gain.value = this.reverb
    this.input.connect(dry).connect(comp)
    this.input.connect(verb).connect(this.wet).connect(comp)
    comp.connect(this.master)
    this.clicks = ctx.createGain()
    this.clicks.connect(this.master)
    this.master.connect(ctx.destination)
  }

  private impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  private async loadSamples() {
    const ctx = this.ctx
    if (!ctx || this.status === 'loading' || this.status === 'ready') return
    this.setStatus('loading')
    // Middle of the keyboard first, so the notes you're most likely to hear arrive first.
    const order = [...SAMPLES].sort((a, b) => Math.abs(a[1] - 62) - Math.abs(b[1] - 62))
    const results = await Promise.allSettled(
      order.map(async ([name, m]) => {
        const res = await fetch(`${SAMPLE_BASE}${name}.mp3`)
        if (!res.ok) throw new Error(`${name}: ${res.status}`)
        const buf = await ctx.decodeAudioData(await res.arrayBuffer())
        this.buffers.set(m, buf)
      }),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    this.setStatus(ok >= SAMPLES.length * 0.8 ? 'ready' : ok > 0 ? 'ready' : 'error')
  }

  private nearest(midi: number): [number, AudioBuffer] | null {
    let best: [number, AudioBuffer] | null = null
    for (const [m, buf] of this.buffers) {
      if (!best || Math.abs(m - midi) < Math.abs(best[0] - midi)) best = [m, buf]
    }
    return best
  }

  private voice(midi: number, vel: number, when: number): Voice {
    const ctx = this.ctx!
    const gain = ctx.createGain()
    const peak = velocityGain(vel) * 0.9
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(peak, when + 0.004)
    gain.connect(this.input)
    const sample = this.nearest(midi)
    let sources: AudioScheduledSourceNode[]
    if (sample && Math.abs(sample[0] - midi) <= 6) {
      const src = ctx.createBufferSource()
      src.buffer = sample[1]
      src.playbackRate.value = Math.pow(2, (midi - sample[0]) / 12)
      src.connect(gain)
      src.start(when)
      sources = [src]
    } else {
      sources = this.synth(midi, when, gain, peak)
    }
    sources[0].onended = () => gain.disconnect()
    this.busyUntil = Math.max(this.busyUntil, when + 0.6)
    return { midi, gain, sources }
  }

  /** Soft electric-piano-ish tone used until samples are ready. */
  private synth(midi: number, when: number, out: GainNode, peak: number): AudioScheduledSourceNode[] {
    const ctx = this.ctx!
    const f = 440 * Math.pow(2, (midi - 69) / 12)
    out.gain.setTargetAtTime(peak * 0.3, when + 0.01, 0.5)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(Math.min(9000, f * 9), when)
    filter.frequency.setTargetAtTime(Math.max(400, f * 2.5), when, 0.35)
    filter.connect(out)
    const o1 = ctx.createOscillator()
    o1.type = 'triangle'
    o1.frequency.value = f
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = f * 2
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o1.connect(filter)
    o2.connect(g2).connect(filter)
    o1.start(when)
    o2.start(when)
    o1.stop(when + 5)
    o2.stop(when + 5)
    return [o1, o2]
  }

  private release(v: Voice, when: number) {
    const g = v.gain.gain
    const tail = v.midi < 48 ? 0.5 : v.midi < 72 ? 0.35 : 0.25
    if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(when)
    else g.cancelScheduledValues(when)
    g.setTargetAtTime(0, when, tail / 4)
    for (const s of v.sources) {
      try {
        s.stop(when + tail * 2)
      } catch {
        /* already stopped */
      }
    }
  }

  /** Start a held note (on-screen keys, computer keys, MIDI thru). */
  noteOn(midi: number, vel = 0.75) {
    const ctx = this.unlock()
    const old = this.held.get(midi)
    if (old) this.release(old, ctx.currentTime)
    this.sustained.delete(midi)
    this.held.set(midi, this.voice(midi, vel, ctx.currentTime))
  }

  noteOff(midi: number) {
    if (!this.ctx) return
    if (this.sustainDown) {
      this.sustained.add(midi)
      return
    }
    const v = this.held.get(midi)
    if (v) {
      this.release(v, this.ctx.currentTime)
      this.held.delete(midi)
    }
  }

  setSustain(down: boolean) {
    this.sustainDown = down
    if (!down && this.ctx) {
      for (const m of this.sustained) {
        const v = this.held.get(m)
        if (v) {
          this.release(v, this.ctx.currentTime)
          this.held.delete(m)
        }
      }
      this.sustained.clear()
    }
  }

  /** Play one note or a chord for a fixed time. `strum` spreads chord notes (seconds apart). */
  play(notes: number | number[], opts: { dur?: number; vel?: number; when?: number; strum?: number } = {}) {
    const ctx = this.unlock()
    const { dur = 1.2, vel = 0.7, strum = 0 } = opts
    const when = opts.when ?? ctx.currentTime + 0.03
    const list = Array.isArray(notes) ? notes : [notes]
    list.forEach((m, i) => {
      const t = when + i * strum
      const v = this.voice(m, vel, t)
      this.release(v, t + dur)
    })
    this.busyUntil = Math.max(this.busyUntil, when + dur + list.length * strum + 0.4)
  }

  /** Play notes one after another. */
  sequence(notes: (number | number[])[], opts: { gap?: number; dur?: number; vel?: number; when?: number } = {}) {
    const ctx = this.unlock()
    const { gap = 0.45, vel = 0.7 } = opts
    const dur = opts.dur ?? gap * 1.6
    const start = opts.when ?? ctx.currentTime + 0.05
    notes.forEach((n, i) => this.play(n, { dur, vel, when: start + i * gap }))
    return start + notes.length * gap
  }

  /** Metronome tick. */
  click(accent: boolean, when?: number) {
    const ctx = this.unlock()
    const t = when ?? ctx.currentTime + 0.01
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = accent ? 1760 : 1175
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(accent ? 0.55 : 0.32, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(g).connect(this.clicks)
    o.start(t)
    o.stop(t + 0.09)
    o.onended = () => g.disconnect()
    this.busyUntil = Math.max(this.busyUntil, t + 0.1)
  }

  /** Little feedback sounds. Kept gentle so they don't fight with your keyboard. */
  ui(kind: 'correct' | 'wrong' | 'tap' | 'complete' | 'levelup') {
    const ctx = this.unlock()
    const t = ctx.currentTime + 0.01
    this.busyUntil = Math.max(this.busyUntil, t + 0.5)
    const bell = (freq: number, at: number, peak = 0.12, len = 0.35) => {
      const o = ctx.createOscillator()
      const o2 = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o2.type = 'sine'
      o.frequency.value = freq
      o2.frequency.value = freq * 3.01
      const g2 = ctx.createGain()
      g2.gain.value = 0.18
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, at + len)
      o.connect(g)
      o2.connect(g2).connect(g)
      g.connect(this.clicks)
      o.start(at)
      o2.start(at)
      o.stop(at + len + 0.05)
      o2.stop(at + len + 0.05)
      o.onended = () => g.disconnect()
    }
    if (kind === 'correct') {
      bell(1318.5, t, 0.09)
      bell(1760, t + 0.07, 0.09)
    } else if (kind === 'tap') {
      bell(880, t, 0.05, 0.12)
    } else if (kind === 'wrong') {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(220, t)
      o.frequency.exponentialRampToValueAtTime(150, t + 0.18)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      o.connect(g).connect(this.clicks)
      o.start(t)
      o.stop(t + 0.25)
    } else if (kind === 'complete') {
      this.sequence([72, 76, 79, [84, 76, 79]], { gap: 0.11, dur: 1.4, vel: 0.55 })
    } else {
      this.sequence([67, 72, 76, 79, [84, 88, 91]], { gap: 0.09, dur: 1.6, vel: 0.55 })
    }
  }

  /** Run `fn` when the audio clock reaches `when` (for syncing visuals to scheduled sound). */
  at(when: number, fn: () => void): number {
    const ms = (when - this.now) * 1000
    return window.setTimeout(fn, Math.max(0, ms))
  }

  stopAll() {
    if (!this.ctx) return
    for (const v of this.held.values()) this.release(v, this.ctx.currentTime)
    this.held.clear()
    this.sustained.clear()
  }
}

export const audio = new AudioEngine()
