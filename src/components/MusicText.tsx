import { Fragment } from 'react'
import { ACC_RE, splitMusic } from '../lib/musicText'

/**
 * Text with proper sharps and flats. Our text fonts don't have ♯ ♭ glyphs, so accidentals are drawn
 * with Bravura's chord-symbol accidentals, which are designed to sit next to letters.
 */

export function MusicText({ text, className }: { text: string; className?: string }) {
  if (!ACC_RE.test(text)) return <span className={className}>{text}</span>
  return (
    <span className={className}>
      {splitMusic(text).map((part, i) =>
        part.acc ? (
          <span
            key={i}
            aria-hidden
            style={{ fontFamily: 'Bravura', fontSize: '0.86em', lineHeight: 0, margin: '0 0.03em 0 0.02em', fontWeight: 400 }}
          >
            {part.s}
          </span>
        ) : (
          <Fragment key={i}>{part.s}</Fragment>
        ),
      )}
      <span className="sr-only">{text.replace(/♯/g, ' sharp').replace(/♭/g, ' flat')}</span>
    </span>
  )
}

/** The same thing as <tspan>s, for SVG text. */
export function SvgMusicText({ text }: { text: string }) {
  if (!ACC_RE.test(text)) return <>{text}</>
  return (
    <>
      {splitMusic(text).map((part, i) =>
        part.acc ? (
          <tspan key={i} fontFamily="Bravura" fontSize="0.86em" fontWeight={400} dx="0.02em">
            {part.s}
          </tspan>
        ) : (
          <tspan key={i} dx={i > 0 ? '0.03em' : undefined}>
            {part.s}
          </tspan>
        ),
      )}
    </>
  )
}
