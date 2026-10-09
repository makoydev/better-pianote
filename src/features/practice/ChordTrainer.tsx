import { Check, Eraser, Layers, Lightbulb, SkipForward, Volume2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Staff } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { playNotes } from '../../lib/audio/play'
import { burst } from '../../lib/fx'
import { type NoteEvent, heldNow, useNoteEvents } from '../../lib/input/bus'
import { type Chord, fromMidi, midiOf, mod, noteName, pcOf, pitchName, voicedChord } from '../../lib/theory'
import { useLive } from '../../state/live'
import { TRAINER_LEVELS, chordLabel, chordRecipe, inversionIndex, matchChord, pickRound } from './logic/chords'
import { FeedbackLine, GameMain, Hud, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor, store } from './shared/finish'

const ROUND = 10
const LEVEL_IDS = TRAINER_LEVELS.map((l) => l.id)

interface ChordResult {
  chord: Chord
  mistakes: number
  hinted: boolean
  skipped: boolean
  seconds: number
  points: number
}

const isClean = (r: ChordResult) => r.mistakes === 0 && !r.hinted && !r.skipped

export function ChordTrainer() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [levelId, setLevelId] = useState(() => remember('chord-trainer-level', 'white', LEVEL_IDS))
  const level = TRAINER_LEVELS.find((l) => l.id === levelId) ?? TRAINER_LEVELS[0]
  const [round, setRound] = useState<Chord[]>([])
  const [results, setResults] = useState<ChordResult[]>([])
  const [finish, setFinish] = useState<FinishResult | null>(null)

  const start = () => {
    store('chord-trainer-level', level.id)
    setRound(pickRound(level.pool(), ROUND))
    setResults([])
    setFinish(null)
    setPhase('play')
  }

  const score = results.reduce((s, r) => s + r.points, 0)
  let streak = 0
  for (let i = results.length - 1; i >= 0 && isClean(results[i]); i--) streak++

  const onDone = (r: ChordResult) => {
    const all = [...results, r]
    setResults(all)
    if (all.length >= ROUND) {
      const total = all.reduce((s, x) => s + x.points, 0)
      const stars = starsFor(all.filter(isClean).length / all.length)
      setFinish(finishGame('chord-trainer', level.id, total, stars))
      setPhase('done')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Chord Trainer" subtitle={phase === 'setup' ? 'See it, play it' : level.name} />
      {phase === 'setup' && (
        <GameMain>
          <SetupCard
            icon={Layers}
            from="#9b8cff"
            to="#ff8fc8"
            title="Chord Trainer"
            blurb={
              <>
                A chord symbol appears. Play it, in any octave, any order. On your keyboard, hold the notes together. On screen, tap each key.
                Fast and clean earns bonus points.
              </>
            }
            gameId="chord-trainer"
            levels={TRAINER_LEVELS}
            level={level.id}
            onLevel={setLevelId}
            onStart={start}
          />
        </GameMain>
      )}
      {phase === 'play' && round[results.length] && (
        <GameMain wide>
          <Hud step={results.length} total={ROUND} score={score} streak={streak} label="Chord" />
          <Challenge key={results.length} chord={round[results.length]} onDone={onDone} />
        </GameMain>
      )}
      {phase === 'done' && (
        <GameMain>
          <ResultsCard
            title={starsFor(results.filter(isClean).length / ROUND) === 3 ? 'Chord master!' : 'Round complete'}
            score={score}
            stars={starsFor(results.filter(isClean).length / ROUND)}
            result={finish}
            stats={[
              { label: 'Clean', value: `${results.filter(isClean).length}/${ROUND}` },
              { label: 'Avg time', value: `${(results.reduce((s, r) => s + r.seconds, 0) / ROUND).toFixed(1)}s` },
              { label: 'Hints', value: results.filter((r) => r.hinted).length },
            ]}
            onAgain={start}
            onSetup={() => setPhase('setup')}
          >
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {results.map((r, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1 rounded-xl px-3 py-1.5 font-display text-lg font-bold ${
                    isClean(r) ? 'bg-good/15 text-good' : 'bg-bad/12 text-bad'
                  }`}
                >
                  {isClean(r) ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                  <MusicText text={chordLabel(r.chord).symbol} />
                </span>
              ))}
            </div>
          </ResultsCard>
        </GameMain>
      )}
    </div>
  )
}

type Status = 'waiting' | 'partial' | 'wrong' | 'bass' | 'correct' | 'skipped'

/** One chord to play. Remounted for every chord, so its state starts fresh. */
function Challenge({ chord, onDone }: { chord: Chord; onDone: (r: ChordResult) => void }) {
  const label = chordLabel(chord)
  const mic = useLive((s) => s.mic)
  const [selected, setSelected] = useState<number[]>([])
  const [status, setStatus] = useState<Status>('waiting')
  const [progress, setProgress] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hinted, setHinted] = useState(false)
  const [flash, setFlash] = useState<Record<number, true>>({})
  const [feedbackId, setFeedbackId] = useState(0)
  const symbolRef = useRef<HTMLDivElement>(null)
  const startedAt = useRef(0)
  const finished = useRef(false)
  const lastMistake = useRef(0)
  // Keys still held from the previous chord don't count until they're released.
  const stale = useRef(new Set(heldNow()))
  const micNotes = useRef<{ midi: number; time: number }[]>([])
  const selectedRef = useRef<number[]>([])

  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  const voicing = useMemo(() => {
    const v = voicedChord(chord, 4, inversionIndex(chord))
    // Inverting pushes notes up; bring high voicings back down near middle C.
    return midiOf(v[0]) >= 74 ? v.map((n) => ({ ...n, oct: n.oct - 1 })) : v
  }, [chord])
  const voicingMidis = voicing.map(midiOf)
  const targetPcs = new Set(voicing.map(pcOf))
  const revealed = hinted || status === 'correct' || status === 'skipped'

  const complete = (skipped: boolean) => {
    if (finished.current) return
    finished.current = true
    const seconds = (performance.now() - startedAt.current) / 1000
    const points = skipped ? 0 : hinted ? 30 : Math.max(40, 100 - 20 * mistakes) + Math.round(Math.max(0, 10 - seconds) * 5)
    setTimeout(() => onDone({ chord, mistakes, hinted, skipped, seconds, points }), skipped ? 1800 : 1300)
  }

  const evaluate = (trigger: number | null, source: NoteEvent['source'] | 'toggle') => {
    if (finished.current) return
    let notes: number[]
    if (source === 'mic') {
      const now = performance.now()
      micNotes.current = micNotes.current.filter((n) => now - n.time < 2500)
      notes = micNotes.current.map((n) => n.midi)
    } else {
      notes = [...new Set([...heldNow().filter((m) => !stale.current.has(m)), ...selectedRef.current])]
    }
    const st = matchChord(notes, chord)
    setProgress(new Set(notes.map((m) => mod(m, 12)).filter((p) => targetPcs.has(p))).size)
    if (st === 'correct') {
      setStatus('correct')
      setFeedbackId((x) => x + 1)
      sfx('correct')
      burst(symbolRef.current, { count: 28 })
      complete(false)
      return
    }
    if (st === 'wrong' && trigger !== null && !targetPcs.has(mod(trigger, 12))) {
      const now = performance.now()
      if (now - lastMistake.current > 700) {
        setMistakes((x) => x + 1)
        sfx('wrong')
      }
      lastMistake.current = now
      setFlash((f) => ({ ...f, [trigger]: true }))
      setTimeout(() => setFlash((f) => {
        const next = { ...f }
        delete next[trigger]
        return next
      }), 650)
      if (source === 'mic') micNotes.current = []
    }
    setStatus(st === 'empty' ? 'waiting' : st)
    setFeedbackId((x) => x + 1)
  }

  useNoteEvents((e) => {
    if (e.source === 'screen') return
    if (e.type === 'off') {
      stale.current.delete(e.midi)
      return
    }
    if (e.source === 'mic') micNotes.current.push({ midi: e.midi, time: e.time })
    evaluate(e.midi, e.source)
  })

  const toggle = (m: number) => {
    if (finished.current) return
    const had = selectedRef.current.includes(m)
    const next = had ? selectedRef.current.filter((x) => x !== m) : [...selectedRef.current, m]
    selectedRef.current = next
    setSelected(next)
    evaluate(had ? null : m, 'toggle')
  }

  const clear = () => {
    selectedRef.current = []
    setSelected([])
    setStatus('waiting')
    setProgress(0)
  }

  const hint = () => {
    setHinted(true)
    sfx('tap')
    playNotes(voicingMidis, { dur: 1.6, strum: 0.04 })
  }

  const skip = () => {
    setHinted(true)
    setStatus('skipped')
    setFeedbackId((x) => x + 1)
    playNotes(voicingMidis, { dur: 1.6, strum: 0.04 })
    complete(true)
  }

  // Mark selected keys, wrong-key flashes, and the answer once it's revealed.
  const marks: Marks = {}
  if (revealed) for (const n of voicing) marks[midiOf(n)] = { kind: 'chord', label: pitchName(n) }
  const nameFor = (m: number) => {
    const tone = voicing.find((n) => pcOf(n) === mod(m, 12))
    return pitchName(tone ?? fromMidi(m))
  }
  for (const m of selected) marks[m] = status === 'correct' ? 'good' : { kind: 'selected', label: nameFor(m) }
  for (const m of Object.keys(flash).map(Number)) marks[m] = 'bad'

  const feedback = (() => {
    switch (status) {
      case 'correct':
        return { tone: 'good' as const, text: `Yes! ${label.symbol}: ${voicing.map((n) => pitchName(n)).join(' – ')}` }
      case 'skipped':
        return { tone: 'info' as const, text: `It's ${voicing.map((n) => pitchName(n)).join(' – ')}. You'll get it next time.` }
      case 'wrong':
        return { tone: 'bad' as const, text: `Not quite: there's a note that isn't in ${label.symbol}.` }
      case 'bass':
        return { tone: 'info' as const, text: `Right notes! Now put ${pitchName(chord.bass!)} at the bottom.` }
      case 'partial':
        return { tone: 'neutral' as const, text: `${progress} of ${targetPcs.size} notes… keep going` }
      default:
        return {
          tone: 'neutral' as const,
          text: mic === 'on' ? 'Mic on: play the notes one after another.' : 'Hold the notes together, or tap them on screen.',
        }
    }
  })()

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={status === 'wrong' ? { opacity: 1, x: [0, -10, 10, -6, 6, 0] } : { opacity: 1, x: 0 }}
          transition={{ duration: status === 'wrong' ? 0.4 : 0.3 }}
          className={`glass relative flex flex-col items-center overflow-hidden rounded-3xl px-5 pb-5 pt-6 text-center transition-colors ${
            status === 'correct' ? 'border-good/50 bg-good/8' : ''
          }`}
        >
          <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-ink-mute">Play this chord</span>
          <div ref={symbolRef} className="relative mt-1">
            <motion.div
              key={label.symbol}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: status === 'correct' ? [1, 1.15, 1] : 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className={`font-display text-7xl font-bold leading-none sm:text-8xl ${status === 'correct' ? 'text-good' : 'text-ink'}`}
            >
              <MusicText text={label.symbol} />
            </motion.div>
            <AnimatePresence>
              {status === 'correct' && (
                <motion.span
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute -right-10 -top-2 flex size-9 items-center justify-center rounded-full bg-good text-night-900"
                >
                  <Check size={22} strokeWidth={3.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 text-lg font-bold text-ink-soft">
            <MusicText text={label.name} />
          </div>
          {chord.bass && (
            <div className="mt-2 rounded-full bg-gold/12 px-3 py-1 text-sm font-extrabold text-gold">
              <MusicText text={`${pitchName(chord.bass)} must be the lowest note`} />
            </div>
          )}
          <FeedbackLine tone={feedback.tone} id={`${status}-${feedbackId}`}>
            <MusicText text={feedback.text} />
          </FeedbackLine>
          {hinted && (
            <div className="mb-2 text-base font-bold text-gold">
              <Lightbulb size={16} className="mr-1 inline" /> {chordRecipe(chord.type)}
            </div>
          )}
          <div className="mt-auto flex flex-wrap justify-center gap-2 pt-2">
            {!revealed && (
              <Button variant="secondary" size="md" icon={Lightbulb} onClick={hint}>
                Hint
              </Button>
            )}
            {revealed && (
              <Button variant="secondary" size="md" icon={Volume2} onClick={() => playNotes(voicingMidis, { dur: 1.6, strum: 0.04 })}>
                Hear it
              </Button>
            )}
            {selected.length > 0 && status !== 'correct' && (
              <Button variant="ghost" size="md" icon={Eraser} onClick={clear}>
                Clear
              </Button>
            )}
            {status !== 'correct' && status !== 'skipped' && (
              <Button variant="ghost" size="md" icon={SkipForward} onClick={skip}>
                Skip
              </Button>
            )}
          </div>
          {!hinted && status !== 'correct' && status !== 'skipped' && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/5" title="Speed bonus">
              <motion.div
                className="h-full bg-linear-to-r from-gold to-coral"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 10, ease: 'linear' }}
              />
            </div>
          )}
        </motion.div>
        <Paper className="flex min-h-[15rem] flex-col justify-center">
          {revealed ? (
            <Staff
              clef="treble"
              items={[{ key: label.symbol, notes: voicing.map((n) => noteName(n, { ascii: true })), dur: 'w', chord: label.symbol }]}
              sp={18}
              labels
              reserveAbove={3}
            />
          ) : (
            <div className="px-4 text-center text-lg font-bold text-[#6b6585]">
              The notes show up here once you've played it.
              <div className="mt-1 text-sm font-semibold">Stuck? Tap Hint.</div>
            </div>
          )}
        </Paper>
      </div>
      <div className="glass rounded-3xl px-2 pb-2 pt-12 sm:px-4">
        <Piano from={48} to={84} mode="toggle" onToggle={toggle} marks={marks} sparks labels="c" height={180} />
      </div>
    </>
  )
}
