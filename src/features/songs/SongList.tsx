import { ChevronRight, Hand, Music } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Page } from '../../components/layout/Page'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Segmented } from '../../components/ui/controls'
import { Stars } from '../../components/ui/progress'
import { DIFFICULTY_LABEL, SONGS, type Song, starsForScore } from '../../content/songs'
import { go } from '../../router'
import { useProgress } from '../../state/progress'
import { buildTimeline, songScoreInput } from './timeline'

const LEVEL_COLOR: Record<Song['difficulty'], [string, string]> = {
  1: ['#3ee6c8', '#5cc8ff'],
  2: ['#ffc857', '#ff9a3c'],
  3: ['#ff7b6b', '#ff8fc8'],
}

type Filter = 'all' | 1 | 2 | 3

export function SongList() {
  const games = useProgress((s) => s.games)
  const [filter, setFilter] = useState<Filter>('all')
  const list = SONGS.filter((s) => filter === 'all' || s.difficulty === filter)
  return (
    <Page
      title="Songs"
      subtitle="Real pieces with the music scrolling past. Practice mode waits for each note; Listen mode plays it for you."
      actions={
        <Segmented<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 1, label: 'Beginner' },
            { value: 2, label: 'Intermediate' },
            { value: 3, label: 'Advanced' },
          ]}
        />
      }
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((song, i) => (
          <SongCard key={song.id} song={song} best={games[`song-${song.id}`]?.best ?? 0} index={i} />
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-mute">
        Every piece here is in the public domain. Want to play songs like <i>River Flows in You</i>? Those are still under copyright,
        but you can learn the chords and progressions behind them in the Learn tab, then play them by ear in Free Play.
      </p>
    </Page>
  )
}

function SongCard({ song, best, index }: { song: Song; best: number; index: number }) {
  const [c1, c2] = LEVEL_COLOR[song.difficulty]
  // The first couple of bars as a preview, without fingers or note names.
  const preview = useMemo(() => {
    // Up to two bars (after any pickup), fewer if they're busy, so the notes stay readable on the card.
    const first = song.pickup ? 1 : 0
    let last = first
    let count = song.rh[0].length + (first ? song.rh[1]?.length ?? 0 : 0)
    while (last + 1 < song.rh.length && last < first + 1 && count + song.rh[last + 1].length <= 12) count += song.rh[++last].length
    return songScoreInput(song, buildTimeline(song), { hands: 'rh', bars: [0, last], fingers: false })
  }, [song])
  return (
    <motion.button
      type="button"
      onClick={() => go(`/songs/${song.id}`)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="glass group relative flex flex-col overflow-hidden rounded-3xl p-5 text-left transition-colors hover:border-white/15"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-50"
        style={{ background: c1 }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-night-900"
            style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}
          >
            <Music size={13} strokeWidth={2.8} /> {DIFFICULTY_LABEL[song.difficulty]}
          </span>
          <h3 className="mt-2.5 font-display text-2xl font-bold leading-tight">{song.title}</h3>
          <p className="mt-0.5 text-sm font-semibold text-ink-mute">
            {song.composer} · {song.year}
          </p>
        </div>
        <Stars value={starsForScore(best)} size={20} />
      </div>
      <div className="paper pointer-events-none relative mt-4 rounded-2xl px-3 py-1">
        <ScoreStaff input={preview} fit sp={11} minSp={6} labels={false} fingers={false} reserveAbove={1.5} reserveBelow={1.5} title={`Opening of ${song.title}`} />
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">{song.keyName}</span>
        <span className="rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">
          {song.time[0]}/{song.time[1]}
        </span>
        {song.lh && (
          <span className="inline-flex items-center gap-1 rounded-xl bg-white/6 px-2.5 py-1 text-ink-soft">
            <Hand size={14} /> Both hands
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-gold opacity-80 transition-opacity group-hover:opacity-100">
          {best > 0 ? `Best ${best}%` : 'Play'} <ChevronRight size={18} strokeWidth={2.6} />
        </span>
      </div>
      <p className="relative mt-3 line-clamp-2 text-sm leading-relaxed text-ink-mute">{song.about}</p>
    </motion.button>
  )
}
