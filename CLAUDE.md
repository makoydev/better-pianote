# Tonic (better-pianote): project instructions

A personal piano-learning app. The owner bought a **Casio CT-S1** (61 keys, C2–C7, USB-MIDI), plays fingerstyle
guitar and piano by ear (River Flows in You, Kiss the Rain), and wants proper fundamentals: reading notes,
chords, scales, progressions, rhythm. They use the app on a stand in front of the keyboard, so **everything must be
big, readable and touch-friendly**, and it should feel fun and immersive (micro-animations, sparks, light trails).

The display name is **Tonic** (not "Pianote", which is an existing brand). Rename in `index.html`,
`public/manifest.webmanifest`, `src/components/layout/Logo.tsx` if the owner wants a different name.

## Setting up on a new machine (the owner works from more than one MacBook)

Claude's local memory doesn't travel between machines, so everything needed lives in this repo.

1. Clone (or `git pull`), `npm install` (Node 22+; 24/25 work), then `npm test` must pass.
2. Start the dev server in the background: `npm run dev` (port 5392, IPv4 + IPv6).
   The owner uses `http://localhost:5392`. Their progress lives in that origin's localStorage
   (`tonic-settings`, `tonic-progress`).
3. **Test in the browser at `http://[::1]:5392/?static#/…`** instead: a separate origin with its own storage, so
   testing never touches the owner's progress. Never reset/import progress on `localhost` yourself.
   - `?static` (before the `#`) makes animations finish instantly and runs frames on timers. Use it for automated
     screenshots: a Chrome tab in a background window gets no animation frames and can show stale paint.
   - `#/dev` is a notation gallery, `#/dev/widgets` previews lesson widgets.
4. Commit per feature with short imperative messages, only after `npm test` and `npx tsc -b` pass.

## Deploying

- `npm run deploy` (`scripts/deploy.sh`) builds and force-pushes `dist/` to the `gh-pages` branch; GitHub Pages
  serves it at https://makoydev.github.io/better-pianote/ (the owner uses it on an iPad). The repo is public because
  the free plan only serves Pages from public repos.
- Git over HTTPS: the macOS keychain holds a different GitHub account, so push with the gh CLI's login:
  `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push` (the deploy script does this).
- Don't switch branches while `npm run dev` is running: Vite can restart without its config and serve unstyled
  pages. If that happens, restart the dev server.

## Map of the code

- `src/lib/theory/`: notes/spelling, intervals, chords (`detectChord` names held notes incl. inversions),
  scales (+ standard fingerings), keys (signatures, diatonic chords, `romanToChord`, `chordToRoman`, `guessKey`),
  voice leading. Pure and unit-tested (`theory.test.ts`). Prefer these over hand-spelling notes.
- `src/lib/audio/`: `engine.ts` (Salamander samples in `public/samples/piano`, synth fallback, reverb, clicks,
  UI sounds; `busyUntil` tells the mic to ignore the app's own sound), `clock.ts` (look-ahead scheduler),
  `play.ts` (demo playback that respects "play demos through my keyboard").
- `src/lib/input/`: `bus.ts` is the single note-event stream (`useNoteEvents`, `heldNow`, `recentNotes`);
  sources: `midi.ts` (Web MIDI, sustain pedal CC64), `keys.ts` (computer keys; `pauseComputerKeys()` to borrow
  keys), `mic.ts` (microphone). The mic has two modes: single notes (McLeod pitch method) by default, and chords
  (`polyphony.ts`, harmonic summation with cancellation) while a screen calls `useMicChords()`. `micMatch.ts` holds
  the forgiving checks for mic input (a chord's perfect 5th may go unheard). `#/dev/mic` is a test page that feeds
  piano chords silently into the mic analysers; tune `POLY_DEFAULTS` against it and `polyphony.test.ts`.
- `src/components/piano/`: `Piano` (marks, fingers, labels, toggle mode for building chords, sparks, trails).
- `src/components/staff/`: two engravers that share one SVG renderer (`StaffSvg.tsx`, Bravura glyphs).
  - `layout.ts` + `Staff.tsx`: one rhythm per staff, for lessons and exercises. Accidentals follow key signature +
    bar rules automatically. `hidden` events reserve space; `lines={false}` draws notes only.
  - `score.ts` + `ScoreStaff.tsx`: real music for the song player. Every voice keeps its own rhythm and notes that
    start together share a column across both staves; handles extra voices per hand (stems up/down), ties,
    tuplets, 32nds/64ths, whole-bar rests, key/time changes. Highlights are applied when drawing (`noteState` by
    note id), and `clip` draws only what's on screen. Covered by `score.test.ts`.
- `src/components/MusicText.tsx`: renders ♯ ♭ with Bravura's chord-symbol glyphs (the text fonts lack them).
  Always use it (or `SvgMusicText`) for note/chord names.
- `src/content/`: lessons as data (`types.ts` documents the schema and RichText markup). `content.test.ts`
  validates every lesson (note names, targets reachable on the shown keyboard, quiz answers). Built-in songs are in
  `content/songs/` (compact text format, listed from easiest to hardest; `songs.test.ts` checks every bar).
- Song import: `src/lib/musicxml/` turns MusicXML (.musicxml/.xml/.mxl) into the `Song` model (voices, ties,
  tuplets, repeats written out, chord symbols, key/time changes). `features/songs/importSession.ts` + `ImportSheet`
  are the UI; `src/state/library.ts` stores imported songs in IndexedDB (`src/lib/idb.ts`) together with the
  original file, and re-reads them when `IMPORTER_VERSION` goes up. Settings export/import includes them.
- `features/songs/timeline.ts`: a song in time (all voices, ties merged, practice steps, columns) and
  `songScoreInput` (what the score engraver needs).
- `src/features/`: screens. Routes are in `src/App.tsx` (hash router in `src/router.ts`).
- `src/state/`: Zustand stores. `settings` and `progress` persist to localStorage; `live` is runtime only.

## Conventions

- Accuracy matters more than anything: double-check every note, chord spelling, key and fact in lesson text.
  Only state song facts that are certain (e.g. River Flows in You uses vi–IV–I–V in A major).
- Only public-domain melodies in the built-in Songs. No copyrighted melodies. (Imported songs are the owner's own
  files and stay on their device; never add those to the repo.)
- Big touch targets (≥ 44px, usually 56px+), `MusicText` for accidentals, `Piano`/`Staff` for visuals,
  `audio.ui(...)` feedback sounds only when `settings.uiSounds`.
- Keep play screens fitting the viewport (keyboard fully visible): measure remaining height with `useElementSize`.
