# UX and quality-of-life audit (October 2026)

A walkthrough of every screen (Chrome at MacBook and iPad sizes, on the `[::1]` test origin) plus a code review of
Learn, Practice, Songs, Free Play/Explore and the app shell. Tick items off as they land.

- **Effort:** S = small, M = medium, L = large.
- **Reproduced** = seen happening in the browser. **iPad check** = needs a real iPad, mic or MIDI keyboard to confirm.
- File references point at the code as it was when the audit was written (commit `42f89b0`).

Suggested order: #1–4, then #5, #19, #6, #7, #10, then #20 and #45–46.

## Bugs (broken today)

- [x] **1. Finishing a lesson keeps awarding XP.** After a lesson that ends on a "play" step (10 of 38), the complete
  screen re-runs `finish()` every ~1.5 s: +5 XP, confetti and the chime on loop. Reproduced (55 → 85 XP in 10 s).
  The play-step auto-advance effect has no `finished` guard. *Where:* `features/learn/LessonPlayer.tsx`. `S`
  *Done:* `finish()` runs once per run (ref guard) and the auto-advance effect stops once the lesson is finished (`LessonPlayer.tsx`). Checked in the browser: XP rose once and stayed put.
- [x] **2. The right quiz answer is almost always option 1.** 79 of 87 quizzes have `answer: 0` and options are
  never shuffled, so pressing 1 passes nearly everything. *Where:* `features/learn/steps/QuizStepView.tsx`,
  `content/units/*`. `S`
  *Done:* options are shuffled per visit (`learn/quizOrder.ts`); two-option and `ordered` questions keep their order, number options show smallest first. A test checks the answer is no longer usually first. Number keys skip ⌘/repeat.
- [x] **3. Enter skips lesson steps.** After clicking Continue (Chrome keeps focus on it), one Enter advances twice
  (reproduced 2/9 → 4/9). Arrow keys inside widgets (tempo slider, circle of fifths) also move the lesson; held
  Enter auto-repeats; ⌘←/→ fires too. *Where:* `LessonPlayer.tsx` keydown handler. `S`
  *Done:* the lesson key handler ignores repeats, ⌘/Ctrl/Alt, text fields, sliders, radio groups and keys a widget already handled, and leaves Enter to a focused button; Chrome's focus-after-click is dropped app-wide (`lib/focus.ts`). Checked: Continue click then Enter moves one step.
- [x] **4. Note Rush gives the answer away by colour.** Staff notes are rainbow-coloured by letter and the name
  buttons use the same palette. Reproduced. *Where:* `features/practice/NoteRush.tsx` (NoteTape, name buttons). `S`
  *Done:* Note Rush draws the staff notes uncoloured and the letter buttons are neutral (8a1fa3b). Checked in the browser.
- [x] **5. Blank screen after a deploy.** No error boundary; a tab or the iPad app that loads a lazy screen whose old
  hashed chunk is gone (deploy replaces `gh-pages`) unmounts the whole app. Add a "Tonic was updated – Reload"
  fallback and handle `vite:preloadError`. *Where:* `App.tsx`, `scripts/deploy.sh`. `S`
  *Done:* an error boundary around every screen shows "Tonic was updated – Reload" (or "Something went wrong") with Reload and Home, and a `vite:preloadError` handler reloads once by itself (`ErrorBoundary.tsx`, `main.tsx`).
- [x] **6. Mic and USB both on → doubled notes.** `main.tsx` auto-starts both; the mic hears the CT-S1 speakers and
  sends a late second note (in Note Rush it answers the next note wrong). The pill only shows the USB device.
  *Where:* `main.tsx`, `lib/input/bus.ts`, `components/layout/ConnectionPill.tsx`. `S`
  *Done:* while a USB keyboard is connected the mic's notes are dropped and its pitch work is skipped (`micPaused` in `bus.ts`, `mic.ts`); the connect sheet says the mic is paused.
- [x] **7. One held wrong note counts as many mistakes (mic).** The "wrong" buzz sets `busyUntil`, the mic drops the
  sounding note, then re-detects the still-ringing note as new → another mistake and buzz every ~0.6 s. Lessons,
  Note Rush, Echo. *Where:* `lib/input/mic.ts`, `lib/audio/engine.ts`, `PlayStepView.tsx`. iPad check. `S–M`
  *Partly done:* in lessons only: no "wrong" buzz for mic input and the same wrong note within 1.5 s counts once. The mic itself still re-detects a ringing note after any app sound.
  *Done:* fixed at the root for every screen: during a feedback sound the mic now holds the note you're playing instead of dropping it, so a still-ringing note isn't heard again as a new one (`mic.ts`).
