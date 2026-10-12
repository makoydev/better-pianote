import { ArrowRight, Check, Clock, Repeat, Search, Star, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Page } from '../../components/layout/Page'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ProgressBar, ProgressRing, Stars } from '../../components/ui/progress'
import { ALL_LESSONS, UNITS, nextLesson } from '../../content'
import type { Lesson, Unit } from '../../content/types'
import { go, navKind } from '../../router'
import { useProgress } from '../../state/progress'
import { useResumeStep } from './resume'
import { REVIEW_ID } from './review'
import { type LessonHit, searchLessons } from './search'

// Horizontal wiggle of the trail, in rem.
const OFFSETS = [0, 3.5, 5.5, 3.5, 0, -3.5, -5.5, -3.5]

// The last search, for coming Back to it.
let lastQuery = ''

export function LearnPath() {
  const lessons = useProgress((s) => s.lessons)
  const done = ALL_LESSONS.filter((x) => lessons[x.lesson.id]).length
  const stars = Object.values(lessons).reduce((a, l) => a + l.stars, 0)
  const current = nextLesson(lessons)?.lesson.id
  // Back from a lesson you found by searching brings the search back too.
  const [query, setQuery] = useState(() => (navKind() === 'pop' ? lastQuery : ''))
  useEffect(() => {
    lastQuery = query
  }, [query])
  const hits = useMemo(() => searchLessons(query), [query])
  const searching = query.trim() !== ''

  // Opening Learn brings your next lesson into view (Back returns you to where you'd scrolled instead).
  useEffect(() => {
    if (navKind() === 'pop') return
    const el = document.querySelector('[data-current-lesson]')
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top > window.innerHeight * 0.7) window.scrollTo({ top: window.scrollY + r.top - window.innerHeight / 2 + r.height / 2 })
  }, [])

  return (
    <Page title="Learn" subtitle="From your first note to playing with both hands. Go in order, or jump to whatever you need.">
      <div className="glass mb-6 rounded-3xl p-5">
        <div className="flex flex-wrap items-center gap-5">
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
          {/* Up to ten questions from finished lessons, so there's nothing to review until you've finished one. */}
          {done > 0 && (
            <Button variant="secondary" size="md" icon={Repeat} onClick={() => go(`/learn/${REVIEW_ID}`)} title="Up to ten questions from lessons you’ve finished">
              Quick review
            </Button>
          )}
        </div>
        <SearchBox value={query} onChange={setQuery} onSubmit={() => hits[0] && go(`/learn/${hits[0].lesson.id}`)} />
      </div>
      <p aria-live="polite" className="sr-only">
        {searching ? resultCount(hits.length, query.trim()) : ''}
      </p>
      {searching ? (
        <SearchResults hits={hits} query={query.trim()} />
      ) : (
        <>
          <UnitStrip />
          <div className="space-y-14">
            {UNITS.map((u, i) => (
              <UnitSection key={u.id} unit={u} number={i + 1} current={current} />
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <div className="relative mt-4">
      <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter opens the best match; Esc clears.
          if (e.key === 'Enter') onSubmit()
          if (e.key === 'Escape') onChange('')
        }}
        placeholder="Search lessons: inversions, treble clef, pedal…"
        aria-label="Search lessons"
        enterKeyHint="go"
        className="h-12 w-full rounded-2xl border border-white/10 bg-night-850 pl-12 pr-12 text-base font-semibold text-ink placeholder:text-ink-mute focus:border-gold/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-mute hover:text-ink"
        >
          <X size={20} />
        </button>
      )}
    </div>
  )
}

const resultCount = (n: number, query: string) => (n === 0 ? `No lessons match “${query}”.` : `${n} lesson${n === 1 ? '' : 's'}`)

