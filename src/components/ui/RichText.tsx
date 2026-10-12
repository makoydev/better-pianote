import { type ReactNode, Fragment } from 'react'
import { playChord, playNotes } from '../../lib/audio/play'
import { letterColor } from '../../lib/colors'
import { nameNote } from '../../lib/naming'
import { chordSymbol, midiOf, parseChord, parseNote } from '../../lib/theory'
import { go } from '../../router'
import { useSettings } from '../../state/settings'
import { MusicText } from '../MusicText'

/**
 * Lesson text with a tiny markup:
 *   **bold**   *emphasis*   [[C4]] a note chip (tap to hear)   {{Am7}} a chord chip (tap to hear)
 *   [Note Rush](/practice/note-rush) a link to another screen
 *   blank line = new paragraph, "- " = bullet point, "1. " = numbered step.
 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{inline(l.trim().slice(2))}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (lines.every((l) => NUMBERED.test(l.trim()))) {
          return (
            <ol key={i} className="space-y-1.5">
              {lines.map((l, j) => {
                const [, n, rest] = NUMBERED.exec(l.trim())!
                return (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-[0.15em] flex size-[1.4em] shrink-0 items-center justify-center rounded-full bg-gold/15 text-[0.8em] font-extrabold text-gold">{n}</span>
                    <span>{inline(rest)}</span>
                  </li>
                )
              })}
            </ol>
          )
        }
        return <p key={i}>{inline(lines.join(' '))}</p>
      })}
    </div>
  )
}

const NUMBERED = /^(\d+)\.\s+(.*)$/
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\]|\{\{[^}]+\}\}|\[[^\]]+\]\([^)]+\))/g
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/

function inline(s: string): ReactNode {
  return s.split(TOKEN).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} className="font-extrabold text-ink">{inline(part.slice(2, -2))}</strong>
    if (part.startsWith('[[')) return <NoteChip key={i} note={part.slice(2, -2)} />
    if (part.startsWith('{{')) return <ChordChip key={i} symbol={part.slice(2, -2)} />
    const link = LINK.exec(part)
    if (link) {
      return (
        <button key={i} type="button" onClick={() => go(link[2])} className="font-extrabold text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold">
          {inline(link[1])}
        </button>
      )
    }
    if (part.startsWith('*') && part.length > 2) return <em key={i} className="text-gold not-italic font-bold">{part.slice(1, -1)}</em>
    return /[♯♭♮]/.test(part) ? <MusicText key={i} text={part} /> : <Fragment key={i}>{part}</Fragment>
  })
}

export function NoteChip({ note, showOctave }: { note: string; showOctave?: boolean }) {
  const naming = useSettings((s) => s.naming)
  let n
  try {
    n = parseNote(note)
  } catch {
    return <span>{note}</span>
  }
  const hasOct = /\d/.test(note)
  const color = letterColor(n.letter)
  const label = nameNote(n, naming, { octave: showOctave ?? hasOct })
  return (
    <button
      type="button"
      onClick={() => playNotes([midiOf(n)], { dur: 1.2 })}
      className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-lg border px-1.5 align-baseline text-[0.95em] font-extrabold leading-snug transition-transform hover:scale-105"
      style={{ color, borderColor: `${color}66`, background: `${color}1f` }}
      title="Tap to hear"
    >
      <MusicText text={label} />
    </button>
  )
}

export function ChordChip({ symbol }: { symbol: string }) {
  let label = symbol
  let play = () => {}
  try {
    const c = parseChord(symbol)
    label = chordSymbol(c)
    play = () => void playChord(c)
  } catch {
    /* plain text if it doesn't parse */
  }
  return (
    <button
      type="button"
      onClick={play}
      className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-lg border border-violet/40 bg-violet/15 px-1.5 align-baseline font-display text-[0.95em] font-bold leading-snug text-[#c9c0ff] transition-transform hover:scale-105"
      title="Tap to hear"
    >
      <MusicText text={label} />
    </button>
  )
}