- [x] **8. The app's own clicks and backing band deafen the mic.** Each click/backing note mutes the mic: Rhythm Tap
  and the lesson metronome grade on-beat notes late; Jam and progression play-along never hear you. Ignore the
  app's own pitches instead of going fully deaf; headphones mode. *Where:* `mic.ts`, `engine.ts`, `drums.ts`,
  `RhythmTap.tsx`, `MetronomeWidget.tsx`, `ProgressionJam.tsx`. iPad check. `M`
  *Done:* the mic no longer goes deaf for the app's sound: the engine tracks the notes it's playing (and keyboard demos) and the mic ignores just those pitches, their octaves and twelfths, plus the metronome click pitches around each click (`engine.ts` `isAppPitch`). Settings has "I'm using headphones" to ignore nothing. The lesson metronome allows for the mic's ~70 ms delay. Still a short pause: Jam drum hits and feedback dings. iPad check.
- [x] **9. Mic and sound don't recover after the iPad locks or the app goes to the background.** The pill says
  "Listening" but nothing is heard until Stop + Start. Resume the audio context on `visibilitychange`, watch
  `track.onended`, keep a resume-on-tap listener. *Where:* `mic.ts`, `engine.ts`, `main.tsx`. iPad check. `M`
  *Done:* the audio wakes up when the app becomes visible again, every tap still wakes it (the unlock listener stays), a "Sound is paused · tap to wake it" chip appears while it's suspended (`SoundWake.tsx`), and if iOS ends the mic it restarts by itself (or says so). iPad check.
- [x] **10. The sustain pedal skips lesson steps while you play.** Any pedal press is Continue, including widget steps
  and the pedal lesson (u7-l4). Count only a deliberate tap (no keys held, nothing played just before).
  *Where:* `LessonPlayer.tsx`. `S`
  *Done:* only a deliberate tap continues: pressed and released within 0.6 s with no keys held and nothing played just before. The pedal lesson (u7-l4) turns pedal-continue off (`pedalContinue: false`), and its "C major, then F" step is `free` so C major isn't a slip.
- [x] **11. Going Back to a solved play step bounces you forward** after 1.5 s, so a step can't be redone.
  *Where:* `LessonPlayer.tsx` auto-advance, `PlayStepView.tsx`. `S`
  *Done:* only a freshly solved step auto-advances; revisiting shows the solved state with a "Play it again" button. Checked in the browser.
- [x] **12. The red wrong-note flash is hidden while the key is held** (the pressed colour wins), so mic users almost
  never see it. *Where:* `components/piano/Piano.tsx`. `S`
  *Done:* good/bad marks now win over the pressed colour and carry a ✓/✕ (`components/piano/Piano.tsx`).
- [x] **13. Space breaks after clicking a button.** Song player: Space re-clicks the focused "Listen" (reset to bar
  1). Metronome: Space re-triggers the last control, and tap-tempo `T` also plays F♯. *Where:* `SongPlayer.tsx`,
  `explore/Metronome.tsx`. `S`
  *Partly done:* Metronome: T no longer plays F♯ and Space works after clicks (83a5260); Chrome's focus-after-click is dropped app-wide (e688569). The song player's Space comes with the Songs batch.
  *Done:* song player: Space plays/pauses in Listen and plays the current bar in Practice, R restarts, and both work after clicking any control (c05705b). Checked: Space started Listen right after clicking a tempo preset.
- [x] **14. Sounds don't stop.** Scale "Listen", lesson demos and Rhythm Tap "Listen first" keep playing after a
  change of screen or scale; a double tap plays two copies; the mic stays muted meanwhile. Track scheduled notes so
  `stopAll()` can cancel them, call it on navigation. *Where:* `engine.ts`, `play.ts`, callers. `S–M`
  *Done:* the engine tracks demo notes so `stopDemos()` can cut them; leaving a screen stops them, a new sequence (Listen, Show me) stops the previous one, and demos on the keyboard's speakers are sent just in time so they can be cancelled, with All Notes Off (`play.ts`, `midi.ts`).
- [x] **15. Song results glitches.** Time shows "1:60" (119.6 s); right-hand and both-hands runs share one best;
  accuracy counts a chord as one step but every slip separately. *Where:* `songs/SongResults.tsx`,
  `SongPlayer.tsx`. `S`
  *Done:* results round the time first (no more "1:60"), accuracy is notes ÷ (notes + slips), and bests are kept per hands with old records still honoured; song cards show "RH 100% · Both 85%" (55c8284). Checked: Hot Cross Buns results.
- [x] **16. Settings and Songs are missing from the nav below 768 px** (iPad mini portrait, Split View): the bottom
  tab bar has neither. *Where:* `components/layout/Nav.tsx`, `Page.tsx`. `S`
  *Done:* the phone tab bar now has Home, Learn, Practice, Play, Explore and Songs, and page headers show a Settings gear below 768 px (`Nav.tsx`, `Page.tsx`). Checked at 700 px.
