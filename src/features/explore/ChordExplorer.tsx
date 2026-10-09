import { Eraser, Guitar, Hand, Music, Play, Sparkles, Waves } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useMemo, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Card, Paper } from '../../components/ui/Card'
import { Segmented, Toggle } from '../../components/ui/controls'
import { playNotes, playSequence } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import {
  CHORD_TYPE,
  type Chord,
  INVERSION_NAMES,
  chordLongName,
  chordSymbol,
  detectChord,
  fromMidi,
  intervalBetween,
  noteName,
  pcOf,
  pitchName,
  spellRoot,
} from '../../lib/theory'
import { heldMidis, useLive } from '../../state/live'
import { CHORD_GROUPS, GUITAR_SHAPES, PC_NAMES, chordFormula, lhFingers, lhVoicing, rhFingers, rhVoicing, spellVoicing } from './chordTools'
import { GuitarDiagram } from './GuitarDiagram'
import { OctavePicker } from './OctavePicker'

const INV_LABELS = ['Root', '1st', '2nd', '3rd']

type Choice = { pc?: number; typeId?: string; inversion?: number }

export function ChordExplorer() {
  const [pc, setPc] = useState(0)
  const [typeId, setTypeId] = useState('maj')
  const [inversion, setInversion] = useState(0)
  const [hands, setHands] = useState<'rh' | 'both'>('rh')
  const [build, setBuild] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [pulse, setPulse] = useState(0)

  const type = CHORD_TYPE[typeId]
  const chord: Chord = useMemo(() => ({ root: spellRoot(pc, CHORD_TYPE[typeId]), type: CHORD_TYPE[typeId] }), [pc, typeId])
  const invCount = Math.min(type.ivs.length, 4)
  const inv = Math.min(inversion, invCount - 1)
  const symbol = chordSymbol(chord)

  const rh = useMemo(() => rhVoicing(chord, inv), [chord, inv])
  const lh = useMemo(() => (hands === 'both' ? lhVoicing(chord) : []), [chord, hands])
  const rhNotes = useMemo(() => spellVoicing(chord, rh), [chord, rh])
  const lhNotes = useMemo(() => spellVoicing(chord, lh), [chord, lh])
  const formula = useMemo(() => chordFormula(chord), [chord])
  const guitar = GUITAR_SHAPES[symbol]
  const bassName = pitchName(rhNotes[0])
  // With the left hand on the root, a right-hand inversion is still the plain chord.
  const shown = inv > 0 && hands === 'rh' ? `${symbol}/${bassName}` : symbol

  const fingers: Record<number, number> = {}
  rhFingers(rh, typeId, inv).forEach((f, i) => (fingers[rh[i]] = f))
  lhFingers(lh).forEach((f, i) => (fingers[lh[i]] = f))

  const from = build ? 48 : hands === 'both' ? 36 : 60
  const to = Math.max(84, rh[rh.length - 1] ?? 84)

  const marks: Record<number, KeyMark> = {}
  if (build) {
    for (const m of picked) marks[m] = { kind: 'selected', label: pitchName(fromMidi(m)) }
  } else {
    lh.forEach((m, i) => (marks[m] = { kind: pcOf(lhNotes[i]) === pc ? 'root' : 'chord', label: pitchName(lhNotes[i]) }))
    rh.forEach((m, i) => (marks[m] = { kind: pcOf(rhNotes[i]) === pc ? 'root' : 'chord', label: pitchName(rhNotes[i]) }))
  }

  const staffItems: StaffItem[] = useMemo(
    () => [{ key: `${shown}-${inv}-${hands}`, notes: [...lhNotes, ...rhNotes], dur: 'w', chord: shown }],
    [shown, inv, hands, lhNotes, rhNotes],
  )

  const playBlock = () => {
    setPulse((p) => p + 1)
    playNotes([...lh, ...rh], { dur: 2, strum: 0.02 })
  }
  const playArp = () => {
    setPulse((p) => p + 1)
    playSequence([...lh, ...rh, [...lh, ...rh]], { gap: 0.2, dur: 1.6 })
  }

  /** Change root/type/inversion, leave build mode and play the result. */
  const choose = (next: Choice) => {
    const nPc = next.pc ?? pc
    const nType = CHORD_TYPE[next.typeId ?? typeId]
    const nInv = Math.min(next.inversion ?? inversion, Math.min(nType.ivs.length, 4) - 1)
    setPc(nPc)
    setTypeId(nType.id)
    setInversion(nInv)
    setBuild(false)
    setPicked([])
    const c = { root: spellRoot(nPc, nType), type: nType }
    const l = hands === 'both' ? lhVoicing(c) : []
    setPulse((p) => p + 1)
    playNotes([...l, ...rhVoicing(c, nInv)], { dur: 1.6, strum: 0.02 })
  }

  const live = <LiveName picked={build ? picked : []} building={build} onExplore={choose} onClear={() => setPicked([])} />

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Chord Explorer" subtitle="Build, hear and name any chord" />
      <main className="mx-auto grid max-w-[1500px] gap-5 px-3 pt-5 sm:px-5 lg:grid-cols-[minmax(320px,410px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Root note</h2>
            <OctavePicker
              value={pc}
              onChange={(v) => choose({ pc: v })}
              sound={false}
              label="Root note"
              names={(p) => {
                const n = PC_NAMES[p]
                if (!n.black) return { main: n.sharp }
                const chosen = pitchName(spellRoot(p, type))
                return { main: chosen, alt: chosen === n.sharp ? n.flat : n.sharp }
              }}
            />
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Chord type</h2>
            <div className="space-y-4">
              {CHORD_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-mute/80">{g.title}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.ids.map((id) => {
                      const t = CHORD_TYPE[id]
                      const on = id === typeId
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => choose({ typeId: id })}
                          title={t.name}
                          aria-pressed={on}
                          className={`min-h-11 rounded-2xl border px-3.5 font-display text-lg font-bold transition-colors ${
                            on ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
                          }`}
                        >
                          <MusicText text={pitchName(spellRoot(pc, t)) + t.suffix} />
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Inversion</h2>
              <Segmented
                value={inv}
                onChange={(v) => choose({ inversion: v })}
                options={Array.from({ length: invCount }, (_, i) => ({ value: i, label: INV_LABELS[i] }))}
                className="w-full"
              />
              <p className="mt-2 text-sm text-ink-mute">
                {INVERSION_NAMES[inv]}
                {inv > 0 && hands === 'rh' && (
                  <>
                    : <MusicText text={bassName} /> is the lowest note, written <MusicText text={shown} className="font-bold text-ink-soft" />.
                  </>
                )}
                {inv > 0 && hands === 'both' && (
                  <>
                    : <MusicText text={bassName} /> is at the bottom of your right hand. With <MusicText text={pitchName(chord.root)} /> in the left hand
                    it's still plain <MusicText text={symbol} className="font-bold text-ink-soft" />.
                  </>
                )}
              </p>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Hands</h2>
              <Segmented
                value={hands}
                onChange={setHands}
                options={[
                  { value: 'rh', label: 'Right hand' },
                  { value: 'both', label: 'Both hands' },
                ]}
                className="w-full"
              />
              {hands === 'both' && <p className="mt-2 text-sm text-ink-mute">Left hand plays the chord in root position; the right hand plays your inversion.</p>}
            </div>
          </Card>
        </section>

        <section className="flex min-w-0 flex-col gap-5">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: noteColor(pc) }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <motion.div
                  key={`${shown}-${pulse}`}
                  initial={{ scale: 0.92, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                  className="origin-left font-display text-7xl font-bold leading-none tracking-tight sm:text-8xl"
                >
                  <MusicText text={shown} />
                </motion.div>
                <div className="mt-2 text-xl font-extrabold text-ink-soft">
                  <MusicText text={chordLongName(chord)} />
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1 text-sm font-bold text-ink-mute">
                  <Sparkles size={15} /> {type.mood}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={Play} onClick={playBlock}>
                  Play
                </Button>
                <Button variant="secondary" icon={Waves} onClick={playArp}>
                  Arpeggio
                </Button>
              </div>
            </div>

            <div className="relative mt-6">
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">How it's built</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {formula.map((f, i) => {
                  const c = noteColor(pcOf(f.note))
                  return (
                    <div key={`${symbol}-${i}`} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <div className="flex flex-col items-center px-0.5 text-center" title={f.gapName}>
                          <span className="text-xs font-extrabold text-ink-mute">+{f.gap}</span>
                          <span className="text-ink-mute">→</span>
                        </div>
                      )}
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex min-w-[4.25rem] flex-col items-center rounded-2xl border px-3 py-2"
                        style={{ borderColor: `${c}66`, background: `${c}18` }}
                      >
                        <span className="text-sm font-extrabold text-ink-mute">
                          <MusicText text={f.degree} />
                        </span>
                        <span className="font-display text-2xl font-bold" style={{ color: c }}>
                          <MusicText text={pitchName(f.note)} />
                        </span>
                        <span className="text-[0.7rem] font-bold text-ink-mute">{f.fromRoot}</span>
                      </motion.div>
                    </div>
                  )
                })}
              </div>
              {formula.length > 1 && (
                <p className="mt-3 text-base text-ink-soft">
                  Start on the root, then stack{' '}
                  {formula.slice(1).map((f, i) => (
                    <span key={i}>
                      {i > 0 && ' + '}
                      <b className="text-ink">{f.gapName.toLowerCase()}</b> ({f.gap} half steps)
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
          </Card>

          <Card className="pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink-mute">
                <Hand size={18} /> {build ? 'Tap keys to add or remove them' : 'Numbers on the keys are finger numbers (1 = thumb)'}
              </div>
              <label className="flex items-center gap-3 text-sm font-extrabold text-ink-soft">
                Tap to build a chord
                <Toggle
                  checked={build}
                  onChange={(v) => {
                    setBuild(v)
                    setPicked([])
                  }}
                  label="Tap keys to build a chord"
                />
              </label>
            </div>
            <Piano
              from={from}
              to={to}
              marks={marks}
              fingers={build ? {} : fingers}
              labels="marked"
              mode={build ? 'toggle' : 'play'}
              onToggle={(m) => setPicked((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m].sort((a, b) => a - b)))}
              sparks
              sparkHeight={90}
              height={from < 60 ? 170 : 200}
              octaveLabels
            />
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Paper className="flex items-center">
              <Staff clef={hands === 'both' ? 'grand' : 'treble'} items={staffItems} sp={18} labels reserveAbove={3} reserveBelow={3} />
            </Paper>
            {guitar ? (
              <Card className="flex items-center gap-5">
                <GuitarDiagram shape={guitar} size={128} />
                <div>
                  <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-teal">
                    <Guitar size={18} /> On guitar
                  </div>
                  <p className="mt-1 text-ink-soft">
                    Same chord as your{' '}
                    <b className="text-ink">
                      {guitar.barre ? 'barre' : 'open'} <MusicText text={symbol} />
                    </b>{' '}
                    shape. Same notes; the piano just lays them out in a line.
                  </p>
                </div>
              </Card>
            ) : (
              live
            )}
          </div>
          {guitar && live}
        </section>
      </main>
    </div>
  )
}

/** Names whatever you're holding (on your keyboard, or tapped in build mode). */
function LiveName({
  picked,
  building,
  onExplore,
  onClear,
}: {
  picked: number[]
  building: boolean
  onExplore: (d: Choice) => void
  onClear: () => void
}) {
  const held = useLive((s) => s.held)
  const notes = useMemo(() => [...new Set([...heldMidis(held), ...picked])].sort((a, b) => a - b), [held, picked])
  const det = notes.length >= 2 ? detectChord(notes) : null
  let body: ReactNode
  if (notes.length === 0) {
    body = (
      <p className="text-ink-mute">
        Hold some keys on your keyboard (or switch on <b className="text-ink-soft">Tap to build a chord</b>) and I'll name the chord.
      </p>
    )
  } else if (det) {
    body = (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-5xl font-bold leading-none">
            <MusicText text={det.symbol} />
          </div>
          <div className="mt-1 font-bold text-ink-soft">
            <MusicText text={det.name} />
            {det.inversion > 0 && <span className="text-ink-mute"> · {INVERSION_NAMES[det.inversion]}</span>}
            {det.no5 && <span className="text-ink-mute"> · no 5th</span>}
          </div>
        </div>
        <Button
          variant="violet"
          size="md"
          icon={Music}
          onClick={() => onExplore({ pc: pcOf(det.chord.root), typeId: det.chord.type.id, inversion: Math.max(0, det.inversion) })}
        >
          Explore it
        </Button>
      </div>
    )
  } else if (notes.length === 1) {
    body = (
      <div className="font-display text-5xl font-bold">
        <MusicText text={noteName(fromMidi(notes[0]))} />
      </div>
    )
  } else if (notes.length === 2) {
    body = (
      <div>
        <div className="font-display text-3xl font-bold">{intervalBetween(fromMidi(notes[0]), fromMidi(notes[1])).name}</div>
        <div className="mt-1 text-ink-mute">
          <MusicText text={notes.map((m) => pitchName(fromMidi(m))).join(' + ')} />. Add one more note to make a chord.
        </div>
      </div>
    )
  } else {
    body = (
      <div>
        <div className="font-display text-3xl font-bold">
          <MusicText text={notes.map((m) => pitchName(fromMidi(m))).join(' · ')} />
        </div>
        <div className="mt-1 text-ink-mute">Not a chord I have a name for. Try moving one note a half step.</div>
      </div>
    )
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">What am I playing?</h3>
        {building && picked.length > 0 && (
          <Button variant="ghost" size="sm" icon={Eraser} onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={det?.symbol ?? notes.join()}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}
