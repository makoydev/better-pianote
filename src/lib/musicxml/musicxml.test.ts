// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { eventBeats } from '../../content/songs/parse'
import type { Song, SongEvent } from '../../content/songs/types'
import { ImportError, importMusicXml, importScoreFile, validateSong } from './index'
import {
  CONTAINER,
  DIV,
  attrs,
  backup,
  barline,
  direction,
  forward,
  harmony,
  implicit,
  makeZip,
  measure,
  n,
  r,
  score,
  start,
} from './testkit'

/** Import, and insist the result is a valid song. */
function imp(xml: string, opts?: { partIndex?: number }) {
  const res = importMusicXml(xml, 'test.musicxml', opts)
  expect(validateSong(res.song)).toEqual([])
  return res
}
const one = (...measures: string[]) => score([{ measures }])
/** "C4+E4 r D4", with "_" for a hidden rest. */
const names = (bar: SongEvent[]) => bar.map((e) => (e.notes.length ? e.notes.join('+') : e.hidden ? '_' : 'r')).join(' ')
const durs = (bar: SongEvent[]) => bar.map((e) => e.dur + '.'.repeat(e.dots)).join(' ')
const beats = (bar: SongEvent[]) => bar.reduce((s, e) => s + eventBeats(e), 0)
const extra = (song: Song, hand: 'rh' | 'lh', i = 0) => song.voices!.filter((v) => v.hand === hand)[i].bars

describe('notes, chords and rests', () => {
  it('reads one staff into the right hand', () => {
    const { song, stats } = imp(
      one(measure(1, start(), n('C4', 'quarter'), n('E4', 'quarter', { chord: true }), n('G4', 'quarter', { chord: true }), r('quarter'), n('D4', 'half'))),
    )
    expect(names(song.rh[0])).toBe('C4+E4+G4 r D4')
    expect(durs(song.rh[0])).toBe('q q h')
    expect(song.lh).toBeUndefined()
    expect(song.voices).toBeUndefined()
    expect(song.keyName).toBe('C major')
    expect(song.time).toEqual([4, 4])
    expect(stats).toEqual({ bars: 1, rhNotes: 4, lhNotes: 0, voices: 1 })
  })

  it('spells accidentals as written', () => {
    const { song } = imp(one(measure(1, start(), n('F#4', 'quarter'), n('Bb4', 'quarter'), n('C##5', 'quarter'), n('Dbb5', 'quarter'))))
    expect(names(song.rh[0])).toBe('F#4 Bb4 C##5 Dbb5')
  })

  it('puts the two staves in the two hands', () => {
    const { song, stats } = imp(
      one(
        measure(
          1,
          start({ staves: 2 }),
          n('E5', 'half', { staff: 1 }),
          n('C5', 'half', { staff: 1 }),
          backup(4 * DIV),
          n('C3', 'whole', { staff: 2, voice: 5 }),
          n('G3', 'whole', { staff: 2, voice: 5, chord: true }),
        ),
      ),
    )
    expect(names(song.rh[0])).toBe('E5 C5')
    expect(names(song.lh![0])).toBe('C3+G3')
    expect(durs(song.lh![0])).toBe('w')
    expect(stats.lhNotes).toBe(2)
  })

  it('reads dotted and double-dotted notes', () => {
    const { song } = imp(
      one(
        measure(1, start(), n('C4', 'half', { dots: 2 }), n('D4', 'eighth')),
        measure(2, n('E4', 'quarter', { dots: 1 }), n('F4', 'eighth'), n('G4', 'half')),
      ),
    )
    expect(durs(song.rh[0])).toBe('h.. 8')
    expect(durs(song.rh[1])).toBe('q. 8 h')
  })

  it('follows divisions that change mid-piece', () => {
    const { song } = imp(
      one(
        measure(1, attrs({ div: 1, fifths: 0, time: [4, 4] }), n('C4', 'quarter', { div: 1 }), n('D4', 'quarter', { div: 1 }), n('E4', 'half', { div: 1 })),
        measure(
          2,
          attrs({ div: 3 }),
          ...['C4', 'D4', 'E4'].map((p) => n(p, 'eighth', { div: 3, tm: [3, 2] })),
          n('F4', 'quarter', { div: 3 }),
          n('G4', 'half', { div: 3 }),
        ),
      ),
    )
    expect(beats(song.rh[0])).toBe(4)
    expect(beats(song.rh[1])).toBeCloseTo(4)
    expect(durs(song.rh[1])).toBe('8 8 8 q h')
  })

  it('works out values from durations when <type> is missing', () => {
    const { song } = imp(one(measure(1, start(), n('C4', 'half', { dots: 1, noType: true }), n('D4', 'quarter', { noType: true }))))
    expect(durs(song.rh[0])).toBe('h. q')
  })

  it('splits values too long to draw into tied notes', () => {
    const { song } = imp(one(measure(1, start({ time: [4, 2] }), n('C4', 'breve'))))
    expect(durs(song.rh[0])).toBe('w w')
    expect(song.rh[0][0].tie).toBe(true)
  })

  it('fills a whole-measure rest with the right value for the time signature', () => {
    const { song } = imp(one(measure(1, start({ time: [3, 4] }), r('whole', { measureRest: true, noType: true, dur: 3 * DIV })), measure(2, n('C4', 'half', { dots: 1 }))))
    expect(names(song.rh[0])).toBe('r')
    expect(durs(song.rh[0])).toBe('h.')
  })
})

