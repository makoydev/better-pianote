import { BEATS, eventBeats } from '../../content/songs/parse'
import type { Song, SongEvent } from '../../content/songs/types'
import { midiOf, parseChord, parseNote } from '../theory'

const EPS = 1e-9

/**
 * Everything that must hold for a song to play and draw correctly. Returns the problems found (empty means
 * the song is fine). Used on every import and by the tests.
 */
export function validateSong(song: Song): string[] {
  const problems: string[] = []
  const say = (s: string) => {
    if (problems.length < 50) problems.push(s)
  }
  if (!song.rh.length) say('The song has no bars.')
  const barLen = (bar: SongEvent[]) => bar.reduce((s, e) => s + eventBeats(e), 0)
  const lens = song.rh.map(barLen)

  const lines = [{ name: 'Right hand', bars: song.rh }]
  if (song.lh) lines.push({ name: 'Left hand', bars: song.lh })
  song.voices?.forEach((v, i) => lines.push({ name: `Extra line ${i + 1} (${v.hand === 'rh' ? 'right' : 'left'} hand)`, bars: v.bars }))

  for (const { name, bars } of lines) {
    if (bars.length !== song.rh.length) {
      say(`${name} has ${bars.length} bars; the right hand has ${song.rh.length}.`)
      continue
    }
    bars.forEach((bar, b) => {
      if (!bar.length) say(`${name}, bar ${b + 1} is empty.`)
      const len = barLen(bar)
      if (Math.abs(len - lens[b]) > EPS) say(`${name}, bar ${b + 1} lasts ${len} beats; the right hand's lasts ${lens[b]}.`)
      bar.forEach((e, i) => checkEvent(e, `${name}, bar ${b + 1}, event ${i + 1}`, say))
    })
    const flat = bars.flat()
    flat.forEach((e, i) => {
      const tied = e.tie ? e.notes : (e.tieNotes ?? [])
      const next = flat[i + 1]
      for (const n of tied) {
        if (!next || next.hidden || !next.notes.includes(n)) say(`${name}: a tie on ${n} doesn't land on the same note.`)
      }
    })
    checkTuplets(
      flat.filter((e) => !e.hidden),
      name,
      say,
    )
  }

  for (const e of lines.flatMap((l) => l.bars.flat())) {
    if (!e.chord) continue
    try {
      parseChord(e.chord)
    } catch {
      say(`Unknown chord symbol "${e.chord}".`)
    }
  }
  let lastBar = 0
  for (const ch of song.changes ?? []) {
    if (ch.bar <= lastBar || ch.bar >= song.rh.length) say(`A key or time change sits at bar ${ch.bar + 1}, out of order or outside the song.`)
    lastBar = ch.bar
    if (ch.keySig !== undefined && !(Number.isInteger(ch.keySig) && Math.abs(ch.keySig) <= 7)) say(`Bad key signature at bar ${ch.bar + 1}.`)
    if (ch.time && !(ch.time[0] > 0 && ch.time[1] > 0)) say(`Bad time signature at bar ${ch.bar + 1}.`)
  }
  if (!(Number.isInteger(song.keySig) && Math.abs(song.keySig) <= 7)) say('Bad key signature.')
  if (!(song.time[0] > 0 && song.time[1] > 0)) say('Bad time signature.')
  if (!(song.bpm >= 20 && song.bpm <= 300)) say('Bad tempo.')
  if (song.pickup !== undefined && lens.length && Math.abs(song.pickup - lens[0]) > EPS) say("The pickup doesn't match the first bar.")
  return problems
}

function checkEvent(e: SongEvent, where: string, say: (s: string) => void) {
  if (!(e.dur in BEATS)) say(`${where}: unknown note value "${e.dur}".`)
  if (![0, 1, 2].includes(e.dots)) say(`${where}: ${e.dots} dots.`)
  if (e.hidden && e.notes.length) say(`${where}: hidden events must be rests.`)
  if (!e.notes.length && (e.tie || e.tieNotes?.length)) say(`${where}: a rest can't be tied.`)
  if (e.tieNotes?.some((n) => !e.notes.includes(n))) say(`${where}: tied notes must be in the chord.`)
  if (new Set(e.notes).size !== e.notes.length) say(`${where}: the same note twice.`)
  for (const n of e.notes) {
    try {
      const m = midiOf(parseNote(n))
      if (m < 36 || m > 96) say(`${where}: ${n} is off the keyboard (C2–C7).`)
    } catch {
      say(`${where}: bad note name "${n}".`)
    }
  }
  if (e.finger !== undefined && !(Number.isInteger(e.finger) && e.finger >= 1 && e.finger <= 5)) say(`${where}: bad finger.`)
  if (e.fingers && e.fingers.length !== e.notes.length) say(`${where}: one finger per note.`)
  if (e.tuplet && !(Number.isInteger(e.tuplet.actual) && Number.isInteger(e.tuplet.normal) && e.tuplet.actual > 0 && e.tuplet.normal > 0)) {
    say(`${where}: bad tuplet.`)
  }
}

/** Tuplet brackets: each group of tuplet notes opens with `start`, closes with `end`, and doesn't mix ratios. */
function checkTuplets(events: SongEvent[], name: string, say: (s: string) => void) {
  let open: SongEvent['tuplet'] | null = null
  for (const e of events) {
    const t = e.tuplet
    if (!t) {
      if (open) say(`${name}: a tuplet bracket isn't closed.`)
      open = null
      continue
    }
    if (t.start) {
      if (open) say(`${name}: a tuplet bracket starts inside another.`)
      open = t
    } else if (!open) {
      say(`${name}: a tuplet note sits outside a bracket.`)
      continue
    } else if (open.actual !== t.actual || open.normal !== t.normal) {
      say(`${name}: a tuplet bracket mixes ratios.`)
    }
    if (t.end) open = null
  }
  if (open) say(`${name}: a tuplet bracket isn't closed.`)
}