- [x] **17. Accuracy slips.** Circle of Fifths calls i–iv–v the main chords of a minor key (most minor songs use a
  major V); a transposed Jam shows F♭/C♭/B𝄫 and "D♭ minor"; numbered lists in lesson text render as one paragraph.
  *Where:* `widgets/CircleOfFifthsWheel.tsx`, `explore/ProgressionJam.tsx`, `ui/RichText.tsx`. `S`
  *Partly done:* numbered steps in lesson text now render as a list (`ui/RichText.tsx`). The Circle of Fifths and Jam spellings are in the Explore batch.
  *Done:* the Circle of Fifths shows a minor key's major V among the gold main chords with corrected wording (7c45b90), and the Jam uses minor-key names and respells F♭/C♭/B𝄫 roots (977f12e); tests cover all 12 keys.
- [x] **18. Smaller ones.** A note shared by two voices in an imported song needs two presses (Listen plays it twice);
  Note Rush level 5's ♯/♭ choice sticks to the next note and ⌘C/held keys answer; unplugging the keyboard is silent
  and can leave sustain stuck down. *Where:* `songs/timeline.ts`, `songs/listen.ts`, `NoteRush.tsx`,
  `lib/input/midi.ts`. `S`
  *Partly done:* unplugging the keyboard now releases a stuck sustain pedal and says so (`midi.ts`). The song and Note Rush parts are in the Songs and Practice batches.
  *Partly done:* Note Rush level 5: the ♯/♭ choice resets after each answer, held keys and ⌘ shortcuts don't answer, Shift+letter is the sharp (3ae2ff8).
  *Done:* songs: a note two voices share is one press in Practice and sounds once in Listen (c15b69b). All three parts done.

## Across the whole app

- [x] **19. Keep the screen awake while practising** (Wake Lock on full-screen pages, re-acquired on
  `visibilitychange`). On iPad a sleeping screen also kills the mic. *Where:* new hook, `App.tsx`. `S`
  *Done:* `useWakeLock` holds a screen wake lock on full-screen pages and takes it again when the page becomes visible; Settings → Display has "Keep the screen on while practising" (on by default).
- [x] **20. Hands-free controls everywhere.** One scheme (pedal tap, Enter, Space) for Start, Next, Play again and Hear
  it again in games, songs, tools and the lesson complete screen. A shortcut sheet (`?`), and a spare key (top C7)
  as Continue for mic users without a pedal. `M`
  *Partly done:* the shared pieces: `useHandsFree(action)` runs a screen's main action on Enter, a deliberate pedal tap (`lib/input/pedalTap.ts`) or the top C (C7, a setting, on by default); `?` opens a shortcut sheet (also in Settings). Lessons use it; the other screens are wired in the area batches.
  *Partly done:* the Jam (Space starts/stops; Enter, a pedal tap or top C start it but never stop it mid-song) and Scale Explorer (Space and the hands-free scheme start a run).
  *Done:* one scheme everywhere: Enter, a pedal tap or the top C (C7) run the main button (Start, Next, Play again, Continue) in lessons, every game, the song player and the Jam, Scale Explorer and Chord Explorer; Space plays, pauses or hears it again in lessons, songs, tools, Ear Training and Chord Trainer (this commit); `?` opens the shortcut sheet. Checked: Space replays an Ear Training question.
- [x] **21. Remember choices.** Note Rush setup, Rhythm Tap tempo/click, Ear Training level per mode, every Explore
  tool and the song list filter reset on each visit; game preferences aren't in Export. `S`
  *Partly done:* Note Rush, Rhythm Tap and Ear Training (4108ba9) and Free Play plus every Explore tool (981ab3b) remember their choices in the prefs store, which Export carries (e688569). The song list filter comes with the Songs batch.
  *Done:* the song list remembers its filter (b264f7e). All parts done.
- [x] **22. Keep your place.** Learn always reopens at Unit 1 (no scroll to the current lesson); Songs loses filter and
  scroll; Back always goes to a fixed parent page (Chord Trainer opened from Home → Back → Practice).
  *Where:* `App.tsx` (`scrollTo(0,0)`), `TopBar.tsx`, `LearnPath.tsx`. `S`
  *Done:* Back on full-screen pages returns to the page you came from (`goBack` in `router.ts`, pushState with a depth), main pages remember their scroll for Back/Forward, and Learn opens scrolled to your next lesson. Lesson → next lesson replaces the history entry. Checked: Chord Trainer from Home → Back → Home at the same scroll.
