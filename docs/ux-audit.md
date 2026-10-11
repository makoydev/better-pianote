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
- [ ] **7. One held wrong note counts as many mistakes (mic).** The "wrong" buzz sets `busyUntil`, the mic drops the
  sounding note, then re-detects the still-ringing note as new → another mistake and buzz every ~0.6 s. Lessons,
  Note Rush, Echo. *Where:* `lib/input/mic.ts`, `lib/audio/engine.ts`, `PlayStepView.tsx`. iPad check. `S–M`
  *Partly done:* in lessons only: no "wrong" buzz for mic input and the same wrong note within 1.5 s counts once. The mic itself still re-detects a ringing note after any app sound.
- [ ] **8. The app's own clicks and backing band deafen the mic.** Each click/backing note mutes the mic: Rhythm Tap
  and the lesson metronome grade on-beat notes late; Jam and progression play-along never hear you. Ignore the
  app's own pitches instead of going fully deaf; headphones mode. *Where:* `mic.ts`, `engine.ts`, `drums.ts`,
  `RhythmTap.tsx`, `MetronomeWidget.tsx`, `ProgressionJam.tsx`. iPad check. `M`
- [ ] **9. Mic and sound don't recover after the iPad locks or the app goes to the background.** The pill says
  "Listening" but nothing is heard until Stop + Start. Resume the audio context on `visibilitychange`, watch
  `track.onended`, keep a resume-on-tap listener. *Where:* `mic.ts`, `engine.ts`, `main.tsx`. iPad check. `M`
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
- [ ] **13. Space breaks after clicking a button.** Song player: Space re-clicks the focused "Listen" (reset to bar
  1). Metronome: Space re-triggers the last control, and tap-tempo `T` also plays F♯. *Where:* `SongPlayer.tsx`,
  `explore/Metronome.tsx`. `S`
  *Partly done:* Metronome: T no longer plays F♯ and Space works after clicks (83a5260); Chrome's focus-after-click is dropped app-wide (e688569). The song player's Space comes with the Songs batch.
- [ ] **14. Sounds don't stop.** Scale "Listen", lesson demos and Rhythm Tap "Listen first" keep playing after a
  change of screen or scale; a double tap plays two copies; the mic stays muted meanwhile. Track scheduled notes so
  `stopAll()` can cancel them, call it on navigation. *Where:* `engine.ts`, `play.ts`, callers. `S–M`
- [ ] **15. Song results glitches.** Time shows "1:60" (119.6 s); right-hand and both-hands runs share one best;
  accuracy counts a chord as one step but every slip separately. *Where:* `songs/SongResults.tsx`,
  `SongPlayer.tsx`. `S`
- [x] **16. Settings and Songs are missing from the nav below 768 px** (iPad mini portrait, Split View): the bottom
  tab bar has neither. *Where:* `components/layout/Nav.tsx`, `Page.tsx`. `S`
  *Done:* the phone tab bar now has Home, Learn, Practice, Play, Explore and Songs, and page headers show a Settings gear below 768 px (`Nav.tsx`, `Page.tsx`). Checked at 700 px.
- [x] **17. Accuracy slips.** Circle of Fifths calls i–iv–v the main chords of a minor key (most minor songs use a
  major V); a transposed Jam shows F♭/C♭/B𝄫 and "D♭ minor"; numbered lists in lesson text render as one paragraph.
  *Where:* `widgets/CircleOfFifthsWheel.tsx`, `explore/ProgressionJam.tsx`, `ui/RichText.tsx`. `S`
  *Partly done:* numbered steps in lesson text now render as a list (`ui/RichText.tsx`). The Circle of Fifths and Jam spellings are in the Explore batch.
  *Done:* the Circle of Fifths shows a minor key's major V among the gold main chords with corrected wording (7c45b90), and the Jam uses minor-key names and respells F♭/C♭/B𝄫 roots (977f12e); tests cover all 12 keys.
