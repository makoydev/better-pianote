import { CircleDot, Guitar, Lock, LockOpen, type LucideIcon } from 'lucide-react'
import { MusicText } from '../../components/MusicText'
import { type Key, type KeyFound, keyName } from '../../lib/theory'

/** An on/off pill: icon always, its word when there's room. */
function Switch({ icon: Icon, label, title, on, disabled, onClick }: { icon: LucideIcon; label: string; title: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition-colors disabled:opacity-40 ${
        on ? 'bg-teal/20 text-teal' : 'bg-white/6 text-ink-mute hover:bg-white/10 hover:text-ink'
      }`}
    >
      <Icon size={17} />
      <span className="hidden min-[1150px]:inline">{label}</span>
    </button>
  )
}

/**
 * The key Free Play hears (with a close second, "A major · or F♯ minor") and a one-tap lock, so numerals stay put
 * while you play. Then switches for the key's notes on the keyboard and guitar shapes.
 */
export function KeyBar({
  choice,
  found,
  keyOf,
  onLock,
  onAuto,
  showKey,
  onShowKey,
  guitar,
  onGuitar,
}: {
  /** The key setting: 'auto', 'none' or a locked key's id. */
  choice: string
  found: KeyFound | null
  keyOf: Key | null
  onLock: (k: Key) => void
  onAuto: () => void
  showKey: boolean
  onShowKey: (v: boolean) => void
  guitar: boolean
  onGuitar: (v: boolean) => void
}) {
  const locked = choice !== 'auto' && choice !== 'none'
  let pill
  if (choice === 'none') {
    pill = (
      <button type="button" onClick={onAuto} className="min-h-11 rounded-full bg-white/6 px-4 text-sm font-extrabold text-ink-mute hover:bg-white/10 hover:text-ink">
        No key · <span className="underline decoration-dotted underline-offset-4">find it</span>
      </button>
    )
  } else if (keyOf) {
    const alt = !locked ? found?.alt : null
    pill = (
      <div className="flex min-h-11 items-center gap-1 rounded-full bg-violet/15 pl-4 pr-1 text-sm font-extrabold text-[#c9c0ff]">
        <MusicText text={keyName(keyOf)} />
        {alt && (
          <button
            type="button"
            onClick={() => onLock(alt)}
            title={`Lock ${keyName(alt)} instead`}
            aria-label={`Or ${keyName(alt)}: lock that key instead`}
            className="min-h-11 px-1 font-bold text-ink-mute underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            · or <MusicText text={keyName(alt)} />
          </button>
        )}
        <button
          type="button"
          aria-pressed={locked}
          onClick={() => (locked ? onAuto() : onLock(keyOf))}
          title={locked ? 'Locked: tap to find the key from what you play again' : `Lock ${keyName(keyOf)} so the numerals stay put`}
          className={`ml-1 flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors ${locked ? 'bg-violet text-night-900' : 'bg-white/8 text-ink-soft hover:bg-white/14 hover:text-ink'}`}
        >
          {locked ? <Lock size={16} /> : <LockOpen size={16} />}
          {locked ? 'Locked' : 'Lock'}
        </button>
      </div>
    )
  } else {
    pill = <span className="flex min-h-11 items-center rounded-full bg-white/6 px-4 text-sm font-extrabold text-ink-mute">Key: listening…</span>
  }
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2">
      {pill}
      <span className="flex-1" />
      <Switch
        icon={CircleDot}
        label="Show key"
        title={keyOf ? `Show the notes of ${keyName(keyOf)} on the keyboard` : 'Show the key’s notes on the keyboard (once there’s a key)'}
        on={showKey && !!keyOf}
        disabled={!keyOf}
        onClick={() => onShowKey(!showKey)}
      />
      <Switch icon={Guitar} label="Guitar" title="Show each chord’s guitar shape" on={guitar} onClick={() => onGuitar(!guitar)} />
    </div>
  )
}
