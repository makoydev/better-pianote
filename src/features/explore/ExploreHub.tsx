import { ArrowRight, Compass, Disc3, Layers, Piano, Timer, Waves } from 'lucide-react'
import { motion } from 'motion/react'
import { Page } from '../../components/layout/Page'
import { Tile } from '../../components/ui/Card'
import { go } from '../../router'

const TOOLS = [
  { path: '/explore/chords', title: 'Chord Explorer', subtitle: 'Any chord: its notes, fingering, sound, and what you’re holding right now', icon: Layers, from: '#b2a6ff', to: '#7b6cff' },
  { path: '/explore/scales', title: 'Scale Explorer', subtitle: 'Major, minor, pentatonic, blues and modes, with fingering and a practice run', icon: Waves, from: '#6ff0d8', to: '#25b9a0' },
  { path: '/explore/progressions', title: 'Progression Jam', subtitle: 'Loop famous chord progressions with a backing band and play along', icon: Disc3, from: '#ff9d8f', to: '#ff6b5b' },
  { path: '/explore/circle', title: 'Circle of Fifths', subtitle: 'Every key, its signature and its chord family on one spinning wheel', icon: Compass, from: '#ffb0dc', to: '#ff6fb5' },
  { path: '/explore/metronome', title: 'Metronome', subtitle: 'Steady beats, tap tempo, subdivisions, and a swinging pendulum', icon: Timer, from: '#ffe08a', to: '#f0a43a' },
]

export function ExploreHub() {
  return (
    <Page title="Explore" subtitle="Look up, hear and jam with any chord, scale or key.">
      <motion.button
        type="button"
        onClick={() => go('/play')}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        className="group relative mb-6 flex w-full flex-col gap-5 overflow-hidden rounded-[2rem] p-6 text-left text-night-900 sm:flex-row sm:items-center sm:p-8"
        style={{ background: 'linear-gradient(130deg, #ffd66b 0%, #ff8a6b 55%, #ff8fc8 100%)' }}
      >
        <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.35)_50%,transparent_70%)] bg-[length:200%_100%]" />
        <span className="relative flex size-20 shrink-0 items-center justify-center rounded-3xl bg-night-900/85 text-gold shadow-xl">
          <Piano size={42} strokeWidth={2.2} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-night-800/80">Featured</span>
          <span className="block font-display text-4xl font-bold leading-tight">Free Play</span>
          <span className="mt-1 block max-w-2xl text-lg font-bold text-night-800/90">
            Play anything on your keyboard and watch the chord name and the sheet music appear as you play.
          </span>
        </span>
        <span className="relative inline-flex h-14 items-center gap-2 self-start rounded-2xl bg-night-900 px-6 text-lg font-extrabold text-ink transition-transform group-hover:translate-x-1 sm:self-center">
          Start playing <ArrowRight size={22} />
        </span>
      </motion.button>
      <div className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((t, i) => (
          <motion.div key={t.path} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <Tile icon={t.icon} from={t.from} to={t.to} title={t.title} subtitle={t.subtitle} onClick={() => go(t.path)} className="min-h-28" />
          </motion.div>
        ))}
      </div>
    </Page>
  )
}
