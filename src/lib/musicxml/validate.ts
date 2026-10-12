import { BEATS, eventBeats } from '../../content/songs/parse'
import type { Song, SongEvent } from '../../content/songs/types'
import { midiOf, parseChord, parseNote } from '../theory'

const EPS = 1e-9

/** One thing wrong with a song: what, where, and what usually fixes it. */
export interface SongProblem {
  /** The bar it's in (from 0, in playing order), when it's about one bar. */
  bar?: number
  /** The line it's in: "Right hand", "Left hand", "Left hand, voice 2". */
  line?: string
  text: string
  /** A plain suggestion for someone fixing the score in a notation app. */
  fix: string
}

const FIX = {
  length: 'Look for a missing rest, an extra note or a wrong triplet in this bar. Fix it in your notation app, then export again.',
  tie: 'Delete that tie, or tie it again so it joins two notes of the same pitch in the same voice, then export again.',
  tuplet: 'Write the triplets (or other tuplets) in this bar again so each group is complete, then export again.',
  note: 'Check this bar for unusual notes (hidden, doubled or very short ones). Fix them and export again.',
  finger: 'Check the fingering numbers in this bar: one per note, 1 to 5.',
  chord: 'Retype or delete that chord symbol, then export again.',
  signature: 'Check the key and time signatures here, then export again.',
  song: 'Export the score from your notation app again. If that doesn’t help, try another part of the score.',
}

const QUARTERS: Record<number, string | undefined> = { 0: '', 250: '¼', 500: '½', 750: '¾' }

/** 3.5 → "3½", for bar lengths in quarter-note beats. */
export function beatsText(n: number): string {
  const whole = Math.floor(n + EPS)
  const part = QUARTERS[Math.round((n - whole) * 1000)]
  if (part === undefined) return String(Math.round(n * 100) / 100)
  return whole || !part ? `${whole}${part}` : part
}

/**
 * Everything that must hold for a song to play and draw correctly. Returns the problems found (empty means
 * the song is fine). Used on every import and by the tests.
 */
export function validateSong(song: Song): string[] {
  return songProblems(song).map((p) => {
    const where = [p.line, p.bar !== undefined && `bar ${p.bar + 1}`].filter(Boolean).join(', ')
    return where ? `${where}: ${p.text}` : p.text
  })
}

/** The same checks, with each problem's bar and a suggested fix (shown when an import fails). */
export function songProblems(song: Song): SongProblem[] {
  const problems: SongProblem[] = []
  const say = (text: string, fix: string, at: { bar?: number; line?: string } = {}) => {
    if (problems.length < 50) problems.push({ ...at, text, fix })
  }
  if (!song.rh.length) say('The song has no bars.', FIX.song)
  const barLen = (bar: SongEvent[]) => bar.reduce((s, e) => s + eventBeats(e), 0)
  const lens = song.rh.map(barLen)

  const lines = [{ name: 'Right hand', bars: song.rh }]
  if (song.lh) lines.push({ name: 'Left hand', bars: song.lh })
  const extra = { rh: 1, lh: 1 }
  song.voices?.forEach((v) => lines.push({ name: `${v.hand === 'rh' ? 'Right' : 'Left'} hand, voice ${++extra[v.hand]}`, bars: v.bars }))

  for (const { name, bars } of lines) {
    if (bars.length !== song.rh.length) {
      say(`It has ${bars.length} bars; the right hand has ${song.rh.length}.`, FIX.song, { line: name })
      continue
    }
    bars.forEach((bar, b) => {
      const at = { bar: b, line: name }
      if (!bar.length) say('This bar is empty (not even a rest).', FIX.length, at)
      const len = barLen(bar)
      if (Math.abs(len - lens[b]) > EPS) say(`This bar lasts ${beatsText(len)} beats; the right hand’s lasts ${beatsText(lens[b])}.`, FIX.length, at)
      for (const e of bar) checkEvent(e, (text, fix) => say(text, fix, at))
    })
    const flat = bars.flatMap((bar, b) => bar.map((e) => ({ e, b })))
    flat.forEach(({ e, b }, i) => {
      const tied = e.tie ? e.notes : (e.tieNotes ?? [])
      const next = flat[i + 1]?.e
      for (const n of tied) {
        if (!next || next.hidden || !next.notes.includes(n)) say(`A tie on ${n} doesn’t land on the same note.`, FIX.tie, { bar: b, line: name })
      }
    })
    checkTuplets(
      flat.filter(({ e }) => !e.hidden),
      (text, b) => say(text, FIX.tuplet, { bar: b, line: name }),
    )
  }

  for (const { name, bars } of lines) {
    bars.forEach((bar, b) => {
      for (const e of bar) {
        if (!e.chord) continue
        try {
          parseChord(e.chord)
        } catch {
          say(`Unknown chord symbol “${e.chord}”.`, FIX.chord, { bar: b, line: name })
        }
      }
    })
  }
  let lastBar = 0
  for (const ch of song.changes ?? []) {
    const at = { bar: ch.bar }
    if (ch.bar <= lastBar || ch.bar >= song.rh.length) say('A key or time change is out of order or outside the song.', FIX.signature, at)
    lastBar = ch.bar
    if (ch.keySig !== undefined && !(Number.isInteger(ch.keySig) && Math.abs(ch.keySig) <= 7)) say('Bad key signature.', FIX.signature, at)
    if (ch.time && !(ch.time[0] > 0 && ch.time[1] > 0)) say('Bad time signature.', FIX.signature, at)
  }
  if (!(Number.isInteger(song.keySig) && Math.abs(song.keySig) <= 7)) say('Bad key signature.', FIX.signature, { bar: 0 })
  if (!(song.time[0] > 0 && song.time[1] > 0)) say('Bad time signature.', FIX.signature, { bar: 0 })
  if (!(song.bpm >= 20 && song.bpm <= 300)) say('Bad tempo.', 'Set a tempo between 20 and 300 at the start of the score, then export again.')
  if (song.pickup !== undefined && lens.length && Math.abs(song.pickup - lens[0]) > EPS) {
    say('The pickup doesn’t match the first bar.', FIX.length, { bar: 0 })
  }
  return problems
}

