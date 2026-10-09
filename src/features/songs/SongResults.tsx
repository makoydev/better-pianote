import { ListMusic, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Stars } from '../../components/ui/progress'
import type { Song } from '../../content/songs'

export interface SongResult {
  stars: number
  accuracy: number
  mistakes: number
  seconds: number
  xp: number
  isBest: boolean
  bestCombo: number
  hands: 'rh' | 'both'
}

const TITLES = ['Nice try!', 'You played it!', 'Lovely playing!', 'Perfect!']

export function SongResults({
  song,
  result,
  onAgain,
  onClose,
  onSongs,
}: {
  song: Song
  result: SongResult | null
  onAgain: () => void
  onClose: () => void
  onSongs: () => void
}) {
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
            {result.hands === 'both' ? ' · both hands' : ''}
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
          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <Stat label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} />
            <Stat label="Wrong notes" value={String(result.mistakes)} />
            <Stat
              label="Time"
              value={`${Math.floor(result.seconds / 60)}:${String(Math.round(result.seconds % 60)).padStart(2, '0')}`}
              icon={<Timer size={16} />}
            />
          </div>
          <div className="mt-3 flex w-full items-center justify-between rounded-2xl bg-night-850 px-4 py-3 text-left">
            <span className="text-ink-soft">
              Longest streak: <b className="text-ink">{result.bestCombo} notes</b>
            </span>
            <span className="inline-flex items-center gap-1.5 font-extrabold text-gold">
              <Zap size={18} className="fill-gold" /> +{result.xp} XP
            </span>
          </div>
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
