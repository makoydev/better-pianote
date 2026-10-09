import { ArrowRight, Disc3, Ear, Flame, Layers, ListMusic, Music, Piano, Sparkles, Target, Usb, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { ConnectSheet } from '../../components/layout/ConnectSheet'
import { Page } from '../../components/layout/Page'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { ProgressBar, ProgressRing } from '../../components/ui/progress'
import { ALL_LESSONS, UNITS, nextLesson } from '../../content'
import { levelFor } from '../../lib/levels'
import { go } from '../../router'
import { useLive } from '../../state/live'
import { liveStreak, todayXp, useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late-night session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } } }

export function Home() {
  const name = useSettings((s) => s.name)
  const lessons = useProgress((s) => s.lessons)
  const xp = useProgress((s) => s.xp)
  const goal = useProgress((s) => s.dailyGoal)
  const today = useProgress(todayXp)
  const streak = useProgress(liveStreak)
  const chords = useProgress((s) => s.chordsFound.length)
  const midi = useLive((s) => s.midi)
  const devices = useLive((s) => s.midiDevices)
  const [connectOpen, setConnectOpen] = useState(false)
  const level = levelFor(xp)
  const next = nextLesson(lessons)
  const doneCount = ALL_LESSONS.filter((x) => lessons[x.lesson.id]).length
  const started = doneCount > 0
  const connected = midi === 'ready' && devices.length > 0

  return (
    <Page title={`${greeting()}${name ? `, ${name}` : ''}`} subtitle={started ? 'Ready for a little more? Ten minutes a day beats an hour on Sunday.' : 'Let’s give your playing some real foundations: reading, chords, scales, rhythm.'}>
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="space-y-6">
        {/* Stats */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<Flame className={streak ? 'animate-flicker text-coral' : 'text-ink-mute'} size={30} />}
            value={streak}
            label={streak === 1 ? 'day streak' : 'day streak'}
          />
          <div className="glass flex items-center gap-4 rounded-3xl p-4">
            <ProgressRing value={today / goal} size={58} color="#3ddc97">
              <Target size={22} className="text-good" />
            </ProgressRing>
            <div>
              <div className="text-2xl font-extrabold leading-none">
                {today}
                <span className="text-base text-ink-mute">/{goal} XP</span>
              </div>
              <div className="mt-1 text-sm font-bold text-ink-mute">{today >= goal ? 'Daily goal done!' : 'today’s goal'}</div>
            </div>
          </div>
          <div className="glass flex items-center gap-4 rounded-3xl p-4">
            <ProgressRing value={level.progress} size={58}>
              <span className="text-lg font-extrabold text-gold">{level.level}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold leading-tight">{level.title}</div>
              <div className="mt-1 text-sm font-bold text-ink-mute">{level.toNext} XP to level {level.level + 1}</div>
            </div>
          </div>
          <Stat icon={<Layers className="text-violet" size={30} />} value={chords} label="chords discovered" />
        </motion.div>

        {/* Continue learning */}
        {next && (
          <motion.button
            variants={item}
            type="button"
            onClick={() => go(`/learn/${next.lesson.id}`)}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            className="relative block w-full overflow-hidden rounded-[2rem] border border-white/10 p-6 text-left sm:p-8"
            style={{ background: `linear-gradient(125deg, ${next.unit.color}40, ${next.unit.color}10 55%, rgba(25,24,56,.9))` }}
          >
            <span aria-hidden className="absolute -right-16 -top-24 size-80 rounded-full opacity-30 blur-3xl" style={{ background: next.unit.color }} />
            <MiniKeys color={next.unit.color} />
            <div className="relative flex flex-wrap items-center gap-6">
              <span className="flex size-20 items-center justify-center rounded-3xl text-night-900 shadow-xl" style={{ background: next.unit.color }}>
                <Icon name={next.lesson.icon} size={40} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: next.unit.color }}>
                  {started ? 'Continue' : 'Start here'} · Unit {UNITS.indexOf(next.unit) + 1}, lesson {next.index + 1}
                </div>
                <div className="mt-1 font-display text-4xl font-bold leading-tight">{next.lesson.title}</div>
                <div className="mt-1 text-lg text-ink-soft">{next.lesson.subtitle}</div>
                <div className="mt-4 max-w-md">
                  <ProgressBar value={ALL_LESSONS.length ? doneCount / ALL_LESSONS.length : 0} color={next.unit.color} height={10} />
                  <div className="mt-1.5 text-sm font-bold text-ink-mute">
                    {doneCount} of {ALL_LESSONS.length} lessons done
                  </div>
                </div>
              </div>
              <span className="inline-flex h-16 items-center gap-2 rounded-2xl bg-linear-to-b from-gold to-gold-deep px-7 text-xl font-extrabold text-night-900 shadow-[0_5px_0_#b9761f]">
                {started ? 'Continue' : 'Start'} <ArrowRight size={24} strokeWidth={2.6} />
              </span>
            </div>
          </motion.button>
        )}

        {/* Connect */}
        {!connected && midi !== 'unsupported' && (
          <motion.div variants={item} className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-good/15 text-good">
              <Usb size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold">Plug in your keyboard</div>
              <div className="text-ink-soft">Connect your CT-S1’s micro-USB “USB TO HOST” port to your computer and the app hears every note you play, so lessons and games react to your real keys.</div>
            </div>
            <Button variant="secondary" icon={Usb} onClick={() => setConnectOpen(true)}>
              How to connect
            </Button>
          </motion.div>
        )}

        {/* Free play + quick picks */}
        <motion.div variants={item} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <motion.button
            type="button"
            onClick={() => go('/play')}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            className="relative min-h-56 overflow-hidden rounded-[2rem] p-7 text-left text-night-900"
            style={{ background: 'linear-gradient(135deg, #ffd66b, #ff8a6b 55%, #ff8fc8)' }}
          >
            <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,.35)_50%,transparent_65%)] bg-[length:200%_100%]" />
            <Sparkles className="absolute right-6 top-6 opacity-70" size={34} />
            <div className="relative">
              <Piano size={44} strokeWidth={2.2} />
              <div className="mt-3 font-display text-4xl font-bold">Free Play</div>
              <p className="mt-2 max-w-sm text-lg font-semibold opacity-80">
                Play anything you know. See every chord’s name and the notes on the staff, live, as you play.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-lg font-extrabold">
                Just play <ArrowRight size={22} />
              </div>
            </div>
          </motion.button>
          <div className="grid gap-3">
            <Tile icon={Zap} from="#5cc8ff" to="#9b8cff" title="Note Rush" subtitle="Read notes against the clock" onClick={() => go('/practice/note-rush')} />
            <Tile icon={Layers} from="#9b8cff" to="#ff8fc8" title="Chord Trainer" subtitle="See a chord symbol, play it" onClick={() => go('/practice/chord-trainer')} />
            <Tile icon={Disc3} from="#3ee6c8" to="#5cc8ff" title="Progression Jam" subtitle="Play along with the backing band" onClick={() => go('/explore/progressions')} />
          </div>
        </motion.div>

        <motion.div variants={item} className="grid gap-3 sm:grid-cols-3">
          <Tile icon={ListMusic} from="#4fd18b" to="#3ee6c8" title="Songs" subtitle="Play-along with wait mode" onClick={() => go('/songs')} />
          <Tile icon={Ear} from="#ff7b6b" to="#ffc857" title="Ear Training" subtitle="Your superpower, sharpened" onClick={() => go('/practice/ear')} />
          <Tile icon={Music} from="#ffc857" to="#ff7b6b" title="Chord Explorer" subtitle="Every chord, every key" onClick={() => go('/explore/chords')} />
        </motion.div>
      </motion.div>
      <ConnectSheet open={connectOpen} onClose={() => setConnectOpen(false)} />
    </Page>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass flex items-center gap-4 rounded-3xl p-4">
      <span className="flex size-[58px] items-center justify-center rounded-full bg-white/6">{icon}</span>
      <div>
        <div className="text-3xl font-extrabold leading-none">{value}</div>
        <div className="mt-1 text-sm font-bold text-ink-mute">{label}</div>
      </div>
    </div>
  )
}

/** Decorative keys peeking out of the continue card. */
function MiniKeys({ color }: { color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute -bottom-6 right-6 hidden h-24 w-72 rotate-[-8deg] opacity-25 sm:flex">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="relative h-full flex-1 rounded-b-lg border-x border-night-900 bg-ink">
          {[0, 1, 3, 4, 5, 7, 8].includes(i) && <span className="absolute -right-2 top-0 z-10 h-3/5 w-4 rounded-b bg-night-900" />}
          {i === 4 && <span className="absolute inset-x-1 bottom-2 h-3 rounded" style={{ background: color }} />}
        </span>
      ))}
    </div>
  )
}
