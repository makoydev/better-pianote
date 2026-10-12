import { Compass, Eraser, Hand, Music, Play, Waves } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Card, Paper } from '../../components/ui/Card'
import { Segmented, Toggle } from '../../components/ui/controls'
import { useHandsFree } from '../../hooks/useHandsFree'
import { useViewportHeight } from '../../hooks/useViewport'
import { playNotes, playSequence } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import {
  CHORD_TYPE,
  CHORD_TYPES,
  type Chord,
  INVERSION_NAMES,
  chordLongName,
  chordSymbol,
  detectChord,
  fromMidi,
  intervalBetween,
  keyName,
  keysWithChord,
  noteName,
  pcOf,
  pitchName,
  spellRoot,
} from '../../lib/theory'
import { heldMidis, useLive } from '../../state/live'
import { usePref } from '../../state/prefs'
import { CHORD_GROUPS, PC_NAMES, chordFormula, lhFingers, lhVoicing, rhFingers, rhVoicing, spellVoicing } from './chordTools'
import { GuitarCard } from './GuitarCard'
import { openCircle } from './links'
import { OctavePicker } from './OctavePicker'
import { useMicChords } from '../../lib/input/mic'

const INV_LABELS = ['Root', '1st', '2nd', '3rd']
const ROOTS = PC_NAMES.map((n) => n.pc)
const TYPE_IDS = CHORD_TYPES.map((t) => t.id)
const INVERSIONS = INV_LABELS.map((_, i) => i)
/** Short tab names for the chord groups, so the four fit side by side. */
const GROUP_TABS: Record<string, string> = { Triads: 'Triads', 'Sus & power': 'Sus', Sevenths: '7ths', Colour: 'Colour' }
const groupOf = (typeId: string) => CHORD_GROUPS.find((g) => g.ids.includes(typeId))?.title ?? CHORD_GROUPS[0].title

type Choice = { pc?: number; typeId?: string; inversion?: number }

