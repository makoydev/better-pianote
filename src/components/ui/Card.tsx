import type { LucideIcon } from 'lucide-react'
import { type HTMLMotionProps, motion } from 'motion/react'
import type { ReactNode } from 'react'

export function Card({ className = '', children, ...rest }: HTMLMotionProps<'div'> & { children?: ReactNode }) {
  return (
    <motion.div className={`glass rounded-3xl p-5 ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}

/** Cream "paper" panel for sheet music. */
export function Paper({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <div className={`paper rounded-3xl px-4 py-3 sm:px-6 ${className}`}>{children}</div>
}

/** Gradient tile with an icon, used on hubs and the home screen. */
export function IconTile({ icon: Icon, from, to, size = 56, className = '' }: { icon: LucideIcon; from: string; to: string; size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_10px_20px_-10px_rgba(0,0,0,.6)] ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${from}, ${to})` }}
    >
      <Icon size={size * 0.5} strokeWidth={2.3} />
    </span>
  )
}

/** A big tappable tile linking somewhere. */
export function Tile({
  icon,
  from,
  to,
  title,
  subtitle,
  onClick,
  badge,
  className = '',
}: {
  icon: LucideIcon
  from: string
  to: string
  title: string
  subtitle?: string
  onClick?: () => void
  badge?: ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={`glass group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl p-4 text-left transition-colors hover:border-white/15 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: from }}
      />
      <IconTile icon={icon} from={from} to={to} />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm leading-snug text-ink-mute">{subtitle}</span>}
      </span>
      {badge}
    </motion.button>
  )
}
