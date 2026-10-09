import { useId } from 'react'

/** The Tonic mark: a tilted whole note glowing like a stage light. */
export function LogoMark({ size = 40 }: { size?: number }) {
  // Unique gradient id: the logo can be on the page twice (compact + full sidebar).
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd66b" />
          <stop offset="0.55" stopColor="#ff8a6b" />
          <stop offset="1" stopColor="#ff8fc8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill={`url(#${id})`} />
      <g transform="rotate(-24 24 24)">
        <ellipse cx="24" cy="24" rx="12.5" ry="9" fill="#1b1838" />
        <ellipse cx="24" cy="24" rx="5.8" ry="3.4" fill={`url(#${id})`} transform="rotate(38 24 24)" />
      </g>
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 40 : 42} />
      {!compact && <span className="font-display text-[1.75rem] font-bold leading-none tracking-tight">Tonic</span>}
    </span>
  )
}