export function ChordExplorer() {
  const [pc, setPc] = usePref('chord:root', 0, ROOTS)
  const [typeId, setTypeId] = usePref('chord:type', 'maj', TYPE_IDS)
  const [inversion, setInversion] = usePref('chord:inversion', 0, INVERSIONS)
  const [hands, setHands] = usePref<'rh' | 'both'>('chord:hands', 'rh', ['rh', 'both'])
  const [build, setBuild] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [pulse, setPulse] = useState(0)
  // The type tab you opened; otherwise the tab of the chord on show.
  const [tab, setTab] = useState<string | null>(null)
  // Short windows (a 13" laptop, an iPad on its side) get a lower keyboard, so chord, staff and keys fit together.
  const short = useViewportHeight() < 900

  const type = CHORD_TYPE[typeId]
  const chord: Chord = useMemo(() => ({ root: spellRoot(pc, CHORD_TYPE[typeId]), type: CHORD_TYPE[typeId] }), [pc, typeId])
  const invCount = Math.min(type.ivs.length, 4)
  const inv = Math.min(inversion, invCount - 1)
  const symbol = chordSymbol(chord)
  const group = tab ?? groupOf(typeId)

  const rh = useMemo(() => rhVoicing(chord, inv), [chord, inv])
  const lh = useMemo(() => (hands === 'both' ? lhVoicing(chord) : []), [chord, hands])
  const rhNotes = useMemo(() => spellVoicing(chord, rh), [chord, rh])
  const lhNotes = useMemo(() => spellVoicing(chord, lh), [chord, lh])
  const formula = useMemo(() => chordFormula(chord), [chord])
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

  // Hands-free: Enter, a tap of the pedal or the top C play the chord, and so does Space (left to a focused button).
  useHandsFree(playBlock)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isPlainKey(e) || isTypingTarget(e.target) || isButtonTarget(e.target)) return
      e.preventDefault()
      playBlock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
    setTab(null)
    const c = { root: spellRoot(nPc, nType), type: nType }
    const l = hands === 'both' ? lhVoicing(c) : []
    setPulse((p) => p + 1)
    playNotes([...l, ...rhVoicing(c, nInv)], { dur: 1.6, strum: 0.02 })
  }

  const groupIds = CHORD_GROUPS.find((g) => g.title === group)?.ids ?? []

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Chord Explorer" subtitle="Build, hear and name any chord · Space plays it" />
      <main className="mx-auto grid max-w-[1500px] gap-4 px-3 pt-4 sm:px-5 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        {/* The pickers, in one card so they fit beside the chord on a laptop screen. */}
        <Card className="flex flex-col gap-3 self-start">
          <div>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Root note</h2>
            <OctavePicker
              value={pc}
              onChange={(v) => choose({ pc: v })}
              sound={false}
              label="Root note"
              height={short ? 76 : 96}
              names={(p) => {
                const n = PC_NAMES[p]
                if (!n.black) return { main: n.sharp }
                const chosen = pitchName(spellRoot(p, type))
                return { main: chosen, alt: chosen === n.sharp ? n.flat : n.sharp }
              }}
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Chord type</h2>
            <div role="tablist" aria-label="Chord groups" className="flex rounded-2xl border border-white/8 bg-night-850 p-1">
              {CHORD_GROUPS.map((g) => (
                <button
                  key={g.title}
                  type="button"
                  role="tab"
                  aria-selected={g.title === group}
                  title={g.title}
                  onClick={() => setTab(g.title)}
                  className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-extrabold transition-colors ${
                    g.title === group ? 'bg-night-600 text-ink' : 'text-ink-mute hover:text-ink'
                  } ${g.ids.includes(typeId) ? 'underline decoration-gold decoration-2 underline-offset-4' : ''}`}
                >
                  {GROUP_TABS[g.title] ?? g.title}
                </button>
              ))}
            </div>
            {/* Room for three rows, so switching tabs doesn't make the page jump. */}
            <div className="mt-2 flex min-h-[9rem] flex-wrap content-start gap-1.5">
              {groupIds.map((id) => {
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
                    className={`min-h-11 rounded-2xl border px-3 font-display text-base font-bold transition-colors ${
                      on ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
                    }`}
                  >
                    <MusicText text={pitchName(spellRoot(pc, t)) + t.suffix} />
                  </motion.button>
                )
              })}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Inversion</h2>
            <Segmented
              value={inv}
              onChange={(v) => choose({ inversion: v })}
              options={Array.from({ length: invCount }, (_, i) => ({ value: i, label: INV_LABELS[i] }))}
              size="sm"
              className="w-full"
            />
            {inv > 0 && (
              <p className="mt-1.5 text-sm text-ink-mute">
                {hands === 'rh' ? (
                  <>
                    {INVERSION_NAMES[inv]}: <MusicText text={bassName} /> at the bottom, written <MusicText text={shown} className="font-bold text-ink-soft" />.
                  </>
                ) : (
                  <>
                    With <MusicText text={pitchName(chord.root)} /> in the left hand it's still <MusicText text={symbol} className="font-bold text-ink-soft" />.
                  </>
                )}
              </p>
            )}
          </div>
          <Segmented
            value={hands}
            onChange={setHands}
            options={[
              { value: 'rh', label: 'Right hand' },
              { value: 'both', label: 'Both hands' },
            ]}
            size="sm"
            className="w-full"
          />
        </Card>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
            <Card className="relative overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: noteColor(pc) }} />
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <motion.div
                    key={`${shown}-${pulse}`}
                    initial={{ scale: 0.92, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                    className="origin-left font-display text-6xl font-bold leading-none tracking-tight [@media(min-height:900px)]:text-7xl"
                  >
                    <MusicText text={shown} />
                  </motion.div>
                  <div className="mt-2 text-lg font-extrabold text-ink-soft">
                    <MusicText text={chordLongName(chord)} />
                    <span className="font-bold text-ink-mute"> · {type.mood}</span>
                  </div>
                </div>
                {/* Icons only until there's room, so they stay beside the name. */}
                <div className="flex gap-2">
                  <Button size="md" icon={Play} onClick={playBlock} aria-label="Play the chord" title="Play the chord (Space)">
                    <span className="hidden xl:inline">Play</span>
                  </Button>
                  <Button size="md" variant="secondary" icon={Waves} onClick={playArp} aria-label="Play it as an arpeggio" title="Play it as an arpeggio">
                    <span className="hidden xl:inline">Arpeggio</span>
                  </Button>
                </div>
              </div>

              <div role="group" className="relative mt-4 flex flex-wrap items-center gap-1" aria-label="How it's built">
                {formula.map((f, i) => {
                  const c = noteColor(pcOf(f.note))
                  return (
                    <div key={`${symbol}-${i}`} className="flex items-center gap-1">
                      {i > 0 && (
                        <div className="flex flex-col items-center text-center" title={f.gapName}>
                          <span className="text-xs font-extrabold text-ink-mute">+{f.gap}</span>
                          <span className="text-xs leading-none text-ink-mute">→</span>
                        </div>
                      )}
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex min-w-[3.4rem] flex-col items-center rounded-2xl border px-2 py-1"
                        title={f.fromRoot}
                        style={{ borderColor: `${c}66`, background: `${c}18` }}
                      >
                        <span className="text-xs font-extrabold text-ink-mute">
                          <MusicText text={f.degree} />
                        </span>
                        <span className="font-display text-xl font-bold leading-tight" style={{ color: c }}>
                          <MusicText text={pitchName(f.note)} />
                        </span>
                      </motion.div>
                    </div>
                  )
                })}
              </div>
              {/* Spelled out in words, except where the column is narrow (an iPad on its side), to keep the keyboard in view. */}
              {formula.length > 1 && (
                <p className="relative mt-2 text-sm text-ink-mute lg:max-xl:hidden">
                  From the root, stack{' '}
                  {formula.slice(1).map((f, i) => (
                    <span key={i}>
                      {i > 0 && ' + '}
                      <b className="text-ink-soft">{f.gapName.toLowerCase()}</b>
                    </span>
                  ))}
                  .
                </p>
              )}
            </Card>
            <Paper className="flex items-center">
              {/* Both hands' note names stack above and below a grand staff, so it's drawn smaller on short screens. */}
              <Staff
                clef={hands === 'both' ? 'grand' : 'treble'}
                items={staffItems}
                sp={hands === 'both' && short ? 12 : 16}
                reserveAbove={hands === 'both' ? 2.2 : 2.6}
                reserveBelow={hands === 'both' ? 2.2 : 2.6}
              />
            </Paper>
          </div>

          <Card className="pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
              // Names only on the chord's keys, spelled for the chord (G♯ in E, not A♭): the content here, not reading help.
              labels="marked"
              mode={build ? 'toggle' : 'play'}
              onToggle={(m) => setPicked((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m].sort((a, b) => a - b)))}
              sparks
              sparkHeight={90}
              height={short ? (from < 60 ? 150 : 165) : from < 60 ? 170 : 200}
              octaveLabels
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <GuitarCard chord={chord} />
            <KeysWithChord chord={chord} />
            <LiveName picked={build ? picked : []} building={build} onExplore={choose} onClear={() => setPicked([])} />
          </div>
        </section>
      </main>
    </div>
  )
}

/** The keys this chord belongs to, with its numeral in each; tap one to see it on the circle of fifths. */
function KeysWithChord({ chord }: { chord: Chord }) {
  const keys = useMemo(() => keysWithChord(chord), [chord])
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
        <Compass size={18} /> Keys with this chord
      </h3>
      {keys.length ? (
        <div className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <motion.button
              key={keyName(k.key)}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => openCircle(k.key)}
              aria-label={`${k.roman} in ${keyName(k.key)}: open it on the circle of fifths`}
              className="flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-night-750 px-3 py-1 transition-colors hover:border-gold/50"
            >
              <span className="font-display text-lg font-bold leading-tight text-gold">
                <MusicText text={k.roman} />
              </span>
              <span className="text-xs font-bold text-ink-soft">
                in <MusicText text={keyName(k.key)} />
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <p className="text-ink-mute">
          No key on the circle has all of its notes, spelled like this. Chords like this one come from harmonic minor (the minor scale with a raised 7th).
        </p>
      )}
    </Card>
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
  // Through the mic, listen for whole chords while naming what you play.
  useMicChords()
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