describe('voices and hands', () => {
  const twoVoices = (bar2: string[] = [n('E5', 'whole')]) =>
    one(
      measure(1, start(), ...['E5', 'D5', 'C5', 'D5'].map((p) => n(p, 'quarter')), backup(4 * DIV), n('C4', 'half', { voice: 2 }), n('G3', 'half', { voice: 2 })),
      measure(2, ...bar2),
    )

  it('keeps a second voice on a staff as its own line', () => {
    const { song, stats } = imp(twoVoices())
    expect(names(song.rh[0])).toBe('E5 D5 C5 D5')
    expect(names(extra(song, 'rh')[0])).toBe('C4 G3')
    // Where the second voice has nothing, it disappears.
    expect(names(extra(song, 'rh')[1])).toBe('_')
    expect(stats.voices).toBe(2)
  })

  it('picks the busier voice as the main line', () => {
    const { song } = imp(
      one(measure(1, start(), n('C5', 'whole'), backup(4 * DIV), ...['C4', 'D4', 'E4', 'F4'].map((p) => n(p, 'quarter', { voice: 2 })))),
    )
    expect(names(song.rh[0])).toBe('C4 D4 E4 F4')
    expect(names(extra(song, 'rh')[0])).toBe('C5')
  })

  it('fills gaps in a voice with hidden rests', () => {
    const { song } = imp(one(measure(1, start(), ...['C5', 'D5', 'E5', 'F5'].map((p) => n(p, 'quarter')), backup(4 * DIV), forward(2 * DIV, 2), n('C4', 'half', { voice: 2 }))))
    expect(names(extra(song, 'rh')[0])).toBe('_ C4')
  })

  it('hides the main line’s rest in a bar where only another voice plays', () => {
    const { song } = imp(
      one(
        measure(1, start(), ...['C5', 'D5', 'E5', 'F5'].map((p) => n(p, 'quarter')), backup(4 * DIV), n('C4', 'whole', { voice: 2 })),
        measure(2, n('G4', 'whole', { voice: 2 })),
      ),
    )
    expect(names(song.rh[1])).toBe('_')
    expect(names(extra(song, 'rh')[1])).toBe('G4')
  })

  it('shows a rest when nothing at all is written in a bar', () => {
    const { song } = imp(one(measure(1, start(), n('C4', 'whole')), measure(2)))
    expect(names(song.rh[1])).toBe('r')
    expect(durs(song.rh[1])).toBe('w')
  })

  it('sends a cross-staff note to the hand of its staff', () => {
    const { song } = imp(
      one(
        measure(1, start({ staves: 2 }), n('C5', 'half', { staff: 1 }), n('C3', 'half', { staff: 2 }), backup(4 * DIV), ...['C2', 'G2', 'C3', 'G2'].map((p) => n(p, 'quarter', { staff: 2, voice: 5 }))),
      ),
    )
    expect(names(song.rh[0])).toBe('C5 _')
    expect(names(song.lh![0])).toBe('C2 G2 C3 G2')
    expect(names(extra(song, 'lh')[0])).toBe('_ C3')
  })

  it('trims notes that run into the next one in the same voice', () => {
    const res = imp(one(measure(1, start(), n('C4', 'half'), backup(DIV), n('D4', 'quarter'), n('E4', 'half'))))
    expect(names(res.song.rh[0])).toBe('C4 D4 E4')
    expect(durs(res.song.rh[0])).toBe('q q h')
    expect(res.warnings.join(' ')).toMatch(/Shortened 1 note/)
  })
})

