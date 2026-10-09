import type { Unit } from '../types'

export const unit7: Unit = {
  id: 'u7',
  title: 'Play for Real',
  subtitle: 'Left-hand patterns, both hands, the pedal, playing by ear',
  color: '#4fd18b',
  icon: 'sparkles',
  lessons: [
    {
      id: 'u7-l1',
      title: 'Left-hand patterns',
      subtitle: 'Block, broken and 1-5-8',
      minutes: 6,
      icon: 'hand',
      steps: [
        {
          kind: 'explain',
          title: 'Your left hand is the band',
          body: `In most pop and ballad piano, the right hand plays the melody (or chords) and the left hand plays the **bass and the rhythm**. Three patterns go a long way:

- **Block**: the whole chord at once.
- **Broken**: chord notes one at a time.
- **Root + octave**: just the root, low and strong.`,
          visual: {
            audio: [
              { label: 'Block', notes: [['C3', 'E3', 'G3'], ['C3', 'E3', 'G3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']], gap: 0.8, dur: 1 },
              { label: 'Broken', notes: ['C3', 'E3', 'G3', 'E3', 'F2', 'A2', 'C3', 'A2'], gap: 0.3, dur: 0.6 },
              { label: 'Root + octave', notes: [['C2', 'C3'], ['C2', 'C3'], ['F2', 'F3'], ['G2', 'G3']], gap: 0.8, dur: 1 },
            ],
          },
          guitar: `Think of your thumb in Travis picking: it keeps an alternating bass going while your fingers play on top. On piano, the left hand takes over that job.`,
        },
        {
          kind: 'explain',
          title: 'The 1-5-8 pattern',
          body: `Take the chord's **root** (1), its **5th** (5) and the root an **octave** up (8). On C: **C – G – C**.

Rolling it as 1-5-8-5 gives a flowing, ballad feel. It's the kind of rolling left hand you hear under pieces like River Flows in You. Use fingers **5, 2, 1**: the hand stays still and just rocks.`,
          visual: {
            keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, G3: 2, C4: 1 } },
            staff: {
              clef: 'bass',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: ['C3'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { notes: ['C4'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { notes: ['C3'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { notes: ['C4'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { bar: 'final' },
              ],
            },
            audio: [{ label: '1-5-8 on C', notes: ['C3', 'G3', 'C4', 'G3', 'C3', 'G3', 'C4', 'G3'], gap: 0.28, dur: 0.6 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Left hand: play C – G – C (1-5-8) with fingers 5, 2, 1.',
          target: { type: 'sequence', notes: ['C3', 'G3', 'C4'] },
          keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, G3: 2, C4: 1 } },
          showTargets: true,
        },
        {
          kind: 'play',
          prompt: 'Now on A minor: A – E – A.',
          target: { type: 'sequence', notes: ['A2', 'E3', 'A3'] },
          keyboard: { from: 'A2', to: 'C4', labels: 'all', fingers: { A2: 5, E3: 2, A3: 1 } },
          hint: 'Same shape, moved down to A: pinky on A, finger 2 on E, thumb on the A above.',
        },
        {
          kind: 'widget',
          title: 'Hear it under a progression',
          body: 'Pick the **Broken** pattern to hear a rolling left hand under I–vi–IV–V. Then try it yourself with your left hand.',
          widget: { type: 'progression', key: 'C', romans: ['I', 'vi', 'IV', 'V'], bpm: 72, pattern: 'arpeggio' },
        },
        {
          kind: 'quiz',
          question: 'In the 1-5-8 pattern on G, which notes do you play?',
          options: ['G D G', 'G B D', 'G C G', 'G E G'],
          answer: 0,
          explain: 'Root G, the 5th above it (D), then G an octave up.',
        },
        {
          kind: 'play',
          prompt: 'Play 1-5-8 on F: F – C – F.',
          target: { type: 'sequence', notes: ['F2', 'C3', 'F3'] },
          keyboard: { from: 'F2', to: 'F3', labels: 'all', fingers: { F2: 5, C3: 2, F3: 1 } },
        },
        {
          kind: 'explain',
          title: 'Make it automatic',
          body: `Practise each pattern on **C, F, G and Am** until your left hand finds the shape without you looking down.

Once it's automatic, your attention is free for the melody. That's the whole secret of playing with both hands.`,
          tip: 'Keep the left hand relaxed and close to the keys. The 1-5-8 shape barely moves; only the position changes between chords.',
        },
      ],
    },
    {
      id: 'u7-l2',
      title: 'Waltz & Alberti bass',
      subtitle: 'Two classic accompaniments',
      minutes: 5,
      icon: 'music',
      steps: [
        {
          kind: 'explain',
          title: 'Oom-pah-pah',
          body: `In 3/4 time, the **waltz bass** plays the root on beat 1 and the rest of the chord on beats 2 and 3: **ROOT – chord – chord**.

Oom-pah-pah, oom-pah-pah.`,
          visual: {
            staff: {
              clef: 'bass',
              time: [3, 4],
              spacing: 'proportional',
              items: [
                { notes: ['C3'], text: '1' },
                { notes: ['E3', 'G3'], text: '2' },
                { notes: ['E3', 'G3'], text: '3' },
                { bar: 'single' },
                { notes: ['G2'], text: '1' },
                { notes: ['B2', 'D3'], text: '2' },
                { notes: ['B2', 'D3'], text: '3' },
                { bar: 'final' },
              ],
            },
            audio: [{ label: 'Waltz bass', notes: ['C3', ['E3', 'G3'], ['E3', 'G3'], 'G2', ['B2', 'D3'], ['B2', 'D3']], gap: 0.42, dur: 0.5 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Play the “pah”: E3 and G3 together.',
          body: 'Then try the whole bar on your own: C3, then E3+G3 twice.',
          target: { type: 'chord', notes: ['E3', 'G3'] },
          keyboard: { from: 'C3', to: 'C4', labels: 'all' },
        },
        {
          kind: 'explain',
          title: 'Alberti bass',
          body: `Named after the composer Domenico Alberti, this pattern breaks a chord into **bottom – top – middle – top**: C G E G, C G E G.

Mozart used it constantly; his famous Sonata in C (K. 545) opens with exactly this left hand. Fingers **5 1 3 1**.`,
          visual: {
            staff: {
              clef: 'bass',
              time: [4, 4],
              spacing: 'proportional',
              items: [
                { notes: [{ note: 'C3', finger: 5 }], dur: '8' },
                { notes: [{ note: 'G3', finger: 1 }], dur: '8' },
                { notes: [{ note: 'E3', finger: 3 }], dur: '8' },
                { notes: [{ note: 'G3', finger: 1 }], dur: '8' },
                { notes: ['C3'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { notes: ['E3'], dur: '8' },
                { notes: ['G3'], dur: '8' },
                { bar: 'final' },
              ],
            },
            audio: [{ label: 'Alberti bass', notes: ['C3', 'G3', 'E3', 'G3', 'C3', 'G3', 'E3', 'G3'], gap: 0.22, dur: 0.4 }],
          },
        },
        {
          kind: 'play',
          prompt: 'Alberti bass on C: C, G, E, G (fingers 5, 1, 3, 1).',
          target: { type: 'sequence', notes: ['C3', 'G3', 'E3', 'G3'] },
          keyboard: { from: 'C3', to: 'C4', labels: 'all', fingers: { C3: 5, E3: 3, G3: 1 } },
          showTargets: true,
        },
        {
          kind: 'play',
          prompt: 'Now on G: G, D, B, D (fingers 5, 1, 3, 1).',
          target: { type: 'sequence', notes: ['G2', 'D3', 'B2', 'D3'] },
          keyboard: { from: 'C2', to: 'C4', labels: 'all', fingers: { G2: 5, B2: 3, D3: 1 } },
          hint: 'G major is G B D. Bottom (G), top (D), middle (B), top (D).',
        },
        {
          kind: 'quiz',
          question: 'In what order does Alberti bass play the chord notes?',
          options: ['Bottom – top – middle – top', 'Top – middle – bottom – middle', 'Bottom – middle – top – middle', 'All together'],
          answer: 0,
          explain: 'C G E G: bottom, top, middle, top.',
        },
        {
          kind: 'quiz',
          question: 'In a waltz bass, what do you play on beat 1?',
          options: ['The root (bass note)', 'The full chord', 'A rest', 'The melody'],
          answer: 0,
          explain: 'Oom (root) on 1, pah-pah (the chord) on 2 and 3.',
        },
        {
          kind: 'explain',
          title: 'Five patterns, any chord',
          body: `Block, broken, 1-5-8, waltz and Alberti: five ways to play one chord. Try each of them on C, F and G, and you'll be able to accompany almost any simple melody.`,
          tip: 'Match the pattern to the mood: block for strong and steady, 1-5-8 for flowing ballads, waltz for 3/4, Alberti for a light classical sparkle.',
        },
      ],
    },
    {
      id: 'u7-l3',
      title: 'Hands together',
      subtitle: 'A practice method that works',
      minutes: 6,
      icon: 'heart',
      steps: [
        {
          kind: 'explain',
          title: 'Make one hand automatic',
          body: `Hands together feels hard because your brain is running two parts at once. The fix is to make each part easy *before* combining them:

- Learn each hand **separately** until it's comfortable.
- Put them together **very slowly**, at half speed or less.
- Start with a simple left hand: **one note per bar**.
- Speed up only once it's clean.`,
          tip: 'Slow and correct beats fast and messy every time. Your hands learn whatever you repeat, so repeat it right.',
        },
        {
          kind: 'explain',
          title: 'Melody plus one bass note',
          body: `Here's the first two bars of Ode to Joy with the simplest possible left hand: **C3** under the first bar (the C chord), **G2** under the second (the G chord).

Play each bass note **together with** the first melody note of its bar, and hold it.`,
          visual: {
            keyboard: { from: 'G2', to: 'C5', labels: 'all', marks: { G2: { kind: 'root', label: 'LH' }, C3: { kind: 'root', label: 'LH' } }, fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
            audio: [
              {
                label: 'Hands together (slow)',
                notes: [['C3', 'E4'], 'E4', 'F4', 'G4', ['G2', 'G4'], 'F4', 'E4', 'D4'],
                gap: 0.6,
                dur: 0.9,
              },
            ],
          },
        },
        {
          kind: 'play',
          prompt: 'Right hand alone: E E F G G F E D.',
          target: { type: 'sequence', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'] },
          keyboard: { from: 'C4', to: 'C5', labels: 'all', fingers: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
        },
        {
          kind: 'play',
          prompt: 'Left hand alone: C3, then G2.',
          target: { type: 'sequence', notes: ['C3', 'G2'] },
          keyboard: { from: 'C2', to: 'C4', labels: 'all' },
        },
        {
          kind: 'play',
          prompt: 'Together, slowly: start bar 1 with left-hand C3 and right-hand E4 at the same time.',
          target: { type: 'chord', notes: ['C3', 'E4'], anyOctave: false },
          keyboard: { from: 'C3', to: 'C5', labels: 'all' },
          success: 'Now keep holding the C and play E F G with your right hand.',
        },
        {
          kind: 'play',
          prompt: 'Bar 2 starts with left-hand G2 and right-hand G4 together.',
          target: { type: 'chord', notes: ['G2', 'G4'], anyOctave: false },
          keyboard: { from: 'G2', to: 'C5', labels: 'all' },
          success: 'Then F E D in the right hand over the held G. That’s hands together!',
        },
        {
          kind: 'quiz',
          question: 'What’s the best way to learn a new piece hands together?',
          options: ['Hands separately first, then together slowly', 'Both hands at full speed from the start', 'Right hand only, forever', 'Watch your hands instead of the music'],
          answer: 0,
          explain: 'Separate, slow, then together. It feels slower, but it gets you there much faster.',
        },
        {
          kind: 'explain',
          title: 'Your practice recipe',
          body: `For any new song: **right hand**, then **left hand**, then **together at half speed** with the metronome. Speed up a few BPM at a time.

It works for Ode to Joy, and it works for River Flows in You.`,
        },
      ],
    },
    {
      id: 'u7-l4',
      title: 'The sustain pedal',
      subtitle: 'Smooth, ringing sound',
      minutes: 5,
      icon: 'disc',
      steps: [
        {
          kind: 'explain',
          title: 'What the pedal does',
          body: `On an acoustic piano, the right pedal lifts the dampers off the strings, so notes keep ringing after you let go of the keys. It's called the **sustain** (or damper) pedal, and it makes playing sound smooth and full.

The CT-S1 has a **pedal jack** on the back: plug in a sustain pedal (Casio's simple SP-3 is one option) and press it with your right foot. When your keyboard is connected by USB, this app can see your pedal too.`,
        },
        {
          kind: 'explain',
          title: 'Pedal markings',
          body: `In sheet music you'll see **Ped.** where to press the pedal, and a **✱** (or the end of a bracket line under the staff) where to lift it.

Many pop arrangements just say “with pedal” and leave the timing to you. The next step tells you how.`,
        },
        {
          kind: 'explain',
          title: 'Legato pedalling: up–down',
          body: `The secret is the **timing**: press the pedal **just after** you play a chord, not at the same moment.

1. Play chord 1, then press the pedal.
2. When you play chord 2, **lift the pedal as the new keys go down**,
3. then press it again **straight after**.

It's “up–down” exactly as the new chord sounds. The old chord is cleared, and there's no gap in the sound.`,
          tip: 'Change the pedal every time the chord changes. Holding it through different chords makes a muddy blur.',
        },
        {
          kind: 'quiz',
          question: 'When should you change (lift and re-press) the pedal?',
          options: ['When the chord changes', 'On every beat', 'Only at the end of the song', 'Never, just keep it down'],
          answer: 0,
          explain: 'New chord, new pedal. That keeps the sound full but clear.',
        },
        {
          kind: 'quiz',
          question: 'In legato pedalling, you press the pedal down again…',
          options: ['Just after playing the new chord', 'Just before playing the new chord', 'Only when the music is loud', 'With your left foot'],
          answer: 0,
          explain: 'Play the new chord first, then the pedal goes back down a moment later.',
        },
        {
          kind: 'play',
          prompt: 'Practise: play C major with the pedal down, then change the pedal as you play F major. Play the F chord here.',
          body: 'No pedal yet? Just play the chords and hold each one for its full length.',
          target: { type: 'chord', notes: ['F3', 'A3', 'C4'], anyOctave: true },
          keyboard: { from: 'C3', to: 'C5', labels: 'all' },
        },
        {
          kind: 'explain',
          title: 'No pedal? Finger legato',
          body: `Without a pedal, connect notes with your **fingers**: hold each key until the very moment the next one goes down. This is called **finger legato**.

It's worth practising even if you do have a pedal. Pianists with good finger legato sound smoother *with* the pedal too.`,
        },
        {
          kind: 'quiz',
          question: 'What does the sustain pedal do?',
          options: ['Keeps notes ringing after you release the keys', 'Makes every note louder', 'Changes the instrument sound', 'Speeds up the tempo'],
          answer: 0,
          explain: 'It lets notes ring on, so you can connect chords smoothly.',
        },
      ],
    },
    {
      id: 'u7-l5',
      title: 'Playing by ear',
      subtitle: 'Bring your guitar ears to the piano',
      minutes: 6,
      icon: 'ear',
      steps: [
        {
          kind: 'explain',
          title: 'You already do this',
          body: `Playing by ear is a superpower, and you already have it. Here's how to bring it to the piano:

- **Find home**: hum the note the song feels like it rests on, especially at the end. That's usually the key's first note (the I).
- **Find the bass**: play along with the lowest notes first. They usually spell out the chord roots.
- **Try the usual suspects**: I, IV, V and vi fit most pop songs. In C: C, F, G and Am.`,
          guitar: `On guitar you might find a song's key by the open chord it “feels like”. On piano every key has the same layout of I, IV, V and vi, and changing key is just moving the whole pattern, like a capo.`,
        },
        {
          kind: 'quiz',
          question: 'Listen to these four chords. How does the ending feel?',
          listen: {
            label: 'Play again',
            notes: [['C3', 'E4', 'G4', 'C5'], ['F2', 'F4', 'A4', 'C5'], ['G2', 'D4', 'G4', 'B4'], ['C3', 'E4', 'G4', 'C5']],
            gap: 1,
            dur: 1.3,
          },
          options: ['Finished, back home', 'Unfinished, like a question'],
          answer: 0,
          explain: 'It ended on the I chord (C), which sounds like home. I–IV–V–I.',
        },
        {
          kind: 'quiz',
          question: 'And these?',
          listen: {
            label: 'Play again',
            notes: [['C3', 'E4', 'G4', 'C5'], ['A2', 'E4', 'A4', 'C5'], ['F2', 'F4', 'A4', 'C5'], ['G2', 'D4', 'G4', 'B4']],
            gap: 1,
            dur: 1.3,
          },
          options: ['Finished, back home', 'Unfinished, like a question'],
          answer: 1,
          explain: 'It stopped on V (G), which wants to go back to I. That pull is what drives most progressions.',
        },
        {
          kind: 'explain',
          title: 'Free Play is your ear trainer',
          body: `Open **Free Play** and play along with a song (yours, or a recording). Whenever you find a chord by ear, the app **names it** and shows it on the staff.

It's the fastest way to connect the sounds you hear to the names and notes you've learned.`,
        },
        {
          kind: 'quiz',
          question: 'Is this chord major or minor?',
          listen: { label: 'Play again', notes: [['A2', 'C4', 'E4', 'A4']], dur: 2 },
          options: ['Major', 'Minor'],
          answer: 1,
          explain: 'A minor: A C E.',
        },
        {
          kind: 'quiz',
          question: 'This starts on C. Which note does it jump up to?',
          listen: { label: 'Play again', notes: ['C4', 'G4'], gap: 0.7 },
          options: ['G', 'E', 'F', 'A'],
          answer: 0,
          explain: 'A perfect 5th: the “Twinkle, Twinkle” leap.',
        },
        {
          kind: 'quiz',
          question: 'This starts on C too. Where does it go?',
          listen: { label: 'Play again', notes: ['C4', 'E4'], gap: 0.7 },
          options: ['E', 'D', 'F', 'G'],
          answer: 0,
          explain: 'A major 3rd, like “When the Saints” (Oh when).',
        },
        {
          kind: 'explain',
          title: 'Keep the habit',
          body: `A little every day beats a lot once a week: **one lesson, one game, and five minutes of Free Play**.

You're not just copying songs any more. You know *why* they work: the keys, the chords, the progressions underneath. That's what playing properly means.`,
        },
      ],
    },
  ],
}
