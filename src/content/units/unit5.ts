import type { Unit } from '../types'

export const unit5: Unit = {
  id: 'u5',
  title: 'Chords',
  subtitle: 'Build any chord, anywhere on the keyboard',
  color: '#9b8cff',
  icon: 'layers',
  lessons: [
    {
      id: 'u5-l1',
      title: 'Triads',
      subtitle: 'Stack two 3rds and you’ve got a chord',
      minutes: 5,
      icon: 'layers',
      steps: [
        {
          kind: 'explain',
          title: 'What is a chord?',
          body: `A **chord** is three or more notes played together. The basic chord is a **triad**: a **root**, the note a **3rd** above it, and the note a **5th** above it.

On the white keys it's “play one, skip one, play one, skip one, play one”: C (skip D) E (skip F) G = **C major**.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: { kind: 'root', label: 'R' }, E4: { kind: 'chord', label: '3' }, G4: { kind: 'chord', label: '5' } } },
            staff: { clef: 'treble', items: [{ notes: ['C4', 'E4', 'G4'], dur: 'w', chord: 'C' }] },
            audio: [{ label: 'C major', notes: [['C4', 'E4', 'G4']], dur: 2 }],
          },
          guitar: `Your open C chord (x32010) is the same three notes, C, E and G, spread over five strings with some of them doubled. Piano just lets you see them side by side.`,
        },
        {
          kind: 'play',
          prompt: 'Play a C major chord: C, E and G together.',
          body: 'Right hand fingers **1, 3, 5**. On screen, tap each key; on your keyboard, hold them down together.',
          target: { type: 'chord', notes: ['C4', 'E4', 'G4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, E4: 3, G4: 5 } },
          success: 'C major, your first chord!',
        },
        {
          kind: 'explain',
          title: 'Move the shape',
          body: `The same skip-one shape works from any white key:

- **F** A C = **F major**
- **G** B D = **G major**

C, F and G are the three most important chords in the key of C. Lots of songs use nothing else.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
                { notes: ['F4', 'A4', 'C5'], dur: 'h', chord: 'F' },
                { notes: ['G4', 'B4', 'D5'], dur: 'h', chord: 'G' },
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
              ],
            },
            audio: [{ label: 'C – F – G – C', notes: [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['C4', 'E4', 'G4']], gap: 0.9, dur: 1.2 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play F major: F, A, C.',
          target: { type: 'chord', notes: ['F4', 'A4', 'C5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
          hint: 'Start on F (left of the three black keys), then skip one, play one, skip one, play one.',
        },
        {
          kind: 'play',
          prompt: 'Play G major: G, B, D.',
          target: { type: 'chord', notes: ['G4', 'B4', 'D5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
        },
        {
          kind: 'quiz',
          question: 'From the bottom, the notes of a triad are called…',
          options: ['Root, 3rd, 5th', '1st, 2nd, 3rd', 'Bass, middle, top', 'Tonic, dominant, octave'],
          answer: 0,
          explain: 'Root, 3rd and 5th: named by their distance from the root.',
        },
        {
          kind: 'quiz',
          question: 'D, F and A make a triad. What is its root?',
          options: ['D', 'F', 'A', 'C'],
          answer: 0,
          explain: 'Stacked in 3rds (D, skip, F, skip, A), the bottom note is the root: D.',
        },
        {
          kind: 'explain',
          title: 'Three chords, a thousand songs',
          body: `In the key of C, **C**, **F** and **G** are built on the 1st, 4th and 5th notes of the scale. Musicians call them the **I, IV and V** chords.

Next: why some triads sound happy and others sound sad.`,
        },
      ],
    },
    {
      id: 'u5-l2',
      title: 'Major vs minor',
      subtitle: 'One note changes the mood',
      minutes: 5,
      icon: 'heart',
      steps: [
        {
          kind: 'explain',
          title: 'One note changes everything',
          body: `Compare **C major** (C E G) and **C minor** (C E♭ G). Only the middle note, the **3rd**, moved down a half step.

- **Major** = 4 + 3 half steps (major 3rd, then minor 3rd)
- **Minor** = 3 + 4 half steps (minor 3rd, then major 3rd)`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: { kind: 'root', label: 'R' }, Eb4: { kind: 'chord', label: '♭3' }, G4: { kind: 'chord', label: '5' } } },
            audio: [
              { label: 'C major', notes: [['C4', 'E4', 'G4']], dur: 1.8 },
              { label: 'C minor', notes: [['C4', 'Eb4', 'G4']], dur: 1.8 },
            ],
          },
          guitar: `Same move as going from your **E** shape to **Em**: one note of the chord, the 3rd, drops one fret.`,
        },
        {
          kind: 'quiz',
          question: 'Listen. Major or minor?',
          listen: { label: 'Play again', notes: [['A3', 'C4', 'E4']], dur: 1.8 },
          options: ['Major (bright)', 'Minor (dark)'],
          answer: 1,
          explain: 'A minor: A C E, a minor 3rd on the bottom.',
        },
        {
          kind: 'quiz',
          question: 'And this one?',
          listen: { label: 'Play again', notes: [['F3', 'A3', 'C4']], dur: 1.8 },
          options: ['Major (bright)', 'Minor (dark)'],
          answer: 0,
          explain: 'F major: F A C, a major 3rd on the bottom.',
        },
        {
          kind: 'play',
          prompt: 'Play C minor: C, E♭, G.',
          target: { type: 'chord', notes: ['C4', 'Eb4', 'G4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, Eb4: 3, G4: 5 } },
        },
        {
          kind: 'explain',
          title: 'The minor chords on white keys',
          body: `**Dm** (D F A), **Em** (E G B) and **Am** (A C E) are the minor triads you can play on white keys alone.

Together with C, F and G that's six chords, and they cover a huge number of pop songs.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['D4', 'F4', 'A4'], dur: 'h', chord: 'Dm' },
                { notes: ['E4', 'G4', 'B4'], dur: 'h', chord: 'Em' },
                { notes: ['A4', 'C5', 'E5'], dur: 'h', chord: 'Am' },
              ],
            },
            audio: [{ label: 'Dm – Em – Am', notes: [['D4', 'F4', 'A4'], ['E4', 'G4', 'B4'], ['A3', 'C4', 'E4']], gap: 0.9, dur: 1.2 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play A minor: A, C, E.',
          target: { type: 'chord', notes: ['A3', 'C4', 'E4'], anyOctave: true },
          keyboard: { from: 'A3', to: 'A4', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Turn D minor into D major: play D, F♯, A.',
          target: { type: 'chord', notes: ['D4', 'F#4', 'A4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'D minor is D F A. Raise the middle note (F) by a half step.',
          success: 'D major. Brighter, right?',
        },
        {
          kind: 'quiz',
          question: 'In a minor chord, how many half steps from the root up to the 3rd?',
          options: ['3', '4', '5', '2'],
          answer: 0,
          explain: 'Minor chords start with a minor 3rd: 3 half steps.',
        },
      ],
    },
    {
      id: 'u5-l3',
      title: 'Diminished, augmented & sus',
      subtitle: 'Tense, mysterious and floating chords',
      minutes: 5,
      icon: 'sparkles',
      steps: [
        {
          kind: 'explain',
          title: 'Two more triads',
          body: `- Stack **two minor 3rds** (3 + 3 half steps): **diminished**. B D F = **Bdim** (also written B°). Tense and spooky.
- Stack **two major 3rds** (4 + 4): **augmented**. C E G♯ = **Caug** (also C+). Mysterious and dreamy.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['B3', 'D4', 'F4'], dur: 'w', chord: 'Bdim' },
                { notes: ['C4', 'E4', 'G#4'], dur: 'w', chord: 'Caug' },
              ],
            },
            audio: [
              { label: 'B diminished', notes: [['B3', 'D4', 'F4']], dur: 1.8 },
              { label: 'C augmented', notes: [['C4', 'E4', 'G#4']], dur: 1.8 },
            ],
          },
        },
        {
          kind: 'play',
          prompt: 'Play B diminished: B, D, F.',
          target: { type: 'chord', notes: ['B3', 'D4', 'F4'], anyOctave: true },
          keyboard: { from: 'A3', to: 'A4', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Play C augmented: C, E, G♯.',
          target: { type: 'chord', notes: ['C4', 'E4', 'G#4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'C major, then push the G up a half step to G♯.',
        },
        {
          kind: 'explain',
          title: 'Sus chords',
          body: `**Sus** is short for *suspended*: the 3rd is swapped for another note.

- **Sus4**: the 3rd goes up to the 4th. C F G = **Csus4**.
- **Sus2**: the 3rd goes down to the 2nd. C D G = **Csus2**.

With no 3rd, they're neither happy nor sad: open, floating, and they love to resolve back to the normal chord.`,
          visual: {
            audio: [
              { label: 'Csus4 → C', notes: [['C4', 'F4', 'G4'], ['C4', 'E4', 'G4']], gap: 1.1, dur: 1.3 },
              { label: 'Csus2 → C', notes: [['C4', 'D4', 'G4'], ['C4', 'E4', 'G4']], gap: 1.1, dur: 1.3 },
            ],
          },
          guitar: `You know these! **Dsus4** (xx0233) and **Dsus2** (xx0230) are the classic open-D decorations: add or lift a finger on the high E string and the chord hangs, then lands back on D.`,
        },
        {
          kind: 'play',
          prompt: 'Play Csus4: C, F, G.',
          target: { type: 'chord', notes: ['C4', 'F4', 'G4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Play Dsus2: D, E, A.',
          target: { type: 'chord', notes: ['D4', 'E4', 'A4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
        },
        {
          kind: 'widget',
          title: 'Chord lab',
          body: 'Try every quality on every root. Watch the half-step gaps change between major, minor, dim and aug.',
          widget: { type: 'chord-builder', root: 'C', quality: 'dim' },
        },
        {
          kind: 'quiz',
          question: 'Which chord is two major 3rds stacked?',
          options: ['Augmented', 'Diminished', 'Major', 'Sus4'],
          answer: 0,
          explain: '4 + 4 half steps: augmented.',
        },
        {
          kind: 'quiz',
          question: 'Which notes are in Csus2?',
          options: ['C D G', 'C F G', 'C E G', 'C E♭ G'],
          answer: 0,
          explain: 'The 3rd (E) is replaced by the 2nd (D).',
        },
      ],
    },
    {
      id: 'u5-l4',
      title: 'Inversions',
      subtitle: 'Same chord, different order',
      minutes: 6,
      icon: 'shuffle',
      steps: [
        {
          kind: 'explain',
          title: 'Same chord, different order',
          body: `You can stack a chord's notes in any order:

- **Root position**: root at the bottom (C E G)
- **1st inversion**: 3rd at the bottom (E G C)
- **2nd inversion**: 5th at the bottom (G C E)

It's still C major. It just sounds a little different, and it can sit much closer to the chord before it.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4'], dur: 'w', text: 'Root' },
                { notes: ['E4', 'G4', 'C5'], dur: 'w', text: '1st inv.' },
                { notes: ['G4', 'C5', 'E5'], dur: 'w', text: '2nd inv.' },
              ],
              labels: false,
            },
            audio: [{ label: 'Hear all three', notes: [['C4', 'E4', 'G4'], ['E4', 'G4', 'C5'], ['G4', 'C5', 'E5']], gap: 1, dur: 1.3 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play C major in 1st inversion: E, G, C, with E at the bottom.',
          target: { type: 'chord', notes: ['E4', 'G4', 'C5'], anyOctave: true, bass: 'E4' },
          keyboard: { from: 'C4', to: 'C6', labels: 'all', fingers: { E4: 1, G4: 2, C5: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Now 2nd inversion: G, C, E, with G at the bottom.',
          target: { type: 'chord', notes: ['G4', 'C5', 'E5'], anyOctave: true, bass: 'G4' },
          keyboard: { from: 'C4', to: 'C6', labels: 'all', fingers: { G4: 1, C5: 3, E5: 5 } },
        },
        {
          kind: 'explain',
          title: 'Slash chords',
          body: `Chord symbols show which note is in the bass with a **slash**:

- **C/E** = C major with **E** in the bass
- **C/G** = C major with **G** in the bass

The letter after the slash is always the lowest note.`,
          visual: {
            keyboard: { from: 'C3', to: 'C5', labels: 'all', marks: { E3: { kind: 'root', label: 'bass' }, C4: 'chord', E4: 'chord', G4: 'chord' } },
            audio: [{ label: 'C/E', notes: [['E3', 'C4', 'E4', 'G4']], dur: 1.8 }],
          },
          guitar: `You've seen these on chord charts: **G/B** (x20003) is G major with B as its lowest note, used to walk the bass smoothly from C down to A.`,
        },
        {
          kind: 'quiz',
          question: 'In C/E, which note is in the bass?',
          options: ['E', 'C', 'G', 'B'],
          answer: 0,
          explain: 'The note after the slash is the bass note.',
        },
        {
          kind: 'explain',
          title: 'Why inversions matter',
          body: `Going from C to F in root position, your whole hand jumps. Instead, play C (C E G), then F in 2nd inversion (**C F A**): the C stays put and the other fingers move one step.

Then G in 1st inversion (**B D G**) is just around the corner. Keeping your hand in one place like this is called **voice leading**. It's how pianists make chord changes sound smooth.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
                { notes: ['C4', 'F4', 'A4'], dur: 'h', chord: 'F/C' },
                { notes: ['B3', 'D4', 'G4'], dur: 'h', chord: 'G/B' },
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
              ],
            },
            audio: [{ label: 'Smooth C – F – G – C', notes: [['C4', 'E4', 'G4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4']], gap: 0.9, dur: 1.2 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play F/C: C, F, A, with C at the bottom.',
          target: { type: 'chord', notes: ['C4', 'F4', 'A4'], anyOctave: true, bass: 'C4' },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, F4: 3, A4: 5 } },
        },
        {
          kind: 'quiz',
          question: 'Which notes make G major in 1st inversion?',
          options: ['B D G', 'G B D', 'D G B', 'B D F'],
          answer: 0,
          explain: '1st inversion puts the 3rd (B) at the bottom: B D G.',
        },
      ],
    },
    {
      id: 'u5-l5',
      title: 'Seventh chords & add9',
      subtitle: 'Richer, dreamier colours',
      minutes: 6,
      icon: 'wand',
      steps: [
        {
          kind: 'explain',
          title: 'Add one more 3rd',
          body: `Stack one more 3rd on top of a triad and you get a **7th chord**: root, 3rd, 5th and 7th.

- **Cmaj7** = C E G **B**: dreamy and warm
- **C7** = C E G **B♭**: bluesy, wants to move somewhere (the “dominant 7th”)
- **Am7** = A C E **G**: mellow and smooth`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4', 'B4'], dur: 'w', chord: 'Cmaj7' },
                { notes: ['C4', 'E4', 'G4', 'Bb4'], dur: 'w', chord: 'C7' },
                { notes: ['A3', 'C4', 'E4', 'G4'], dur: 'w', chord: 'Am7' },
              ],
            },
            audio: [
              { label: 'Cmaj7', notes: [['C4', 'E4', 'G4', 'B4']], dur: 2 },
              { label: 'C7', notes: [['C4', 'E4', 'G4', 'Bb4']], dur: 2 },
              { label: 'Am7', notes: [['A3', 'C4', 'E4', 'G4']], dur: 2 },
            ],
          },
        },
        {
          kind: 'play',
          prompt: 'Play Cmaj7: C, E, G, B.',
          body: 'Right hand fingers **1 2 3 5**.',
          target: { type: 'chord', notes: ['C4', 'E4', 'G4', 'B4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, E4: 2, G4: 3, B4: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Play G7: G, B, D, F.',
          target: { type: 'chord', notes: ['G3', 'B3', 'D4', 'F4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'C5', labels: 'all' },
          hint: 'A G major chord (G B D) plus F on top.',
          success: 'G7 is the chord that pulls hardest back to C.',
        },
        {
          kind: 'quiz',
          question: 'Listen. Which chord is it?',
          listen: { label: 'Play again', notes: [['C4', 'E4', 'G4', 'B4']], dur: 2 },
          options: ['Cmaj7 (dreamy)', 'C7 (bluesy)'],
          answer: 0,
          explain: 'The B on top, a half step under C, gives maj7 its soft, shimmering sound.',
        },
        {
          kind: 'explain',
          title: 'The sound of add9',
          body: `An **add9** chord is a triad plus the **9th**: the 2nd note of the scale, an octave up. **Cadd9** = C E G + **D**.

It's sparkly and open. Add9 and maj7 colours are everywhere in gentle modern piano music, the soft, dreamy ballad style. Pianists often tuck the D in close (C D E G) or put it on top (C G D E).`,
          visual: {
            audio: [
              { label: 'C', notes: [['C4', 'E4', 'G4']], dur: 1.8 },
              { label: 'Cadd9', notes: [['C4', 'E4', 'G4', 'D5']], dur: 1.8 },
            ],
          },
          guitar: `**Cadd9** (x32033) is a guitar favourite for the same reason: C E G with a D ringing on top.`,
        },
        {
          kind: 'play',
          prompt: 'Play Cadd9: C, E, G, and the D above.',
          target: { type: 'chord', notes: ['C4', 'E4', 'G4', 'D5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
        },
        {
          kind: 'widget',
          title: 'Explore the colours',
          body: 'Switch between Major, Maj7, 7, m7 and Add9 on a few roots and listen to how each one feels.',
          widget: { type: 'chord-builder', root: 'F', quality: 'maj7' },
        },
        {
          kind: 'quiz',
          question: 'Which note turns C major into C7?',
          options: ['B♭', 'B', 'D', 'A'],
          answer: 0,
          explain: 'C7 adds the minor 7th, B♭. Adding B instead makes Cmaj7.',
        },
        {
          kind: 'quiz',
          question: 'How is Am7 spelled?',
          options: ['A C E G', 'A C♯ E G', 'A C E G♯', 'A D E G'],
          answer: 0,
          explain: 'A minor (A C E) plus the minor 7th, G.',
        },
      ],
    },
    {
      id: 'u5-l6',
      title: 'Reading chord symbols',
      subtitle: 'From a chord chart to your fingers',
      minutes: 5,
      icon: 'list-music',
      steps: [
        {
          kind: 'explain',
          title: 'Lead sheets',
          body: `Pop songbooks write the melody on a staff and the chords as **symbols** above it. Read them like this:

- {{C}} = C major, {{Cm}} = C minor
- {{C7}}, {{Cmaj7}}, {{Cm7}} = sevenths
- {{Cdim}} (or C°), {{Caug}} (or C+)
- {{Csus4}}, {{Csus2}}, {{Cadd9}}
- {{C/E}} = C with E in the bass

Tap any chord to hear it.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['E4'], chord: 'C' },
                { notes: ['E4'] },
                { notes: ['F4'] },
                { notes: ['G4'] },
                { bar: 'single' },
                { notes: ['G4'], chord: 'G' },
                { notes: ['F4'] },
                { notes: ['E4'] },
                { notes: ['D4'] },
                { bar: 'final' },
              ],
            },
          },
          guitar: `This is the same chord-chart language you already read. The only new skill is turning a symbol into piano keys.`,
        },
        {
          kind: 'quiz',
          question: 'What are the notes of B♭m7?',
          options: ['B♭ D♭ F A♭', 'B♭ D F A♭', 'B♭ D♭ F A', 'B♭ D F A'],
          answer: 0,
          explain: 'B♭ minor (B♭ D♭ F) plus the minor 7th (A♭).',
        },
        {
          kind: 'play',
          prompt: 'Play Dm7.',
          target: { type: 'chord', notes: ['D4', 'F4', 'A4', 'C5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
          hint: 'D minor (D F A) plus C.',
        },
        {
          kind: 'play',
          prompt: 'Play E♭ major.',
          target: { type: 'chord', notes: ['Eb4', 'G4', 'Bb4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'Start on E♭, go up 4 half steps (G), then 3 more (B♭).',
        },
        {
          kind: 'quiz',
          question: 'What does F/A mean?',
          options: ['F major with A in the bass', 'Play F or A', 'F minor over A minor', 'Play F, then A'],
          answer: 0,
          explain: 'The chord is F major (F A C); the note after the slash, A, is the lowest note.',
        },
        {
          kind: 'play',
          prompt: 'Play F/A: F major with A as the lowest note.',
          target: { type: 'chord', notes: ['A3', 'C4', 'F4'], anyOctave: true, bass: 'A3' },
          keyboard: { from: 'F3', to: 'F4', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Play Gsus4.',
          target: { type: 'chord', notes: ['G3', 'C4', 'D4'], anyOctave: true },
          keyboard: { from: 'F3', to: 'F4', labels: 'all' },
          hint: 'G major is G B D. Swap the 3rd (B) for the 4th (C).',
        },
        {
          kind: 'explain',
          title: 'Any symbol, any key',
          body: `Every chord symbol works the same way:

1. Find the **root** (the letter).
2. Add the right **3rd**: major (4 half steps) or minor (3).
3. Add the **5th**, then any extras the symbol asks for (7, maj7, add9…).
4. Check for a **slash**: that note goes at the bottom.`,
          tip: 'Drill this with the **Chord Trainer** in Practice. Speed comes quickly once the steps are automatic.',
        },
      ],
    },
  ],
}
