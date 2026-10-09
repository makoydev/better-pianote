import type { StaffItem } from '../../components/staff/Staff'
import type { Unit } from '../types'

const w = (note: string, extra: Partial<StaffItem> = {}): StaffItem => ({ notes: [note], dur: 'w', ...extra })
const q = (note: string): StaffItem => ({ notes: [note], dur: 'q' })

export const unit2: Unit = {
  id: 'u2',
  title: 'Reading Notes',
  subtitle: 'Treble clef, bass clef and the grand staff',
  color: '#5cc8ff',
  icon: 'eye',
  lessons: [
    {
      id: 'u2-l1',
      title: 'The staff',
      subtitle: 'Five lines, four spaces, up means higher',
      minutes: 3,
      icon: 'music4',
      steps: [
        {
          kind: 'explain',
          title: 'Music is written on a staff',
          body: `Sheet music sits on a **staff**: five lines with four spaces between them. Every line and every space is a different note.

The rule that makes it all work: **higher on the staff means higher on the keyboard.** Each move from a line to the next space (or a space to the next line) is one letter up the alphabet.`,
          visual: {
            staff: { clef: 'treble', items: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'].map((n) => w(n)), labels: true },
            audio: [{ label: 'Hear them climb', notes: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'], gap: 0.32 }],
          },
          guitar: `Tab tells you *where to put your fingers*. A staff tells you *what the note is*, which works on any instrument. The good news: it's a picture of pitch, so up is up.`,
        },
        {
          kind: 'explain',
          title: 'Lines and spaces',
          body: `A **line note** has a staff line running through its middle. A **space note** sits in the gap between two lines.

Lines are counted from the **bottom**: line 1 is the lowest, line 5 the highest. Spaces are counted the same way.`,
          visual: {
            staff: {
              clef: 'treble',
              labels: false,
              items: [
                w('E4', { text: 'line 1' }),
                w('G4', { text: 'line 2' }),
                w('B4', { text: 'line 3' }),
                w('D5', { text: 'line 4' }),
                w('F5', { text: 'line 5' }),
              ],
            },
          },
        },
        {
          kind: 'quiz',
          question: 'Is this note on a line or in a space?',
          visual: { staff: { clef: 'treble', items: [w('G4')], labels: false } },
          options: ['On a line', 'In a space'],
          answer: 0,
          explain: 'The line runs right through the middle of the note, so it’s a line note (line 2).',
        },
        {
          kind: 'quiz',
          question: 'And this one?',
          visual: { staff: { clef: 'treble', items: [w('C5')], labels: false } },
          options: ['On a line', 'In a space'],
          answer: 1,
          explain: 'It sits between lines 3 and 4: a space note.',
        },
        {
          kind: 'explain',
          title: 'Steps and skips',
          body: `- Line → next space (or space → next line) is a **step**: the next letter, like E → F.
- Line → next line (or space → next space) is a **skip**: it skips a letter, like E → G.

Seeing steps and skips is the secret to reading fast. You'll use it a lot.`,
          visual: {
            staff: { clef: 'treble', labels: true, items: [w('E4', { text: 'step' }), w('F4'), { bar: 'double' }, w('E4', { text: 'skip' }), w('G4')] },
            audio: [
              { label: 'Step (E–F)', notes: ['E4', 'F4'], gap: 0.6 },
              { label: 'Skip (E–G)', notes: ['E4', 'G4'], gap: 0.6 },
            ],
          },
        },
        {
          kind: 'quiz',
          question: 'Is the second note higher or lower?',
          visual: { staff: { clef: 'treble', items: [w('G4'), w('D5')], labels: false } },
          options: ['Higher', 'Lower', 'The same'],
          answer: 0,
          explain: 'It sits higher on the staff, so it sounds higher.',
        },
        {
          kind: 'quiz',
          question: 'Step or skip?',
          visual: { staff: { clef: 'treble', items: [w('F4'), w('A4')], labels: false } },
          options: ['Step', 'Skip'],
          answer: 1,
          explain: 'Space to the next space skips a letter: F → (G) → A.',
        },
      ],
    },
    {
      id: 'u2-l2',
      title: 'Treble clef',
      subtitle: 'Every Good Boy Deserves Fruit',
      minutes: 6,
      icon: 'music',
      steps: [
        {
          kind: 'explain',
          title: 'The treble clef',
          body: `This curly symbol is the **treble clef**, also called the **G clef**. Its inner curl wraps around the **second line**, and that tells you the second line is **G**: the G just above middle C (G4).

The treble staff is usually for your **right hand** and the higher notes.`,
          visual: {
            staff: { clef: 'treble', items: [w('G4', { state: 'active' })], labels: true },
            audio: [{ label: 'Hear G4', notes: ['G4'] }],
          },
        },
        {
          kind: 'explain',
          title: 'Lines: Every Good Boy Deserves Fruit',
          body: `From the bottom up, the treble lines are **E G B D F**.

The classic way to remember them: **E**very **G**ood **B**oy **D**eserves **F**ruit.`,
          visual: { staff: { clef: 'treble', items: ['E4', 'G4', 'B4', 'D5', 'F5'].map((n) => w(n)), labels: true } },
        },
        {
          kind: 'explain',
          title: 'Spaces spell FACE',
          body: `The four spaces, from the bottom up, spell **F A C E**. Easy!`,
          visual: { staff: { clef: 'treble', items: ['F4', 'A4', 'C5', 'E5'].map((n) => w(n)), labels: true } },
          tip: 'Say the note names out loud as you read. It builds the connection between eye and hand much faster.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['G4'] },
          staff: { clef: 'treble', items: [w('G4')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'The clef curls around this line: it’s the G just above middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['E4'] },
          staff: { clef: 'treble', items: [w('E4')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Bottom line: **E**very. It’s the E just above middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['C5'] },
          staff: { clef: 'treble', items: [w('C5')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Third space: F A **C** E. One octave above middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['F5'] },
          staff: { clef: 'treble', items: [w('F5')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Top line: Every Good Boy Deserves **Fruit**.',
        },
        {
          kind: 'quiz',
          question: 'What is this note?',
          visual: { staff: { clef: 'treble', items: [w('A4')], labels: false } },
          options: ['A', 'F', 'C', 'E'],
          answer: 0,
          explain: 'Second space: F **A** C E.',
        },
        {
          kind: 'play',
          prompt: 'Play these four notes in order.',
          target: { type: 'sequence', notes: ['E4', 'G4', 'B4', 'D5'] },
          staff: { clef: 'treble', items: ['E4', 'G4', 'B4', 'D5'].map((n) => w(n)), labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Lines from the bottom: Every Good Boy Deserves…',
          success: 'You just read four notes in a row!',
        },
        {
          kind: 'explain',
          title: 'Landmark notes',
          body: `You don't need to recite the whole sentence every time. Learn a few **landmarks** by sight:

- **Middle C**: one short line below the staff
- **Treble G**: the second line (where the clef curls)
- **High C**: the third space

Then read any nearby note by counting steps from the closest landmark. Fluent readers do exactly this.`,
          visual: {
            staff: { clef: 'treble', items: [w('C4'), w('G4'), w('C5')], labels: true },
            keyboard: { from: 'C4', to: 'C6', labels: 'marked', marks: { C4: 'target', G4: 'target', C5: 'target' } },
          },
        },
      ],
    },
    {
      id: 'u2-l3',
      title: 'Bass clef',
      subtitle: 'Good Boys Do Fine Always',
      minutes: 6,
      icon: 'music2',
      steps: [
        {
          kind: 'explain',
          title: 'The bass clef',
          body: `This is the **bass clef**, also called the **F clef**. Its two dots sit either side of the **fourth line**, which tells you that line is **F**: the F just below middle C (F3).

The bass staff is usually for your **left hand** and the lower notes.`,
          visual: {
            staff: { clef: 'bass', items: [w('F3', { state: 'active' })], labels: true },
            audio: [{ label: 'Hear F3', notes: ['F3'] }],
          },
          guitar: `Fun fact: guitar music is written in treble clef but *sounds* an octave lower than written. The real pitches of your bass strings live down here in the bass clef.`,
        },
        {
          kind: 'explain',
          title: 'Lines: Good Boys Do Fine Always',
          body: `From the bottom up, the bass lines are **G B D F A**: **G**ood **B**oys **D**o **F**ine **A**lways.`,
          visual: { staff: { clef: 'bass', items: ['G2', 'B2', 'D3', 'F3', 'A3'].map((n) => w(n)), labels: true } },
        },
        {
          kind: 'explain',
          title: 'Spaces: All Cows Eat Grass',
          body: `The bass spaces, from the bottom up, are **A C E G**: **A**ll **C**ows **E**at **G**rass.

Notice the names don't match the treble clef: the bottom line is G here, but E in treble. In fact every line and space is named **two letters later** in the bass clef (E → G, F → A, G → B…). Mixing the two up is the most common reading mistake, so take your time here.`,
          visual: { staff: { clef: 'bass', items: ['A2', 'C3', 'E3', 'G3'].map((n) => w(n)), labels: true } },
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['F3'] },
          staff: { clef: 'bass', items: [w('F3')], labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'The two dots of the clef surround this line: it’s the F just below middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['G2'] },
          staff: { clef: 'bass', items: [w('G2')], labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'Bottom line: **G**ood. It’s the low G near the left of this keyboard.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['C3'] },
          staff: { clef: 'bass', items: [w('C3')], labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'Second space: All **C**ows… It’s the C one octave below middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['A3'] },
          staff: { clef: 'bass', items: [w('A3')], labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'Top line: Good Boys Do Fine **Always**.',
        },
        {
          kind: 'quiz',
          question: 'What is this note?',
          visual: { staff: { clef: 'bass', items: [w('D3')], labels: false } },
          options: ['D', 'B', 'F', 'G'],
          answer: 0,
          explain: 'Middle line of the bass staff: Good Boys **D**o…',
        },
        {
          kind: 'play',
          prompt: 'Play these four notes in order.',
          target: { type: 'sequence', notes: ['G2', 'B2', 'D3', 'F3'] },
          staff: { clef: 'bass', items: ['G2', 'B2', 'D3', 'F3'].map((n) => w(n)), labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'Lines from the bottom: Good Boys Do Fine…',
        },
        {
          kind: 'explain',
          title: 'Bass landmarks',
          body: `Your bass-clef landmarks:

- **Bass F**: the fourth line, between the clef's dots
- **Low C**: the second space
- **Middle C**: one short line *above* the bass staff

Find the closest landmark, then count steps.`,
          visual: {
            staff: { clef: 'bass', items: [w('C3'), w('F3'), w('C4')], labels: true },
            keyboard: { from: 'C2', to: 'C4', labels: 'marked', marks: { C3: 'target', F3: 'target', C4: 'target' } },
          },
        },
      ],
    },
    {
      id: 'u2-l4',
      title: 'The grand staff',
      subtitle: 'Both hands, with middle C in between',
      minutes: 5,
      icon: 'layers',
      steps: [
        {
          kind: 'explain',
          title: 'Two staves, one piano',
          body: `Piano music uses the **grand staff**: the treble staff on top (right hand) and the bass staff below (left hand), joined by a brace.

**Middle C** lives right between them on its own short line. It can be written in either staff, and it's the same key both times.`,
          visual: {
            staff: {
              clef: 'grand',
              labels: true,
              items: [w('C4', { staff: 'treble', text: 'treble' }), w('C4', { staff: 'bass', text: 'bass' })],
            },
            audio: [{ label: 'Middle C', notes: ['C4'] }],
          },
        },
        {
          kind: 'widget',
          title: 'See where every key lives',
          body: 'Play anything (or tap the keys) and watch it land on the grand staff. From middle C up goes on the treble staff; lower notes go on the bass staff.',
          widget: { type: 'staff-mapper', clef: 'grand' },
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['C4'] },
          staff: { clef: 'grand', items: [w('C4', { staff: 'treble' })], labels: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'c' },
          hint: 'One short line below the treble staff: middle C.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['G4'] },
          staff: { clef: 'grand', items: [w('G4')], labels: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'c' },
          hint: 'Treble staff, second line: G.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['F3'] },
          staff: { clef: 'grand', items: [w('F3')], labels: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'c' },
          hint: 'Bass staff, fourth line: F.',
        },
        {
          kind: 'play',
          prompt: 'Play both notes together.',
          body: 'Left hand on the lower note, right hand on the higher one. (On screen: tap both keys.)',
          target: { type: 'chord', notes: ['C3', 'C4'], anyOctave: false },
          staff: { clef: 'grand', items: [{ notes: ['C3', 'C4'], dur: 'w' }], labels: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'c' },
          hint: 'Bass staff second space is C3; the short line between the staves is middle C.',
        },
        {
          kind: 'quiz',
          question: 'Which hand would usually play this note?',
          visual: { staff: { clef: 'grand', items: [w('E3')], labels: false } },
          options: ['Left hand', 'Right hand'],
          answer: 0,
          explain: 'It’s on the bass staff (E3, third space), so the left hand plays it.',
        },
        {
          kind: 'play',
          prompt: 'Read across both staves: play these notes in order.',
          body: 'Left hand takes the first three, right hand the last three.',
          target: { type: 'sequence', notes: ['C3', 'E3', 'G3', 'C4', 'E4', 'G4'] },
          staff: { clef: 'grand', items: ['C3', 'E3', 'G3', 'C4', 'E4', 'G4'].map(q), labels: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'c' },
          success: 'That’s a C major arpeggio, from bass to treble!',
        },
      ],
    },
    {
      id: 'u2-l5',
      title: 'Ledger lines & accidentals',
      subtitle: 'Notes beyond the staff, and ♯ ♭ ♮ on the page',
      minutes: 6,
      icon: 'hash',
      steps: [
        {
          kind: 'explain',
          title: 'Ledger lines',
          body: `Notes above or below the staff get short extra lines called **ledger lines**. Just imagine the staff carrying on: the line-space-line pattern continues.

You already know one: middle C, one ledger line below the treble staff. **A5** sits on one ledger line *above*, and **C6** sits on the second ledger line above.`,
          visual: { staff: { clef: 'treble', items: [w('C4'), w('B3'), w('G5'), w('A5'), w('B5'), w('C6')], labels: true } },
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['A5'] },
          staff: { clef: 'treble', items: [w('A5')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'The top line is F, the space above is G, and the first ledger line is A.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['C6'] },
          staff: { clef: 'treble', items: [w('C6')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Two ledger lines above the treble staff: C6, two octaves above middle C.',
        },
        {
          kind: 'play',
          prompt: 'Now a low one. Play this note.',
          target: { type: 'note', notes: ['E2'] },
          staff: { clef: 'bass', items: [w('E2')], labels: false },
          keyboard: { from: 'C2', to: 'C4', labels: 'c' },
          hint: 'The bottom bass line is G, the space below is F, and the first ledger line below is E.',
          success: 'That’s E2: the same pitch as your guitar’s open low E string!',
        },
        {
          kind: 'explain',
          title: 'Sharps, flats and naturals on the staff',
          body: `An **accidental** sits just *before* a note, on the same line or space:

- **♯ sharp** raises it a half step
- **♭ flat** lowers it a half step
- **♮ natural** cancels a sharp or flat

An accidental lasts until the end of the **bar** (the space between two vertical bar lines). After the bar line, it's gone.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [3, 4],
              labels: true,
              items: [q('F#4'), q('F#4'), q('F4'), { bar: 'single' }, q('F#4'), q('G4'), q('A4')],
            },
          },
          tip: 'In the first bar, the second F is still sharp: the ♯ carries on until the bar line. The ♮ then cancels it.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['Bb4'] },
          staff: { clef: 'treble', items: [w('Bb4')], labels: false },
          keyboard: { from: 'C4', to: 'C5', labels: 'c' },
          hint: 'Middle line is B. The flat lowers it one key: B♭.',
        },
        {
          kind: 'play',
          prompt: 'Play this note.',
          target: { type: 'note', notes: ['C#5'] },
          staff: { clef: 'treble', items: [w('C#5')], labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'Third space is C. The sharp raises it one key: C♯.',
        },
        {
          kind: 'quiz',
          question: 'What is the second note?',
          visual: { staff: { clef: 'treble', time: [2, 4], items: [q('F#4'), q('F4'), { bar: 'single' }], labels: false } },
          options: ['F', 'F♯', 'F♭', 'E'],
          answer: 0,
          explain: 'The natural sign cancels the sharp from earlier in the bar, so it’s plain F.',
        },
        {
          kind: 'explain',
          title: 'A sneak peek: key signatures',
          body: `Writing the same sharp over and over gets messy, so music puts it once at the start of every line: the **key signature**.

One sharp on the F line means **every F is F♯**, in every octave, unless a natural says otherwise. Here's a scale with that key signature: no sharp is printed next to the F, but you still play F♯. You'll learn how keys work in Unit 6.`,
          visual: {
            staff: { clef: 'treble', keySig: 1, items: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'].map(q), labels: true },
          },
        },
        {
          kind: 'play',
          prompt: 'Play this scale. Watch the key signature!',
          target: { type: 'sequence', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'] },
          staff: { clef: 'treble', keySig: 1, items: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'].map(q), labels: false },
          keyboard: { from: 'C4', to: 'C6', labels: 'c' },
          hint: 'The key signature has one sharp on the F line, so the F near the end is F♯.',
          success: 'G major, read with a key signature. That’s real sheet-music reading.',
        },
      ],
    },
    {
      id: 'u2-l6',
      title: 'Reading by shape',
      subtitle: 'Steps, skips and your first real melody',
      minutes: 6,
      icon: 'route',
      steps: [
        {
          kind: 'explain',
          title: 'Read the shape, not every letter',
          body: `Good readers don't name every note. They find the **first** note, then read the **distance** to the next:

- a **step** (line → space) is the next white key
- a **skip** (line → line) jumps over one white key
- a bigger gap is a **leap**: count the lines and spaces

Your eyes follow the shape of the melody and your hand follows your eyes.`,
          visual: {
            staff: { clef: 'treble', labels: true, items: [q('C4'), q('D4'), q('E4'), { bar: 'double' }, q('C4'), q('E4'), q('G4')] },
            audio: [
              { label: 'Steps', notes: ['C4', 'D4', 'E4'], gap: 0.45 },
              { label: 'Skips', notes: ['C4', 'E4', 'G4'], gap: 0.45 },
            ],
          },
        },
        {
          kind: 'play',
          prompt: 'It starts on G. Read the steps.',
          target: { type: 'sequence', notes: ['G4', 'A4', 'B4', 'A4', 'G4'] },
          staff: { clef: 'treble', items: ['G4', 'A4', 'B4', 'A4', 'G4'].map(q), labels: false },
          keyboard: { from: 'C4', to: 'C5', labels: 'c' },
          hint: 'Each note is the next key up or down.',
        },
        {
          kind: 'play',
          prompt: 'It starts on middle C. Read the skips.',
          target: { type: 'sequence', notes: ['C4', 'E4', 'G4', 'E4', 'C4'] },
          staff: { clef: 'treble', items: ['C4', 'E4', 'G4', 'E4', 'C4'].map(q), labels: false },
          keyboard: { from: 'C4', to: 'C5', labels: 'c' },
          hint: 'Each skip jumps over one white key: C (D) E (F) G.',
        },
        {
          kind: 'quiz',
          question: 'Step, skip, or bigger leap?',
          visual: { staff: { clef: 'treble', items: [w('C4'), w('G4')], labels: false } },
          options: ['Step', 'Skip', 'Bigger leap'],
          answer: 2,
          explain: 'C up to G covers five letters (C D E F G): a 5th. Leaps like this are easy to spot once you see the gap.',
        },
        {
          kind: 'play',
          prompt: 'Your first real melody! It starts on E.',
          body: 'Play it at your own pace; the next note lights up as you go.',
          target: { type: 'sequence', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'D4'] },
          staff: {
            clef: 'treble',
            time: [4, 4],
            spacing: 'proportional',
            labels: false,
            items: [
              q('E4'), q('E4'), q('F4'), q('G4'), { bar: 'single' },
              q('G4'), q('F4'), q('E4'), q('D4'), { bar: 'single' },
              q('C4'), q('C4'), q('D4'), q('E4'), { bar: 'single' },
              { notes: ['E4'], dur: 'q', dots: 1 }, { notes: ['D4'], dur: '8' }, { notes: ['D4'], dur: 'h' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'c', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
          success: 'That’s Beethoven’s “Ode to Joy”. You just read it from sheet music!',
        },
        {
          kind: 'explain',
          title: 'How to get fluent',
          body: `Reading is a skill like typing: a little every day beats a lot once a week.

- Play **Note Rush** for 3–5 minutes a day (Practice tab).
- Say the note names out loud.
- Keep your eyes on the music, and feel for the black-key groups instead of looking down.
- Use landmarks and steps/skips instead of reciting EGBDF every time.`,
          tip: 'Turn off note names under the staff in Settings once you feel ready. It’s like taking the training wheels off.',
        },
      ],
    },
  ],
}
