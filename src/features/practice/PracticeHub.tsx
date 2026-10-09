import { Drum, Ear, Flame, Hash, Layers, type LucideIcon, Play, Trophy, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { Page } from '../../components/layout/Page'
import { IconTile } from '../../components/ui/Card'
import { go } from '../../router'
import { type GameRecord, dayKeyOf, useProgress } from '../../state/progress'

interface Game {
  id: string
  path: string
  title: string
  blurb: string
  skill: string
  icon: LucideIcon
  from: string
  to: string
  format: (best: number) => string
}

const GAMES: Game[] = [
  {
    id: 'note-rush',
    path: '/practice/note-rush',
    title: 'Note Rush',
    blurb: 'A note appears on the staff. Play it before the clock runs out.',
    skill: 'Sight reading',
    icon: Zap,
    from: '#ffc857',
    to: '#ff7b6b',
    format: (b) => b.toLocaleString(),
  },
  {
    id: 'chord-trainer',
    path: '/practice/chord-trainer',
    title: 'Chord Trainer',
    blurb: 'See a chord symbol, play it. From C major all the way to slash chords.',
    skill: 'Chords',
    icon: Layers,
    from: '#9b8cff',
    to: '#ff8fc8',
    format: (b) => b.toLocaleString(),
  },
  {
    id: 'ear',
    path: '/practice/ear',
    title: 'Ear Training',
    blurb: 'Major or minor? Which interval? Hear a tune and play it back.',
    skill: 'Listening',
    icon: Ear,
    from: '#3ee6c8',
    to: '#5cc8ff',
    format: (b) => b.toLocaleString(),
  },
  {
    id: 'rhythm',
    path: '/practice/rhythm',
    title: 'Rhythm Tap',
    blurb: 'Read a rhythm and tap it in time. Every tap graded to the millisecond.',
    skill: 'Rhythm',
    icon: Drum,
    from: '#ff7b6b',
    to: '#ffc857',
    format: (b) => `${b}%`,
  },
  {
    id: 'key-quiz',
    path: '/practice/key-quiz',
    title: 'Key Signature Quiz',
    blurb: 'Name the key from its sharps and flats, and the other way round.',
    skill: 'Theory',
    icon: Hash,
    from: '#5cc8ff',
    to: '#9b8cff',
    format: (b) => b.toLocaleString(),
  },
]

/** Today's warm-up: a game you haven't tried yet, otherwise the one you've left the longest. */
function warmUp(games: Record<string, GameRecord>): Game {
  const fresh = GAMES.find((g) => !games[g.id])
  if (fresh) return fresh
  const day = Number(dayKeyOf().replace(/-/g, ''))
  return [...GAMES].sort((a, b) => games[a.id].lastPlayed - games[b.id].lastPlayed || ((day + GAMES.indexOf(a)) % 5) - ((day + GAMES.indexOf(b)) % 5))[0]
}

export function PracticeHub() {
  const games = useProgress((s) => s.games)
  const today = warmUp(games)
  const playedToday = Object.values(games).some((g) => dayKeyOf(g.lastPlayed) === dayKeyOf())
  const TodayIcon = today.icon

  return (
    <Page title="Practice" subtitle="Short games that build real skills. Five minutes a day beats an hour once a week.">
      <motion.button
        type="button"
        onClick={() => go(today.path)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        className="group relative mb-8 flex w-full flex-col gap-5 overflow-hidden rounded-[2rem] p-6 text-left sm:flex-row sm:items-center sm:p-8"
        style={{ background: `linear-gradient(125deg, ${today.from}33, ${today.to}22 45%, rgba(25,24,56,.9))` }}
      >
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60" style={{ background: today.from }} />
        <span className="relative">
          <motion.span className="inline-flex" animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}>
            <IconTile icon={TodayIcon} from={today.from} to={today.to} size={88} />
          </motion.span>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.18em] text-gold">
            <Flame size={16} className="animate-flicker" /> {playedToday ? 'Keep it going' : "Today's warm-up"}
          </span>
          <span className="mt-1 block font-display text-4xl font-bold leading-tight">{today.title}</span>
          <span className="mt-1 block max-w-xl text-lg text-ink-soft">{today.blurb}</span>
        </span>
        {/* Looks like a button; the whole card is the button. */}
        <span className="relative inline-flex h-16 shrink-0 items-center justify-center gap-3 rounded-[1.25rem] bg-linear-to-b from-gold to-gold-deep px-8 text-xl font-extrabold text-night-900 shadow-[0_5px_0_#b9761f,0_14px_28px_-10px_rgba(255,200,87,.55)] transition-transform group-active:translate-y-[3px]">
          <Play size={26} strokeWidth={2.5} /> Play
        </span>
      </motion.button>

      <div className="grid gap-4 md:grid-cols-2">
        {GAMES.map((g, i) => {
          const rec = games[g.id]
          const I = g.icon
          return (
            <motion.button
              key={g.id}
              type="button"
              onClick={() => go(g.path)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="glass group relative flex items-start gap-4 overflow-hidden rounded-3xl p-5 text-left transition-colors hover:border-white/15"
            >
              <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-35" style={{ background: g.from }} />
              <IconTile icon={I} from={g.from} to={g.to} size={64} />
              <span className="relative min-w-0 flex-1">
                <span className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: g.from }}>
                  {g.skill}
                </span>
                <span className="block font-display text-2xl font-bold leading-tight">{g.title}</span>
                <span className="mt-1 block text-base leading-snug text-ink-mute">{g.blurb}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2 text-sm font-extrabold">
                  {rec ? (
                    <>
                      <span className="flex items-center gap-1 rounded-full bg-gold/12 px-3 py-1 text-gold">
                        <Trophy size={14} /> Best {g.format(rec.best)}
                      </span>
                      <span className="rounded-full bg-white/6 px-3 py-1 text-ink-mute">
                        {rec.plays} {rec.plays === 1 ? 'round' : 'rounds'}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-teal/15 px-3 py-1 text-teal">New!</span>
                  )}
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </Page>
  )
}