function checkEvent(e: SongEvent, say: (text: string, fix: string) => void) {
  if (!(e.dur in BEATS)) say(`A note value the app can’t show (“${e.dur}”).`, FIX.note)
  if (![0, 1, 2].includes(e.dots)) say(`A note with ${e.dots} dots.`, FIX.note)
  if (e.hidden && e.notes.length) say('Hidden events must be rests.', FIX.note)
  if (!e.notes.length && (e.tie || e.tieNotes?.length)) say('A rest can’t be tied.', FIX.tie)
  if (e.tieNotes?.some((n) => !e.notes.includes(n))) say('Tied notes must be in the chord.', FIX.tie)
  const twice = e.notes.find((n, i) => e.notes.indexOf(n) !== i)
  if (twice) say(`The same note (${twice}) twice in one chord.`, FIX.note)
  for (const n of e.notes) {
    try {
      const m = midiOf(parseNote(n))
      if (m < 36 || m > 96) say(`${n} is off the keyboard (C2–C7).`, FIX.note)
    } catch {
      say(`Bad note name “${n}”.`, FIX.note)
    }
  }
  if (e.finger !== undefined && !(Number.isInteger(e.finger) && e.finger >= 1 && e.finger <= 5)) say('A finger number that isn’t 1 to 5.', FIX.finger)
  if (e.fingers && e.fingers.length !== e.notes.length) say('A chord needs one finger number per note.', FIX.finger)
  if (e.tuplet && !(Number.isInteger(e.tuplet.actual) && Number.isInteger(e.tuplet.normal) && e.tuplet.actual > 0 && e.tuplet.normal > 0)) {
    say('A tuplet the app can’t read.', FIX.tuplet)
  }
}

/** Tuplet brackets: each group of tuplet notes opens with `start`, closes with `end`, and doesn't mix ratios. */
function checkTuplets(events: { e: SongEvent; b: number }[], say: (text: string, bar: number) => void) {
  let open: SongEvent['tuplet'] | null = null
  let openBar = 0
  for (const { e, b } of events) {
    const t = e.tuplet
    if (!t) {
      if (open) say('A tuplet bracket isn’t closed.', openBar)
      open = null
      continue
    }
    if (t.start) {
      if (open) say('A tuplet bracket starts inside another.', b)
      open = t
      openBar = b
    } else if (!open) {
      say('A tuplet note sits outside a bracket.', b)
      continue
    } else if (open.actual !== t.actual || open.normal !== t.normal) {
      say('A tuplet bracket mixes ratios.', b)
    }
    if (t.end) open = null
  }
  if (open) say('A tuplet bracket isn’t closed.', openBar)
}
