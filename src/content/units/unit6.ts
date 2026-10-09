import type { Unit } from '../types'

export const unit6: Unit = {
  id: 'u6',
  title: 'Keys & Progressions',
  subtitle: 'Key signatures, the circle of fifths, and the progressions you already love',
  color: '#ff8fc8',
  icon: 'compass',
  lessons: [
    {
      id: 'u6-l1',
      title: 'Key signatures',
      subtitle: 'Read the sharps and flats at the start',
      minutes: 6,
      icon: 'hash',
      steps: [
        {
          kind: 'explain',
          title: 'Sharps and flats up front',
          body: `Music in G major uses F♯ instead of F. Rather than writing a ♯ next to every F, the sharp goes once at the start of each line: the **key signature**.

It means “these notes are always sharp (or flat), unless you're told otherwise”. Here, every F is played as F♯, even though there's no ♯ next to the note.`,
          visual: {
            staff: {
              clef: 'treble',
              keySig: 1,
              items: [
                { notes: ['G4'] },
                { notes: ['A4'] },
                { notes: ['B4'] },
                { notes: ['C5'] },
                { notes: ['D5'] },
                { notes: ['E5'] },
                { notes: ['F#5'] },
                { notes: ['G5'] },
              ],
            },
            audio: [{ label: 'G major scale', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'], gap: 0.33 }],
          },
        },
        {
          kind: 'explain',
          title: 'The order of sharps',
          body: `Sharps always appear in the same order: **F C G D A E B**.

A silly sentence helps: *Father Charles Goes Down And Ends Battle*. A key with 2 sharps has F♯ and C♯; a key with 3 sharps adds G♯, and so on.`,
          visual: { staff: { clef: 'treble', keySig: 7, items: [] } },
        },
        {
          kind: 'explain',
          title: 'The order of flats',
          body: `Flats come in the reverse order: **B E A D G C F**.

The sentence flips too: *Battle Ends And Down Goes Charles' Father*. (The first four flats even spell **BEAD**.)`,
          visual: { staff: { clef: 'treble', keySig: -7, items: [] } },
        },
        {
          kind: 'explain',
          title: 'Naming a sharp key',
          body: `For sharp keys: take the **last sharp** and go **up a half step**. That's the major key.

- One sharp, F♯ → up a half step → **G major**
- Two sharps, the last is C♯ → **D major**`,
          visual: {
            staff: { clef: 'treble', keySig: 2, items: [{ notes: ['D4', 'F#4', 'A4'], dur: 'w', chord: 'D' }] },
          },
        },
        {
          kind: 'explain',
          title: 'Naming a flat key',
          body: `For flat keys: the **second-to-last flat** is the key.

- B♭ E♭ → **B♭ major**
- B♭ E♭ A♭ → **E♭ major**

One exception to memorise: **one flat (B♭) is F major**.`,
          visual: {
            staff: { clef: 'treble', keySig: -3, items: [{ notes: ['Eb4', 'G4', 'Bb4'], dur: 'w', chord: 'Eb' }] },
          },
        },
        {
          kind: 'quiz',
          question: 'Which major key has this key signature?',
          visual: { staff: { clef: 'treble', keySig: 3, items: [] } },
          options: ['A major', 'E major', 'D major', 'F♯ major'],
          answer: 0,
          explain: 'Three sharps: F♯ C♯ G♯. The last is G♯, and a half step up is A.',
        },
        {
          kind: 'quiz',
          question: 'And this one?',
          visual: { staff: { clef: 'treble', keySig: -2, items: [] } },
          options: ['B♭ major', 'E♭ major', 'F major', 'D major'],
          answer: 0,
          explain: 'Two flats, B♭ and E♭. The second-to-last flat is B♭.',
        },
        {
          kind: 'quiz',
          question: 'Which major key has no sharps or flats?',
          options: ['C major', 'G major', 'F major', 'A major'],
          answer: 0,
          explain: 'C major: all white keys. (Its relative, A minor, has none either.)',
        },
        {
          kind: 'quiz',
          question: 'Every key signature fits one major and one minor key. One sharp is G major or…',
          options: ['E minor', 'D minor', 'A minor', 'B minor'],
          answer: 0,
          explain: 'E minor is G major’s relative minor: same notes, same one sharp.',
        },
      ],
    },
    {
      id: 'u6-l2',
      title: 'The circle of fifths',
      subtitle: 'A map of all 12 keys',
      minutes: 5,
      icon: 'compass',
      steps: [
        {
          kind: 'explain',
          title: 'A map of every key',
          body: `Start on C and go up a **5th** (7 half steps): C → G → D → A → E → B → F♯. Each step adds **one sharp** to the key signature.

Go the other way, down a 5th each time: C → F → B♭ → E♭ → A♭ → D♭ → G♭. Each step adds **one flat**.

Bend that line into a circle and the two ends meet at the bottom: F♯ major and G♭ major sound identical, just spelled differently. That's the **circle of fifths**.`,
          guitar: `Ever noticed that G, C and D go together on guitar? Or A, D and E? They're neighbours on this circle, and neighbours always sound good together.`,
        },
        {
          kind: 'widget',
          title: 'Explore the circle',
          body: 'Tap a key to see its key signature and chords. Notice that neighbouring keys differ by just one sharp or flat.',
          widget: { type: 'circle-of-fifths' },
        },
        {
          kind: 'quiz',
          question: 'Going clockwise from C, which key comes next?',
          options: ['G', 'F', 'D', 'A'],
          answer: 0,
          explain: 'Clockwise = up a 5th: C → G.',
        },
        {
          kind: 'quiz',
          question: 'How many sharps does D major have?',
          options: ['2', '1', '3', '0'],
          answer: 0,
          explain: 'C (0) → G (1) → D (2): F♯ and C♯.',
        },
        {
          kind: 'explain',
          title: 'Relative minors live inside',
          body: `The inner ring shows each major key's **relative minor**, which shares its key signature: C and Am, G and Em, D and Bm, A and F♯m, and so on all the way round.

So once you know the major keys, you get the minor keys for free.`,
        },
        {
          kind: 'quiz',
          question: 'Which major key has 3 flats?',
          options: ['E♭ major', 'A♭ major', 'B♭ major', 'F major'],
          answer: 0,
          explain: 'Counter-clockwise from C: F (1), B♭ (2), E♭ (3).',
        },
        {
          kind: 'explain',
          title: 'Why musicians love it',
          body: `Keys that sit next to each other share all but one note, so songs move between them easily.

Better still: a key and its two neighbours are its **I, IV and V** chords. For C, the neighbours are **F** and **G**, so the chords are C, F and G. For G, they're C, G and D.`,
          visual: { audio: [{ label: 'C – F – G – C', notes: [['C4', 'E4', 'G4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4']], gap: 0.9, dur: 1.2 }] },
        },
        {
          kind: 'quiz',
          question: 'In the key of G, which keys sit either side of it on the circle?',
          options: ['C and D', 'F and A', 'C and A', 'D and E'],
          answer: 0,
          explain: 'One step counter-clockwise is C, one step clockwise is D. So G’s main chords are G, C and D.',
        },
      ],
    },
    {
      id: 'u6-l3',
      title: 'Chords in a key',
      subtitle: 'I ii iii IV V vi vii°',
      minutes: 6,
      icon: 'grid',
      steps: [
        {
          kind: 'explain',
          title: 'A chord on every note',
          body: `Take the C major scale and build a triad on each note, using **only notes from the scale**: C, Dm, Em, F, G, Am, Bdim.

Musicians number them with **Roman numerals**: UPPER case for major, lower case for minor, ° for diminished.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4'], chord: 'C', text: 'I' },
                { notes: ['D4', 'F4', 'A4'], chord: 'Dm', text: 'ii' },
                { notes: ['E4', 'G4', 'B4'], chord: 'Em', text: 'iii' },
                { notes: ['F4', 'A4', 'C5'], chord: 'F', text: 'IV' },
                { notes: ['G4', 'B4', 'D5'], chord: 'G', text: 'V' },
                { notes: ['A4', 'C5', 'E5'], chord: 'Am', text: 'vi' },
                { notes: ['B4', 'D5', 'F5'], chord: 'Bdim', text: 'vii°' },
              ],
              labels: false,
            },
            audio: [
              {
                label: 'All seven',
                notes: [['C4', 'E4', 'G4'], ['D4', 'F4', 'A4'], ['E4', 'G4', 'B4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['A4', 'C5', 'E5'], ['B4', 'D5', 'F5'], ['C5', 'E5', 'G5']],
                gap: 0.6,
                dur: 0.9,
              },
            ],
          },
        },
        {
          kind: 'explain',
          title: 'The same pattern in every key',
          body: `Every major key follows the same pattern: **major, minor, minor, major, major, minor, diminished**.

In G major that gives: {{G}} {{Am}} {{Bm}} {{C}} {{D}} {{Em}} {{F#dim}}. Tap them to hear.`,
          guitar: `This is the **Nashville number system** you may have met in bands: “one-four-five in G” means G, C and D. Roman numerals are the same idea, with case showing major or minor.`,
        },
        {
          kind: 'widget',
          title: 'One-four-five',
          body: 'The I, IV and V chords in G. Switch keys to hear the same numbers anywhere.',
          widget: { type: 'progression', key: 'G', romans: ['I', 'IV', 'V', 'I'], pattern: 'block' },
        },
        {
          kind: 'quiz',
          question: 'In C major, what is the vi chord?',
          options: ['Am', 'Em', 'Dm', 'A'],
          answer: 0,
          explain: 'The 6th note of C major is A, and vi is lower case, so minor: Am.',
        },
        {
          kind: 'quiz',
          question: 'In G major, what is the IV chord?',
          options: ['C', 'D', 'Am', 'Em'],
          answer: 0,
          explain: 'G A B C: the 4th note is C, and IV is major.',
        },
        {
          kind: 'play',
          prompt: 'Play the V chord in C major.',
          target: { type: 'chord', notes: ['G4', 'B4', 'D5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
          hint: 'The 5th note of C major is G. Build a major triad on it.',
          success: 'G major is the V chord in C.',
        },
        {
          kind: 'play',
          prompt: 'Play the ii chord in C major.',
          target: { type: 'chord', notes: ['D4', 'F4', 'A4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
          hint: 'The 2nd note is D, and ii is minor: D F A.',
        },
        {
          kind: 'quiz',
          question: 'What quality is the vii° chord?',
          options: ['Diminished', 'Minor', 'Major', 'Augmented'],
          answer: 0,
          explain: 'The little circle means diminished. In C it’s B D F.',
        },
        {
          kind: 'quiz',
          question: 'In D major (2 sharps), what is the vi chord?',
          options: ['Bm', 'B', 'F♯m', 'Em'],
          answer: 0,
          explain: 'D E F♯ G A B C♯: the 6th note is B, so vi = B minor (B D F♯).',
        },
      ],
    },
    {
      id: 'u6-l4',
      title: 'Famous progressions',
      subtitle: 'The chord patterns behind countless songs',
      minutes: 6,
      icon: 'route',
      steps: [
        {
          kind: 'explain',
          title: 'A handful of progressions',
          body: `A **chord progression** is a sequence of chords. A small handful of them power an enormous number of songs:

- **I–V–vi–IV**: {{C}} {{G}} {{Am}} {{F}}. The pop progression.
- **vi–IV–I–V**: {{Am}} {{F}} {{C}} {{G}}. The same chords starting on vi: moodier.
- **I–vi–IV–V**: {{C}} {{Am}} {{F}} {{G}}. 1950s doo-wop.
- **ii–V–I**: {{Dm}} {{G}} {{C}}. The heart of jazz.`,
        },
        {
          kind: 'widget',
          title: 'The pop progression',
          body: 'Press play and play along. The keys light up so you can follow, and a ✓ appears when you hold the right chord.',
          widget: { type: 'progression', key: 'C', romans: ['I', 'V', 'vi', 'IV'], bpm: 80, pattern: 'block' },
        },
        {
          kind: 'explain',
          title: 'You already know one',
          body: `**River Flows in You** uses **vi–IV–I–V** in **A major**: {{F#m}} – {{D}} – {{A}} – {{E}}.

Now you know *why* it sounds the way it does: it starts on the wistful vi chord and lifts up to the bright I.`,
        },
        {
          kind: 'widget',
          title: 'vi–IV–I–V in A major',
          body: 'Try the **Broken** pattern for a flowing piano-ballad feel, then switch keys to hear the same progression elsewhere.',
          widget: { type: 'progression', key: 'A', romans: ['vi', 'IV', 'I', 'V'], bpm: 70, pattern: 'arpeggio' },
        },
        {
          kind: 'quiz',
          question: 'In A major, what is the IV chord?',
          options: ['D', 'E', 'F♯m', 'Bm'],
          answer: 0,
          explain: 'A B C♯ D: the 4th note is D, and IV is major.',
        },
        {
          kind: 'quiz',
          question: 'What is ii–V–I in C major?',
          options: ['Dm – G – C', 'D – G – C', 'Dm – G7 – Am', 'Em – A – D'],
          answer: 0,
          explain: 'ii = Dm, V = G, I = C. Jazz players usually play it as Dm7 – G7 – Cmaj7.',
        },
        {
          kind: 'widget',
          title: 'Pachelbel’s Canon',
          body: 'The famous Canon in D: **I–V–vi–iii–IV–I–IV–V**. Generations of songwriters have borrowed it.',
          widget: { type: 'progression', key: 'D', romans: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], bpm: 72, pattern: 'ballad' },
        },
        {
          kind: 'play',
          prompt: 'Play the vi chord in A major: the first chord of River Flows in You.',
          target: { type: 'chord', notes: ['F#4', 'A4', 'C#5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'all' },
          hint: 'The 6th note of A major is F♯. vi is minor: F♯ A C♯.',
          success: 'F♯ minor. Recognise that sound?',
        },
      ],
    },
    {
      id: 'u6-l5',
      title: 'Smooth voice leading',
      subtitle: 'Glide between chords, don’t jump',
      minutes: 6,
      icon: 'waves',
      steps: [
        {
          kind: 'explain',
          title: 'Don’t jump, glide',
          body: `Playing every chord in root position makes your hand leap around, and the music sounds choppy.

Good pianists **keep shared notes where they are** and move the other notes to the **nearest** chord note. C → F → G becomes C E G → C F A → B D G: tiny moves, smooth sound.`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
                { notes: ['C4', 'F4', 'A4'], dur: 'h', chord: 'F' },
                { notes: ['B3', 'D4', 'G4'], dur: 'h', chord: 'G' },
                { notes: ['C4', 'E4', 'G4'], dur: 'h', chord: 'C' },
              ],
            },
            audio: [
              { label: 'Jumpy (all root position)', notes: [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['C4', 'E4', 'G4']], gap: 0.9, dur: 1.1 },
              { label: 'Smooth (voice-led)', notes: [['C4', 'E4', 'G4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4']], gap: 0.9, dur: 1.1 },
            ],
          },
        },
        {
          kind: 'widget',
          title: 'Watch the keys',
          body: 'This player always picks the smoothest inversion. Notice how little the lit-up keys move from chord to chord.',
          widget: { type: 'progression', key: 'C', romans: ['I', 'IV', 'V', 'I'], pattern: 'block' },
        },
        {
          kind: 'play',
          prompt: 'Play C major exactly here: C4, E4, G4.',
          target: { type: 'chord', notes: ['C4', 'E4', 'G4'] },
          keyboard: { from: 'G3', to: 'C5', labels: 'all', fingers: { C4: 1, E4: 3, G4: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Now F, keeping your thumb on C: C4, F4, A4.',
          target: { type: 'chord', notes: ['C4', 'F4', 'A4'] },
          keyboard: { from: 'G3', to: 'C5', labels: 'all', fingers: { C4: 1, F4: 3, A4: 5 } },
          success: 'Only two fingers moved, one step each.',
        },
        {
          kind: 'play',
          prompt: 'Now G: B3, D4, G4.',
          target: { type: 'chord', notes: ['B3', 'D4', 'G4'] },
          keyboard: { from: 'G3', to: 'C5', labels: 'all', fingers: { B3: 1, D4: 2, G4: 5 } },
          success: 'C → F → G with almost no hand movement. That’s voice leading.',
        },
        {
          kind: 'quiz',
          question: 'C major and A minor share which notes?',
          options: ['C and E', 'A and G', 'G only', 'None'],
          answer: 0,
          explain: 'C major = C E G, A minor = A C E. They share C and E, so moving between them, only one note changes.',
        },
        {
          kind: 'explain',
          title: 'The rule of thumb',
          body: `1. **Keep** any notes the two chords share.
2. **Move** the other notes to the nearest note of the new chord.
3. Let the **left hand** play the roots underneath, so you still hear what the chord is.`,
          tip: 'Try I–vi–IV–V in C with smooth voicings: C E G → C E A → C F A → B D G.',
        },
        {
          kind: 'quiz',
          question: 'After C E G, which F major voicing moves the least?',
          options: ['C F A', 'F A C', 'A C F', 'F C A'],
          answer: 0,
          explain: 'C stays, E moves up to F, G moves up to A: two one-step moves.',
        },
      ],
    },
  ],
}
