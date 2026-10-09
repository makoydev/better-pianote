import { Check, Minus, Play, Plus, Square } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { playNotes } from '../../lib/audio/play'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import {
  type Chord,
  type Key,
  bassFor,
  chordPcs,
  chordSymbol,
  keyName,
  mod,
  parseKey,
  pcOf,
  romanToChord,
  voiceProgression,
} from '../../lib/theory'
import { MusicText } from '../MusicText'
import { type Marks, Piano } from '../piano/Piano'
import { Button, IconButton } from '../ui/Button'
import { Segmented } from '../ui/controls'

/** Plays a chord progression in a key, lighting up each chord; transpose it and play along. */

type Pattern = 'block' | 'arpeggio' | 'ballad'

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb']
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'Dm', 'Gm', 'Cm']

function safeKey(s: string): Key {
  try {
    return parseKey(s)
  } catch {
    return parseKey('C')
  }
}

function safeRoman(r: string, k: Key): Chord {
  try {
    return romanToChord(r, k)
  } catch {
    return romanToChord('I', k)
  }
}

/** Left-hand broken chord: root, 5th-ish, octave, 10th-ish (all chord tones). */
function brokenTones(chord: Chord): number[] {
  const pcs = new Set(chordPcs(chord).map((p) => mod(p, 12)))
  const base = bassFor(chord, 36)
  const above = (from: number) => {
    let m = from
    while (!pcs.has(mod(m, 12))) m++
    return m
  }
  const t1 = above(base + 5)
  const t2 = base + 12
  const t3 = above(base + 14)
  return [base, t1, t2, t3, t2, t1, t2, t1]
}