- [ ] **18. Smaller ones.** A note shared by two voices in an imported song needs two presses (Listen plays it twice);
  Note Rush level 5's ♯/♭ choice sticks to the next note and ⌘C/held keys answer; unplugging the keyboard is silent
  and can leave sustain stuck down. *Where:* `songs/timeline.ts`, `songs/listen.ts`, `NoteRush.tsx`,
  `lib/input/midi.ts`. `S`
  *Partly done:* unplugging the keyboard now releases a stuck sustain pedal and says so (`midi.ts`). The song and Note Rush parts are in the Songs and Practice batches.
  *Partly done:* Note Rush level 5: the ♯/♭ choice resets after each answer, held keys and ⌘ shortcuts don't answer, Shift+letter is the sharp (3ae2ff8).

## Across the whole app

- [x] **19. Keep the screen awake while practising** (Wake Lock on full-screen pages, re-acquired on
  `visibilitychange`). On iPad a sleeping screen also kills the mic. *Where:* new hook, `App.tsx`. `S`
  *Done:* `useWakeLock` holds a screen wake lock on full-screen pages and takes it again when the page becomes visible; Settings → Display has "Keep the screen on while practising" (on by default).
- [ ] **20. Hands-free controls everywhere.** One scheme (pedal tap, Enter, Space) for Start, Next, Play again and Hear
  it again in games, songs, tools and the lesson complete screen. A shortcut sheet (`?`), and a spare key (top C7)
  as Continue for mic users without a pedal. `M`
- [ ] **21. Remember choices.** Note Rush setup, Rhythm Tap tempo/click, Ear Training level per mode, every Explore
  tool and the song list filter reset on each visit; game preferences aren't in Export. `S`
  *Partly done:* Note Rush, Rhythm Tap and Ear Training (4108ba9) and Free Play plus every Explore tool (981ab3b) remember their choices in the prefs store, which Export carries (e688569). The song list filter comes with the Songs batch.
- [x] **22. Keep your place.** Learn always reopens at Unit 1 (no scroll to the current lesson); Songs loses filter and
  scroll; Back always goes to a fixed parent page (Chord Trainer opened from Home → Back → Practice).
  *Where:* `App.tsx` (`scrollTo(0,0)`), `TopBar.tsx`, `LearnPath.tsx`. `S`
  *Done:* Back on full-screen pages returns to the page you came from (`goBack` in `router.ts`, pushState with a depth), main pages remember their scroll for Back/Forward, and Learn opens scrolled to your next lesson. Lesson → next lesson replaces the history entry. Checked: Chord Trainer from Home → Back → Home at the same scroll.
- [ ] **23. Fit screens to the window.** On a 13" MacBook, lesson pictures, Chord Explorer and Jam push the keyboard
  below the fold, and Start is below the fold on game setup screens (reproduced). Sticky action bar, measured
  heights. `M`
- [ ] **24. Work offline.** No service worker: the iPad app needs the network on every cold launch and re-downloads
  the 2 MB piano. Precache the shell and samples, show "New version – Reload". `M`
- [ ] **25. Put the mic first on iPad.** The connect sheet opens on a disabled USB button saying "try Chrome or Edge".
  Mic first when Web MIDI is missing, an inline "Start listening" on play steps, a "Heard: C4" readout, headphones
  mode. `S–M`
- [ ] **26. Celebrate level-ups and the daily goal when they happen**, and show goal progress on results screens.
  *Where:* `state/progress.ts`, `XpToaster.tsx`, results screens. `S`
  *Partly done:* level-ups and the daily goal pop a toast with sound and confetti the moment they happen (`progress.ts` → `Toaster.tsx`); a goal bar (`GoalProgress`) is on the lesson complete screen. Games and song results get it once those batches are merged.
  *Partly done:* game results (shared ResultsCard and Note Rush) show the daily goal bar too.
- [ ] **27. Rebalance XP.** One Note Rush round (`score/20`) clears the daily goal; a round with zero right answers still
  pays and keeps the streak; looping a song section earns nothing. *Where:* `NoteRush.tsx`,
  `practice/shared/finish.ts`, `SongPlayer.tsx`. `S`
  *Partly done:* games pay nothing for a round with nothing right, and Note Rush uses the same XP rule as the other games, at most 25 per round (ec7153b). Song loop XP comes with the Songs batch.

## Learn

