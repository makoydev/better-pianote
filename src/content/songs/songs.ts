import type { SongSource } from './types'

/**
 * Public-domain pieces only, listed from easiest to hardest (the Songs page keeps this order).
 * Melodies are for the right hand; chord symbols are simple, standard harmonisations you can play
 * with the left hand (or strum in your head, guitar-style).
 * Format: see SongSource in ./types.ts. songs.test.ts checks every bar adds up.
 */
export const SONG_SOURCES: SongSource[] = [
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditional (English)',
    year: '18th century',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 90,
    tags: ['First song', '3 notes', 'Eighth notes'],
    about:
      'A classic first song with just three notes: E, D and C, right hand in C position. In the third bar the notes come twice as fast: eighth notes, two per beat.',
    rh: `
      {C}E4:q/3 D4/2 C4:h/1 | E4:q/3 D4/2 C4:h/1 | C4:8/1 C4 C4 C4 {G}D4/2 D4 D4 D4 | {C}E4:q/3 D4/2 C4:h/1 |
      {C}E4:q D4 C4:h | E4:q D4 C4:h | C4:8 C4 C4 C4 {G}D4 D4 D4 D4 | {C}E4:q D4 C4:h
    `,
    lh: `
      C3:w/5 | C3:w | C3:h G3:h/1 | C3:w/5 |
      C3:w | C3:w | C3:h G3:h | C3:w
    `,
  },
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
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditional (French)',
    year: '18th century',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 100,
    tags: ['C position', 'Eighth notes', 'Both hands', 'Round'],
    about:
      'Each line comes twice, so you get a second try at every one. The last line drops to the G below middle C: move your thumb down to reach it. It’s also a round: a second player can start two bars later.',
    rh: `
      {C}C4:q/1 D4/2 E4/3 C4/1 | C4/1 D4/2 E4/3 C4/1 | E4/3 F4/4 G4:h/5 | E4:q/3 F4/4 G4:h/5 |
      G4:8 A4 G4 F4 E4:q C4 | G4:8 A4 G4 F4 E4:q C4 | C4 {G}G3 {C}C4:h | C4:q {G}G3 {C}C4:h
    `,
    lh: `
      C3:w/5 | C3:w | C3:w | C3:w |
      C3:w | C3:w | C3:q G2:q C3:h | C3:q G2:q C3:h
    `,
  },
  {
    id: 'london-bridge',
    title: 'London Bridge',
    composer: 'Traditional (English)',
    year: '1744',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 104,
    tags: ['C position', 'Dotted rhythms', 'Both hands'],
    about:
      'It starts long-short: a dotted quarter, then a quick eighth note. The left hand only needs C and G, the I and V chords. The rhyme was in print by 1744; this tune came later.',
    rh: `
      {C}G4:q./5 A4:8 G4:q/5 F4/4 | E4/3 F4/4 G4:h/5 | {G}D4:q/2 E4/3 F4:h/4 | {C}E4:q/3 F4/4 G4:h/5 |
      {C}G4:q. A4:8 G4:q F4 | E4 F4 G4:h | {G}D4:h G4:h | {C}E4:q C4:h.
    `,
    lh: `
      C3:w/5 | C3:w | G3:w/1 | C3:w/5 |
      C3:w | C3:w | G3:w | C3:w
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
    id: 'row-your-boat',
    title: 'Row, Row, Row Your Boat',
    composer: 'Traditional (American)',
    year: '1852',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [6, 8],
    bpm: 96,
    tags: ['6/8 time', 'Both hands', 'Octave jump'],
    about:
      'Your first song in 6/8: count six eighth notes as two groups of three, “1-2-3 4-5-6”, so it rocks like a boat. On “merrily, merrily” the tune leaps up to the C above middle C.',
    rh: `
      {C}C4:q./1 C4:q. | C4:q/1 D4:8/2 E4:q./3 | E4:q/3 D4:8/2 E4:q/3 F4:8/4 | G4:h./5 |
      C5:8 C5 C5 G4 G4 G4 | E4 E4 E4 C4 C4 C4 | {G}G4:q/5 F4:8/4 E4:q/3 D4:8/2 | {C}C4:h./1
    `,
    lh: `
      C3:h./5 | C3:h. | C3:h. | C3:h. |
      C3:h. | C3:h. | G3:h./1 | C3:h./5
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
    id: 'silent-night',
    title: 'Silent Night',
    composer: 'Franz Xaver Gruber',
    year: '1818',
    difficulty: 2,
    keyName: 'C major',
    keySig: 0,
    time: [6, 8],
    bpm: 80,
    tags: ['6/8 time', 'Long notes', 'Ties'],
    about:
      'A gently swaying carol in 6/8: feel two slow beats per bar, and hold every long note for its full length. The climb to the high E near the end is the big moment.',
    rh: `
      {C}G4:q. A4:8 G4:q | E4:h. | G4:q. A4:8 G4:q | E4:h. |
      {G}D5:h D5:q | B4:h. | {C}C5:h C5:q | G4:h. |
      {F}A4:h A4:q | C5:q. B4:8 A4:q | {C}G4:q. A4:8 G4:q | E4:h. |
      {F}A4:h A4:q | C5:q. B4:8 A4:q | {C}G4:q. A4:8 G4:q | E4:h. |
      {G}D5:h D5:q | {G7}F5:q. D5:8 B4:q | {C}C5:h. | E5:h. |
      {C}C5:q. G4:8 E4:q | {G7}G4:q. F4:8 D4:q | {C}C4:h.~ | C4:h.
    `,
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    composer: 'Mildred J. Hill & Patty Hill',
    year: '1893',
    difficulty: 2,
    keyName: 'C major',
    keySig: 0,
    time: [3, 4],
    bpm: 100,
    pickup: 1,
    tags: ['3/4 time', 'Pickup notes', 'Dotted rhythms', 'Octave leap'],
    about:
      'Every line starts with a quick pickup, “Hap-py”: a dotted eighth and a sixteenth, long-short. Count 1-2-3 per bar, and reach up an octave for the third “happy birthday”. The tune comes from the Hill sisters’ “Good Morning to All” (1893).',
    rh: `
      G4:8. G4:16 |
      {C}A4:q G4 C5 | {G}B4:h G4:8. G4:16 | A4:q G4 D5 | {C}C5:h G4:8. G4:16 |
      {C}G5:q E5 C5 | {F}B4:q A4 F5:8. F5:16 | {C}E5:q C5 {G}D5 | {C}C5:h.
    `,
  },
  {
    id: 'canon-in-d',
    title: 'Canon in D',
    composer: 'Johann Pachelbel',
    year: '1680–1706',
    difficulty: 2,
    keyName: 'D major',
    keySig: 2,
    time: [4, 4],
    bpm: 66,
    tags: ['Key of D', 'Both hands', 'Chord progression'],
    about:
      'The left hand repeats Pachelbel’s famous eight-note bass, D A B F♯ G D G A, while the right hand plays the theme. It’s the I–V–vi–iii–IV–I–IV–V progression from the lessons. Learn each hand alone, then put them together.',
    rh: `
      {D}F#5:h {A}E5:h | {Bm}D5:h {F#m}C#5:h | {G}B4:h {D}A4:h | {G}B4:h {A}C#5:h |
      {D}D5:h {A}C#5:h | {Bm}B4:h {F#m}A4:h | {G}G4:h {D}F#4:h | {G}G4:h {A}E4:h |
      {D}[D4,F#4,A4]:w
    `,
    lh: `
      D3:h A2:h | B2:h F#2:h | G2:h D2:h | G2:h A2:h |
      D3:h A2:h | B2:h F#2:h | G2:h D2:h | G2:h A2:h |
      D3:w
    `,
  },
  {
    id: 'mountain-king',
    title: 'In the Hall of the Mountain King',
    composer: 'Edvard Grieg',
    year: '1875',
    difficulty: 2,
    keyName: 'A minor',
    keySig: 0,
    time: [4, 4],
    bpm: 120,
    tags: ['A minor', 'Accidentals', 'Octave shift'],
    about:
      'Grieg’s creeping march, moved from B minor to A minor so it’s easier to read. Watch the D♯ and B♭: the tune slides down by half steps, which makes it sound sneaky. You play it twice, the second time an octave higher. In the orchestra it keeps getting faster and louder right to the end.',
    rh: `
      {Am}A3:q B3 C4 D4 | E4:q C4 E4:h | {B7}D#4:q B3 D#4:h | {Bb}D4:q Bb3 D4:h |
      {Am}A3:q B3 C4 D4 | E4 C4 E4 A4 | {C}G4 E4 C4 E4 | {G}G4:w |
      {Am}A4:q B4 C5 D5 | E5:q C5 E5:h | {B7}D#5:q B4 D#5:h | {Bb}D5:q Bb4 D5:h |
      {Am}A4:q B4 C5 D5 | E5 C5 E5 A5 | {C}G5 E5 C5 E5 | {G}G5:w |
      {Am}[A4,C5,E5]:w
    `,
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    year: '16th century',
    difficulty: 2,
    keyName: 'A minor',
    keySig: 0,
    time: [6, 8],
    bpm: 84,
    pickup: 0.5,
    tags: ['A minor', '6/8 time', 'Dotted rhythms', 'Accidentals'],
    about:
      'A 16th-century English tune in A minor. The dotted eighth plus sixteenth gives it its lilt, and the G♯ (the raised 7th of A minor) pulls back home to A. The chords are just Am, G, C and E.',
    rh: `
      A4:8 |
      {Am}C5:q D5:8 E5:8. F5:16 E5:8 | {G}D5:q B4:8 G4:8. A4:16 B4:8 | {Am}C5:q A4:8 A4:8. G#4:16 A4:8 | {E}B4:q G#4:8 E4:q A4:8 |
      {Am}C5:q D5:8 E5:8. F5:16 E5:8 | {G}D5:q B4:8 G4:8. A4:16 B4:8 | {Am}C5:8. B4:16 A4:8 {E}G#4:8. F#4:16 G#4:8 | {Am}A4:h. |
      {C}G5:q. G5:8. F#5:16 E5:8 | {G}D5:q B4:8 G4:8. A4:16 B4:8 | {Am}C5:q A4:8 A4:8. G#4:16 A4:8 | {E}B4:q G#4:8 E4:q. |
      {C}G5:q. G5:8. F#5:16 E5:8 | {G}D5:q B4:8 G4:8. A4:16 B4:8 | {Am}C5:8. B4:16 A4:8 {E}G#4:8. F#4:16 G#4:8 | {Am}A4:h.
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
  {
    id: 'prelude-in-c',
    title: 'Prelude in C',
    composer: 'Johann Sebastian Bach',
    year: '1722',
    difficulty: 3,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 66,
    tags: ['Sixteenth notes', 'Broken chords', 'Classical'],
    about:
      'The first prelude of Bach’s Well-Tempered Clavier. Each bar is one chord picked out in running sixteenth notes, like fingerpicking: read the chord, then let your fingers run the shape. Pianists play the first two notes of each group with the left hand. This is the first eight bars, then a C chord to finish.',
    rh: `
      {C}C4:16 E4 G4 C5 E5 G4 C5 E5 C4 E4 G4 C5 E5 G4 C5 E5 |
      {Dm7/C}C4 D4 A4 D5 F5 A4 D5 F5 C4 D4 A4 D5 F5 A4 D5 F5 |
      {G7/B}B3 D4 G4 D5 F5 G4 D5 F5 B3 D4 G4 D5 F5 G4 D5 F5 |
      {C}C4 E4 G4 C5 E5 G4 C5 E5 C4 E4 G4 C5 E5 G4 C5 E5 |
      {Am/C}C4 E4 A4 E5 A5 A4 E5 A5 C4 E4 A4 E5 A5 A4 E5 A5 |
      {D7/C}C4 D4 F#4 A4 D5 F#4 A4 D5 C4 D4 F#4 A4 D5 F#4 A4 D5 |
      {G/B}B3 D4 G4 D5 G5 G4 D5 G5 B3 D4 G4 D5 G5 G4 D5 G5 |
      {Cmaj7/B}B3 C4 E4 G4 C5 E4 G4 C5 B3 C4 E4 G4 C5 E4 G4 C5 |
      {C}[C4,E4,G4,C5]:w
    `,
  },
]
