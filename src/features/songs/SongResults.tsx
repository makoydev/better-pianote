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
}

const TITLES = ['Nice try!', 'You played it!', 'Lovely playing!', 'Perfect!']
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
  const trend = result ? trendRuns(runs, result.hands) : []
  return (
    <Modal open={!!result} onClose={onClose}>
      {result && (
        <div className="-mt-6 flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            <Stars value={result.stars} size={52} animate />
          </motion.div>
          <h2 className="mt-3 font-display text-4xl font-bold">{TITLES[result.stars]}</h2>
          <p className="mt-1 text-lg text-ink-soft">
            {song.title}
            {song.lh ? ` · ${HANDS_NAME[result.hands]}` : ''}
            {result.pct !== 100 ? ` · ${result.pct}% tempo` : ''}
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
            <Stat label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} />
            <Stat label="Wrong notes" value={String(result.mistakes)} />
            <Stat label="Time" value={clockTime(result.seconds)} icon={<Timer size={16} />} />
          </div>
          {result.slips.some((s) => s > 0) && (
            <div className="mt-3 w-full rounded-2xl bg-night-850 px-4 py-3 text-left">
              <p className="mb-2 text-sm font-extrabold text-ink-soft">Wrong notes by bar</p>
              <SlipStrip song={song} slips={result.slips} played={result.played} worst={result.worst} />
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
              Longest streak: <b className="text-ink">{result.bestCombo} notes</b>
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
