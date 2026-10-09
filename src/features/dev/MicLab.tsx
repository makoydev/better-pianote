import { useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { audio } from '../../lib/audio/engine'
import { attachTestInput, useMicChords } from '../../lib/input/mic'
import { nameHeardChord } from '../../lib/input/micMatch'
import { fromMidi, midi, noteName } from '../../lib/theory'
import { useLive } from '../../state/live'

/**
 * Developer page (#/dev/mic): plays piano chords silently into the mic analysers and checks which notes
 * the app hears, through the real browser audio pipeline.
 */

const SAMPLES: [string, number][] = (() => {
  const out: [string, number][] = [['A0', 21]]
  for (let o = 1; o <= 7; o++) {
    const c = (o + 1) * 12
    out.push([`C${o}`, c], [`Ds${o}`, c + 3], [`Fs${o}`, c + 6], [`A${o}`, c + 9])
  }
  out.push(['C8', 108])
  return out
})()

const CASES: [string, string[]][] = [
  ['C4', ['C4']],
  ['A4', ['A4']],
  ['E3', ['E3']],
  ['C major', ['C4', 'E4', 'G4']],
  ['A minor', ['A3', 'C4', 'E4']],
  ['F major', ['F3', 'A3', 'C4']],
  ['G major', ['G3', 'B3', 'D4']],
  ['F♯m (bass F♯2)', ['F#2', 'F#3', 'A3', 'C#4']],
  ['D major (bass D3)', ['D3', 'F#4', 'A4', 'D5']],
  ['A major (bass A2)', ['A2', 'A3', 'C#4', 'E4']],
  ['E major (bass E3)', ['E3', 'G#3', 'B3', 'E4']],
  ['G7', ['G3', 'B3', 'D4', 'F4']],
  ['Cmaj7', ['C4', 'E4', 'G4', 'B4']],
  ['Dm7', ['D4', 'F4', 'A4', 'C5']],
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Row {
  name: string
  played: string
  heard: string
  chord: string
  ok: boolean
}

export function MicLab() {
  useMicChords()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  const run = async (speaker: boolean) => {
    setBusy(true)
    setRows([])
    const ctx = audio.unlock()
    await ctx.resume()
    const buffers = new Map<number, AudioBuffer>()
    await Promise.all(
      SAMPLES.map(async ([name, m]) => {
        const res = await fetch(`${import.meta.env.BASE_URL}samples/piano/${name}.mp3`)
        buffers.set(m, await ctx.decodeAudioData(await res.arrayBuffer()))
      }),
    )
    // Silent bus: it feeds the analysers only, never the speakers.
    const bus = ctx.createGain()
    let input: AudioNode = bus
    if (speaker) {
      // Small keyboard speakers barely reproduce the lowest notes.
      const hp1 = ctx.createBiquadFilter()
      hp1.type = 'highpass'
      hp1.frequency.value = 140
      const hp2 = ctx.createBiquadFilter()
      hp2.type = 'highpass'
      hp2.frequency.value = 140
      bus.connect(hp1).connect(hp2)
      input = hp2
    }
    const tick = attachTestInput(input)
    const out: Row[] = []
    for (const [name, notes] of CASES) {
      const sources = notes.map((n) => {
        const m = midi(n)
        let best = 21
        for (const s of buffers.keys()) if (Math.abs(s - m) < Math.abs(best - m)) best = s
        const src = ctx.createBufferSource()
        src.buffer = buffers.get(best)!
        src.playbackRate.value = Math.pow(2, (m - best) / 12)
        src.connect(bus)
        src.start()
        return src
      })
      // Check while the notes are still ringing, like the live mic does every 40 ms.
      await wait(450)
      for (let i = 0; i < 10; i++) tick()
      const heard = Object.entries(useLive.getState().held)
        .filter(([, s]) => s === 'mic')
        .map(([m]) => Number(m))
        .sort((a, b) => a - b)
      sources.forEach((s) => s.stop())
      const want = new Set(notes.map((n) => midi(n) % 12))
      const got = new Set(heard.map((m) => m % 12))
      const extra = [...got].some((p) => !want.has(p))
      const missing = [...want].filter((p) => !got.has(p)).length
      const named = nameHeardChord(heard)
      out.push({
        name,
        played: notes.join(' '),
        heard: heard.map((m) => noteName(fromMidi(m))).join(' ') || '–',
        chord: named ? named.det.symbol + (named.fifthGuessed ? ' (5th guessed)' : '') : '',
        ok: !extra && missing <= (notes.length >= 3 ? 1 : 0),
      })
      setRows([...out])
      await wait(400)
      for (let i = 0; i < 6; i++) tick()
    }
    const ok = out.filter((r) => r.ok).length
    console.log(`[MicLab] ${speaker ? 'speaker' : 'full range'}: ${ok}/${out.length} usable`, JSON.stringify(out))
    setBusy(false)
  }

  return (
    <div className="min-h-dvh">
      <TopBar back="/" title="Mic lab" subtitle="Chord hearing through the real browser audio pipeline" />
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex gap-3">
          <Button onClick={() => void run(false)} disabled={busy}>
            Run (full range)
          </Button>
          <Button variant="secondary" onClick={() => void run(true)} disabled={busy}>
            Run (small speaker)
          </Button>
        </div>
        <p className="text-sm text-ink-mute">Silent: the test audio goes only into the analysers. Reload the page afterwards to use the real mic.</p>
        <table className="w-full text-left text-sm">
          <thead className="text-ink-mute">
            <tr>
              <th className="py-2">Case</th>
              <th>Played</th>
              <th>Heard</th>
              <th>Named</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-white/8">
                <td className="py-2 font-bold">{r.name}</td>
                <td>{r.played}</td>
                <td>{r.heard}</td>
                <td>{r.chord}</td>
                <td className={r.ok ? 'text-good' : 'text-bad'}>{r.ok ? 'ok' : 'miss'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 0 && !busy && (
          <div id="miclab-summary" className="font-extrabold">
            {rows.filter((r) => r.ok).length} / {rows.length} usable
          </div>
        )}
      </div>
    </div>
  )
}
