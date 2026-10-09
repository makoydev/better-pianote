import type { StaffItem } from '../../components/staff/Staff'
import type { Unit } from '../types'

const C_POSITION = { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 }

/** One bar of a rhythm on the one-line staff, with counting written underneath. */
const beats = (durs: ('w' | 'h' | 'q' | '8' | 'hr' | 'qr' | '8r')[], counts: string[]): StaffItem[] =>
  durs.map((d, i) => (d.endsWith('r') ? { dur: d.slice(0, -1) as 'h' | 'q' | '8', text: counts[i] } : { notes: ['B4'], dur: d as 'w' | 'h' | 'q' | '8', text: counts[i] }))

export const unit3: Unit = {
  id: 'u3',
  title: 'Rhythm & Time',
  subtitle: 'Beats, note lengths and counting like a pro',
  color: '#ff7b6b',
  icon: 'drum',
  lessons: [
    {
      id: 'u3-l1',
      title: 'Feel the beat',
      subtitle: 'Pulse, tempo and BPM',
      minutes: 4,
      icon: 'activity',
      steps: [
        {
          kind: 'explain',
          title: 'The beat',
          body: `Under almost every song there's a steady pulse: the **beat**. It's what you tap your foot or nod your head to.

How fast the beats go is the **tempo**, measured in **BPM**: beats per minute. At **60 BPM** you get one beat every second. At **120 BPM**, two every second.`,
          visual: {
            audio: [
              { label: '60 BPM', notes: ['C4', 'C4', 'C4', 'C4'], gap: 1, dur: 0.4 },
              { label: '120 BPM', notes: ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'], gap: 0.5, dur: 0.3 },
            ],
          },
          guitar: `When you strum along to a song, your strumming hand is keeping the beat. On piano both hands are busy playing, so the beat lives in your foot or your head instead.`,
        },
        {
          kind: 'widget',
          title: 'Tap along',
          body: 'Press **Start**, then tap the big pad (or press Space, or play any key on your keyboard) exactly on each click. Try for three **Perfect!** taps in a row.',
          widget: { type: 'metronome', bpm: 80, beats: 4 },
          tip: 'Don’t chase the click. Listen to two or three clicks first, feel the gap between them, then join in.',
        },
        {
          kind: 'explain',
          title: 'Strong and weak beats',
          body: `Beats come in groups. The **first beat** of each group is the strongest: **ONE** two three four, **ONE** two three four.

That's why the metronome plays beat one higher. When you count while you play, lean on the one.`,
          visual: {
            audio: [{ label: 'ONE two three four', notes: ['C5', 'C4', 'C4', 'C4', 'C5', 'C4', 'C4', 'C4'], gap: 0.5, dur: 0.3 }],
          },
        },
        {
          kind: 'quiz',
          question: 'At 60 BPM, how many beats happen in one second?',
          options: ['1', '2', '60', '½'],
          answer: 0,
          explain: '60 beats per minute = 60 beats in 60 seconds = one beat per second.',
        },
        {
          kind: 'quiz',
          question: 'A song at 120 BPM compared with one at 60 BPM…',
          options: ['has beats twice as fast', 'has beats twice as slow', 'is twice as loud', 'has twice as many notes in the melody'],
          answer: 0,
          explain: 'Twice the BPM means beats come twice as often. Tempo is about speed, not volume.',
        },
        {
          kind: 'play',
          prompt: 'Play middle C four times, slow and steady like a clock.',
          body: 'Count out loud as you play: **one, two, three, four**.',
          target: { type: 'sequence', notes: ['C4', 'C4', 'C4', 'C4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all' },
          success: 'Steady beats are the foundation of everything else.',
        },
        {
          kind: 'explain',
          title: 'Tempo words',
          body: `Sheet music often names the tempo with old Italian words instead of a number:

- **Adagio**: slow (around 70 BPM)
- **Andante**: at a walking pace (around 90)
- **Moderato**: moderate (around 110)
- **Allegro**: fast and lively (around 130 or more)
- **Presto**: very fast`,
          tip: 'Practise anything new slowly. Speed comes from playing it right many times, not from rushing.',
        },
        {
          kind: 'quiz',
          question: 'What does Andante mean?',
          options: ['At a walking pace', 'Very fast', 'Getting louder', 'Very slow'],
          answer: 0,
          explain: 'Andante comes from the Italian for “walking”: a relaxed, moving tempo.',
        },
      ],
    },
    {
      id: 'u3-l2',
      title: 'Note lengths',
      subtitle: 'Whole, half and quarter notes, and rests',
      minutes: 5,
      icon: 'clock',
      steps: [
        {
          kind: 'explain',
          title: 'How long does a note last?',
          body: `On the staff, a note's **position** tells you which key to play. Its **shape** tells you how long to hold it, counted in beats.

- **Whole note** (an open oval, no stem): **4 beats**
- **Half note** (open, with a stem): **2 beats**
- **Quarter note** (filled in, with a stem): **1 beat**`,
          visual: {
            staff: {
              clef: 'rhythm',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                ...beats(['w'], ['1 2 3 4']),
                { bar: 'single' },
                ...beats(['h', 'h'], ['1 2', '3 4']),
                { bar: 'single' },
                ...beats(['q', 'q', 'q', 'q'], ['1', '2', '3', '4']),
                { bar: 'final' },
              ],
            },
          },
        },
        {
          kind: 'widget',
          title: 'Split it in half',
          body: 'Each note value is half as long as the one above it. Tap a row to hear it against the beat.',
          widget: { type: 'note-values' },
        },
        {
          kind: 'quiz',
          question: 'How many beats does this note last?',
          visual: { staff: { clef: 'treble', items: [{ notes: ['G4'], dur: 'h' }] } },
          options: ['2', '1', '4', '½'],
          answer: 0,
          explain: 'Open notehead with a stem: a half note, 2 beats.',
        },
        {
          kind: 'quiz',
          question: 'Which note lasts the longest?',
          options: ['Whole note', 'Half note', 'Quarter note', 'Eighth note'],
          answer: 0,
          explain: 'A whole note lasts 4 beats, a whole bar of 4/4.',
        },
        {
          kind: 'play',
          prompt: 'Read and play: hold each note for its full length.',
          body: 'Half note C (count 1-2), half note D (3-4), then whole note E (1-2-3-4).',
          target: { type: 'sequence', notes: ['C4', 'D4', 'E4'] },
          staff: {
            clef: 'treble',
            time: [4, 4],
            spacing: 'proportional',
            items: [
              { notes: [{ note: 'C4', finger: 1 }], dur: 'h', text: '1 2' },
              { notes: [{ note: 'D4', finger: 2 }], dur: 'h', text: '3 4' },
              { bar: 'single' },
              { notes: [{ note: 'E4', finger: 3 }], dur: 'w', text: '1 2 3 4' },
              { bar: 'final' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: C_POSITION },
        },
        {
          kind: 'explain',
          title: 'Rests: counted silence',
          body: `Silence is counted too. Every note length has a matching **rest**:

- **Whole rest**: hangs *down* from a line. A full bar of silence.
- **Half rest**: sits *up* on a line. 2 beats.
- **Quarter rest**: the squiggle. 1 beat.

Keep counting through rests, just as you would through notes.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [{ dur: 'w', text: 'whole rest' }, { bar: 'single' }, { dur: 'h', text: 'half' }, { dur: 'q', text: 'quarter' }, { dur: 'q' }, { bar: 'final' }],
            },
          },
          tip: 'Memory trick: the **whole** rest looks like a *hole* in the ground; the **half** rest looks like a *hat*.',
        },
        {
          kind: 'quiz',
          question: 'What is this symbol?',
          visual: { staff: { clef: 'treble', items: [{ dur: 'h' }] } },
          options: ['Half rest (2 beats)', 'Whole rest (4 beats)', 'Quarter rest (1 beat)', 'Half note'],
          answer: 0,
          explain: 'It sits on top of the middle line like a hat: a half rest.',
        },
        {
          kind: 'quiz',
          question: 'In a bar of 4 beats, which pair fills the bar exactly?',
          options: ['Half + half', 'Half + quarter', 'Whole + quarter', 'Quarter + quarter'],
          answer: 0,
          explain: '2 + 2 = 4 beats.',
        },
      ],
    },
    {
      id: 'u3-l3',
      title: 'Time signatures & bars',
      subtitle: '4/4, 3/4 and counting out loud',
      minutes: 5,
      icon: 'grid',
      steps: [
        {
          kind: 'explain',
          title: 'Bars',
          body: `Music is chopped into **bars** (also called **measures**) by vertical **bar lines**. Every bar holds the same number of beats, so long pieces stay easy to read and count.

A **double bar line** with a thick line marks the end.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['C4'], text: '1' },
                { notes: ['D4'], text: '2' },
                { notes: ['E4'], text: '3' },
                { notes: ['F4'], text: '4' },
                { bar: 'single' },
                { notes: ['G4'], dur: 'h', text: '1 2' },
                { notes: ['G4'], dur: 'h', text: '3 4' },
                { bar: 'final' },
              ],
            },
          },
        },
        {
          kind: 'explain',
          title: 'The time signature',
          body: `The two stacked numbers at the start are the **time signature**.

- **Top number**: how many beats in each bar.
- **Bottom number**: which note gets one beat (**4** = a quarter note).

So **4/4** means four quarter-note beats per bar. It's so common it's nicknamed **common time**. **3/4** means three beats per bar: the waltz feel, *ONE two three*.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [3, 4],
              spacing: 'proportional',
              items: [
                { notes: ['C4'], dur: 'h', text: '1 2' },
                { notes: ['E4'], text: '3' },
                { bar: 'single' },
                { notes: ['G4'], dur: 'h', text: '1 2' },
                { notes: ['E4'], text: '3' },
                { bar: 'final' },
              ],
            },
            audio: [
              { label: '4/4 feel', notes: ['C3', 'G4', 'G4', 'G4', 'C3', 'G4', 'G4', 'G4'], gap: 0.45, dur: 0.35 },
              { label: '3/4 waltz', notes: ['C3', 'G4', 'G4', 'C3', 'G4', 'G4'], gap: 0.45, dur: 0.35 },
            ],
          },
          guitar: `Strumming patterns live inside these bars. A classic “down, down-up, up-down-up” strum is one bar of 4/4. Waltz strums (bass, strum, strum) are 3/4.`,
        },
        {
          kind: 'quiz',
          question: 'How many beats are in each bar of this music?',
          visual: { staff: { clef: 'treble', time: [3, 4], spacing: 'proportional', items: [{ notes: ['A4'], dur: 'h' }, { notes: ['B4'] }, { bar: 'single' }] } },
          options: ['3', '4', '2', '6'],
          answer: 0,
          explain: 'The top number of the time signature is 3: three beats per bar.',
        },
        {
          kind: 'quiz',
          question: 'In 4/4, what does the bottom 4 mean?',
          options: ['A quarter note gets one beat', 'There are 4 bars', 'Play at 4 BPM', 'Use 4 fingers'],
          answer: 0,
          explain: 'The bottom number names the note that counts as one beat: 4 = quarter note.',
        },
        {
          kind: 'play',
          prompt: 'Read and play these two bars of 4/4 with your right hand.',
          body: 'Thumb on middle C. Count 1 2 3 4 in each bar.',
          target: { type: 'sequence', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'] },
          staff: {
            clef: 'treble',
            time: [4, 4],
            spacing: 'proportional',
            items: [
              { notes: [{ note: 'E4', finger: 3 }], text: '1' },
              { notes: ['E4'], text: '2' },
              { notes: [{ note: 'F4', finger: 4 }], text: '3' },
              { notes: [{ note: 'G4', finger: 5 }], text: '4' },
              { bar: 'single' },
              { notes: ['G4'], text: '1' },
              { notes: ['F4'], text: '2' },
              { notes: ['E4'], text: '3' },
              { notes: [{ note: 'D4', finger: 2 }], text: '4' },
              { bar: 'final' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: C_POSITION },
          success: 'That’s the opening of Beethoven’s “Ode to Joy”!',
        },
        {
          kind: 'quiz',
          question: 'Which time signature fits a waltz: ONE two three, ONE two three?',
          options: ['3/4', '4/4', '2/4', '2/2'],
          answer: 0,
          explain: 'Three beats per bar, with a quarter note as the beat: 3/4.',
        },
        {
          kind: 'explain',
          title: 'Count out loud',
          body: `Pianists count while they practise: “**1** 2 3 4” in every bar, holding each note for its full count.

It feels a bit silly at first. It's also the single best habit for steady rhythm, and it's how you'll keep your place when both hands are busy.`,
          tip: 'Count **out loud**, not in your head, the first few times through anything new.',
        },
        {
          kind: 'play',
          prompt: 'A little waltz in 3/4. Read it and play it, counting 1 2 3.',
          target: { type: 'sequence', notes: ['C4', 'E4', 'G4', 'E4', 'F4', 'D4', 'C4'] },
          staff: {
            clef: 'treble',
            time: [3, 4],
            spacing: 'proportional',
            items: [
              { notes: [{ note: 'C4', finger: 1 }], dur: 'h', text: '1 2' },
              { notes: [{ note: 'E4', finger: 3 }], text: '3' },
              { bar: 'single' },
              { notes: [{ note: 'G4', finger: 5 }], dur: 'h', text: '1 2' },
              { notes: ['E4'], text: '3' },
              { bar: 'single' },
              { notes: [{ note: 'F4', finger: 4 }], dur: 'h', text: '1 2' },
              { notes: [{ note: 'D4', finger: 2 }], text: '3' },
              { bar: 'single' },
              { notes: ['C4'], dur: 'h', text: '1 2' },
              { dur: 'q', text: '3' },
              { bar: 'final' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: C_POSITION },
          success: 'One-two-three, one-two-three. You just read a waltz!',
        },
      ],
    },
    {
      id: 'u3-l4',
      title: 'Eighth notes & rests',
      subtitle: 'Splitting the beat: 1 & 2 &',
      minutes: 5,
      icon: 'music2',
      steps: [
        {
          kind: 'explain',
          title: 'Splitting the beat',
          body: `An **eighth note** lasts **half a beat**. On its own it has a little **flag**; two or more in a row are joined by a **beam**.

Count eighth notes with “and”: **1 & 2 & 3 & 4 &**. The numbers land on the beat, the “&”s land exactly halfway between.`,
          visual: {
            staff: {
              clef: 'rhythm',
              time: [4, 4],
              spacing: 'proportional',
              items: [...beats(['8', '8', '8', '8', '8', '8', '8', '8'], ['1', '&', '2', '&', '3', '&', '4', '&']), { bar: 'final' }],
            },
            audio: [{ label: 'Eighth notes (1 & 2 &…)', notes: ['C5', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'], gap: 0.3, dur: 0.22 }],
          },
        },
        {
          kind: 'quiz',
          question: 'How many eighth notes fit in one beat?',
          options: ['2', '1', '4', '8'],
          answer: 0,
          explain: 'Each eighth note is half a beat, so two make one beat: “1 &”.',
        },
        {
          kind: 'explain',
          title: 'Mixing quarters and eighths',
          body: `Most melodies mix note lengths. Keep the “&”s going in your head even when you're playing longer notes, and the eighths will always land in the right place.

Here: quarter, two eighths, quarter, quarter = 1 + ½ + ½ + 1 + 1 = **4 beats**.`,
          visual: {
            staff: {
              clef: 'rhythm',
              time: [4, 4],
              spacing: 'proportional',
              items: [...beats(['q', '8', '8', 'q', 'q'], ['1', '2', '&', '3', '4']), { bar: 'final' }],
            },
            audio: [{ label: 'Hear it', notes: ['C5', 'C4', 'C4', 'C4', 'C4'], gap: 0.5, dur: 0.3 }],
          },
        },
        {
          kind: 'explain',
          title: 'The eighth rest',
          body: `The **eighth rest** looks like a little slanted 7 with a dot. It's half a beat of silence.

Together with the quarter rest (the squiggle, 1 beat), it's the rest you'll see most in pop piano music.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['G4'], dur: 'q', text: '1' },
                { dur: 'q', text: '2' },
                { dur: '8', text: '3' },
                { notes: ['G4'], dur: '8', text: '&' },
                { notes: ['G4'], dur: 'q', text: '4' },
                { bar: 'final' },
              ],
            },
          },
        },
        {
          kind: 'play',
          prompt: 'Read and play “Hot Cross Buns”, counting the eighth notes in bar 3.',
          body: 'Bar 3 goes: **1 & 2 & 3 & 4 &**, four Cs then four Ds.',
          target: { type: 'sequence', notes: ['E4', 'D4', 'C4', 'E4', 'D4', 'C4', 'C4', 'C4', 'C4', 'C4', 'D4', 'D4', 'D4', 'D4', 'E4', 'D4', 'C4'] },
          staff: {
            clef: 'treble',
            time: [4, 4],
            spacing: 'proportional',
            items: [
              { notes: [{ note: 'E4', finger: 3 }] },
              { notes: [{ note: 'D4', finger: 2 }] },
              { notes: [{ note: 'C4', finger: 1 }], dur: 'h' },
              { bar: 'single' },
              { notes: ['E4'] },
              { notes: ['D4'] },
              { notes: ['C4'], dur: 'h' },
              { bar: 'single' },
              { notes: ['C4'], dur: '8', text: '1' },
              { notes: ['C4'], dur: '8', text: '&' },
              { notes: ['C4'], dur: '8', text: '2' },
              { notes: ['C4'], dur: '8', text: '&' },
              { notes: ['D4'], dur: '8', text: '3' },
              { notes: ['D4'], dur: '8', text: '&' },
              { notes: ['D4'], dur: '8', text: '4' },
              { notes: ['D4'], dur: '8', text: '&' },
              { bar: 'single' },
              { notes: ['E4'] },
              { notes: ['D4'] },
              { notes: ['C4'], dur: 'h' },
              { bar: 'final' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: C_POSITION },
          success: 'Hot Cross Buns, eighth notes and all!',
        },
        {
          kind: 'quiz',
          question: 'How many beats are in this bar?',
          visual: {
            staff: { clef: 'rhythm', time: [4, 4], spacing: 'proportional', items: [...beats(['q', '8', '8', 'h'], ['', '', '', '']), { bar: 'final' }] },
          },
          options: ['4', '5', '3', '6'],
          answer: 0,
          explain: '1 + ½ + ½ + 2 = 4 beats. A full bar of 4/4.',
        },
        {
          kind: 'quiz',
          question: 'How long is an eighth rest?',
          options: ['½ beat', '1 beat', '2 beats', '¼ beat'],
          answer: 0,
          explain: 'Same as an eighth note: half a beat, just silent.',
        },
      ],
    },
    {
      id: 'u3-l5',
      title: 'Dots & ties',
      subtitle: 'Making notes longer',
      minutes: 5,
      icon: 'timer',
      steps: [
        {
          kind: 'explain',
          title: 'The dot',
          body: `A **dot** after a note adds **half of its value**.

- **Dotted half note**: 2 + 1 = **3 beats**. It fills a whole bar of 3/4.
- **Dotted quarter note**: 1 + ½ = **1½ beats**, usually followed by an eighth note to finish the second beat.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['G4'], dur: 'h', dots: 1, text: '1 2 3' },
                { notes: ['G4'], dur: 'q', text: '4' },
                { bar: 'single' },
                { notes: ['A4'], dur: 'q', dots: 1, text: '1 (2)' },
                { notes: ['A4'], dur: '8', text: '&' },
                { notes: ['B4'], dur: 'h', text: '3 4' },
                { bar: 'final' },
              ],
            },
            audio: [{ label: 'Dotted quarter + eighth', notes: ['A4', 'A4', 'B4'], gap: 0.5 }],
          },
        },
        {
          kind: 'quiz',
          question: 'How long does a dotted half note last?',
          options: ['3 beats', '2½ beats', '4 beats', '2 beats'],
          answer: 0,
          explain: 'Half note (2) + half of that (1) = 3 beats.',
        },
        {
          kind: 'explain',
          title: 'Ties',
          body: `A **tie** is a curved line joining two notes of the **same pitch**. Play the first one and keep holding it through the second; don't play it again.

Ties are how a note can last across a bar line.`,
          visual: {
            staff: {
              clef: 'treble',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['C5'], dur: 'h', text: '1 2' },
                { notes: ['E5'], dur: 'h', text: '3 4', tie: true },
                { bar: 'single' },
                { notes: ['E5'], dur: 'h', text: '(1 2)' },
                { notes: ['D5'], dur: 'h', text: '3 4' },
                { bar: 'final' },
              ],
            },
          },
          tip: 'A tie joins the *same* note. A similar curve over *different* notes is a **slur**: it means play them smoothly, connected (legato).',
        },
        {
          kind: 'quiz',
          question: 'How do you play two tied quarter notes on the same C?',
          visual: {
            staff: { clef: 'treble', time: [4, 4], spacing: 'proportional', items: [{ notes: ['C5'], dur: 'q', tie: true }, { notes: ['C5'], dur: 'q' }, { dur: 'h' }, { bar: 'single' }] },
          },
          options: ['Play it once and hold for 2 beats', 'Play it twice', 'Play it louder', 'Skip both notes'],
          answer: 0,
          explain: 'Tied notes become one longer note: 1 + 1 = 2 beats.',
        },
        {
          kind: 'play',
          prompt: 'Read and play the whole first line of “Ode to Joy”.',
          body: 'Watch the last bar: a **dotted quarter** (count “1 (2)”), an **eighth** (“&”), then a half note.',
          target: { type: 'sequence', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'D4'] },
          staff: {
            clef: 'treble',
            time: [4, 4],
            spacing: 'proportional',
            items: [
              { notes: [{ note: 'E4', finger: 3 }] },
              { notes: ['E4'] },
              { notes: [{ note: 'F4', finger: 4 }] },
              { notes: [{ note: 'G4', finger: 5 }] },
              { bar: 'single' },
              { notes: ['G4'] },
              { notes: ['F4'] },
              { notes: ['E4'] },
              { notes: [{ note: 'D4', finger: 2 }] },
              { bar: 'single' },
              { notes: [{ note: 'C4', finger: 1 }] },
              { notes: ['C4'] },
              { notes: ['D4'] },
              { notes: ['E4'] },
              { bar: 'single' },
              { notes: ['E4'], dur: 'q', dots: 1, text: '1 (2)' },
              { notes: ['D4'], dur: '8', text: '&' },
              { notes: ['D4'], dur: 'h', text: '3 4' },
              { bar: 'final' },
            ],
          },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: C_POSITION },
          success: 'The whole first line of Ode to Joy, dotted rhythm and all!',
        },
        {
          kind: 'quiz',
          question: 'In 3/4, which single note fills a whole bar?',
          options: ['Dotted half note', 'Whole note', 'Half note', 'Dotted quarter note'],
          answer: 0,
          explain: '3/4 has three beats per bar, and a dotted half note lasts exactly 3.',
        },
        {
          kind: 'explain',
          title: 'You can read rhythm now',
          body: `Whole, half, quarter and eighth notes, their rests, time signatures, dots and ties: that covers most of the rhythms in beginner and intermediate piano music.

Next up: the distances *between* notes, and the scales built from them.`,
          tip: 'Try the **Rhythm** game in Practice to drill these with a metronome.',
        },
      ],
    },
  ],
}
