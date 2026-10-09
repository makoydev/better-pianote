import { Star } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = '#ffc857',
  track = 'rgba(255,255,255,.1)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  )
}

export function ProgressBar({ value, color = '#ffc857', className = '', height = 12 }: { value: number; color?: string; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`} style={{ height }}>
      <motion.div
        className="relative h-full rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        <span className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-white/40" />
      </motion.div>
    </div>
  )
}

export function Stars({ value, max = 3, size = 22, animate = false }: { value: number; max?: number; size?: number; animate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <motion.span
          key={i}
          initial={animate ? { scale: 0, rotate: -30 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animate ? 0.25 + i * 0.22 : 0, type: 'spring', stiffness: 400, damping: 14 }}
        >
          <Star size={size} strokeWidth={2} className={i < value ? 'fill-gold text-gold' : 'fill-white/10 text-white/20'} />
        </motion.span>
      ))}
    </span>
  )
}
