import { Music } from 'lucide-react'
import { ICONS, type IconName } from './icons'

export type { IconName }

export function Icon({ name, size = 24, className = '', strokeWidth = 2.3 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Music
  return <C size={size} className={className} strokeWidth={strokeWidth} />
}
