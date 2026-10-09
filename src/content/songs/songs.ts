import type { SongSource } from './types'

/**
 * Public-domain pieces only. Melodies are for the right hand; chord symbols are simple, standard
 * harmonisations you can play with the left hand (or strum in your head, guitar-style).
 * Format: see SongSource in ./types.ts. songs.test.ts checks every bar adds up.
 */
export const SONG_SOURCES: SongSource[] = [
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    year: '1830',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 100,
    tags: ['First song', 'C position', 'Both hands'],
    about: 'Three notes and a lot of fun. Right hand in C position: thumb on middle C.',
    rh: `
      {C}E4:q/3 D4/2 C4/1 D4/2 | E4/3 E4 E4:h | {G}D4:q/2 D4 D4:h | {C}E4:q/3 G4/5 G4:h |
      {C}E4:q/3 D4 C4 D4 | E4 E4 E4 E4 | {G}D4 D4 E4 D4 | {C}C4:w/1
    `,
    lh: `
      C3:w/5 | C3:w | G3:w/1 | C3:w/5 | C3:w | C3:w | G3:w/1 | C3:w/5
    `,
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 96,
    tags: ['C position', 'Both hands', 'Classical'],
    about:
      'The big tune from the finale of Beethoven’s 9th Symphony. It moves almost entirely by step, which makes it perfect reading practice: watch the notes climb and fall.',
    rh: `
      {C}E4:q/3 E4 F4/4 G4/5 | {G}G4/5 F4/4 E4/3 D4/2 | {C}C4/1 C4 D4/2 E4/3 | {C}E4:q./3 D4:8/2 {G}D4:h |
      {C}E4:q E4 F4 G4 | {G}G4 F4 E4 D4 | {C}C4 C4 D4 E4 | {G}D4:q. C4:8 {C}C4:h |
      {G}D4:q D4 {C}E4 C4 | {G}D4 E4:8 F4 {C}E4:q C4 | {G}D4 E4:8 F4 E4:q D4 | {C}C4 {G}D4 G3:h |
      {C}E4:q E4 F4 G4 | {G}G4 F4 E4 D4 | {C}C4 C4 D4 E4 | {G}D4:q. C4:8 {C}C4:h
    `,
    lh: `
      C3:w/5 | G3:w/1 | C3:w/5 | C3:h G3:h |
      C3:w | G3:w | C3:w | G3:h C3:h |
      G3:h C3:h | G3:h C3:h | G3:w | C3:q G2:h. |
      C3:w | G3:w | C3:w | G3:h C3:h
    `,
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    composer: 'Traditional (French)',
    year: '1761',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 92,
    tags: ['C position', 'Both hands', 'First chords'],
    about:
      'The French tune “Ah! vous dirai-je, maman”. Your pinky stretches from G up to A and back. In the left hand you play the roots of C, F and G: the three chords behind thousands of songs.',
    rh: `
      {C}C4:q/1 C4 G4/5 G4 | {F}A4/5 A4 {C}G4:h/5 | {F}F4:q/4 F4 {C}E4/3 E4 | {G}D4/2 D4 {C}C4:h/1 |
      {C}G4:q G4 {F}F4 F4 | {C}E4 E4 {G}D4:h | {C}G4:q G4 {F}F4 F4 | {C}E4 E4 {G}D4:h |
      {C}C4:q C4 G4 G4 | {F}A4 A4 {C}G4:h | {F}F4:q F4 {C}E4 E4 | {G}D4 D4 {C}C4:h
    `,
    lh: `
      C3:w/5 | F3:h/2 C3:h/5 | F3:h C3:h | G3:h/1 C3:h |
      C3:h F3:h | C3:h G3:h | C3:h F3:h | C3:h G3:h |
      C3:w | F3:h C3:h | F3:h C3:h | G3:h C3:h
    `,
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells (chorus)',
    composer: 'James Lord Pierpont',
    year: '1857',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 112,
    tags: ['C position', 'Dotted rhythms', 'Both hands'],
    about:
      'Count the dotted quarter in “jingle ALL the way”: long-short. The left hand walks C, F, D and G, the roots of the chords above the staff.',
    rh: `
      {C}E4:q/3 E4 E4:h | E4:q E4 E4:h | E4:q G4/5 C4:q./1 D4:8/2 | E4:w/3 |
      {F}F4:q/4 F4 F4:q. F4:8 | {C}F4:q E4 E4 E4:8 E4 | {D7}E4:q D4 D4 E4 | {G7}D4:h G4:h |
      {C}E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:8 | E4:w |
      {F}F4:q F4 F4:q. F4:8 | {C}F4:q E4 E4 E4:8 E4 | {G7}G4:q G4 F4 D4 | {C}C4:w
    `,
    lh: `
      C3:w/5 | C3:w | C3:w | C3:w |
      F3:w/2 | C3:w/5 | D3:w/4 | G3:w/1 |
      C3:w/5 | C3:w | C3:w | C3:w |
      F3:w/2 | C3:w/5 | G3:w/1 | C3:w/5
    `,
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (tune “New Britain”)',
    year: '1835',
    difficulty: 2,
    keyName: 'G major',
    keySig: 1,
    time: [3, 4],
    bpm: 84,
    pickup: 1,
    tags: ['3/4 time', 'Key of G', 'Pickup note', 'Ties'],
    about:
      'Count “1 2 3” for each bar. It starts with a pickup note before the first bar line, and the long notes are tied across bar lines: hold them, don’t play them again.',
    rh: `
      D4:q |
      {G}G4:h B4:8 G4:8 | {G7}B4:h A4:q | {C}G4:h E4:q | {G}D4:h D4:q |
      {G}G4:h B4:8 G4:8 | {Em}B4:h A4:q | {D}D5:h.~ | D5:h {D7}B4:q |
      {G}D5:h B4:8 G4:8 | {G7}B4:h A4:q | {C}G4:h E4:q | {G}D4:h D4:q |
      {Em}G4:h B4:8 G4:8 | {D}B4:h A4:q | {G}G4:h.~ | G4:h
    `,
  },
  {
    id: 'minuet-in-g',
    title: 'Minuet in G',
    composer: 'Christian Petzold',
    year: 'c. 1725',
    difficulty: 3,
    keyName: 'G major',
    keySig: 1,
    time: [3, 4],
    bpm: 96,
    tags: ['3/4 time', 'Key of G', 'Eighth notes', 'Classical'],
    about:
      'From the notebook J. S. Bach kept for his wife Anna Magdalena, and long credited to Bach himself. Every F is F♯ here: look at the key signature.',
    rh: `
      {G}D5:q/5 G4:8/1 A4:8/2 B4:8/3 C5:8/4 | D5:q/5 G4:q/1 G4:q/1 | {C}E5:q C5:8 D5:8 E5:8 F#5:8 | {G}G5:q G4:q G4:q |
      {Am}C5:q D5:8 C5:8 B4:8 A4:8 | {G}B4:q C5:8 B4:8 A4:8 G4:8 | {D}F#4:q G4:8 A4:8 B4:8 G4:8 | A4:h. |
      {G}D5:q G4:8 A4:8 B4:8 C5:8 | D5:q G4:q G4:q | {C}E5:q C5:8 D5:8 E5:8 F#5:8 | {G}G5:q G4:q G4:q |
      {Am}C5:q D5:8 C5:8 B4:8 A4:8 | {G}B4:q C5:8 B4:8 A4:8 G4:8 | {D7}A4:q B4:8 A4:8 G4:8 F#4:8 | {G}G4:h.
    `,
  },
  {
    id: 'fur-elise',
    title: 'Für Elise (opening)',
    composer: 'Ludwig van Beethoven',
    year: '1810',
    difficulty: 3,
    keyName: 'A minor',
    keySig: 0,
    time: [3, 8],
    bpm: 50,
    pickup: 0.5,
    tags: ['3/8 time', 'Sixteenth notes', 'A minor', 'Classical'],
    about:
      'The famous opening theme, right hand only, with a simple final note instead of the repeat. Count in eighth notes: “1 2 3” per bar. The E–D♯ wiggle is a half step; the natural sign cancels the D♯ later in the bar.',
    rh: `
      E5:16 D#5 |
      E5 D#5 E5 B4 D5 C5 | {Am}A4:8 r:16 C4 E4 A4 | {E}B4:8 r:16 E4 G#4 B4 | {Am}C5:8 r:16 E4 E5 D#5 |
      E5 D#5 E5 B4 D5 C5 | {Am}A4:8 r:16 C4 E4 A4 | {E}B4:8 r:16 E4 C5 B4 | {Am}A4:q.
    `,
  },
]
