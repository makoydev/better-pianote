import { Guitar, Info, Lightbulb } from 'lucide-react'
import { RichText } from './RichText'

const STYLES = {
  tip: { icon: Lightbulb, title: 'Tip', color: '#ffc857' },
  guitar: { icon: Guitar, title: 'Guitar brain', color: '#3ee6c8' },
  info: { icon: Info, title: 'Good to know', color: '#9b8cff' },
} as const

/** A side note in lessons. "guitar" callouts connect piano ideas to what you know from guitar. */
export function Callout({ kind, text, title }: { kind: keyof typeof STYLES; text: string; title?: string }) {
  const s = STYLES[kind]
  const I = s.icon
  return (
    <div className="flex gap-3 rounded-2xl border p-4 text-ink-soft" style={{ borderColor: `${s.color}44`, background: `${s.color}12` }}>
      <span className="mt-0.5 shrink-0" style={{ color: s.color }}>
        <I size={22} strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        <div className="mb-0.5 text-sm font-extrabold uppercase tracking-wider" style={{ color: s.color }}>
          {title ?? s.title}
        </div>
        <RichText text={text} className="text-base leading-relaxed" />
      </div>
    </div>
  )
}
