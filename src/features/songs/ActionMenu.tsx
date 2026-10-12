import { type LucideIcon, MoreHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/ui/Button'

export interface MenuItem {
  label: string
  icon: LucideIcon
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

const ITEMS = '[role="menuitem"]:not([disabled])'

/**
 * A "⋯" button that opens a short list of actions under it. Arrow keys move through the list, Escape or a tap
 * outside closes it.
 */
export function ActionMenu({ label, items, className = '' }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  /** Stays on until the menu has faded out, so it isn't drawn under the cards below while it closes. */
  const [raised, setRaised] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // The items vanish with the menu: focus goes back to the ⋯ button, so Tab and closing sheets carry on from there.
  const focusButton = () => root.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus({ preventScroll: true })

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>(ITEMS)?.focus({ preventScroll: true })
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const keys = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault()
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      focusButton()
      setOpen(false)
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', keys)
    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', keys)
    }
  }, [open])

  const move = (e: KeyboardEvent) => {
    const list = [...(root.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])]
    const at = list.indexOf(document.activeElement as HTMLElement)
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key]
    if (to === undefined || !list.length) return
    e.preventDefault()
    list[(to + list.length) % list.length].focus()
  }

  return (
    <div ref={root} className={className}>
      {/* Above the cards that come after it while open. */}
      <div className={`relative ${open || raised ? 'z-30' : ''}`}>
        <IconButton
          icon={MoreHorizontal}
          label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setRaised(true)
            setOpen((o) => !o)
          }}
        />
        <AnimatePresence onExitComplete={() => setRaised(false)}>
          {open && (
            <motion.div
              role="menu"
              aria-label={label}
              onKeyDown={move}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl border border-white/10 bg-night-800 p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,.8)]"
            >
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => {
                    // First, so a sheet this opens gives focus back to the ⋯ button when it closes.
                    focusButton()
                    setOpen(false)
                    it.onSelect()
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-extrabold outline-none transition-colors hover:bg-white/6 focus-visible:bg-white/8 disabled:opacity-40 ${
                    it.danger ? 'text-coral' : 'text-ink'
                  }`}
                >
                  <it.icon size={20} strokeWidth={2.4} className="shrink-0" />
                  {it.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