export function ProgressionWidget({
  keyName: startKey,
  romans,
  bpm: startBpm = 80,
  pattern: startPattern = 'block',
}: {
  keyName: string
  romans: string[]
  bpm?: number
  pattern?: Pattern
}) {
  const [keyStr, setKeyStr] = useState(startKey)
  const [pattern, setPattern] = useState<Pattern>(startPattern)
  const [bpm, setBpm] = useState(startBpm)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [matched, setMatched] = useState<number[]>([])

  const key = useMemo(() => safeKey(keyStr), [keyStr])
  const chords = useMemo(() => romans.map((r) => safeRoman(r, key)), [romans, key])
  const rh = useMemo(() => voiceProgression(chords, { center: 64, low: 57, high: 77 }), [chords])
  const bass = useMemo(() => chords.map((c) => bassFor(c, 40)), [chords])
  const broken = useMemo(() => chords.map(brokenTones), [chords])

  const live = useRef({ pattern, bpm, rh, bass, broken })
  useEffect(() => {
    live.current = { pattern, bpm, rh, bass, broken }
  }, [pattern, bpm, rh, bass, broken])

  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])

  const stop = () => {
    clock.current?.stop()
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPlaying(false)
  }
  useEffect(() => () => stop(), [])

  const start = () => {
    stop()
    setMatched([])
    clock.current = new Clock({
      interval: () => 30 / live.current.bpm,
      onTick: (i, time) => {
        const { pattern: p, bpm: b, rh: v, bass: bs, broken: br } = live.current
        const n = v.length
        if (n === 0) return
        const e = 30 / b
        const pos = i % 8
        const idx = Math.floor(i / 8) % n
        if (pos === 0) {
          timers.current.push(audio.at(time, () => setCurrent(idx)))
          if (timers.current.length > 40) timers.current = timers.current.slice(-20)
        }
        if (p === 'block') {
          if (pos === 0) {
            audio.play(bs[idx], { when: time, dur: e * 7.8, vel: 0.6 })
            audio.play(v[idx], { when: time, dur: e * 3.8, vel: 0.5 })
          } else if (pos === 4) audio.play(v[idx], { when: time, dur: e * 3.8, vel: 0.4 })
        } else if (p === 'arpeggio') {
          audio.play(br[idx][pos], { when: time, dur: e * 2.4, vel: pos === 0 ? 0.62 : 0.46 })
          if (pos === 0) audio.play(v[idx], { when: time, dur: e * 7.6, vel: 0.34 })
        } else {
          if (pos === 0) audio.play(bs[idx], { when: time, dur: e * 8, vel: 0.58 })
          const order = [-1, 0, 1, 2, 1, 2, 1, 0]
          const k = order[pos]
          if (k >= 0) audio.play(v[idx][Math.min(k, v[idx].length - 1)], { when: time, dur: e * 2.6, vel: 0.42 })
        }
      },
    })
    clock.current.start(0.15)
    setPlaying(true)
  }

  // Restart cleanly when the key changes mid-play (new voicings).
  useEffect(() => {
    if (clock.current?.running) start()
  }, [keyStr])

  useNoteEvents((e) => {
    if (e.type !== 'on') return
    const held = new Set(heldNow().map((m) => mod(m, 12)))
    const need = chordPcs(chords[current]).slice(0, 3)
    if (need.every((p) => held.has(mod(p, 12))) && !matched.includes(current)) setMatched((m) => [...m, current])
  })

  const marks: Marks = {}
  marks[bass[current]] = { kind: 'root', label: 'Bass' }
  rh[current]?.forEach((m) => (marks[m] = 'chord'))

  const keys = key.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS
  const changeBpm = (v: number) => setBpm(Math.max(50, Math.min(160, v)))

  // Scope animated highlights so two copies of this widget don't share them.
  const layoutGroup = useId()
  return (
    <LayoutGroup id={layoutGroup}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl font-bold leading-tight">
            In <MusicText text={keyName(key)} />
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={pattern}
              onChange={setPattern}
              options={[
                { value: 'block', label: 'Block' },
                { value: 'arpeggio', label: 'Broken' },
                { value: 'ballad', label: 'Ballad' },
              ]}
            />
            <div className="flex items-center gap-1.5">
              <IconButton icon={Minus} label="Slower" size={40} onClick={() => changeBpm(bpm - 5)} />
              <span className="w-16 text-center text-sm font-extrabold text-ink-soft">{bpm} BPM</span>
              <IconButton icon={Plus} label="Faster" size={40} onClick={() => changeBpm(bpm + 5)} />
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {chords.map((c, i) => {
            const on = i === current
            return (
              <motion.button
                key={`${romans[i]}-${i}`}
                type="button"
                onClick={() => {
                  setCurrent(i)
                  if (!playing) playNotes([bass[i], ...rh[i]], { dur: 1.6, strum: 0.02 })
                }}
                animate={{ scale: on ? 1.06 : 1, y: on ? -3 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className={`relative flex min-w-[5.5rem] flex-1 flex-col items-center rounded-2xl border-2 px-3 py-3 ${
                  on ? 'border-gold bg-gold/15 shadow-[0_0_28px_-6px_rgba(255,200,87,.6)]' : 'border-white/10 bg-night-850'
                }`}
              >
                {matched.includes(i) && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-good text-night-900">
                    <Check size={15} strokeWidth={3} />
                  </motion.span>
                )}
                <span className={`font-display text-3xl font-bold leading-none ${on ? 'text-gold' : 'text-ink'}`}>
                  <MusicText text={romans[i].replace(/^b/, '♭').replace(/^#/, '♯')} />
                </span>
                <span className="mt-1.5 text-lg font-extrabold text-ink-soft">
                  <MusicText text={chordSymbol(c)} />
                </span>
              </motion.button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="md" variant={playing ? 'secondary' : 'primary'} icon={playing ? Square : Play} onClick={playing ? stop : start}>
            {playing ? 'Stop' : 'Play loop'}
          </Button>
          <span className="text-sm text-ink-mute">Play along: hold the lit-up chord on your keyboard to tick it off.</span>
        </div>

        <Piano from={36} to={84} marks={marks} labels="c" height={150} middleC={false} />

        <div>
          <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Same progression, another key</div>
          <div className="flex flex-wrap gap-2">
            {keys.map((k) => {
              const kk = safeKey(k)
              const on = pcOf(kk.tonic) === pcOf(key.tonic) && kk.mode === key.mode
              return (
                <motion.button
                  key={k}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setKeyStr(k)}
                  className={`h-11 min-w-12 rounded-xl border px-3 text-base font-extrabold ${on ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'}`}
                >
                  <MusicText text={k.replace('b', '♭')} />
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </LayoutGroup>
  )
}
