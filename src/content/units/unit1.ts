import type { Unit } from '../types'

export const unit1: Unit = {
  id: 'u1',
  title: 'Meet the Keyboard',
  subtitle: 'Find any note on your keyboard in seconds',
  color: '#ffc857',
  icon: 'piano',
  lessons: [
    {
      id: 'u1-l1',
      title: 'The black-key map',
      subtitle: 'Groups of two and three, and where C lives',
      minutes: 3,
      icon: 'map',
      steps: [
        {
          kind: 'explain',
          title: 'Your keyboard has a pattern',
          body: `Your CT-S1 has **61 keys**, but it only uses **12 different notes**. They just repeat, higher and higher.

Look at the black keys: they come in **groups of two** and **groups of three**, over and over. That pattern is your map. Once you see it, you can find any note without counting.`,
          visual: { widget: { type: 'keyboard-map' } },
          guitar: `On guitar you find your way with fret numbers and the dots on the neck. On piano, the black-key groups are your fret dots. They never move.`,
        },
        {
          kind: 'play',
          prompt: 'Find a group of two black keys and play both of them.',
          body: 'Any group of two, anywhere. One at a time is fine.',
          target: { type: 'set', notes: ['C#4', 'D#4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'Look for two black keys sitting close together, with a bigger gap on each side.',
          success: 'That’s a group of two.',
        },
        {
          kind: 'play',
          prompt: 'Now play all three black keys in a group of three.',
          target: { type: 'set', notes: ['F#4', 'G#4', 'A#4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'The group of three comes right after the group of two.',
          success: 'Nice, you can see the map.',
        },
        {
          kind: 'explain',
          title: 'C lives just left of the two',
          body: `The white key just to the **left of every group of two** black keys is **C**.

C is home base on the piano. Lots of music is built around it, and every other note is easy to find once you've found C.`,
          visual: {
            keyboard: { from: 'C3', to: 'B4', labels: 'marked', marks: { C3: 'target', C4: 'target' } },
            audio: [{ label: 'Hear the Cs', notes: ['C3', 'C4', 'C5'], gap: 0.6 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play any C.',
          target: { type: 'note', notes: ['C4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'Find a group of two black keys. C is the white key just left of it.',
          success: 'Found it!',
        },
        {
          kind: 'play',
          prompt: 'Play every C you can see on this keyboard.',
          body: 'There are three of them.',
          target: { type: 'set', notes: ['C3', 'C4', 'C5'] },
          keyboard: { from: 'C3', to: 'C5', labels: 'none' },
          hint: 'Every group of two black keys has a C on its left. Don’t forget the very last key.',
          success: 'All three Cs. On your real keyboard there are six!',
        },
        {
          kind: 'quiz',
          question: 'Which white key sits just to the left of a group of two black keys?',
          options: ['C', 'F', 'D', 'B'],
          answer: 0,
          explain: 'C! And the key just left of a group of **three** black keys is F. You’ll meet it next lesson.',
        },
        {
          kind: 'play',
          prompt: 'Speed round: play the Cs from lowest to highest.',
          target: { type: 'sequence', notes: ['C3', 'C4', 'C5'] },
          keyboard: { from: 'C3', to: 'C5', labels: 'none' },
          success: 'You can find C anywhere now. That’s the first big piano skill.',
        },
      ],
    },
    {
      id: 'u1-l2',
      title: 'The musical alphabet',
      subtitle: 'Name every white key, A to G',
      minutes: 4,
      icon: 'book',
      steps: [
        {
          kind: 'explain',
          title: 'Only seven letters',
          body: `Music uses just seven letters: **A B C D E F G**. After G it starts again at A.

On the keyboard, the white keys go **C D E F G A B**, then C again. Moving **right** goes **higher**, moving left goes lower.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all' },
            audio: [{ label: 'C to C going up', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], gap: 0.38 }],
          },
          guitar: `Same seven letters you know from chord names. The difference: on piano they're laid out in a straight line, so you can *see* the whole scale at once.`,
        },
        {
          kind: 'explain',
          title: 'Two landmarks: C and F',
          body: `You already know C sits left of the **two** black keys.

**F** sits just left of the **three** black keys. With C and F as anchors, every other white key is one step away.`,
          visual: { keyboard: { from: 'C4', to: 'B4', labels: 'marked', marks: { C4: 'target', F4: 'target' } } },
        },
        {
          kind: 'play',
          prompt: 'Play any F.',
          target: { type: 'note', notes: ['F4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'Find a group of three black keys. F is just left of it.',
          success: 'F found.',
        },
        {
          kind: 'explain',
          title: 'Filling in the rest',
          body: `- **D** sits *between* the two black keys.
- **E** is just right of the two black keys.
- **G** and **A** sit *between* the three black keys.
- **B** is just right of the three black keys.

So: C D E around the twos, F G A B around the threes.`,
          visual: { keyboard: { from: 'C4', to: 'B4', labels: 'all' } },
        },
        {
          kind: 'play',
          prompt: 'Play any D.',
          target: { type: 'note', notes: ['D4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'D is the white key in the middle of a group of two black keys.',
        },
        {
          kind: 'play',
          prompt: 'Play G, then A, then B.',
          target: { type: 'sequence', notes: ['G4', 'A4', 'B4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          hint: 'G and A are inside the group of three; B comes just after it.',
        },
        {
          kind: 'play',
          prompt: 'Spell a word: play B, E, A, D.',
          body: 'Any octave you like.',
          target: { type: 'sequence', notes: ['B3', 'E4', 'A4', 'D4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'B4', labels: 'none' },
          success: 'You just “played” BEAD. Musicians love spelling words with notes. Try CAFE or BAGGAGE later!',
        },
        {
          kind: 'quiz',
          question: 'Going up from E, what is the next white key?',
          options: ['F', 'G', 'D', 'E again'],
          answer: 0,
          explain: 'E then F. They sit side by side with no black key between them.',
        },
        {
          kind: 'play',
          prompt: 'Play the whole alphabet going up, C to C.',
          target: { type: 'sequence', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          success: 'That’s the C major scale. You’ll see it a lot!',
        },
      ],
    },
    {
      id: 'u1-l3',
      title: 'Middle C & octaves',
      subtitle: 'Every note has a letter and a number',
      minutes: 3,
      icon: 'target',
      steps: [
        {
          kind: 'explain',
          title: 'Middle C',
          body: `**Middle C** is the C closest to the middle of a full-size piano. On your 61-key CT-S1 it's the **third C from the left**.

It matters because sheet music is built around it: the two halves of the music staff meet at middle C. When a teacher says “start on middle C”, this is the key.`,
          visual: { keyboard: { from: 'C2', to: 'C7', labels: 'c', marks: { C4: 'target' } } },
        },
        {
          kind: 'play',
          prompt: 'Play middle C.',
          target: { type: 'note', notes: ['C4'] },
          keyboard: { from: 'C2', to: 'C7', labels: 'c' },
          hint: 'Count the Cs from the lowest key: one, two, three. The third one is middle C.',
          success: 'That’s middle C, also called C4.',
        },
        {
          kind: 'explain',
          title: 'Octaves',
          body: `From one C to the next C is an **octave**: eight white keys, C D E F G A B C. Notes an octave apart sound like the same note, just higher or lower.

Pianists number the octaves. Middle C is **C4**, the next C up is **C5**, the one below is **C3**. Your CT-S1 runs from **C2** (lowest key) to **C7** (highest key). The number changes at every C, so the B just below middle C is B3.`,
          visual: {
            keyboard: { from: 'C3', to: 'C6', labels: 'c', octaveLabels: true, marks: { C3: 'target', C4: 'target', C5: 'target', C6: 'target' } },
            audio: [{ label: 'C3, C4, C5, C6', notes: ['C3', 'C4', 'C5', 'C6'], gap: 0.55 }],
          },
          guitar: `It's like the 12th fret: same note name, one octave higher. Your open low E and the E on the 2nd fret of the D string are an octave apart too.`,
        },
        {
          kind: 'play',
          prompt: 'Play C3, C4 and C5, in that order.',
          target: { type: 'sequence', notes: ['C3', 'C4', 'C5'] },
          keyboard: { from: 'C3', to: 'C6', labels: 'c', octaveLabels: true },
        },
        {
          kind: 'quiz',
          question: 'What note is one octave above G4?',
          options: ['G5', 'G3', 'A4', 'C5'],
          answer: 0,
          explain: 'Same letter, number goes up by one: G5.',
        },
        {
          kind: 'play',
          prompt: 'Play A4, the A just above middle C.',
          body: 'Fun fact: this is the note orchestras tune to (440 vibrations per second).',
          target: { type: 'note', notes: ['A4'] },
          keyboard: { from: 'C3', to: 'C6', labels: 'c', octaveLabels: true },
          hint: 'Start at middle C and go up: C D E F G A.',
          success: 'A440, the tuning note.',
        },
        {
          kind: 'quiz',
          question: 'Which note is lower?',
          options: ['B3', 'C4'],
          answer: 0,
          explain: 'B3 is the white key just *below* middle C. Octave numbers change at C, so the B below C4 is still in octave 3.',
        },
      ],
    },
    {
      id: 'u1-l4',
      title: 'Sharps, flats & half steps',
      subtitle: 'Naming the black keys',
      minutes: 4,
      icon: 'hash',
      steps: [
        {
          kind: 'explain',
          title: 'Black keys have two names',
          body: `A black key is named after its neighbours.

The black key just above C is **C sharp** (C♯). The same key is also **D flat** (D♭), because it's just below D.

- **Sharp ♯** means one key higher.
- **Flat ♭** means one key lower.

Which name you use depends on the key the music is in. You'll learn that later; for now, both are right.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { 'C#4': { kind: 'chord', label: 'C♯ D♭' } } },
          },
        },
        {
          kind: 'explain',
          title: 'Half steps and whole steps',
          body: `A **half step** is the very next key, black or white, with nothing in between. C to C♯ is a half step.

A **whole step** is two half steps: C to D, or E to F♯.

Watch out for **E–F** and **B–C**: there's no black key between them, so they're only a half step apart.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { E4: 'chord', F4: 'chord', B4: 'root', C5: 'root' } },
            audio: [
              { label: 'Half step (E–F)', notes: ['E4', 'F4'], gap: 0.6 },
              { label: 'Whole step (F–G)', notes: ['F4', 'G4'], gap: 0.6 },
            ],
          },
          guitar: `Easy one: a half step is **one fret**, a whole step is **two frets**. The piano just shows them as neighbouring keys.`,
        },
        {
          kind: 'play',
          prompt: 'Play F♯ (the black key just right of F).',
          target: { type: 'note', notes: ['F#4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'F is left of the three black keys. F♯ is the first black key of that group.',
        },
        {
          kind: 'play',
          prompt: 'Play B♭.',
          target: { type: 'note', notes: ['Bb4'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'Flat means one key lower: find B, then go one key to the left.',
          success: 'B♭ is also A♯. Same key, two names.',
        },
        {
          kind: 'quiz',
          question: 'What is a half step up from E?',
          options: ['F', 'F♯', 'G', 'D♯'],
          answer: 0,
          explain: 'There’s no black key between E and F, so F is just a half step up.',
        },
        {
          kind: 'play',
          prompt: 'Play C, then the note a whole step above it.',
          target: { type: 'sequence', notes: ['C4', 'D4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'Two half steps: C → C♯ → D.',
          success: 'C to D is a whole step.',
        },
        {
          kind: 'quiz',
          question: 'Which pair is a whole step apart?',
          options: ['E–F', 'B–C', 'F–G', 'C–C♯'],
          answer: 2,
          explain: 'F to G skips over F♯, so it’s two half steps: a whole step. The others are all half steps.',
        },
        {
          kind: 'play',
          prompt: 'Play every key from C up to the next C, black ones too.',
          body: 'This is the chromatic scale: twelve half steps.',
          target: { type: 'sequence', notes: ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          success: 'Twelve half steps make an octave. Now you know every key on the piano.',
        },
      ],
    },
    {
      id: 'u1-l5',
      title: 'Fingers & hand position',
      subtitle: 'Finger numbers and C position',
      minutes: 5,
      icon: 'hand',
      steps: [
        {
          kind: 'explain',
          title: 'Finger numbers',
          body: `Pianists number their fingers: **thumb = 1**, index = 2, middle = 3, ring = 4, **pinky = 5**. Both hands use the same numbers.

You'll see small numbers like these above notes in sheet music. They tell you which finger to use so your hand is ready for what comes next.`,
          visual: {
            keyboard: { from: 'C4', to: 'G4', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
          },
          guitar: `Careful here! On guitar your **index** finger is 1 and the thumb is “T”. On piano the **thumb is 1**, so every number is one higher than you're used to: piano 2 = your guitar 1.`,
        },
        {
          kind: 'explain',
          title: 'Sit like a pianist',
          body: `- Sit so your elbows are about level with the keys, a little back from the keyboard.
- **Curve your fingers** as if you're holding a small ball, and play with your fingertips.
- Keep your wrists level and your shoulders relaxed.
- Let your arm's weight do the work. The keys don't need a hard push.`,
          tip: 'Your CT-S1 is touch-sensitive: pressing faster plays louder. Try one soft and one loud note.',
        },
        {
          kind: 'explain',
          title: 'C position',
          body: `**Right hand:** thumb (1) on middle C, then 2 on D, 3 on E, 4 on F, 5 on G. One finger per key.

**Left hand:** pinky (5) on the C below middle C (C3), then 4 on D, 3 on E, 2 on F, thumb (1) on G.

Most first pieces only use these ten notes, so this is your home position.`,
          visual: {
            keyboard: {
              from: 'C3',
              to: 'G4',
              labels: 'all',
              fingers: { C3: 5, D3: 4, E3: 3, F3: 2, G3: 1, C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 },
            },
          },
        },
        {
          kind: 'play',
          prompt: 'Right hand in C position: play C D E F G with fingers 1 2 3 4 5.',
          target: { type: 'sequence', notes: ['C4', 'D4', 'E4', 'F4', 'G4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
          showTargets: true,
        },
        {
          kind: 'play',
          prompt: 'Come back down: G F E D C, fingers 5 4 3 2 1.',
          target: { type: 'sequence', notes: ['G4', 'F4', 'E4', 'D4', 'C4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Left hand: pinky on C3. Play C D E F G with fingers 5 4 3 2 1.',
          target: { type: 'sequence', notes: ['C3', 'D3', 'E3', 'F3', 'G3'] },
          keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, D3: 4, E3: 3, F3: 2, G3: 1 } },
          showTargets: true,
        },
        {
          kind: 'quiz',
          question: 'In C position, which right-hand finger plays E?',
          options: ['3', '2', '4', '1'],
          answer: 0,
          explain: 'Thumb on C (1), D is 2, E is 3.',
        },
        {
          kind: 'play',
          prompt: 'A first tune! Right hand: E D C D E E E (fingers 3 2 1 2 3 3 3).',
          target: { type: 'sequence', notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
          success: 'That’s the start of “Mary Had a Little Lamb”, played with proper fingering!',
        },
      ],
    },
  ],
}