describe('ties', () => {
  it('ties a whole chord across the bar line', () => {
    const { song, stats } = imp(
      one(
        measure(1, start(), n('C4', 'half'), n('C4', 'half', { tie: 'start' }), n('E4', 'half', { tie: 'start', chord: true })),
        measure(2, n('C4', 'half', { tie: 'stop' }), n('E4', 'half', { tie: 'stop', chord: true }), r('half')),
      ),
    )
    expect(song.rh[0][1].tie).toBe(true)
    expect(song.rh[0][1].tieNotes).toBeUndefined()
    expect(stats.rhNotes).toBe(3)
  })

  it('ties single notes of a chord', () => {
    const { song } = imp(
      one(
        measure(
          1,
          start(),
          n('C4', 'half'),
          n('E4', 'half', { chord: true, tie: 'start' }),
          n('D4', 'half'),
          n('E4', 'half', { chord: true, tie: 'stop' }),
        ),
      ),
    )
    expect(song.rh[0][0].tie).toBe(false)
    expect(song.rh[0][0].tieNotes).toEqual(['E4'])
  })

  it('drops a tie with nothing to land on', () => {
    const { song } = imp(one(measure(1, start(), n('C4', 'half', { tie: 'start' }), n('D4', 'half'))))
    expect(song.rh[0][0].tie).toBe(false)
    expect(song.rh[0][0].tieNotes).toBeUndefined()
  })
})

describe('tuplets', () => {
  const trip = (p: string, o: Parameters<typeof n>[2] = {}) => n(p, 'eighth', { tm: [3, 2], ...o })

  it('uses the score’s bracket marks', () => {
    const { song } = imp(one(measure(1, start(), trip('C4', { tuplet: 'start' }), trip('D4'), trip('E4', { tuplet: 'stop' }), n('F4', 'quarter'), n('G4', 'half'))))
    const [a, b, c] = song.rh[0]
    expect(a.tuplet).toEqual({ actual: 3, normal: 2, start: true })
    expect(b.tuplet).toEqual({ actual: 3, normal: 2 })
    expect(c.tuplet).toEqual({ actual: 3, normal: 2, end: true })
    expect(beats(song.rh[0])).toBeCloseTo(4)
  })

  it('works out brackets by time when the score doesn’t mark them', () => {
    const { song } = imp(one(measure(1, start(), ...['C4', 'D4', 'E4', 'F4', 'G4', 'A4'].map((p) => trip(p)), n('B4', 'half'))))
    const marks = song.rh[0].map((e) => (e.tuplet?.start ? '[' : '') + (e.tuplet ? '3' : '-') + (e.tuplet?.end ? ']' : ''))
    expect(marks.join(' ')).toBe('[3 3 3] [3 3 3] -')
  })

  it('groups mixed values in a triplet by its unit', () => {
    const { song } = imp(
      one(measure(1, start(), n('C4', 'quarter', { tm: [3, 2, 'eighth'] }), trip('D4'), n('E4', 'quarter', { tm: [3, 2, 'eighth'] }), trip('F4'), n('G4', 'half'))),
    )
    const marks = song.rh[0].map((e) => (e.tuplet?.start ? '[' : '') + (e.tuplet ? '3' : '-') + (e.tuplet?.end ? ']' : ''))
    expect(marks.join(' ')).toBe('[3 3] [3 3] -')
  })
})

