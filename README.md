# Tonic · learn piano properly

A piano-learning app built for playing in front of a real keyboard (made with a **Casio CT-S1** in mind).
It teaches the fundamentals people who play by ear often skip: **reading notes, rhythm, intervals, scales, chords,
keys and progressions**. It listens to your keyboard over USB-MIDI, so lessons and games react to what you play.

Big text and buttons, a dark "stage" theme, rainbow-coloured notes (optional), sparks and light trails when you play,
and a real sampled grand piano.

**Use it now: https://makoydev.github.io/better-pianote/**

On an iPad, open that link in Safari, then Share → **Add to Home Screen** for a full-screen app. iPad browsers
can't read MIDI, so play through the **microphone** (or the on-screen keys). Progress is saved per device; move it
with Settings → Export / Import.

## What's inside

- **Learn**: a path of 7 units with interactive lessons. Explanations with sound, "play this on your keyboard"
  steps that check your answer, quizzes, and widgets. "Guitar brain" notes connect ideas to the guitar.
  1. Meet the Keyboard · 2. Reading Notes · 3. Rhythm & Time · 4. Intervals & Scales · 5. Chords ·
  6. Keys & Progressions · 7. Play for Real
- **Free Play**: play anything; it names the chord (with inversion), shows it on the grand staff, writes your
  progression with roman numerals, guesses the key, and collects every chord you discover.
- **Practice**: Note Rush (sight-reading sprint), Chord Trainer, Rhythm Tap, Ear Training, Key Signature Quiz.
- **Explore**: Chord Explorer, Scale Explorer (with fingerings), Circle of Fifths, Progression Jam (a backing band
  for progressions like vi–IV–I–V), Metronome.
- **Songs**: public-domain pieces with a play-along "wait mode" and a listen mode.
- XP, levels, daily goal, streaks, stars. Progress is saved in the browser (export/import in Settings).

## Run it

Needs Node 22+ (Node 24/25 tested).

```bash
npm install
npm run dev        # http://localhost:5392
```

Other scripts: `npm test` (Vitest), `npm run build` (type-check + production build into `dist/`),
`npm run lint` (oxlint), `npm run preview`.

`npm run deploy` builds the app and publishes it to the `gh-pages` branch, which GitHub Pages serves at the link
above (it updates a minute or two later).

## Connect your keyboard

1. Plug a USB cable into the keyboard's **USB TO HOST** port and your computer, and switch the keyboard on.
   On the CT-S1 that's the small **micro-USB** port; the bigger USB-A port (USB TO DEVICE) is for Casio's
   Bluetooth adapter and won't work with a computer. Use a cable that carries data (many micro-USB cables only charge).
2. Open the app in **Chrome or Edge** (Safari and iPhone/iPad browsers don't support Web MIDI yet).
3. Press **Connect keyboard** (top right) and allow MIDI access. It reconnects automatically next time.

If it says no keyboard was found: on a Mac, open Audio MIDI Setup → Window → Show MIDI Studio. If "CASIO USB-MIDI"
isn't listed there, the Mac can't see the keyboard yet, so check the port and try another cable.

No cable? Use **Start listening** to play through the microphone: it hears your keyboard's speakers, single
notes in games and lessons and whole chords in Free Play and chord exercises (works on iPad too). Or play with the
on-screen keys / your computer keyboard (`A S D F G H J K` = white keys, `W E T Y U` = black keys, `Z`/`X` = octave).

Handy at the piano: in lessons, **tap the sustain pedal to continue**.

## Tech

React 19 + TypeScript + Vite, Tailwind CSS 4, Motion for animation, Zustand for state. No backend.

- `src/lib/theory`: music theory engine (spelling, intervals, chords + chord detection, scales + fingerings,
  keys, roman numerals, voice leading), fully unit-tested.
- `src/lib/audio`: Web Audio piano sampler with reverb, metronome clicks, look-ahead clock.
- `src/lib/input`: one note-event bus fed by Web MIDI, on-screen keys, computer keys and the mic
  (McLeod pitch detection for single notes; multi-pitch detection for chords, tuned on real piano recordings).
- `src/components/staff`: SVG music engraving (clefs, key/time signatures, accidentals, beams, ties, ledger lines)
  using the Bravura SMuFL font.
- `src/components/piano`: the interactive keyboard, sparks and light trails.
- `src/content`: lessons as plain data, validated by tests.

## Credits

- Piano samples: Salamander Grand Piano by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  via the [Tone.js audio collection](https://github.com/Tonejs/audio/tree/master/salamander).
- Music font: [Bravura](https://github.com/steinbergmedia/bravura) by Steinberg Media Technologies,
  SIL Open Font License 1.1 (see `src/assets/fonts/BRAVURA-OFL.txt`).
- Fonts: Fraunces and Nunito (SIL OFL), via Fontsource.
- Song melodies are in the public domain.
