import type { ReactNode } from 'react'
import { ConnectionPill } from './ConnectionPill'

/** Standard page for the main tabs: big title, optional subtitle, content. */
export function Page({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-8 lg:px-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <ConnectionPill />
        </div>
      </header>
      {children}
    </div>
  )
}