describe('bars, repeats and jumps', () => {
  it('starts with a pickup', () => {
    const { song } = imp(one(implicit(0, start({ time: [3, 4] }), n('G4', 'quarter')), measure(1, n('C5', 'half', { dots: 1 }))))
    expect(song.pickup).toBe(1)
    expect(song.rh.length).toBe(2)
  })

  it('writes out repeats and first/second endings', () => {
    const res = imp(
      one(
        measure(1, start(), barline('left', { repeat: 'forward' }), n('C4', 'whole')),
        measure(2, n('D4', 'whole')),
        measure(3, barline('left', { ending: ['1', 'start'] }), n('E4', 'whole'), barline('right', { ending: ['1', 'stop'], repeat: 'backward' })),
        measure(4, barline('left', { ending: ['2', 'start'] }), n('F4', 'whole'), barline('right', { ending: ['2', 'discontinue'] })),
        measure(5, n('G4', 'whole')),
      ),
    )
    expect(res.song.rh.map(names).join(' ')).toBe('C4 D4 E4 C4 D4 F4 G4')
    expect(res.warnings.join(' ')).toMatch(/5 bars play as 7/)
  })

  it('follows D.S. al Coda', () => {
    const { song } = imp(
      one(
        measure(1, start(), n('C4', 'whole')),
        measure(2, direction({ segno: true, sound: { segno: 'segno' } }), n('D4', 'whole')),
        measure(3, n('E4', 'whole'), direction({ words: 'To Coda', sound: { tocoda: 'coda' } })),
        measure(4, n('F4', 'whole'), direction({ words: 'D.S. al Coda', sound: { dalsegno: 'segno' } })),
        measure(5, direction({ coda: true, sound: { coda: 'coda' } }), n('G4', 'whole')),
      ),
    )
    expect(song.rh.map(names).join(' ')).toBe('C4 D4 E4 F4 D4 E4 G4')
  })

  it('follows D.C. al Fine', () => {
    const { song } = imp(
      one(
        measure(1, start(), n('C4', 'whole')),
        measure(2, n('D4', 'whole'), direction({ words: 'Fine', sound: { fine: 'yes' } })),
        measure(3, n('E4', 'whole'), direction({ words: 'D.C. al Fine', sound: { dacapo: 'yes' } })),
      ),
    )
    expect(song.rh.map(names).join(' ')).toBe('C4 D4 E4 C4 D4')
  })

  it('warns when a jump is only written as words', () => {
    const res = imp(one(measure(1, start(), n('C4', 'whole')), measure(2, n('D4', 'whole'), direction({ words: 'D.C. al Fine' }))))
    expect(res.song.rh.length).toBe(2)
    expect(res.warnings.join(' ')).toMatch(/D\.C\. al Fine.*straight through/)
  })

  it('records key and time changes, in playing order', () => {
    const { song } = imp(
      one(
        measure(1, start(), barline('left', { repeat: 'forward' }), n('C4', 'whole')),
        measure(2, attrs({ fifths: 1, time: [3, 4] }), n('G4', 'half', { dots: 1 }), barline('right', { repeat: 'backward' })),
        measure(3, attrs({ fifths: -2, mode: 'minor' }), n('D4', 'half', { dots: 1 })),
      ),
    )
    expect(song.keySig).toBe(0)
    expect(song.changes).toEqual([
      { bar: 1, keySig: 1, time: [3, 4] },
      { bar: 2, keySig: 0, time: [4, 4] },
      { bar: 3, keySig: 1, time: [3, 4] },
      { bar: 4, keySig: -2 },
    ])
  })

  it('reads common and cut time', () => {
    const { song } = imp(one(measure(1, attrs({ div: DIV, fifths: 0, time: '<beats>2</beats><beat-type>2</beat-type>' }), n('C4', 'whole'))))
    expect(song.time).toEqual([2, 2])
    const composite = imp(one(measure(1, attrs({ div: DIV, fifths: 0, time: '<beats>3+2</beats><beat-type>8</beat-type>' }), n('C4', 'half'), n('D4', 'eighth'))))
    expect(composite.song.time).toEqual([5, 8])
  })
})

