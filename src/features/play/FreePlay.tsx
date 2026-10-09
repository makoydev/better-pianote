import { Eraser, Footprints, Layers, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import { Paper } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { useElementSize } from '../../hooks/useElementSize'
import { playChord } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { recentNotes } from '../../lib/input/bus'
import {
  ALL_MAJOR_KEYS,
  ALL_MINOR_KEYS,
  CHORD_TYPES,
  type Chord,
  INVERSION_NAMES,
  type Key,
  chordSymbol,
  chordToRoman,
  detectChord,
  guessKey,
  intervalBetween,
  keyFifths,
  keyId,
  keyName,
  noteName,
  parseKey,
  spellInKey,
} from '../../lib/theory'
import { heldMidis, useLive } from '../../state/live'
import { useProgress } from '../../state/progress'

interface HistoryItem {
  id: number
  chord: Chord
  symbol: string
}

const KEY_OPTIONS = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]

export function FreePlay() {
  const held = useLive((s) => s.held)
  const sustain = useLive((s) => s.sustain)
  const mic = useLive((s) => s.mic)
  const found = useProgress((s) => s.chordsFound)
  const [keyChoice, setKeyChoice] = useState('auto')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [discovered, setDiscovered] = useState<string | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const [area, { height: areaH, width: areaW }] = useElementSize<HTMLDivElement>()
  const nextId = useRef(1)

  // With the mic only one note is heard at a time, so chords are notes played close together.
  const midis = useMemo(() => {
    const h = heldMidis(held)
    return mic === 'on' ? [...new Set([...h, ...recentNotes(1400)])].sort((a, b) => a - b) : h
  }, [held, mic])

  const guessed = useMemo(() => guessKey(history.slice(-8).map((h) => h.chord)), [history])
  const key: Key | null = keyChoice === 'none' ? null : keyChoice === 'auto' ? guessed : parseKey(keyChoice)
  const prefer = key ? (keyFifths(key) < 0 ? 'flat' : keyFifths(key) > 0 ? 'sharp' : undefined) : undefined
  const det = midis.length >= 2 ? detectChord(midis, prefer) : null

  // Once a chord has been held steadily for a moment, add it to the history (and the collection).
  const stableSymbol = det && det.chord.type.ivs.length >= 3 ? det.symbol : null
  const commitChord = useEffectEvent(() => {
    if (!det || !stableSymbol) return
    setHistory((h) => (h[h.length - 1]?.symbol === stableSymbol ? h : [...h.slice(-23), { id: nextId.current++, chord: det.chord, symbol: stableSymbol }]))
    const base = chordSymbol({ ...det.chord, bass: undefined })
    const p = useProgress.getState()
    if (p.findChord(base)) {
      p.addXp(5)
      setDiscovered(base)
      window.setTimeout(() => setDiscovered((d) => (d === base ? null : d)), 2600)
    }
  })
  useEffect(() => {
    if (!stableSymbol) return
    const id = window.setTimeout(commitChord, 260)
    return () => window.clearTimeout(id)
  }, [stableSymbol])

  const spelled = det ? det.notes : midis.map((m) => spellInKey(m, key))
  const staffItems: StaffItem[] = spelled.length ? [{ key: 'now', notes: spelled.map((n) => noteName(n)), dur: 'w' }] : [{ key: 'empty', dur: 'w', hidden: true }]

  let headline = ''
  let sub = ''
  if (det) {
    headline = det.symbol
    sub = `${det.name}${det.inversion > 0 ? ` · ${INVERSION_NAMES[det.inversion]}` : ''}${det.no5 ? ' · no 5th' : ''}`
  } else if (spelled.length === 1) {
    headline = noteName(spelled[0])
    sub = 'Add more notes to make a chord'
  } else if (spelled.length === 2) {
    headline = spelled.map((n) => noteName(n, { octave: false })).join(' + ')
    sub = intervalBetween(spelled[0], spelled[1]).name
  } else if (spelled.length > 2) {
    headline = spelled.map((n) => noteName(n, { octave: false })).join(' ')
    sub = 'Not a standard chord name. Try moving one note.'
  }
  const roman = det && key ? chordToRoman(det.chord, key) : null
  const pianoH = Math.round(Math.max(120, Math.min(200, areaH - 40)))

  return (
    <div className="flex h-dvh flex-col">
      <TopBar back="/" title="Free Play" subtitle="Play anything. See what it is.">
        <select
          value={keyChoice}
          onChange={(e) => setKeyChoice(e.target.value)}
          aria-label="Key"
          className="hidden h-11 rounded-full border border-white/10 bg-night-750 px-4 text-sm font-extrabold text-ink-soft sm:block"
        >
          <option value="auto">Key: auto-detect</option>
          <option value="none">Key: none</option>
          {KEY_OPTIONS.map((k) => (
            <option key={keyId(k)} value={keyId(k)}>
              {keyName(k)}
            </option>
          ))}
        </select>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 pt-4 sm:px-6">
        <div className="grid shrink-0 gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* What you're playing */}
          <div className="glass relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-5 pb-10 text-center">
            <AnimatePresence mode="popLayout">
              {headline ? (
                <motion.div key={headline} initial={{ scale: 0.85, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                  <div
                    className="font-display text-6xl font-bold leading-none sm:text-7xl [@media(min-height:820px)]:sm:text-8xl"
                    style={{ color: det ? '#f7f3ea' : spelled[0] ? noteColor(midis[0]) : undefined, textShadow: det ? '0 0 40px rgba(255,200,87,.35)' : undefined }}
                  >
                    <MusicText text={headline} />
                  </div>
                  <div className="mt-3 text-xl font-bold text-ink-soft first-letter:uppercase">
                    <MusicText text={sub} />
                  </div>
                  {roman && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet/15 px-4 py-1.5 font-display text-2xl font-bold text-[#c9c0ff]">
                      <MusicText text={roman} />
                      <span className="font-sans text-sm font-bold text-ink-mute">
                        in <MusicText text={keyName(key!)} />
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md">
                  <Sparkles className="mx-auto mb-3 text-gold" size={40} />
                  <div className="font-display text-4xl font-bold">Play anything</div>
                  <p className="mt-2 text-lg text-ink-soft">
                    A chord you know, a song you play by ear, a random cluster. This shows its name and how it’s written, live.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {discovered && (
                <motion.div
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-linear-to-r from-gold to-coral px-4 py-2 text-sm font-extrabold text-night-900 shadow-lg"
                >
                  <Wand2 size={18} /> New chord discovered: <MusicText text={discovered} /> · +5 XP
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-4 right-5 flex items-center gap-2 text-sm font-bold">
              <span className={`rounded-full px-3 py-1 transition-colors ${sustain ? 'bg-teal/20 text-teal' : 'bg-white/5 text-ink-mute'}`}>Pedal {sustain ? 'down' : 'up'}</span>
            </div>
          </div>

          {/* On the staff */}
          <Paper className="flex items-center">
            <Staff clef="grand" items={staffItems} sp={16} minSlot={6} reserveAbove={2.6} reserveBelow={2.6} animate={false} labels={spelled.length > 0} />
          </Paper>
        </div>

        {/* Progression history */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="shrink-0 text-sm font-extrabold uppercase tracking-widest text-ink-mute">You played</span>
            {history.length === 0 && <span className="text-sm text-ink-mute">Chords you hold will line up here, like a chord chart.</span>}
            <AnimatePresence initial={false}>
              {history.map((h) => (
                <motion.button
                  key={h.id}
                  layout
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  type="button"
                  onClick={() => playChord(h.chord)}
                  className="flex shrink-0 flex-col items-center rounded-xl border border-white/10 bg-night-750 px-3 py-1.5 hover:border-gold/50"
                >
                  <span className="font-display text-xl font-bold leading-tight">
                    <MusicText text={h.symbol} />
                  </span>
                  {key && (
                    <span className="text-xs font-bold text-[#c9c0ff]">
                      <MusicText text={chordToRoman(h.chord, key)} />
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          {keyChoice === 'auto' && guessed && (
            <span className="hidden shrink-0 gap-1 rounded-full bg-violet/15 px-3 py-1.5 text-sm font-extrabold text-[#c9c0ff] md:inline-flex">
              Sounds like <MusicText text={keyName(guessed)} />
            </span>
          )}
          {history.length > 0 && (
            <button type="button" onClick={() => setHistory([])} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-ink-mute hover:bg-white/5 hover:text-ink">
              <Eraser size={16} /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCollection(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-sm font-extrabold text-ink-soft hover:bg-white/10"
          >
            <Layers size={16} /> {found.length} found
          </button>
        </div>

        {/* The keyboard: all 61 keys, like your CT-S1 */}
        <div ref={area} className="flex min-h-[200px] flex-1 flex-col justify-end">
          {/* All 61 keys like the CT-S1 on wide screens; two octaves around middle C on phones. */}
          <Piano
            from={areaW && areaW < 640 ? 48 : 36}
            to={areaW && areaW < 640 ? 72 : 96}
            labels="c"
            trails
            trailHeight={Math.max(60, areaH - pianoH - 30)}
            height={pianoH}
            minKeyWidth={20}
          />
        </div>
      </div>

      <Collection open={showCollection} onClose={() => setShowCollection(false)} found={found} />
    </div>
  )
}

function Collection({ open, onClose, found }: { open: boolean; onClose: () => void; found: string[] }) {
  // Group what you've found by chord type, using the symbol suffix.
  const groups = CHORD_TYPES.map((t) => ({
    type: t,
    chords: found.filter((s) => {
      const suffix = s.replace(/^[A-G](♯|♭)?/, '')
      return suffix === t.suffix
    }),
  })).filter((g) => g.chords.length)
  return (
    <Modal open={open} onClose={onClose} title={`Your chord collection (${found.length})`} wide>
      {found.length === 0 ? (
        <p className="text-ink-soft">Every new chord you play in Free Play gets added here. Hold three or more notes to discover your first one!</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.type.id}>
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-ink-mute">
                <Footprints size={14} /> {g.type.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.chords.map((c) => (
                  <span key={c} className="rounded-xl border border-white/10 bg-night-750 px-3 py-1.5 font-display text-lg font-bold">
                    <MusicText text={c} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