- [ ] **28. Resume a lesson where you left off** (leaving or an iPad reload restarts at step 1). `S–M`
- [x] **29. Say what went wrong:** "That's D", "Right notes – now put E at the bottom", "wrong octave"; keep the progress
  dots visible when the hint appears. *Where:* `PlayStepView.tsx`, `learn/match.ts`. `S`
  *Done:* a feedback line names what you played ("That's D.", "right note, wrong octave") and, for chords, what's left ("2 of 3 notes… keep going.", "Now put E at the bottom.", "play exactly the keys written"); a wrong-octave chord note isn't a slip; the dots stay visible with the hint (`learn/feedback.ts`, `match.ts`, tests).
- [x] **30. Fairer stars:** one slip per attempt (a wrong chord counts 3 today), re-hearing "Show me" is free, list the
  slips on the complete screen. *Where:* `LessonPlayer.tsx`, `PlayStepView.tsx`. `S`
  *Done:* one slip per attempt (700 ms window), the first "Show me" costs a slip and replays are free, and the complete screen lists the steps you slipped on.
- [ ] **31. Rhythm lessons that check rhythm.** "Show me" plays even notes today; play the written durations, add a
  count-in and grade timing (reuse Rhythm Tap's `scoreTaps`). `M–L`
- [ ] **32. Answer note and chord quizzes by playing them** (19 quizzes fit). `M`
- [ ] **33. Review mode** for finished lessons (Continue always on, step strip) and a quick mixed review weighted to
  low-star lessons. `M`
- [x] **34. End of lesson and unit:** a unit-complete moment; "Next" goes to the first unfinished lesson; lesson text
  can link to the matching game; a real button instead of the tiny "Back to all lessons" link. `S`
  *Done:* unit-complete banner and extra confetti; "Next" goes to the next unfinished lesson; Enter or a pedal tap goes there from the complete screen; "All lessons" is a real button; lesson tips link to Note Rush, Rhythm Tap, Chord Trainer and Free Play (`[text](/path)` markup in RichText).
- [ ] **35. Demos light up the keys** in time with the sound. `M`
- [ ] **36. Learn page navigation:** a unit jump strip and lesson search. `S–M`

## Practice

- [ ] **37. Track weak spots** (notes, chords, intervals, keys you miss or are slow on), ask about them more often,
  "Drill these" on results. `M`
- [x] **38. Show what you missed in Ear Training and Key Quiz**, with tap-to-hear. `S`
  *Done:* Ear Training and Key Quiz results list "What you missed" (e.g. "Major 6th → you said minor 7th"); tapping an Ear Training miss plays both the way the question was asked, and option replays after a harmonic question are harmonic now (2040e5d).
- [x] **39. Pause and Skip in Note Rush** (auto-pause when the app is hidden); don't save near-empty rounds. `S`
  *Done:* Pause button and auto-pause when the app is hidden (any key, tap or note resumes), Skip (button or Space) counts as missed, and a round with nothing right isn't saved (e0a349b). Checked in the browser.
- [ ] **40. Results that lead somewhere:** history per game, "Next level →" after 3★, a per-level "New best" badge. `S–M`
- [ ] **41. Answer Ear Training and Key Quiz by playing.** `M`
- [ ] **42. Note Rush on the shared game parts** (SetupCard/ResultsCard/finishGame), a tighter keyboard range (bigger
  keys; Bass level 4 starts below the CT-S1), optional key signatures. `M`
- [x] **43. Rhythm Tap insights:** "you rush by ~25 ms", first-try score, bests per tempo, bigger Next/Try again
  buttons. `S`
  *Done:* results say "You rush/drag by about N ms" or "Right on time", show the first-try score next to the best-of-retries one, bests are kept per tempo band, and Next/Try again are large buttons (8bc72a9).
- [ ] **44. A chained 5-minute "Daily workout".** `L`

## Songs

- [ ] **45. Section practice:** tap or drag bars on the score to loop, "start from this bar", bar numbers on the score,
  bigger loop buttons (30 px today). `M`
- [ ] **46. Keep your bar** when switching Practice ↔ Listen or hands (today both reset to bar 1); "Hear this bar" and
  Skip in Practice. *Where:* `SongPlayer.tsx`. `S`
- [ ] **47. Left-hand-only practice**, and an option for the app to play the other hand. `M`
- [ ] **48. Remember hands, loop, tempo and last bar per song** ("Continue from bar 37"); loop practice counts toward
  the streak. `S–M`
- [ ] **49. Better tempo control:** −/+ and % presets instead of the ~80 px slider, count-in, metronome, speed up each
  loop, tempo remembered per song. *Where:* `SongPlayer.tsx`. `S`
- [ ] **50. Play along at tempo**, with timing judged. `L`
- [ ] **51. Use the screen:** iPad portrait shows ~1.5 bars with a big empty gap above the keyboard (reproduced);
  multi-line score, score size option, narrower keys for wide pieces. `M`
- [ ] **52. Mic in songs:** hear multi-note steps as chords; in one-hand mode ignore the other hand; exact octave over
  USB. `M`
- [ ] **53. Results that point at the problem:** mistakes per bar, "Practise these bars", run history. `M`
- [ ] **54. Imported songs:** edit title, level and part; replace the file and keep progress (re-import duplicates
  today); persistent storage. `S–M`
- [ ] **55. Song list for a real library:** search, sort by recently practised, keep filter and scroll. `S–M`
- [ ] **56. Score details:** original bar numbers for pieces with repeats, next notes shown faintly on the keys, import
  errors that name the bar, drop files on any page. `S–M`
- [ ] **57. Two-hand versions of the Advanced built-ins** (Minuet, Für Elise and the Prelude are right hand only). `M`

## Free Play & Explore

- [ ] **58. Free Play:** keep the last chord on screen after you let go (reproduced), name pedalled and broken chords,
  a chord chart that scrolls to the newest chord, survives leaving and lets you remove one. `M`
- [ ] **59. "Save that!"**: keep the last couple of minutes so a good idea isn't lost. `M–L`
- [ ] **60. Better key detection** (melody notes too, top two guesses, one-tap lock), the key's notes on the keyboard,
  "try next" chord suggestions. `M`
- [ ] **61. Link the tools:** Circle → practise this scale / jam in this key; Chord Explorer → keys containing this
  chord; Free Play chord → explore it. `M`
- [ ] **62. Progression Jam:** save progressions, replace/reorder chords in place, more chords (I7, sus4, slash chords),
  mute the band's chords, 3/4 and 6/8, tick off chords as you play. `M`
- [ ] **63. A metronome that keeps running across screens**, plus a speed trainer. `M`
- [ ] **64. Scale practice in time**, over two octaves, hands together. `M`
- [ ] **65. Guitar shapes for every chord** (20 of 48 basic chords have one; F♯m from River Flows is missing), capo
  view. `M`
- [x] **66. Free Play and the tools respect the reading settings** (note names under the staff, key labels), and Free
  Play's on-screen keys are big enough to tap on iPad. *Where:* `play/FreePlay.tsx`, `ChordExplorer.tsx`,
  `ScaleExplorer.tsx`, `CircleOfFifthsWheel.tsx`. `S`
  *Done:* Free Play, Chord Explorer, Scale Explorer and the circle's key details follow "Note names under the staff", Free Play follows "Names on keys", and without a USB keyboard on screens under ~1100 px Free Play shows two big octaves with ◀ ▶ (e697797). The explorers keep labels on their highlighted keys on purpose.

## Settings & platform

- [ ] **67. Safer Export/Import:** iPad share sheet, preview with merge or replace (Import overwrites everything today),
  undo, last-backup reminder. iPad check. `M`
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
- [ ] **72. Accessibility and touch sweep:** controls under 44 px, ✓/✗ alongside red/green, focus in dialogs,
  screen-reader announcements, Do-Re-Mi naming everywhere. `S–M`
- [x] **73. Performance:** with the mic on, hidden connect sheets re-render 25 times a second; pause the animated
  background on full-screen pages. `S`
  *Done:* the connect sheet's live parts only exist while it's open (no more hidden re-renders 25×/s), and the background lights hold still on full-screen pages (`Aurora calm`).