describe('key, tempo, title', () => {
  it('names keys with their mode', () => {
    const key = (fifths: number, mode?: string) => imp(one(measure(1, start({ fifths, mode }), n('C4', 'whole')))).song.keyName
    expect(key(0)).toBe('C major')
    expect(key(3, 'minor')).toBe('F♯ minor')
    expect(key(-2)).toBe('B♭ major')
    expect(key(-3, 'minor')).toBe('C minor')
    expect(key(0, 'dorian')).toBe('D dorian')
    expect(key(7)).toBe('C♯ major')
  })

  it('reads the tempo from a sound or a metronome mark', () => {
    const tempo = (dir: string) => imp(one(measure(1, start({ time: [6, 8] }), dir, n('C4', 'half', { dots: 1 })))).song.bpm
    expect(tempo(direction({ sound: { tempo: '72' } }))).toBe(72)
    expect(tempo(direction({ metronome: ['quarter', 60, 1] }))).toBe(90)
    expect(tempo('')).toBe(90)
    expect(tempo(direction({ sound: { tempo: '300' } }))).toBe(160)
  })

  it('finds the title and composer, with fallbacks', () => {
    const body = [measure(1, start(), n('C4', 'whole'))]
    expect(imp(score([{ measures: body }], { title: 'Gymnopédie', composer: 'Erik Satie' })).song).toMatchObject({ title: 'Gymnopédie', composer: 'Erik Satie' })
    expect(imp(score([{ measures: body }], { movementTitle: 'Arabesque' })).song.title).toBe('Arabesque')
    expect(imp(score([{ measures: body }], { credits: [['title', 'Credit Title'], ['composer', 'Someone']] })).song).toMatchObject({
      title: 'Credit Title',
      composer: 'Someone',
    })
    const plain = importMusicXml(score([{ measures: body }]), 'My Song.musicxml')
    expect(plain.song).toMatchObject({ title: 'My Song', composer: 'Unknown composer', tags: ['Imported'], about: 'Imported from My Song.musicxml.' })
    expect(plain.song.id).toMatch(/^my-my-song-[a-z0-9]{4}$/)
    expect(plain.song.imported?.fileName).toBe('My Song.musicxml')
  })
})

describe('chord symbols, fingering and range', () => {
  it('converts chord symbols and places them on the notes', () => {
    const res = imp(
      one(
        measure(
          1,
          start(),
          harmony('C', 'major'),
          n('C4', 'quarter'),
          harmony('A', 'minor-seventh', { bass: 'G' }),
          n('A4', 'quarter'),
          harmony('F', 'major', { degrees: [[9, 0, 'add']] }),
          n('F4', 'quarter'),
          harmony('G', 'dominant', { degrees: [[9, -1, 'add']] }),
          n('G4', 'quarter'),
        ),
        measure(2, harmony('B', 'half-diminished'), harmony('E', 'suspended-fourth', { offset: 2 * DIV, degrees: [[7, -1, 'add']] }), n('B4', 'half'), n('E4', 'half')),
        measure(3, harmony('F#', 'minor'), n('F#4', 'whole')),
      ),
    )
    const chords = res.song.rh.flat().map((e) => e.chord ?? '-')
    expect(chords).toEqual(['C', 'Am7/G', 'Fadd9', '-', 'Bm7b5', 'E7sus4', 'F#m'])
    expect(res.warnings.join(' ')).toMatch(/Left out 1 chord symbol the app can’t show/)
  })

  it('reads fingering for single notes and chords', () => {
    const { song } = imp(one(measure(1, start(), n('C4', 'half', { finger: 1 }), n('E4', 'half', { finger: 1 }), n('C5', 'half', { finger: 5, chord: true }))))
    expect(song.rh[0][0].finger).toBe(1)
    expect(song.rh[0][1].fingers).toEqual([1, 5])
  })

  it('moves notes off the keyboard by octaves', () => {
    const res = imp(one(measure(1, start(), n('A1', 'half'), n('E7', 'half'))))
    expect(names(res.song.rh[0])).toBe('A2 E6')
    expect(res.warnings.join(' ')).toMatch(/Moved 2 notes by an octave/)
  })

  it('leaves out grace notes and keeps the timing', () => {
    const res = imp(one(measure(1, start(), n('D4', 'eighth', { grace: true }), n('C4', 'half'), n('E4', 'half'))))
    expect(names(res.song.rh[0])).toBe('C4 E4')
    expect(res.warnings.join(' ')).toMatch(/Left out 1 grace note/)
  })
})

