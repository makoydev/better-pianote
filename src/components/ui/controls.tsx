import { motion } from 'motion/react'
import { type ReactNode, useId } from 'react'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-good' : 'bg-night-600'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className="absolute top-1 size-6 rounded-full bg-white shadow"
        style={{ left: checked ? 'calc(100% - 1.75rem)' : '0.25rem' }}
      />
    </button>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const h = size === 'sm' ? 'h-9 text-sm' : size === 'lg' ? 'h-14 text-lg' : 'h-11 text-base'
  // Unique per control, so two controls with the same options don't share a highlight.
  const highlightId = useId()
  return (
    <div role="radiogroup" className={`inline-flex rounded-2xl border border-white/8 bg-night-850 p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 whitespace-nowrap rounded-xl px-3.5 font-extrabold transition-colors ${h} ${active ? 'text-night-900' : 'text-ink-soft hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${highlightId}`}
                className="absolute inset-0 rounded-xl bg-linear-to-b from-gold to-gold-deep"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A row of big pill buttons where one or more can be chosen. */
export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-2xl border px-4 text-base font-extrabold transition-colors ${
              active ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
            }`}
          >
            {o.label}
          </motion.button>
        )
      })}
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-night-600 accent-gold"
    />
  )
}
