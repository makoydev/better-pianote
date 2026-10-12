import type { Step } from '../../content/types'

/** Lesson markup as plain text: [[C4]] and {{Am}} chips keep their name, links their text, ** and * go. */
export function plainText(markup: string): string {
  return markup
    .replace(/\[\[([^\]]+)\]\]|\{\{([^}]+)\}\}/g, (_, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*+/g, '')
    .trim()
}

/** A step's heading as plain text, shortened for lists (the slips on the complete screen, the review strip). */
export function stepLabel(s: Step): string {
  const raw = s.kind === 'quiz' ? s.question : s.kind === 'play' ? (s.title ?? s.prompt) : s.title
  const text = plainText(raw)
  return text.length > 70 ? `${text.slice(0, 68)}…` : text
}