describe('parts', () => {
  const vocal = { name: 'Voice', measures: [measure(1, start(), n('G4', 'whole'))] }
  const piano = { name: 'Piano', measures: [measure(1, start({ staves: 2 }), n('C5', 'whole', { staff: 1 }), backup(4 * DIV), n('C3', 'whole', { staff: 2, voice: 5 }))] }

  it('picks the piano part, and lets you choose another', () => {
    const res = imp(score([vocal, piano]))
    expect(res.partIndex).toBe(1)
    expect(res.parts).toEqual([
      { id: 'P1', name: 'Voice', staves: 1, notes: 1 },
      { id: 'P2', name: 'Piano', staves: 2, notes: 2 },
    ])
    expect(names(res.song.rh[0])).toBe('C5')
    const voice = imp(score([vocal, piano]), { partIndex: 0 })
    expect(names(voice.song.rh[0])).toBe('G4')
    expect(voice.song.lh).toBeUndefined()
  })
})

describe('pianos written as two parts', () => {
  const hand = (name: string, pitch: string) => ({ name, measures: [measure(1, start(), n(pitch, 'whole'))] })
  const withGroup = (group: string, parts: { name: string; measures: string[] }[]) =>
    score(parts).replace(
      '<part-list>',
      `<part-list><part-group type="start" number="1"><group-name>${group}</group-name><group-symbol>brace</group-symbol></part-group>`,
    ).replace('</part-list>', '<part-group type="stop" number="1"/></part-list>')

  it('joins “Piano (right)” and “Piano (left)” into one part with both hands', () => {
    const res = imp(score([hand('Piano (right)', 'E5'), hand('Piano (left)', 'C3')]))
    expect(res.parts.map((p) => p.name)).toEqual(['Piano (right)', 'Piano (left)', 'Piano (both hands)'])
    expect(res.partIndex).toBe(2)
    expect(names(res.song.rh[0])).toBe('E5')
    expect(names(res.song.lh![0])).toBe('C3')
    // Each hand on its own is still there.
    expect(names(imp(score([hand('Piano (right)', 'E5'), hand('Piano (left)', 'C3')]), { partIndex: 1 }).song.rh[0])).toBe('C3')
  })

  it('joins two braced keyboard parts, but not a braced section of an orchestra', () => {
    expect(imp(withGroup('Piano', [hand('Pno.', 'E5'), hand('', 'C3')])).parts.map((p) => p.name)).toContain('Pno (both hands)')
    const horns = imp(withGroup('Horns in F', [hand('1 2', 'E4'), hand('3 4', 'C4')]))
    expect(horns.parts.map((p) => p.name)).toEqual(['1 2', '3 4'])
  })

  it('prefers a piano over other two-staff parts', () => {
    const twoStaves = (name: string, pitch: string) => ({ name, measures: [measure(1, start({ staves: 2 }), n(pitch, 'whole', { staff: 1 }))] })
    const res = imp(score([twoStaves('Organ', 'G4'), twoStaves('Klavier', 'C5')]))
    expect(res.partIndex).toBe(1)
  })
})

