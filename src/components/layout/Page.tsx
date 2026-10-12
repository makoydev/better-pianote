import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { go, usePath } from '../../router'
import { IconButton } from '../ui/Button'
import { ConnectionPill } from './ConnectionPill'
import { MetronomeMini } from '../../features/explore/MetronomeMini'

/** Standard page for the main tabs: big title, optional subtitle, content. */
export function Page({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const path = usePath()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-6 md:pb-12 md:pt-[calc(env(safe-area-inset-top)+2rem)] lg:px-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <MetronomeMini />
          <ConnectionPill />
          {/* No sidebar below 768px (phones, iPad Split View), so Settings lives here. */}
          {path !== '/settings' && <IconButton icon={Settings} label="Settings" onClick={() => go('/settings')} className="md:hidden" />}
        </div>
      </header>
      {children}
    </div>
  )
}
