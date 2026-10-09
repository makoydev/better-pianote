import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { go } from '../../router'
import { IconButton } from '../ui/Button'
import { ConnectionPill } from './ConnectionPill'

/** Header for full-screen pages (lessons, games, tools): back, title, connection status. */
export function TopBar({
  back,
  title,
  subtitle,
  children,
  center,
}: {
  /** Path the back button goes to. */
  back: string
  title?: ReactNode
  subtitle?: ReactNode
  /** Extra controls before the connection pill. */
  children?: ReactNode
  /** Replaces the title area (e.g. a progress bar). */
  center?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/6 bg-night-900/85 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[4.5rem] max-w-[1600px] items-center gap-3 px-3 sm:px-5">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => go(back)} />
        {center ?? (
          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">{title}</h1>}
            {subtitle && <p className="truncate text-sm font-semibold text-ink-mute">{subtitle}</p>}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {children}
          <span className="hidden sm:inline-flex">
            <ConnectionPill />
          </span>
          <span className="sm:hidden">
            <ConnectionPill compact />
          </span>
        </div>
      </div>
    </header>
  )
}