describe('the file’s own quirks', () => {
  it('guesses major or minor when the score doesn’t say', () => {
    const ending = (last: string, mode?: string) => imp(one(measure(1, start({ mode }), n('E4', 'half'), n(last, 'half')))).song.keyName
    expect(ending('A3')).toBe('A minor')
    expect(ending('C4')).toBe('C major')
    expect(ending('A3', 'major')).toBe('C major')
  })

  it('reads a bare root as a major chord symbol', () => {
    const xml = one(measure(1, start(), harmony('G', ''), n('G4', 'whole')))
    expect(imp(xml).song.rh[0][0].chord).toBe('G')
  })

  it('lands tuplets exactly when the file had to round them', () => {
    // Sextuplet quarters with 256 divisions: 170⅔ each, written as 170 or 171.
    const six = [170, 171, 171, 170, 171, 171].map((d, i) =>
      n(['C4', 'D4', 'E4', 'F4', 'G4', 'A4'][i], 'quarter', { div: 256, dur: d, tm: [6, 4, 'quarter'], tuplet: i === 0 ? 'start' : i === 5 ? 'stop' : undefined }),
    )
    const res = imp(one(measure(1, attrs({ div: 256, fifths: 0, time: [4, 4] }), ...six), measure(2, n('C5', 'whole', { div: 256 }))))
    expect(res.song.rh[0].map((e) => `${e.dur}${e.tuplet ? `(${e.tuplet.actual}:${e.tuplet.normal})` : ''}`).join(' ')).toBe(
      'q(6:4) q(6:4) q(6:4) q(6:4) q(6:4) q(6:4)',
    )
    expect(beats(res.song.rh[0])).toBeCloseTo(4, 12)
    expect(res.warnings).toEqual([])
  })
})

describe('errors', () => {
  it('explains files it can’t read', () => {
    expect(() => importMusicXml('hello', 'x.txt')).toThrow(ImportError)
    expect(() => importMusicXml('<score-timewise/>', 'x.xml')).toThrow(/timewise/)
    expect(() => importMusicXml('<html><body/></html>', 'x.xml')).toThrow(/MusicXML/)
    expect(() => importMusicXml(one(measure(1, start(), r('whole'))), 'x.xml')).toThrow(/no notes/)
  })
})

describe('files', () => {
  const xml = one(measure(1, start(), n('C4', 'whole')))

  it('opens compressed .mxl files', async () => {
    const mxl = await makeZip([
      { name: 'META-INF/container.xml', text: CONTAINER('score.xml'), deflate: true },
      { name: 'score.xml', text: xml, deflate: true, descriptor: true },
    ])
    const res = await importScoreFile(mxl, 'song.mxl')
    expect(names(res.song.rh[0])).toBe('C4')
  })

  it('opens UTF-16 files', async () => {
    const units = [0xfeff, ...Array.from(xml, (ch) => ch.charCodeAt(0))]
    const bytes = new Uint8Array(new Uint16Array(units).buffer)
    const res = await importScoreFile(bytes, 'song.musicxml')
    expect(names(res.song.rh[0])).toBe('C4')
  })
})

describe('validateSong', () => {
  const ok = imp(one(measure(1, start(), n('C4', 'half', { tie: 'start' }), n('C4', 'half', { tie: 'stop' })))).song

  it('accepts a good song and catches broken ones', () => {
    expect(validateSong(ok)).toEqual([])
    const broken = (f: (s: Song) => void) => {
      const s = structuredClone(ok)
      f(s)
      return validateSong(s)
    }
    expect(broken((s) => (s.rh[0][1].hidden = true))).toEqual(expect.arrayContaining([expect.stringMatching(/hidden events must be rests/)]))
    expect(broken((s) => (s.rh[0][1].notes = ['D4']))).toEqual([expect.stringMatching(/tie on C4/)])
    expect(broken((s) => (s.rh[0][0].notes = ['C1']))).toEqual(expect.arrayContaining([expect.stringMatching(/off the keyboard/)]))
    expect(broken((s) => (s.rh[0][0].chord = 'H7'))).toEqual([expect.stringMatching(/Unknown chord/)])
    expect(broken((s) => (s.lh = [[]]))).toEqual(expect.arrayContaining([expect.stringMatching(/Left hand, bar 1/)]))
    expect(broken((s) => (s.rh[0][0].tuplet = { actual: 3, normal: 2 }))).toEqual(expect.arrayContaining([expect.stringMatching(/tuplet/)]))
    expect(broken((s) => (s.pickup = 1))).toEqual([expect.stringMatching(/pickup/)])
  })
})
