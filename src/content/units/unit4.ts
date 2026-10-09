import type { Unit } from '../types'

export const unit4: Unit = {
  id: 'u4',
  title: 'Intervals & Scales',
  subtitle: 'Steps, skips and the scales behind every song',
  color: '#3ee6c8',
  icon: 'waves',
  lessons: [
    {
      id: 'u4-l1',
      title: 'Intervals',
      subtitle: 'Measuring the distance between notes',
      minutes: 5,
      icon: 'route',
      steps: [
        {
          kind: 'explain',
          title: 'What is an interval?',
          body: `The distance between two notes is an **interval**. Musicians name intervals by counting **letter names**, including both ends:

- C up to E: C D E = **a 3rd**
- C up to G: C D E F G = **a 5th**
- C up to the next C = **an octave** (8 letters)`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: { kind: 'root', label: '1' }, E4: { kind: 'chord', label: '3' }, G4: { kind: 'chord', label: '5' } } },
            audio: [
              { label: 'C to E (a 3rd)', notes: ['C4', 'E4'], gap: 0.6 },
              { label: 'C to G (a 5th)', notes: ['C4', 'G4'], gap: 0.6 },
            ],
          },
          guitar: `On guitar you probably think of these as shapes and fret distances. Counting letters is the piano (and sheet-music) way, and it tells you how the notes will look on the staff.`,
        },
        {
          kind: 'widget',
          title: 'Interval lab',
          body: 'Tap two keys (or play two notes on your keyboard) and see the interval: its name, its size in half steps, and a song that starts with it.',
          widget: { type: 'interval-lab' },
        },
        {
          kind: 'explain',
          title: 'Intervals on the staff',
          body: `You can read intervals from their **shape** on the staff, without naming the notes:

- **2nd**: line to the next space (neighbours)
- **3rd**: line to the next line, or space to the next space
- **4th**: line to space, with a gap
- **5th**: line to line, skipping one line`,
          visual: {
            staff: {
              clef: 'treble',
              items: [
                { notes: ['E4'] },
                { notes: ['F4'], text: '2nd' },
                { bar: 'single' },
                { notes: ['E4'] },
                { notes: ['G4'], text: '3rd' },
                { bar: 'single' },
                { notes: ['E4'] },
                { notes: ['A4'], text: '4th' },
                { bar: 'single' },
                { notes: ['E4'] },
                { notes: ['B4'], text: '5th' },
              ],
              labels: false,
            },
          },
        },
        {
          kind: 'quiz',
          question: 'What interval is this?',
          visual: { staff: { clef: 'treble', items: [{ notes: ['G4'], dur: 'h' }, { notes: ['B4'], dur: 'h' }], labels: false } },
          options: ['A 3rd', 'A 2nd', 'A 4th', 'A 5th'],
          answer: 0,
          explain: 'Line to the very next line: a 3rd (G A B).',
        },
        {
          kind: 'quiz',
          question: 'Count the letters: D up to A is a…',
          options: ['5th', '4th', '6th', '3rd'],
          answer: 0,
          explain: 'D E F G A: five letters, a 5th.',
        },
        {
          kind: 'play',
          prompt: 'Play C4, then the white key a 5th above it.',
          target: { type: 'sequence', notes: ['C4', 'G4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'none' },
          hint: 'Count five letters, starting on C: C D E F G.',
          success: 'C to G. That jump is the “Twinkle, Twinkle” leap.',
        },
        {
          kind: 'play',
          prompt: 'Play D4, then the white key a 4th above it.',
          target: { type: 'sequence', notes: ['D4', 'G4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'none' },
          hint: 'Count four letters: D E F G.',
        },
        {
          kind: 'explain',
          title: 'Size isn’t everything',
          body: `C to E and C to E♭ are *both* 3rds (the letters are C and E), but they sound very different. Intervals also have a **quality**: major, minor, perfect…

That tiny difference is what makes a chord sound happy or sad. That's next.`,
          visual: {
            audio: [
              { label: 'C to E', notes: [['C4', 'E4']], dur: 1.6 },
              { label: 'C to E♭', notes: [['C4', 'Eb4']], dur: 1.6 },
            ],
          },
        },
      ],
    },
    {
      id: 'u4-l2',
      title: 'Major & minor 3rds',
      subtitle: 'The interval that decides happy or sad',
      minutes: 5,
      icon: 'heart',
      steps: [
        {
          kind: 'explain',
          title: 'Two kinds of 3rd',
          body: `Count the **half steps**:

- **Major 3rd** = **4** half steps. C → E.
- **Minor 3rd** = **3** half steps. C → E♭.

Same letters, one half step apart, and a completely different mood.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: { kind: 'root', label: 'C' }, E4: { kind: 'chord', label: '4' }, Eb4: { kind: 'scale', label: '3' } } },
            audio: [
              { label: 'Major 3rd (C–E)', notes: [['C4', 'E4']], dur: 1.6 },
              { label: 'Minor 3rd (C–E♭)', notes: [['C4', 'Eb4']], dur: 1.6 },
            ],
          },
          guitar: `On one string, 4 frets is a major 3rd and 3 frets is a minor 3rd. It's the one-fret difference between your **E** and **Em** shapes: the G string plays G♯ in E major and G in E minor.`,
        },
        {
          kind: 'quiz',
          question: 'Listen. Major 3rd or minor 3rd?',
          listen: { label: 'Play again', notes: [['C4', 'E4']], dur: 1.6 },
          options: ['Major 3rd (brighter)', 'Minor 3rd (darker)'],
          answer: 0,
          explain: 'That was C and E: 4 half steps, a major 3rd.',
        },
        {
          kind: 'quiz',
          question: 'And this one?',
          listen: { label: 'Play again', notes: [['A3', 'C4']], dur: 1.6 },
          options: ['Major 3rd (brighter)', 'Minor 3rd (darker)'],
          answer: 1,
          explain: 'A to C: A → A♯ → B → C, 3 half steps, a minor 3rd.',
        },
        {
          kind: 'play',
          prompt: 'Play a major 3rd up from C: C, then E.',
          target: { type: 'sequence', notes: ['C4', 'E4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Play a minor 3rd up from A: A, then C.',
          target: { type: 'sequence', notes: ['A3', 'C4'] },
          keyboard: { from: 'C3', to: 'C5', labels: 'all' },
          hint: 'Count three half steps up from A: A♯, B, C.',
        },
        {
          kind: 'explain',
          title: 'Why 3rds matter so much',
          body: `Every major and minor chord is two 3rds stacked on top of each other:

- **Major chord** = major 3rd + minor 3rd: C–E–G (4 + 3 half steps)
- **Minor chord** = minor 3rd + major 3rd: A–C–E (3 + 4 half steps)

Hear the difference? Same recipe, flipped.`,
          visual: {
            keyboard: { from: 'A3', to: 'A4', labels: 'all', marks: { C4: 'chord', E4: 'chord', G4: 'chord' } },
            audio: [
              { label: 'C major (4 + 3)', notes: [['C4', 'E4', 'G4']], dur: 1.8 },
              { label: 'A minor (3 + 4)', notes: [['A3', 'C4', 'E4']], dur: 1.8 },
            ],
          },
        },
        {
          kind: 'quiz',
          question: 'How many half steps are in a minor 3rd?',
          options: ['3', '4', '2', '5'],
          answer: 0,
          explain: 'Minor 3rd = 3 half steps. Major 3rd = 4.',
        },
        {
          kind: 'play',
          prompt: 'Find the major 3rd above D: play D, then the note 4 half steps higher.',
          target: { type: 'sequence', notes: ['D4', 'F#4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          hint: 'D → D♯ → E → F → F♯.',
          success: 'D to F♯: the major 3rd that makes a D major chord sound bright.',
        },
        {
          kind: 'quiz',
          question: 'E up to G is a…',
          options: ['Minor 3rd', 'Major 3rd'],
          answer: 0,
          explain: 'E → F → F♯ → G is 3 half steps: a minor 3rd. (E to G♯ would be major.)',
        },
      ],
    },
    {
      id: 'u4-l3',
      title: 'The major scale',
      subtitle: 'W W H W W W H',
      minutes: 6,
      icon: 'waves',
      steps: [
        {
          kind: 'explain',
          title: 'A recipe for every key',
          body: `A **scale** is a set of notes in order. The **major scale** follows a recipe of **whole steps (W)** and **half steps (H)**:

**W W H W W W H**

Start on C, play only white keys, and you get it for free: C D E F G A B C. The half steps land on E–F and B–C, exactly where there's no black key.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: 'root', D4: 'scale', E4: 'scale', F4: 'scale', G4: 'scale', A4: 'scale', B4: 'scale', C5: 'root' } },
            audio: [{ label: 'C major scale', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], gap: 0.36 }],
          },
        },
        {
          kind: 'widget',
          title: 'Build it step by step',
          body: 'Press **Next step** (or play the next note on your keyboard) and watch where the half steps fall.',
          widget: { type: 'step-pattern', tonic: 'C4', scale: 'major' },
        },
        {
          kind: 'explain',
          title: 'Same recipe, new start',
          body: `Start on G and follow W W H W W W H: G A B C D E **F♯** G.

To keep the recipe, F has to become **F♯**. That's why the key of **G major has one sharp**. Every major key works this way: same pattern, different black keys.`,
          visual: {
            keyboard: { from: 'G4', to: 'G5', labels: 'all', marks: { G4: 'root', A4: 'scale', B4: 'scale', C5: 'scale', D5: 'scale', E5: 'scale', 'F#5': 'chord', G5: 'root' } },
            audio: [{ label: 'G major scale', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'], gap: 0.36 }],
          },
          guitar: `It's why a capo works. Moving a shape up keeps its W/H pattern. On piano you keep the pattern by switching some white keys for black ones.`,
        },
        {
          kind: 'widget',
          title: 'Try other starting notes',
          body: 'Build G major, then tap other start notes (D, F, B♭…) and see which black keys each one needs.',
          widget: { type: 'step-pattern', tonic: 'G4', scale: 'major' },
        },
        {
          kind: 'quiz',
          question: 'What is the 4th note of the F major scale?',
          options: ['B♭', 'B', 'A', 'C'],
          answer: 0,
          explain: 'F G A B♭ C D E F. From A, the recipe needs a half step, so B becomes B♭.',
        },
        {
          kind: 'play',
          prompt: 'Play the G major scale going up: G A B C D E F♯ G.',
          target: { type: 'sequence', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'] },
          keyboard: { from: 'G4', to: 'G5', labels: 'all' },
          hint: 'Don’t forget the F♯!',
        },
        {
          kind: 'quiz',
          question: 'What is the step pattern of the major scale?',
          options: ['W W H W W W H', 'W H W W H W W', 'W W W H W W H', 'H W W W H W W'],
          answer: 0,
          explain: 'W W H W W W H. (W H W W H W W is the natural minor, coming soon.)',
        },
        {
          kind: 'play',
          prompt: 'Challenge: play the F major scale going up.',
          body: 'One flat: B♭.',
          target: { type: 'sequence', notes: ['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'] },
          keyboard: { from: 'F4', to: 'F5', labels: 'all' },
          success: 'F major. You can build a major scale from any note now.',
        },
      ],
    },
    {
      id: 'u4-l4',
      title: 'Scale fingering',
      subtitle: 'Thumb under, finger over',
      minutes: 6,
      icon: 'hand',
      steps: [
        {
          kind: 'explain',
          title: 'Eight notes, five fingers',
          body: `A one-octave scale has 8 notes, but you only have 5 fingers. Pianists solve it by **tucking the thumb under**.

**Right hand, C major going up:** 1 2 3, tuck the thumb under to F, then 1 2 3 4 5.

**Coming down:** 5 4 3 2 1, then **finger 3 crosses over** the thumb to E, and 2 1.`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 1, G4: 2, A4: 3, B4: 4, C5: 5 } },
          },
          guitar: `Different instrument, same goal as good fretting-hand fingering: set your hand up so the next notes are already under your fingers, with no awkward jumps.`,
        },
        {
          kind: 'play',
          prompt: 'Right hand, C major up: fingers 1 2 3, thumb under, 1 2 3 4 5.',
          target: { type: 'sequence', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 1, G4: 2, A4: 3, B4: 4, C5: 5 } },
          showTargets: true,
        },
        {
          kind: 'play',
          prompt: 'Now down: 5 4 3 2 1, finger 3 crosses over, then 2 1.',
          target: { type: 'sequence', notes: ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 1, G4: 2, A4: 3, B4: 4, C5: 5 } },
        },
        {
          kind: 'explain',
          title: 'Left hand',
          body: `The left hand mirrors it.

**Left hand, C major going up:** 5 4 3 2 1, then **finger 3 crosses over** the thumb to A, then 2 1.

**Coming down:** 1 2 3, tuck the thumb under to G, then 1 2 3 4 5.`,
          visual: {
            keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, D3: 4, E3: 3, F3: 2, G3: 1, A3: 3, B3: 2, C4: 1 } },
          },
        },
        {
          kind: 'play',
          prompt: 'Left hand, C major up: 5 4 3 2 1, 3 over, 2 1.',
          target: { type: 'sequence', notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'] },
          keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, D3: 4, E3: 3, F3: 2, G3: 1, A3: 3, B3: 2, C4: 1 } },
          showTargets: true,
        },
        {
          kind: 'quiz',
          question: 'Right hand, C major going up: which finger plays F?',
          options: ['1 (the thumb, tucked under)', '4', '2', '3'],
          answer: 0,
          explain: 'After 1 2 3 on C D E, the thumb slides under to play F.',
        },
        {
          kind: 'explain',
          title: 'Making it smooth',
          body: `- Start moving the thumb toward F **as soon as** it has played C, so it's already waiting.
- Keep your wrist level and quiet; no elbow flapping.
- Practise each hand **separately and slowly** first, then use the metronome to speed up a little at a time.`,
          tip: 'G, D, A and E major use exactly the same fingering as C major, in both hands.',
        },
        {
          kind: 'play',
          prompt: 'Bonus: G major, right hand, same fingering (1 2 3, thumb under, 1 2 3 4 5).',
          target: { type: 'sequence', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'] },
          keyboard: { from: 'G4', to: 'G5', labels: 'all', fingers: { G4: 1, A4: 2, B4: 3, C5: 1, D5: 2, E5: 3, 'F#5': 4, G5: 5 } },
          success: 'Same shape, new key: that’s how scale fingering pays off.',
        },
      ],
    },
    {
      id: 'u4-l5',
      title: 'Minor scales',
      subtitle: 'Natural, relative and harmonic minor',
      minutes: 6,
      icon: 'music4',
      steps: [
        {
          kind: 'explain',
          title: 'The natural minor scale',
          body: `The **natural minor** scale has its own recipe:

**W H W W H W W**

From A, using only white keys: A B C D E F G A. Darker and more wistful than C major.`,
          visual: {
            keyboard: { from: 'A3', to: 'A4', labels: 'all', marks: { A3: 'root', B3: 'scale', C4: 'scale', D4: 'scale', E4: 'scale', F4: 'scale', G4: 'scale', A4: 'root' } },
            audio: [{ label: 'A natural minor', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], gap: 0.36 }],
          },
        },
        {
          kind: 'explain',
          title: 'Relative minor',
          body: `Notice that A minor uses **exactly the same notes as C major**, just starting on A.

Every major key has a **relative minor** with the same notes, starting on the **6th note** of the major scale: C major ↔ A minor, G major ↔ E minor, F major ↔ D minor.`,
          visual: {
            audio: [
              { label: 'C major', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], gap: 0.32 },
              { label: 'A minor', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], gap: 0.32 },
            ],
          },
          guitar: `You've felt this if you've played Am and C in the same song: they're relatives. Same scale, and the two chords even share two notes (C and E).`,
        },
        {
          kind: 'widget',
          title: 'Build the natural minor',
          body: 'Watch where the half steps land this time: after the 2nd note and after the 5th.',
          widget: { type: 'step-pattern', tonic: 'A3', scale: 'minor' },
        },
        {
          kind: 'quiz',
          question: 'What is the relative minor of G major?',
          options: ['E minor', 'A minor', 'B minor', 'D minor'],
          answer: 0,
          explain: 'The 6th note of G major (G A B C D E) is E. E minor has the same one sharp, F♯.',
        },
        {
          kind: 'explain',
          title: 'Harmonic minor',
          body: `Raise the **7th note** of the natural minor by a half step and you get the **harmonic minor**: A B C D E F **G♯** A.

That G♯ leans hard back up to A, which gives this scale its dramatic, slightly exotic sound. It's also why minor-key songs so often use an **E major** chord (E G♯ B) instead of E minor.`,
          visual: {
            keyboard: { from: 'A3', to: 'A4', labels: 'all', marks: { A3: 'root', B3: 'scale', C4: 'scale', D4: 'scale', E4: 'scale', F4: 'scale', 'G#4': 'chord', A4: 'root' } },
            audio: [{ label: 'A harmonic minor', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G#4', 'A4'], gap: 0.36 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play A natural minor going up: A B C D E F G A.',
          body: 'Right hand, same fingering as C major: 1 2 3, thumb under, 1 2 3 4 5.',
          target: { type: 'sequence', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'] },
          keyboard: { from: 'A3', to: 'A4', labels: 'all', fingers: { A3: 1, B3: 2, C4: 3, D4: 1, E4: 2, F4: 3, G4: 4, A4: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Now A harmonic minor: the same, but with G♯.',
          target: { type: 'sequence', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G#4', 'A4'] },
          keyboard: { from: 'A3', to: 'A4', labels: 'all', fingers: { A3: 1, B3: 2, C4: 3, D4: 1, E4: 2, F4: 3, 'G#4': 4, A4: 5 } },
          success: 'Hear that pull from G♯ up to A?',
        },
        {
          kind: 'quiz',
          question: 'Which scale has the step pattern W H W W H W W?',
          options: ['Natural minor', 'Major', 'Harmonic minor', 'Chromatic'],
          answer: 0,
          explain: 'A to A on the white keys: W H W W H W W, the natural minor.',
        },
      ],
    },
    {
      id: 'u4-l6',
      title: 'Pentatonic & blues',
      subtitle: 'The scales you already solo with',
      minutes: 5,
      icon: 'guitar',
      steps: [
        {
          kind: 'explain',
          title: 'Five-note scales',
          body: `**Pentatonic** means five notes. The **major pentatonic** is the major scale without its 4th and 7th: C D E G A.

With no half steps, nothing clashes, which is why it sounds good over almost anything. Fun fact: the **black keys on their own** form a pentatonic scale (G♭ major pentatonic).`,
          visual: {
            keyboard: { from: 'C4', to: 'C5', labels: 'all', marks: { C4: 'root', D4: 'scale', E4: 'scale', G4: 'scale', A4: 'scale', C5: 'root' } },
            audio: [
              { label: 'C major pentatonic', notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], gap: 0.36 },
              { label: 'Black keys only', notes: ['Gb4', 'Ab4', 'Bb4', 'Db5', 'Eb5', 'Gb5'], gap: 0.36 },
            ],
          },
        },
        {
          kind: 'play',
          prompt: 'Play all five black keys in one octave, in any order.',
          body: 'Then keep improvising on black keys only. Everything you play will sound nice!',
          target: { type: 'set', notes: ['F#4', 'G#4', 'A#4', 'C#5', 'D#5'], anyOctave: true },
          keyboard: { from: 'C4', to: 'C6', labels: 'none' },
          success: 'That’s a whole pentatonic scale. No wrong notes possible!',
        },
        {
          kind: 'explain',
          title: 'Minor pentatonic',
          body: `**A minor pentatonic**: A C D E G. Same five notes as C major pentatonic, starting from A.

This is *the* rock and blues soloing scale.`,
          visual: {
            keyboard: { from: 'A3', to: 'A4', labels: 'all', marks: { A3: 'root', C4: 'scale', D4: 'scale', E4: 'scale', G4: 'scale', A4: 'root' } },
            audio: [{ label: 'A minor pentatonic', notes: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'], gap: 0.36 }],
          },
          guitar: `It's your “box 1” at the 5th fret: A C D E G. Every lick you know from that box works here, note for note.`,
        },
        {
          kind: 'explain',
          title: 'The blues scale',
          body: `Add one spicy note to the minor pentatonic, the **♭5** or “blue note”, and you get the **blues scale**: A C D **E♭** E G.

Slide from E♭ up to E and you're instantly playing the blues.`,
          visual: {
            keyboard: { from: 'A3', to: 'A4', labels: 'all', marks: { A3: 'root', C4: 'scale', D4: 'scale', Eb4: 'chord', E4: 'scale', G4: 'scale', A4: 'root' } },
            audio: [{ label: 'A blues scale', notes: ['A3', 'C4', 'D4', 'Eb4', 'E4', 'G4', 'A4'], gap: 0.33 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play the A blues scale going up: A C D E♭ E G A.',
          target: { type: 'sequence', notes: ['A3', 'C4', 'D4', 'Eb4', 'E4', 'G4', 'A4'] },
          keyboard: { from: 'A3', to: 'A4', labels: 'all' },
        },
        {
          kind: 'quiz',
          question: 'Which notes are in C major pentatonic?',
          options: ['C D E G A', 'C D E F G', 'C E G B D', 'C D F G A♭'],
          answer: 0,
          explain: 'The C major scale without F (the 4th) and B (the 7th).',
        },
        {
          kind: 'quiz',
          question: 'What is the “blue note” in the A blues scale?',
          options: ['E♭', 'F♯', 'B♭', 'G♯'],
          answer: 0,
          explain: 'The ♭5 of A is E♭.',
        },
        {
          kind: 'explain',
          title: 'Your scale vocabulary',
          body: `Major, natural minor, harmonic minor, pentatonic and blues: you now know the scales behind most pop, rock and film music.

Next unit, we stack these notes into **chords**.`,
          tip: 'Open **Free Play**, hold a low A with your left hand, and wander around the A minor pentatonic with your right. Instant blues jam.',
        },
      ],
    },
  ],
}