function SearchResults({ hits, query }: { hits: LessonHit[]; query: string }) {
  const lessons = useProgress((s) => s.lessons)
  return (
    <section aria-label="Search results">
      <p className="mb-3 text-sm font-bold text-ink-mute">{resultCount(hits.length, query)}</p>
      <ul className="space-y-3">
        {hits.map((h) => (
          <li key={h.lesson.id}>
            <button
              type="button"
              onClick={() => go(`/learn/${h.lesson.id}`)}
              className="glass flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-colors hover:border-white/20"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl text-night-900" style={{ background: h.unit.color }}>
                <Icon name={h.lesson.icon} size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold uppercase tracking-wider" style={{ color: h.unit.color }}>
                  Unit {h.unitNo} · Lesson {h.lessonNo}
                </span>
                <span className="block text-lg font-extrabold leading-tight text-ink">{h.lesson.title}</span>
                <span className="block truncate text-sm text-ink-mute">{h.step ? `Step: ${h.step}` : h.lesson.subtitle}</span>
              </span>
              {lessons[h.lesson.id] && <Stars value={lessons[h.lesson.id].stars} size={16} />}
              <ArrowRight size={20} className="shrink-0 text-ink-mute" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Sticky chips for the units, with each one's progress: tap to jump there. The one you're looking at is lit. */
function UnitStrip() {
  const lessons = useProgress((s) => s.lessons)
  const [active, setActive] = useState(0)

  // The unit crossing the top part of the screen is the one you're in.
  useEffect(() => {
    const sections = UNITS.map((u) => document.getElementById(`unit-${u.id}`)).filter((el): el is HTMLElement => !!el)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(sections.indexOf(e.target as HTMLElement))
      },
      { rootMargin: '-110px 0px -65% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  const jump = (k: number) => {
    setActive(k)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`unit-${UNITS[k].id}`)?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    // Only the chips take taps: the lessons scrolling past either side of them stay tappable.
    <nav aria-label="Units" className="pointer-events-none sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 mb-8 flex justify-center">
      <div className="glass pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,.8)] scrollbar-none">
        {UNITS.map((u, k) => {
          const done = u.lessons.filter((l) => lessons[l.id]).length
          const on = k === active
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => jump(k)}
              aria-label={`Unit ${k + 1}: ${u.title}, ${done} of ${u.lessons.length} done`}
              aria-current={on ? 'true' : undefined}
              title={`${u.title} · ${done} / ${u.lessons.length}`}
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors ${on ? 'bg-white/10' : 'hover:bg-white/6'}`}
            >
              <ProgressRing value={u.lessons.length ? done / u.lessons.length : 0} size={40} stroke={4} color={u.color}>
                <span className="text-sm font-extrabold" style={{ color: on ? u.color : '#cdc9e6' }}>
                  {k + 1}
                </span>
              </ProgressRing>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function UnitSection({ unit, number, current }: { unit: Unit; number: number; current?: string }) {
  const lessons = useProgress((s) => s.lessons)
  const done = unit.lessons.filter((l) => lessons[l.id]).length
  return (
    <section id={`unit-${unit.id}`} className="scroll-mt-24">
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
  // Part-way through (a first try or a replay): "Step 7 of 9" and a ring that far round.
  const at = useResumeStep(lesson.id, lesson.steps.length)
  const partial = at === null ? null : `Step ${at + 1} of ${lesson.steps.length}`
  const status = [done ? `done, ${record.stars} of 3 stars` : isCurrent && !partial ? 'up next' : '', partial?.toLowerCase()].filter(Boolean).join(', ')
  return (
    <div className="relative" data-current-lesson={isCurrent || undefined} style={{ transform: `translateX(calc(var(--wig) * ${offset}))` }}>
      {/* One button for the circle and the text, so each lesson is a single tab stop. */}
      <button
        type="button"
        onClick={() => go(`/learn/${lesson.id}`)}
        aria-label={`${lesson.title}: ${lesson.subtitle}${status ? `. ${status}` : ''}`}
        className="group relative flex items-center text-left outline-none"
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          className="relative flex shrink-0 items-center"
        >
          {isCurrent && (
            <motion.span
              aria-hidden
              className="absolute -top-11 left-[2.6rem] z-10 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-extrabold text-night-900 shadow-lg"
              style={{ background: unit.color }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              {partial ? 'Resume' : done ? 'Again?' : 'Start'}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent" style={{ borderTopColor: unit.color }} />
            </motion.span>
          )}
          <span
            className="relative flex size-[5.2rem] items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-[1.06] group-active:scale-[0.94] group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-gold"
            style={{
              background: done ? `linear-gradient(150deg, ${unit.color}, ${unit.color}aa)` : isCurrent ? '#282752' : '#201f45',
              // An unfinished lesson's ring shows how far you got instead of a full ring.
              boxShadow: done ? `0 7px 0 ${unit.color}66, 0 0 30px -6px ${unit.color}` : isCurrent && !partial ? `0 7px 0 #100f27, 0 0 0 4px ${unit.color}` : '0 7px 0 #100f27',
              color: done ? '#0d0c24' : isCurrent || partial ? unit.color : '#938fbb',
            }}
          >
            {at !== null && <PartRing value={at / lesson.steps.length} color={unit.color} />}
            {isCurrent && <span className="absolute inset-0 animate-pulse-ring rounded-full" style={{ boxShadow: `0 0 0 3px ${unit.color}` }} />}
            <Icon name={lesson.icon} size={34} />
            {done && (
              <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-night-900 bg-good text-night-900">
                <Check size={16} strokeWidth={3.5} />
              </span>
            )}
          </span>
        </motion.span>
        <span className="ml-4 block w-[min(16rem,calc(100vw-9rem))] sm:absolute sm:left-full sm:top-1/2 sm:w-64 sm:-translate-y-1/2">
          <span className={`block text-lg font-extrabold leading-tight group-hover:text-ink ${done || isCurrent ? 'text-ink' : 'text-ink-soft'}`}>{lesson.title}</span>
          <span className="block text-sm leading-snug text-ink-mute">{lesson.subtitle}</span>
          <span className="mt-1 flex items-center gap-2 text-xs font-bold text-ink-mute">
            <Clock size={13} /> {lesson.minutes} min
            {record && <Stars value={record.stars} size={15} />}
            {partial && <span style={{ color: unit.color }}>· {partial}</span>}
          </span>
        </span>
      </button>
    </div>
  )
}

/** How far into an unfinished lesson you are, drawn round its circle. */
function PartRing({ value, color }: { value: number; color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[7px] -rotate-90">
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="4" />
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(4, value * 100)} 100`} />
    </svg>
  )
}
