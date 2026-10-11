import { Target } from 'lucide-react'
import { todayXp, useProgress } from '../../state/progress'

/** Today's XP against the daily goal, for results screens ("35 / 40 XP today · one more round"). */
export function GoalProgress({ className = '' }: { className?: string }) {
  const xp = useProgress(todayXp)
  const goal = useProgress((s) => s.dailyGoal)
  const done = xp >= goal
  return (
    <div className={`flex w-full max-w-xl items-center gap-3 rounded-2xl bg-night-850 px-4 py-2.5 text-left ${className}`}>
      <Target size={20} className={done ? 'text-good' : 'text-teal'} />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3 text-sm font-extrabold">
          <span className={done ? 'text-good' : 'text-ink-soft'}>{done ? 'Daily goal done!' : 'Daily goal'}</span>
          <span className="text-ink-mute">
            {Math.min(xp, goal)} / {goal} XP today
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${done ? 'bg-good' : 'bg-teal'}`} style={{ width: `${Math.min(1, xp / goal) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
