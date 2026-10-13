import { ListMusic, Repeat, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { GoalProgress } from '../../components/ui/GoalProgress'
import { Modal } from '../../components/ui/Modal'
import { Stars } from '../../components/ui/progress'
import type { Song } from '../../content/songs'
import { RunTrend, SlipStrip } from './ResultCharts'
import { barsName } from './bars'
import { trendRuns, useSongRuns } from './history'
import { tendency } from './along'
import { type Hands, clockTime } from './results'

export interface SongResult {
  stars: number
  accuracy: number
  mistakes: number
  seconds: number
  xp: number
  isBest: boolean
  bestCombo: number
  hands: Hands
  /** Played from the start without skipping ahead or changing hands (only those runs count as a best). */
  whole: boolean
  /** Started from a bar you chose ("bar 12"): from there to the end. */
  from?: string
  /** Slips in each bar of the song, the bars the run went through, and the stretch with the most slips. */
  slips: number[]
  played: [number, number]
  worst: [number, number] | null
  /** The tempo, as a % of the song's. */
  pct: number
  /** Played along at tempo: `accuracy` is the share of notes in time, and this is how the timing went. */
  along?: AlongTiming
}

export interface AlongTiming {
  /** Notes on the beat, a little early or late (still in time), too far off, and missed, of `total`. */
  onBeat: number
  close: number
  off: number
  missed: number
  total: number
  /** On average, how early (minus) or late the notes you played were, in seconds. */
  mean: number | null
}

const TITLES = ['Nice try!', 'You played it!', 'Lovely playing!', 'Perfect!']
/** Playing along, 3 stars can come with a slip or two, so "Perfect!" is kept for every note on the beat. */
const ALONG_TITLES = ['Nice try!', 'You played along!', 'Lovely playing!', 'Great timing!']
const HANDS_NAME: Record<Hands, string> = { rh: 'right hand', lh: 'left hand', both: 'both hands' }

export function SongResults({
  song,
  result,
  onAgain,
  onClose,
  onSongs,
  onPractise,
}: {
  song: Song
  result: SongResult | null
  onAgain: () => void
  onClose: () => void
  onSongs: () => void
  /** Loop these bars and practise them. */
  onPractise: (bars: [number, number]) => void
}) {
  const runs = useSongRuns((s) => s.runs[song.id])
  const along = result?.along
  const trend = result ? trendRuns(runs, result.hands, along ? 'along' : undefined) : []
  return (
    <Modal open={!!result} onClose={onClose}>
      {result && (
        <div className="-mt-6 flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            <Stars value={result.stars} size={52} animate />
          </motion.div>
          <h2 className="mt-3 font-display text-4xl font-bold">
            {!along ? TITLES[result.stars] : along.onBeat === along.total && result.mistakes === 0 ? 'Perfect!' : ALONG_TITLES[result.stars]}
          </h2>
          <p className="mt-1 text-lg text-ink-soft">
            {song.title}
            {song.lh ? ` · ${HANDS_NAME[result.hands]}` : ''}
            {result.pct !== 100 ? ` · ${result.pct}% tempo` : ''}
            {along ? ' · played along' : ''}
          </p>
          {result.isBest && (
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-sm font-extrabold text-gold"
            >
              <Trophy size={18} /> New personal best
            </motion.p>
          )}
          {result.from ? (
            <p className="mt-3 text-sm font-semibold text-ink-mute">
              From {result.from} to the end <span className="text-ink-soft">·</span> doesn’t count as a best
            </p>
          ) : (
            !result.whole && <p className="mt-3 text-sm font-semibold text-ink-mute">Not played all the way from the start, so this run doesn’t count as a best.</p>
          )}
          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <Stat label={along ? 'In time' : 'Accuracy'} value={`${Math.round(result.accuracy * 100)}%`} />
            <Stat label="Wrong notes" value={String(result.mistakes)} />
            {along ? (
              <Stat label="Missed" value={String(along.missed)} />
            ) : (
              <Stat label="Time" value={clockTime(result.seconds)} icon={<Timer size={16} />} />
            )}
          </div>
          {along && <TimingSplit timing={along} />}
          {result.slips.some((s) => s > 0) && (
            <div className="mt-3 w-full rounded-2xl bg-night-850 px-4 py-3 text-left">
              <p className="mb-2 text-sm font-extrabold text-ink-soft">{along ? 'Off the beat, missed or wrong, by bar' : 'Wrong notes by bar'}</p>
              <SlipStrip
                song={song}
                slips={result.slips}
                played={result.played}
                worst={result.worst}
                {...(along && { title: 'Notes off the beat, missed or wrong, by bar', count: (n: number) => `${n} off the beat, missed or wrong` })}
              />
              {result.worst && (
                <Button size="sm" variant="secondary" icon={Repeat} className="mt-3 w-full" onClick={() => onPractise(result.worst!)}>
                  Practise {barsName(song, ...result.worst)}
                </Button>
              )}
            </div>
          )}
          {trend.length >= 2 && (
            <div className="mt-3 w-full rounded-2xl bg-night-850 px-4 py-3 text-left">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm font-extrabold">
                <span className="text-ink-soft">Your last {trend.length} runs</span>
                <span className="text-ink-mute">
                  {trend[0].accuracy}% → {trend[trend.length - 1].accuracy}%
                </span>
              </div>
              <RunTrend runs={trend} />
              {trend[0].pct !== trend[trend.length - 1].pct && (
                <p className="mt-1 text-xs font-bold text-ink-mute">
                  Tempo {trend[0].pct}% → {trend[trend.length - 1].pct}%
                </p>
              )}
            </div>
          )}
          <div className="mt-3 flex w-full items-center justify-between rounded-2xl bg-night-850 px-4 py-3 text-left">
            <span className="text-ink-soft">
              {along ? 'Longest streak in time' : 'Longest streak'}: <b className="text-ink">{result.bestCombo} notes</b>
            </span>
            <span className="inline-flex items-center gap-1.5 font-extrabold text-gold">
              <Zap size={18} className="fill-gold" /> +{result.xp} XP
            </span>
          </div>
          <GoalProgress className="mt-3" />
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
            <Button icon={RotateCcw} className="w-full sm:w-auto sm:flex-1" onClick={onAgain}>
              Play again
            </Button>
            <Button variant="secondary" icon={ListMusic} className="w-full sm:w-auto sm:flex-1" onClick={onSongs}>
              More songs
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** The colours of the music: on the beat green, a little off amber, too far off red, missed grey. */
const SPLIT = [
  { key: 'onBeat', name: 'On the beat', color: '#2fbf80' },
  { key: 'close', name: 'A little off', color: '#f0a43a' },
  { key: 'off', name: 'Too far off', color: '#e0405f' },
  { key: 'missed', name: 'Missed', color: '#5b5a86' },
] as const

/** How the notes went, as one bar split by colour, and whether you rushed or dragged on the whole. */
function TimingSplit({ timing }: { timing: AlongTiming }) {
  const parts = SPLIT.filter((p) => timing[p.key] > 0)
  const lean = tendency(timing.mean)
  const ms = timing.mean === null ? 0 : Math.round(Math.abs(timing.mean) * 1000)
  return (
    <div className="mt-3 w-full rounded-2xl bg-night-850 px-4 py-3 text-left">
      <div
        className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={parts.map((p) => `${p.name}: ${timing[p.key]}`).join(', ')}
      >
        {parts.map((p) => (
          <span key={p.key} className="h-full" style={{ flexGrow: timing[p.key], background: p.color }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
            {p.name} <b className="text-ink">{timing[p.key]}</b>
          </span>
        ))}
      </p>
      {lean && (
        <p className="mt-2 text-sm font-bold text-gold">
          {lean === 'rushing' ? `You tended to rush: notes came about ${ms} ms early.` : `You tended to drag: notes came about ${ms} ms late.`}
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-night-850 px-3 py-4">
      <div className="flex items-center justify-center gap-1 font-display text-3xl font-bold">
        {icon}
        {value}
      </div>
      <div className="mt-1 text-xs font-extrabold uppercase tracking-wider text-ink-mute">{label}</div>
    </div>
  )
}
