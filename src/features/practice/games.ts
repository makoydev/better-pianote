import { Drum, Ear, Hash, Layers, type LucideIcon, Zap } from 'lucide-react'

/** The Practice games: where each one is, what it trains, its colours, and how its best is shown. */
export interface Game {
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

export const GAMES: Game[] = [
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

/** A game by id. */
export const gameById = (id: string) => GAMES.find((g) => g.id === id)!
