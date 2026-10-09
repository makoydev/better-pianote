import { ArrowUpDown, Hand, Play, RotateCcw, Square, Target, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { type NoteState, Staff, type StaffItem } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Card, Paper } from '../../components/ui/Card'
import { Segmented } from '../../components/ui/controls'
import { audio } from '../../lib/audio/engine'
import { playSequence } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { burst } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { SCALE_TYPE, SCALE_TYPES, keyFifths, midiOf, mod, parseNote, pcOf, pitchName, scaleFingering, scaleNotes, stepPattern } from '../../lib/theory'
import { useProgress } from '../../state/progress'
import { OctavePicker } from './OctavePicker'

const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
const MINORISH = new Set(['minor', 'harmonic-minor', 'melodic-minor', 'minor-pentatonic', 'blues', 'dorian'])
const KEY_SIG_MODE: Record<string, 'major' | 'minor'> = { major: 'major', minor: 'minor', 'harmonic-minor': 'minor', 'melodic-minor': 'minor' }

const tonicName = (pc: number, typeId: string) => (MINORISH.has(typeId) ? MINOR_TONICS : MAJOR_TONICS)[pc]

interface Practice {
  idx: number
  mistakes: number
  done: boolean
  wrongAt: number | null
}

export function ScaleExplorer() {
  const [pc, setPc] = useState(0)
  const [typeId, setTypeId] = useState('major')
  const [hand, setHand] = useState<'rh' | 'lh'>('rh')
  const [upDown, setUpDown] = useState(true)
  const [playIdx, setPlayIdx] = useState<number | null>(null)
  const [practice, setPractice] = useState<Practice | null>(null)
  const timers = useRef<number[]>([])
  const scoreRef = useRef<HTMLDivElement>(null)
  const addXp = useProgress((s) => s.addXp)

  const type = SCALE_TYPE[typeId]
  const oct = hand === 'rh' ? 4 : 3
  const tonic = useMemo(() => parseNote(tonicName(pc, typeId) + oct), [pc, typeId, oct])
  const notes = useMemo(() => scaleNotes(tonic, type), [tonic, type])
  const midis = useMemo(() => notes.map(midiOf), [notes])
  const steps = useMemo(() => stepPattern(type), [type])
  const fingering = scaleFingering(tonic, type)
  const fingers = fingering ? (hand === 'rh' ? fingering.rh : fingering.lh) : null
  const keyMode = KEY_SIG_MODE[typeId]
  const keySig = keyMode ? keyFifths({ tonic, mode: keyMode }) : 0
  const title = `${pitchName(tonic)} ${type.name.toLowerCase()}`

  // Up (and back down) as one list of positions into `notes`.
  const order = useMemo(() => {
    const up = notes.map((_, i) => i)
    return upDown ? [...up, ...up.slice(0, -1).reverse()] : up
  }, [notes, upDown])

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  /** Changing the scale stops any playback or practice run. */
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    clearTimers()
    setPlayIdx(null)
    setPractice(null)
    set(v)
  }

  const play = () => {
    clearTimers()
    setPractice(null)
    const gap = 0.36
    playSequence(
      order.map((i) => midis[i]),
      { gap, dur: 0.6 },
    )
    order.forEach((_, k) => timers.current.push(window.setTimeout(() => setPlayIdx(k), k * gap * 1000 + 30)))
    timers.current.push(window.setTimeout(() => setPlayIdx(null), order.length * gap * 1000 + 400))
  }

  const startPractice = () => {
    clearTimers()
    setPlayIdx(null)
    setPractice({ idx: 0, mistakes: 0, done: false, wrongAt: null })
  }

  useNoteEvents((e) => {
    if (e.type !== 'on' || !practice || practice.done) return
    const target = midis[order[practice.idx]]
    if (mod(e.midi, 12) === mod(target, 12)) {
      const idx = practice.idx + 1
      if (idx >= order.length) {
        setPractice({ ...practice, idx, done: true, wrongAt: null })
        audio.ui('complete')
        burst(scoreRef.current, { count: 70 })
        addXp(practice.mistakes === 0 ? 10 : 5)
      } else setPractice({ ...practice, idx, wrongAt: null })
    } else {
      setPractice({ ...practice, mistakes: practice.mistakes + 1, wrongAt: e.midi })
    }
  })

  // Clear the red flash on a wrong key after a moment.
  useEffect(() => {
    if (practice?.wrongAt == null) return
    const t = window.setTimeout(() => setPractice((p) => (p ? { ...p, wrongAt: null } : p)), 450)
    return () => window.clearTimeout(t)
  }, [practice?.wrongAt])

  const current = practice && !practice.done ? order[practice.idx] : playIdx !== null ? order[playIdx] : null

  const marks: Record<number, KeyMark> = {}
  notes.forEach((n, i) => {
    const m = midis[i]
    marks[m] = { kind: pcOf(n) === pcOf(tonic) ? 'root' : 'scale', label: pitchName(n) }
  })
  if (current !== null) marks[midis[current]] = { kind: practice ? 'target' : 'chord', label: pitchName(notes[current]) }
  if (practice?.wrongAt != null && !(practice.wrongAt in marks)) marks[practice.wrongAt] = { kind: 'bad' }
  else if (practice?.wrongAt != null) marks[practice.wrongAt] = { ...(marks[practice.wrongAt] as KeyMark), kind: 'bad' }

  const pianoFingers: Record<number, number> = {}
  if (fingers) midis.forEach((m, i) => (pianoFingers[m] = fingers[i]))

  const items: StaffItem[] = useMemo(
    () =>
      order.map((i, k) => {
        let state: NoteState = 'normal'
        if (practice) state = k < practice.idx ? 'correct' : k === practice.idx && !practice.done ? 'active' : 'normal'
        else if (playIdx !== null) state = k === playIdx ? 'active' : 'normal'
        return { key: `${k}`, notes: [{ note: notes[i], finger: fingers?.[i] }], dur: 'q' as const, state }
      }),
    [order, notes, fingers, practice, playIdx],
  )

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Scale Explorer" subtitle="Every scale, with fingering and a practice mode" />
      <main className="mx-auto grid max-w-[1500px] gap-5 px-3 pt-5 sm:px-5 lg:grid-cols-[minmax(320px,410px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Starting note</h2>
            <OctavePicker value={pc} onChange={change(setPc)} label="Starting note" names={(p) => ({ main: tonicName(p, typeId).replace('#', '♯').replace('b', '♭') })} />
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Scale</h2>
            <div className="flex flex-wrap gap-2">
              {SCALE_TYPES.map((s) => (
                <motion.button
                  key={s.id}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => change(setTypeId)(s.id)}
                  aria-pressed={s.id === typeId}
                  className={`min-h-11 rounded-2xl border px-3.5 text-base font-extrabold transition-colors ${
                    s.id === typeId ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
                  }`}
                >
                  {s.name}
                </motion.button>
              ))}
            </div>
          </Card>
          <Card className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Hand</h2>
              <Segmented
                value={hand}
                onChange={change(setHand)}
                options={[
                  { value: 'rh', label: 'Right hand' },
                  { value: 'lh', label: 'Left hand' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Direction</h2>
              <Segmented
                value={upDown ? 'both' : 'up'}
                onChange={(v) => change(setUpDown)(v === 'both')}
                options={[
                  { value: 'up', label: 'Up' },
                  { value: 'both', label: 'Up & down' },
                ]}
                className="w-full"
              />
            </div>
          </Card>
        </section>

        <section className="flex min-w-0 flex-col gap-5">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: noteColor(pc) }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
                  <MusicText text={title.charAt(0).toUpperCase() + title.slice(1)} />
                </div>
                <div className="mt-1 text-lg font-extrabold text-gold">{type.mood}</div>
                <p className="mt-2 max-w-2xl text-ink-soft">{type.about}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={upDown ? ArrowUpDown : Play} onClick={play}>
                  Listen
                </Button>
                {practice && !practice.done ? (
                  <Button variant="secondary" icon={Square} onClick={() => setPractice(null)}>
                    Stop
                  </Button>
                ) : (
                  <Button variant="good" icon={Target} onClick={startPractice}>
                    Practice
                  </Button>
                )}
              </div>
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-1">
              {notes.map((n, i) => {
                const c = noteColor(pcOf(n))
                const lit = current === i
                return (
                  <div key={`${title}-${i}`} className="flex items-center gap-1">
                    {i > 0 && (
                      <span
                        className={`rounded-lg px-1.5 py-0.5 text-xs font-extrabold ${steps[i - 1] === 'H' ? 'bg-coral/20 text-coral' : steps[i - 1] === 'W' ? 'bg-teal/15 text-teal' : 'bg-violet/20 text-violet'}`}
                        title={steps[i - 1] === 'H' ? 'Half step' : steps[i - 1] === 'W' ? 'Whole step' : 'Step and a half'}
                      >
                        {steps[i - 1] === 'W+H' ? '1½' : steps[i - 1]}
                      </span>
                    )}
                    <motion.span
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1, scale: lit ? 1.18 : 1 }}
                      transition={{ delay: lit ? 0 : i * 0.04, type: 'spring', stiffness: 420, damping: 20 }}
                      className="flex min-w-12 flex-col items-center rounded-xl border px-2 py-1 font-display text-2xl font-bold"
                      style={{ color: c, borderColor: `${c}66`, background: lit ? `${c}38` : `${c}14` }}
                    >
                      <MusicText text={pitchName(n)} />
                      {fingers && <span className="font-sans text-xs font-extrabold text-ink-mute">{fingers[i]}</span>}
                    </motion.span>
                  </div>
                )
              })}
            </div>
            <p className="relative mt-3 text-sm text-ink-mute">
              <b className="text-teal">W</b> = whole step (2 keys), <b className="text-coral">H</b> = half step (next key)
              {steps.includes('W+H') && (
                <>
                  , <b className="text-violet">1½</b> = three half steps
                </>
              )}
              .{' '}
              {fingers ? (
                <>Small numbers are {hand === 'rh' ? 'right' : 'left'}-hand fingers.</>
              ) : (
                <>No standard fingering here: keep your thumb off the black keys and cross under after 3 or 4 notes.</>
              )}
            </p>
          </Card>

          <Card className="pt-4">
            <div ref={scoreRef} className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink-mute">
                <Hand size={18} />
                {practice ? 'Play each lit note on your keyboard (any octave)' : `${hand === 'rh' ? 'Right' : 'Left'} hand, ${upDown ? 'up and back down' : 'going up'}`}
              </div>
              <AnimatePresence mode="wait">
                {practice && (
                  <motion.div
                    key={practice.done ? 'done' : 'go'}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    {practice.done ? (
                      <>
                        <span className="flex items-center gap-2 font-extrabold text-good">
                          <Trophy size={20} /> {practice.mistakes === 0 ? 'Clean run!' : `Done with ${practice.mistakes} slip${practice.mistakes > 1 ? 's' : ''}`}
                        </span>
                        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={startPractice}>
                          Again
                        </Button>
                      </>
                    ) : (
                      <span className="rounded-full bg-white/6 px-3 py-1.5 text-sm font-extrabold text-ink-soft">
                        {practice.idx}/{order.length} · {practice.mistakes} slip{practice.mistakes === 1 ? '' : 's'}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Piano from={hand === 'rh' ? 60 : 48} to={hand === 'rh' ? 84 : 72} marks={marks} fingers={pianoFingers} labels="marked" sparks sparkHeight={90} height={190} octaveLabels />
          </Card>

          <Paper>
            <Staff clef={hand === 'rh' ? 'treble' : 'bass'} keySig={keySig} items={items} sp={18} minSlot={3.4} labels fingers />
            <p className="mt-1 text-center text-sm font-bold text-paper-ink/60">
              {keyMode ? (
                <>
                  Written with the key signature of <MusicText text={`${pitchName(tonic)} ${keyMode}`} />
                  {typeId !== keyMode && typeId !== 'minor' ? '; the raised notes get accidentals.' : '.'}
                </>
              ) : (
                <>Written with accidentals (no key signature).</>
              )}
            </p>
          </Paper>
        </section>
      </main>
    </div>
  )
}
