import { Check, Clock, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { Page } from '../../components/layout/Page'
import { Icon } from '../../components/ui/Icon'
import { ProgressBar, Stars } from '../../components/ui/progress'
import { ALL_LESSONS, UNITS, nextLesson } from '../../content'
import type { Lesson, Unit } from '../../content/types'
import { go } from '../../router'
import { useProgress } from '../../state/progress'

// Horizontal wiggle of the trail, in rem.
const OFFSETS = [0, 3.5, 5.5, 3.5, 0, -3.5, -5.5, -3.5]

export function LearnPath() {
  const lessons = useProgress((s) => s.lessons)
  const done = ALL_LESSONS.filter((x) => lessons[x.lesson.id]).length
  const stars = Object.values(lessons).reduce((a, l) => a + l.stars, 0)
  const current = nextLesson(lessons)?.lesson.id

  return (
    <Page title="Learn" subtitle="From your first note to playing with both hands. Go in order, or jump to whatever you need.">
      <div className="glass mb-10 flex flex-wrap items-center gap-5 rounded-3xl p-5">
        <div className="min-w-48 flex-1">
          <div className="mb-2 flex justify-between text-sm font-extrabold">
            <span>Course progress</span>
            <span className="text-ink-mute">
              {done} / {ALL_LESSONS.length} lessons
            </span>
          </div>
          <ProgressBar value={ALL_LESSONS.length ? done / ALL_LESSONS.length : 0} height={14} />
        </div>
        <div className="flex items-center gap-2 text-lg font-extrabold text-gold">
          <Star className="fill-gold" size={24} /> {stars} <span className="text-sm text-ink-mute">/ {ALL_LESSONS.length * 3}</span>
        </div>
      </div>
      <div className="space-y-14">
        {UNITS.map((u, i) => (
          <UnitSection key={u.id} unit={u} number={i + 1} current={current} />
        ))}
      </div>
    </Page>
  )
}

function UnitSection({ unit, number, current }: { unit: Unit; number: number; current?: string }) {
  const lessons = useProgress((s) => s.lessons)
  const done = unit.lessons.filter((l) => lessons[l.id]).length
  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        className="relative mb-8 overflow-hidden rounded-3xl border border-white/8 p-5 sm:p-6"
        style={{ background: `linear-gradient(120deg, ${unit.color}26, ${unit.color}08 60%, transparent)` }}
      >
        <span aria-hidden className="absolute -right-12 -top-16 size-56 rounded-full opacity-25 blur-3xl" style={{ background: unit.color }} />
        <div className="relative flex items-center gap-4 sm:gap-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-night-900 shadow-lg sm:size-16" style={{ background: unit.color }}>
            <Icon name={unit.icon} size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] sm:text-sm" style={{ color: unit.color }}>
              Unit {number}
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{unit.title}</h2>
            <p className="text-ink-soft">{unit.subtitle}</p>
            <div className="mt-1 text-sm font-extrabold text-ink-mute sm:hidden">
              {unit.lessons.length ? `${done} / ${unit.lessons.length} done` : 'Coming soon'}
            </div>
          </div>
          <div className="hidden shrink-0 text-right text-sm font-extrabold text-ink-mute sm:block">
            {unit.lessons.length ? `${done} / ${unit.lessons.length} done` : 'Coming soon'}
          </div>
        </div>
      </motion.div>
      {/* Phones: a simple list. Wider screens: a winding trail (--wig sets how far it wiggles). */}
      <div className="flex flex-col items-start gap-3 [--wig:0rem] sm:items-center sm:gap-0 sm:[--wig:0.62rem]">
        {unit.lessons.map((l, i) => (
          <div key={l.id} className="flex flex-col items-start sm:items-center">
            {i > 0 && <Connector from={OFFSETS[(i - 1) % OFFSETS.length]} to={OFFSETS[i % OFFSETS.length]} color={unit.color} lit={!!lessons[unit.lessons[i - 1].id]} />}
            <LessonNode lesson={l} unit={unit} offset={OFFSETS[i % OFFSETS.length]} isCurrent={l.id === current} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Connector({ from, to, color, lit }: { from: number; to: number; color: string; lit: boolean }) {
  return (
    <div className="relative hidden h-10 w-0 sm:block" aria-hidden>
      {[0.25, 0.5, 0.75].map((t) => (
        <span
          key={t}
          className="absolute size-2.5 -translate-x-1/2 rounded-full"
          style={{
            left: `calc(var(--wig) * ${from + (to - from) * t})`,
            top: `${t * 100}%`,
            background: lit ? color : 'rgba(255,255,255,.14)',
          }}
        />
      ))}
    </div>
  )
}

function LessonNode({ lesson, unit, offset, isCurrent }: { lesson: Lesson; unit: Unit; offset: number; isCurrent: boolean }) {
  const record = useProgress((s) => s.lessons[lesson.id])
  const done = !!record
  return (
    <div className="relative flex items-center" style={{ transform: `translateX(calc(var(--wig) * ${offset}))` }}>
      <motion.div initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-40px' }} className="relative flex items-center">
      {isCurrent && (
        <motion.div
          className="absolute -top-11 left-[2.6rem] z-10 -translate-x-1/2 rounded-xl px-3 py-1.5 text-sm font-extrabold text-night-900 shadow-lg"
          style={{ background: unit.color }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {done ? 'Again?' : 'Start'}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent" style={{ borderTopColor: unit.color }} />
        </motion.div>
      )}
      <motion.button
        type="button"
        onClick={() => go(`/learn/${lesson.id}`)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={`${lesson.title}${done ? ' (done)' : ''}`}
        className="relative flex size-[5.2rem] shrink-0 items-center justify-center rounded-full"
        style={{
          background: done ? `linear-gradient(150deg, ${unit.color}, ${unit.color}aa)` : isCurrent ? '#282752' : '#201f45',
          boxShadow: done ? `0 7px 0 ${unit.color}66, 0 0 30px -6px ${unit.color}` : isCurrent ? `0 7px 0 #100f27, 0 0 0 4px ${unit.color}` : '0 7px 0 #100f27',
          color: done ? '#0d0c24' : isCurrent ? unit.color : '#938fbb',
        }}
      >
        {isCurrent && <span className="absolute inset-0 animate-pulse-ring rounded-full" style={{ boxShadow: `0 0 0 3px ${unit.color}` }} />}
        <Icon name={lesson.icon} size={34} />
        {done && (
          <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-night-900 bg-good text-night-900">
            <Check size={16} strokeWidth={3.5} />
          </span>
        )}
      </motion.button>
      </motion.div>
      <button
        type="button"
        onClick={() => go(`/learn/${lesson.id}`)}
        className="ml-4 w-[min(16rem,calc(100vw-9rem))] text-left sm:absolute sm:left-full sm:top-1/2 sm:w-64 sm:-translate-y-1/2"
      >
        <div className={`text-lg font-extrabold leading-tight ${done || isCurrent ? 'text-ink' : 'text-ink-soft'}`}>{lesson.title}</div>
        <div className="text-sm leading-snug text-ink-mute">{lesson.subtitle}</div>
        <div className="mt-1 flex items-center gap-2 text-xs font-bold text-ink-mute">
          <Clock size={13} /> {lesson.minutes} min
          {record && <Stars value={record.stars} size={15} />}
        </div>
      </button>
    </div>
  )
}
