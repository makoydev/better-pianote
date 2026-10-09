import { type ReactNode, Fragment } from 'react'
import { playChord, playNotes } from '../../lib/audio/play'
import { letterColor } from '../../lib/colors'
import { chordSymbol, midiOf, noteName, parseChord, parseNote } from '../../lib/theory'
import { MusicText } from '../MusicText'

/**
 * Lesson text with a tiny markup:
 *   **bold**   *emphasis*   [[C4]] a note chip (tap to hear)   {{Am7}} a chord chip (tap to hear)
 *   blank line = new paragraph, "- " = bullet point.
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
        return <p key={i}>{inline(lines.join(' '))}</p>
      })}
    </div>
  )
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\]|\{\{[^}]+\}\})/g

function inline(s: string): ReactNode {
  return s.split(TOKEN).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} className="font-extrabold text-ink">{inline(part.slice(2, -2))}</strong>
    if (part.startsWith('[[')) return <NoteChip key={i} note={part.slice(2, -2)} />
    if (part.startsWith('{{')) return <ChordChip key={i} symbol={part.slice(2, -2)} />
    if (part.startsWith('*') && part.length > 2) return <em key={i} className="text-gold not-italic font-bold">{part.slice(1, -1)}</em>
    return /[♯♭♮]/.test(part) ? <MusicText key={i} text={part} /> : <Fragment key={i}>{part}</Fragment>
  })
}

export function NoteChip({ note, showOctave }: { note: string; showOctave?: boolean }) {
  let n
  try {
    n = parseNote(note)
  } catch {
    return <span>{note}</span>
  }
  const hasOct = /\d/.test(note)
  const color = letterColor(n.letter)
  return (
    <button
      type="button"
      onClick={() => playNotes([midiOf(n)], { dur: 1.2 })}
      className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-lg border px-1.5 align-baseline text-[0.95em] font-extrabold leading-snug transition-transform hover:scale-105"
      style={{ color, borderColor: `${color}66`, background: `${color}1f` }}
      title="Tap to hear"
    >
      <MusicText text={noteName(n, { octave: showOctave ?? hasOct })} />
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
