import type { LucideIcon } from 'lucide-react'
import { type HTMLMotionProps, motion } from 'motion/react'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'good' | 'danger' | 'violet'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-gold to-gold-deep text-night-900 shadow-[0_5px_0_#b9761f,0_14px_28px_-10px_rgba(255,200,87,.55)] active:shadow-[0_2px_0_#b9761f] active:translate-y-[3px]',
  secondary:
    'bg-night-700 text-ink border border-white/10 shadow-[0_5px_0_#100f27] hover:bg-night-600 active:shadow-[0_2px_0_#100f27] active:translate-y-[3px]',
  ghost: 'text-ink-soft hover:bg-white/6 hover:text-ink',
  good: 'bg-linear-to-b from-[#5ef0ae] to-good text-night-900 shadow-[0_5px_0_#1d9a62] active:shadow-[0_2px_0_#1d9a62] active:translate-y-[3px]',
  danger: 'bg-bad text-white shadow-[0_5px_0_#a8304a] active:shadow-[0_2px_0_#a8304a] active:translate-y-[3px]',
  violet:
    'bg-linear-to-b from-[#b2a6ff] to-violet text-night-900 shadow-[0_5px_0_#5f50c9] active:shadow-[0_2px_0_#5f50c9] active:translate-y-[3px]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-5 text-base rounded-2xl gap-2',
  lg: 'h-14 px-6 text-lg rounded-2xl gap-2.5',
  xl: 'h-16 px-8 text-xl rounded-[1.25rem] gap-3',
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
  block?: boolean
}

export function Button({ variant = 'primary', size = 'lg', icon: Icon, iconRight: IconRight, block, className = '', children, ...rest }: ButtonProps) {
  const iconSize = size === 'sm' ? 18 : size === 'md' ? 20 : size === 'lg' ? 22 : 26
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      type="button"
      className={`inline-flex shrink-0 select-none items-center justify-center font-extrabold tracking-tight transition-[background-color,box-shadow,opacity,translate] duration-100 disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2.5} />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={2.5} />}
    </motion.button>
  )
}

/** Round icon-only button (back, close, replay …). */
export function IconButton({
  icon: Icon,
  label,
  size = 48,
  className = '',
  ...rest
}: Omit<HTMLMotionProps<'button'>, 'children'> & { icon: LucideIcon; label: string; size?: number }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-night-700/80 text-ink-soft transition-colors hover:bg-night-600 hover:text-ink disabled:opacity-40 ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={size * 0.46} strokeWidth={2.4} />
    </motion.button>
  )
}