- [x] **23. Fit screens to the window.** On a 13" MacBook, lesson pictures, Chord Explorer and Jam push the keyboard
  below the fold, and Start is below the fold on game setup screens (reproduced). Sticky action bar, measured
  heights. `M`
  *Partly done:* the Jam fits the screen while the band plays (Now/Next, beat dots, strip, keyboard sized to what's left; settings in a sheet below xl). Lessons, games, Chord Explorer and the song player come with their batches.
  *Partly done:* lesson pictures fit the window (checked: u1-l1 step 1's 61-key map is fully visible at 1440×813); a few widget steps still scroll a little.
  *Done:* every screen fits a 13" MacBook (measured at 1440×757): game setups keep Start in view, Chord Trainer, Ear Training and Key Quiz fit (dbdc0a9), the Jam and Chord Explorer fit, the song player fills the screen (#51), and all 38 lessons were measured step by step. Every lesson step fits except the note-values list and one play step that scrolls 7 px without a USB keyboard (4c47db5, 80a4d34).
- [x] **24. Work offline.** No service worker: the iPad app needs the network on every cold launch and re-downloads
  the 2 MB piano. Precache the shell and samples, show "New version – Reload". `M`
  *Done:* a service worker (written at build time by `vite.config.ts` from `scripts/service-worker.js`) keeps the whole build on the device: 132 files, 3.8 MB including the piano. A new build installs in the background and "A new version of Tonic is ready · Reload" lets you switch when you like (`lib/offline.ts`, `UpdateBanner.tsx`). Checked with the production build: installed, updated through the banner, and loaded with the server stopped.
- [x] **25. Put the mic first on iPad.** The connect sheet opens on a disabled USB button saying "try Chrome or Edge".
  Mic first when Web MIDI is missing, an inline "Start listening" on play steps, a "Heard: C4" readout, headphones
  mode. `S–M`
  *Partly done:* play steps show `MicPrompt`: "Playing on your keyboard? Start listening" when there's no USB keyboard, then "Heard: E4" with a level bar.
  *Partly done:* on an iPad the connect sheet leads with the microphone (USB and Bluetooth tucked under "On a Mac or PC"), the header pill reads "Use mic" and one tap starts it, and Home offers "Play your keyboard through the mic". Games and songs get `MicPrompt` in their batches.
  *Done:* games (Note Rush, Chord Trainer, Echo) and the song player show the mic prompt too. All parts done.
- [x] **26. Celebrate level-ups and the daily goal when they happen**, and show goal progress on results screens.
  *Where:* `state/progress.ts`, `XpToaster.tsx`, results screens. `S`
  *Partly done:* level-ups and the daily goal pop a toast with sound and confetti the moment they happen (`progress.ts` → `Toaster.tsx`); a goal bar (`GoalProgress`) is on the lesson complete screen. Games and song results get it once those batches are merged.
  *Partly done:* game results (shared ResultsCard and Note Rush) show the daily goal bar too.
  *Done:* song results show the goal bar too. All parts done.
- [x] **27. Rebalance XP.** One Note Rush round (`score/20`) clears the daily goal; a round with zero right answers still
  pays and keeps the streak; looping a song section earns nothing. *Where:* `NoteRush.tsx`,
  `practice/shared/finish.ts`, `SongPlayer.tsx`. `S`
  *Partly done:* games pay nothing for a round with nothing right, and Note Rush uses the same XP rule as the other games, at most 25 per round (ec7153b). Song loop XP comes with the Songs batch.
  *Done:* a clean pass of a looped section earns +2 XP (up to 20 per visit), so section practice counts for the goal and streak (8082f43). All parts done.

## Learn

- [x] **28. Resume a lesson where you left off** (leaving or an iPad reload restarts at step 1). `S–M`
  *Done:* lessons save your place as you go; reopening resumes there with a one-tap Start over, and the Learn path and Home show "step 5 of 9".
- [x] **29. Say what went wrong:** "That's D", "Right notes – now put E at the bottom", "wrong octave"; keep the progress
  dots visible when the hint appears. *Where:* `PlayStepView.tsx`, `learn/match.ts`. `S`
  *Done:* a feedback line names what you played ("That's D.", "right note, wrong octave") and, for chords, what's left ("2 of 3 notes… keep going.", "Now put E at the bottom.", "play exactly the keys written"); a wrong-octave chord note isn't a slip; the dots stay visible with the hint (`learn/feedback.ts`, `match.ts`, tests).
- [x] **30. Fairer stars:** one slip per attempt (a wrong chord counts 3 today), re-hearing "Show me" is free, list the
  slips on the complete screen. *Where:* `LessonPlayer.tsx`, `PlayStepView.tsx`. `S`
  *Done:* one slip per attempt (700 ms window), the first "Show me" costs a slip and replays are free, and the complete screen lists the steps you slipped on.
- [x] **31. Rhythm lessons that check rhythm.** "Show me" plays even notes today; play the written durations, add a
  count-in and grade timing (reuse Rhythm Tap's `scoreTaps`). `M–L`
  *Done:* the six play steps in Rhythm & Time are played in time. Start (or Enter, a pedal tap, the top C) counts in a bar of clicks, then every note is judged against the beat as the staff writes it (lengths, rests, ties) by the scales-in-time judge, now shared in `lib/timing.ts` with Rhythm Tap's grades and window. In time passes (green on the staff, amber when a little off); too far off, wrong or missed is a slip, with a tip; long notes let go too soon are named. Tempo −/+, click on/off, Slower after two misses, no auto-advance so the result stays. Show me counts in and plays the written rhythm with the clicks; untimed staffs in time (Ode to Joy in unit 2) now play their written lengths too. Checked in Chrome at 1440×757 (every timed step fits, before and after a run) and in an iPad-portrait frame; worth a try with the CT-S1 and through the mic.
- [x] **32. Answer note and chord quizzes by playing them** (19 quizzes fit). `M`
  *Done:* 19 note/chord quizzes accept a played answer (MIDI, mic, computer keys); ear quizzes don't, so hunting for the sound on the keyboard stays free.
- [x] **33. Review mode** for finished lessons (Continue always on, step strip) and a quick mixed review weighted to
  low-star lessons. `M`
  *Done:* finished lessons offer Review (jump around, nothing scored) next to Replay for stars, and Quick review mixes up to 10 questions from finished lessons, weighted to low stars and oldest.
- [x] **34. End of lesson and unit:** a unit-complete moment; "Next" goes to the first unfinished lesson; lesson text
  can link to the matching game; a real button instead of the tiny "Back to all lessons" link. `S`
  *Done:* unit-complete banner and extra confetti; "Next" goes to the next unfinished lesson; Enter or a pedal tap goes there from the complete screen; "All lessons" is a real button; lesson tips link to Note Rush, Rhythm Tap, Chord Trainer and Free Play (`[text](/path)` markup in RichText).
- [x] **35. Demos light up the keys** in time with the sound. `M`
  *Done:* Show me and listen clips light each key in time with the sound (quiz pictures don't, so they can't give answers away).
- [x] **36. Learn page navigation:** a unit jump strip and lesson search. `S–M`
  *Done:* sticky unit chips 1–7 with progress, and a lesson search over titles and step titles. Checked in the browser.

## Practice

- [x] **37. Track weak spots** (notes, chords, intervals, keys you miss or are slow on), ask about them more often,
  "Drill these" on results. `M`
  *Done:* games track every note, chord, interval and key you answer (miss rate, usual time) in `tonic-practice-stats`, lean the next rounds toward weak and slow items (capped, still varied), show "Weakest: …" on setups and "Drill these" on results.
- [x] **38. Show what you missed in Ear Training and Key Quiz**, with tap-to-hear. `S`
  *Done:* Ear Training and Key Quiz results list "What you missed" (e.g. "Major 6th → you said minor 7th"); tapping an Ear Training miss plays both the way the question was asked, and option replays after a harmonic question are harmonic now (2040e5d).
- [x] **39. Pause and Skip in Note Rush** (auto-pause when the app is hidden); don't save near-empty rounds. `S`
  *Done:* Pause button and auto-pause when the app is hidden (any key, tap or note resumes), Skip (button or Space) counts as missed, and a round with nothing right isn't saved (e0a349b). Checked in the browser.
- [x] **40. Results that lead somewhere:** history per game, "Next level →" after 3★, a per-level "New best" badge. `S–M`
  *Done:* each level keeps its last 20 rounds with a sparkline and "62% → 88% this week", 3★ makes "Next level →" the main button, Rhythm Tap offers a faster tempo, and "New level best!" shows.
- [x] **41. Answer Ear Training and Key Quiz by playing.** `M`
  *Done:* "Answer by playing" in Ear Training (the top note of an interval, the chord on the marked root) and Key Quiz (the keynote; F♯/G♭ twins handled).
- [x] **42. Note Rush on the shared game parts** (SetupCard/ResultsCard/finishGame), a tighter keyboard range (bigger
  keys; Bass level 4 starts below the CT-S1), optional key signatures. `M`
  *Done:* Note Rush runs on the shared setup/results, its keyboard spans just the notes (within C2–C7), and it has key signatures (None, G, D, F, B♭) with correct spellings. Checked: G major's sharp on the staff.
- [x] **43. Rhythm Tap insights:** "you rush by ~25 ms", first-try score, bests per tempo, bigger Next/Try again
  buttons. `S`
  *Done:* results say "You rush/drag by about N ms" or "Right on time", show the first-try score next to the best-of-retries one, bests are kept per tempo band, and Next/Try again are large buttons (8bc72a9).
- [ ] **44. A chained 5-minute "Daily workout".** `L`

## Songs

- [x] **45. Section practice:** tap or drag bars on the score to loop, "start from this bar", bar numbers on the score,
  bigger loop buttons (30 px today). `M`
  *Done:* tap or drag bars on the music to loop them, Loop around here, Start from bar N (results say so), bar numbers on the bar lines, 44 px steppers that repeat while held.
- [x] **46. Keep your bar** when switching Practice ↔ Listen or hands (today both reset to bar 1); "Hear this bar" and
  Skip in Practice. *Where:* `SongPlayer.tsx`. `S`
  *Done:* Listen starts at the current Practice step, Practice resumes where Listen paused, and changing hands keeps the bar; Practice has Hear this bar (Space) and Skip (c05705b, c8dad37, 943b29e). Checked: Skip to bar 2 → Listen offers "plays from bar 2".
- [x] **47. Left-hand-only practice**, and an option for the app to play the other hand. `M`
  *Done:* Right / Left / Both hands (left hand has its own best), Accompany me plays the other hand, and Listen can play both, either hand or the other one.
- [x] **48. Remember hands, loop, tempo and last bar per song** ("Continue from bar 37"); loop practice counts toward
  the streak. `S–M`
  *Partly done:* Home shows "Keep practising: <song> · from bar N" for the song you practised in the last two weeks (reads `songs:last`). The player side comes with the song player batch.
  *Done:* each song remembers hands, loop, backing and your bar, and offers "Continue from bar 37" (Enter, pedal tap or top C).
- [x] **49. Better tempo control:** −/+ and % presets instead of the ~80 px slider, count-in, metronome, speed up each
  loop, tempo remembered per song. *Where:* `SongPlayer.tsx`. `S`
  *Done:* −/+ buttons in 5% steps, presets 50/60/75/90/100% ("♩ = 72 · 75%"), Count-in and Metronome toggles, Speed up each loop, tempo saved per song (bb96fec). Checked: 75% preset and the count-in.
- [ ] **50. Play along at tempo**, with timing judged. `L`
- [x] **51. Use the screen:** iPad portrait shows ~1.5 bars with a big empty gap above the keyboard (reproduced);
  multi-line score, score size option, narrower keys for wide pieces. `M`
  *Done:* the player fills the screen: up to four lines of music when there's room, S/M/L size, keys sized to fit.
- [x] **52. Mic in songs:** hear multi-note steps as chords; in one-hand mode ignore the other hand; exact octave over
  USB. `M`
  *Done:* through the mic, chord steps use chord hearing and mic slips don't count; your other hand is ignored in one-hand modes; USB and on-screen keys need the written octave.
- [x] **53. Results that point at the problem:** mistakes per bar, "Practise these bars", run history. `M`
  *Done:* results show wrong notes by bar with "Practise bars 12–15", a trend of your last runs, and loop passes toward "3 clean in a row".
- [x] **54. Imported songs:** edit title, level and part; replace the file and keep progress (re-import duplicates
  today); persistent storage. `S–M`
  *Done:* a ⋯ menu on imported songs: Edit (title, composer, level, and the part re-read from the stored file), Replace file (same song, progress kept), Download original file, Remove; re-importing the same file offers "Replace (keep progress)" or "Add as new"; persistent storage is requested after the first import (de6dbbe, 26eadf9, 6d0982a).
- [x] **55. Song list for a real library:** search, sort by recently practised, keep filter and scroll. `S–M`
  *Done:* search (title, composer, tags), sort (Recently practised, Title, Difficulty, Recently added) and a compact List view, all remembered; cards show "Practised 2 days ago · 1 run" and per-hands bests; a Continue card for the last song (148ffd6, b53a015, 9e93fa4). Checked: search "bach" shows the Prelude only.
- [x] **56. Score details:** original bar numbers for pieces with repeats, next notes shown faintly on the keys, import
  errors that name the bar, drop files on any page. `S–M`
  *Partly done:* imports that fail list the first problems by bar with a fix, "Which files work?" only shows for files that aren't MusicXML, several files import one after another, the picker filters score files on desktop (0186d44, 454b2e2), and score files dropped on any page go to Songs (App). The bar numbers and next notes are in the song player batch.
  *Done:* printed bar numbers ("Bar 14 (2nd time)") and the next notes shown faintly; IMPORTER_VERSION bumped to 2 so older imports get them.
- [x] **57. Two-hand versions of the Advanced built-ins** (Minuet, Für Elise and the Prelude are right hand only). `M`
  *Done:* Minuet in G gets its left hand, Für Elise its left-hand broken chords, and the Prelude in C both hands as Bach wrote them (half-note bass plus the held second voice), transcribed bar by bar from Mutopia (Bach-Gesellschaft, Breitkopf & Härtel 1888) and checked against the Humdrum Bach-Gesellschaft encoding; every built-in song now passes the importer's song check (345b742). Checked: the Prelude's grand staff.

## Free Play & Explore

- [x] **58. Free Play:** keep the last chord on screen after you let go (reproduced), name pedalled and broken chords,
  a chord chart that scrolls to the newest chord, survives leaving and lets you remove one. `M`
  *Done:* the last chord stays on screen, faded, with its notes faded on the staff; pedalled and broken chords are named (River Flows' A–E–A–C♯ reads A); the chord chart survives leaving, scrolls to the newest chord, and has tap to hear, × to remove, Undo, Play all, Copy chart and Loop in Jam (7cb4820, 3f50c42). A chord is recorded once however it's spelled (4e3f0f5). Checked: F♯m D A E twice reads vi IV I V in A major, and block chords played quickly no longer add up to Dmaj9 (fixed in the commit that ticks this).
- [ ] **59. "Save that!"**: keep the last couple of minutes so a good idea isn't lost. `M–L`
- [x] **60. Better key detection** (melody notes too, top two guesses, one-tap lock), the key's notes on the keyboard,
  "try next" chord suggestions. `M`
  *Done:* the key is found from melody and chords (how long notes sound, and this visit's chords only), with the runner-up shown ("A major · or F♯ minor"), a one-tap lock, Show key dots on the keyboard, and Try next chords with numerals (9f8bc59, ffd251d, 38ccbd5). Chords are spelled for the key (7767b4d). Checked in the browser.
- [x] **61. Link the tools:** Circle → practise this scale / jam in this key; Chord Explorer → keys containing this
  chord; Free Play chord → explore it. `M`
  *Done:* the Circle of Fifths offers Practise this scale, Jam in this key and Free Play in this key; the Chord Explorer lists the keys a chord belongs to (F♯m: vi in A, ii in E, iii in D, i in F♯ minor, iv in C♯ minor, v in B minor); Free Play has Explore it and Loop in Jam (0fd5547, 3f50c42). Checked: Loop in Jam opens vi–IV–I–V in A.
- [x] **62. Progression Jam:** save progressions, replace/reorder chords in place, more chords (I7, sus4, slash chords),
  mute the band's chords, 3/4 and 6/8, tick off chords as you play. `M`
  *Done:* Jam: more chips (I7, IV7, sus4, I/3, V/3, II, III) with correct slash spellings and chord-tone bass patterns; tap a card to replace or move it (◀ ▶), step-by-step Undo and an Undo banner when a preset would replace yours; save, load and delete your own progressions; Bass / Chords / Drums toggles; Waltz 3/4, Ballad 6/8 and 2-bar chords; play-along ✓ per chord with an on-the-beat check and a score per loop. Checked: the new chips, and Now/Next with the keyboard fully visible while playing.
- [x] **63. A metronome that keeps running across screens**, plus a speed trainer. `M`
  *Done:* the metronome's clock moved into `metronomeEngine.ts`, so it keeps clicking when you leave the page; a chip in every header shows the beat and BPM, opens the Metronome and stops it (`MetronomeMini.tsx`). It stops itself in Rhythm Tap and the Jam, which keep their own time. A speed trainer adds +2/4/6/8 BPM every 2/4/8 bars up to a target (remembered). Checked: started on the Metronome page, chip on Scale Explorer, stopped from the chip.
- [x] **64. Scale practice in time**, over two octaves, hands together. `M`
  *Done:* Scale Explorer practises one or two octaves (scale-book fingerings, tested for all 12 majors and the minors), right, left or both hands on the grand staff, and an optional in-time run with count-in and click that grades every note early/late like Rhythm Tap and saves your best clean tempo per scale.
- [x] **65. Guitar shapes for every chord** (20 of 48 basic chords have one; F♯m from River Flows is missing), capo
  view. `M`
  *Done:* every chord type gets guitar shapes: the open chord, then E- and A-shape barres with the fret shown, and capo equivalents ("= Em shape, capo 2"), in the Chord Explorer and behind Free Play's Guitar switch (d95f57c, ffd251d). Tests check every shape note by note. Checked: F♯m shows 244222.
- [x] **66. Free Play and the tools respect the reading settings** (note names under the staff, key labels), and Free
  Play's on-screen keys are big enough to tap on iPad. *Where:* `play/FreePlay.tsx`, `ChordExplorer.tsx`,
  `ScaleExplorer.tsx`, `CircleOfFifthsWheel.tsx`. `S`
  *Done:* Free Play, Chord Explorer, Scale Explorer and the circle's key details follow "Note names under the staff", Free Play follows "Names on keys", and without a USB keyboard on screens under ~1100 px Free Play shows two big octaves with ◀ ▶ (e697797). The explorers keep labels on their highlighted keys on purpose.

## Settings & platform

- [x] **67. Safer Export/Import:** iPad share sheet, preview with merge or replace (Import overwrites everything today),
  undo, last-backup reminder. iPad check. `M`
  *Done:* Import now shows what's in the file next to this device (XP, lessons, stars, songs, when it was saved) and offers Merge (every lesson and best score from either device, days joined into one streak) or Replace; device settings (size, mic, sound routing) are never imported; "Undo import" works until the app is closed; the app reloads after an import so every saved store picks it up. Export uses the share sheet on iPad (Save to Files, AirDrop) and carries every saved store (practice stats, song history…), and Settings says when you last backed up (`lib/backup.ts`, `ImportPreview.tsx`, tests). iPad check for the share sheet.
- [x] **68. Onboarding:** "Coming from another device? Import" and "Show welcome again" in Settings. `S`
  *Done:* onboarding's first step has "Coming from another device? Import your progress", and Settings → You has "Show welcome again". Export/import now live in `lib/backup.ts` (shared by both).
- [x] **69. Connect sheet:** a live test strip (last note heard, source, pedal), keyboard connected/disconnected
  messages, quick volume. `S`
  *Done:* a "Test it" strip at the top of the connect sheet (last note heard and its source, pedal down, app volume, piano-sound status with Try again), plus toasts when the keyboard is plugged in or out (`ConnectSheet.tsx`, `midi.ts`, `Toaster.tsx`). Checked: "Heard E4 from your computer keys".
- [x] **70. Faster, steadier start:** fetch the piano samples early with a loading/failed state and retry, a static
  loader while the app boots, `apple-mobile-web-app-title`. *Where:* `engine.ts`, `index.html`, `main.tsx`. `S`
  *Done:* piano samples start downloading 0.8 s after launch (decoded once a tap unlocks audio), missing ones are retried when the device comes back online or from the connect sheet, `index.html` shows a spinner while the app boots, and the home-screen title is "Tonic". Not done: subsetting the music font.
- [x] **71. iPad polish:** padding under the status bar, no double-tap zoom on buttons, keyboards scroll to the lit
  keys, labels under the sidebar icons in portrait. iPad check. `S`
  *Done:* safe-area padding on pages and the sidebar plus a dark strip behind the status bar, `touch-action: manipulation` and no long-press callout on buttons, wide keyboards scroll to the lit keys, labels under the sidebar icons on the iPad-portrait icon rail. Checked at 900 px; still worth a look on the iPad itself.
- [x] **72. Accessibility and touch sweep:** controls under 44 px, ✓/✗ alongside red/green, focus in dialogs,
  screen-reader announcements, Do-Re-Mi naming everywhere. `S–M`
  *Partly done:* shared controls: switches, small toggles and small buttons are 44 px, the dialog close button 48 px, dialogs take focus, keep Tab inside and give it back, and lesson note chips follow the Do Re Mi setting (`lib/naming.ts`).
  *Partly done:* screen readers hear chord names once ("F sharp m", not the drawn letters too: `MusicText`), every Settings switch row toggles from its text, and the compact connection pill has a spoken label. Screen-specific sizes and ✓/✗ cues come with the area batches.
  *Partly done:* the Jam's transpose buttons are 48 px and its × 44 px; the octave picker's black keys have a 44 px tap area.
  *Partly done:* single notes follow the Do Re Mi setting in Free Play, the mic readout ("Heard: Mi4") and the lesson labs too (this commit), on top of lessons, songs and the keyboard and staff labels. Games (Ear Training, Chord Trainer, Note Rush) and the Explore tools still name notes with letters; whether chord symbols and key names should follow it (Rem, Sol7, Mi♭ major) is still to decide. Games show ✓/✗ with screen-reader text, every game choice is a radio or has aria-pressed, and the shared chips too (43a9a14).
  *Done:* the owner chose to keep chord names, key names and game answers (Ear Training, Chord Trainer, Note Rush, the Explore tools) in letters, so Do Re Mi covers single notes: the keyboard, the staff, lessons, songs, Free Play, the mic readout and the lesson labs. The Note names setting now says so.
- [x] **73. Performance:** with the mic on, hidden connect sheets re-render 25 times a second; pause the animated
  background on full-screen pages. `S`
  *Done:* the connect sheet's live parts only exist while it's open (no more hidden re-renders 25×/s), and the background lights hold still on full-screen pages (`Aurora calm`).
