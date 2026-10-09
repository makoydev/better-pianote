import { MotionConfig, motion } from 'motion/react'
import { type ComponentType, Suspense, lazy, useEffect } from 'react'
import { Aurora } from './components/layout/Aurora'
import { Sidebar, type Tab, TabBar } from './components/layout/Nav'
import { XpToaster } from './components/layout/XpToaster'
import { Home } from './features/home/Home'
import { Onboarding } from './features/home/Onboarding'
import { LearnPath } from './features/learn/LearnPath'
import { audio } from './lib/audio/engine'
import { matchPath, usePath } from './router'
import { useSettings } from './state/settings'

// Screens load on demand so the app starts quickly.
const Gallery = lazy(() => import('./features/dev/Gallery').then((m) => ({ default: m.Gallery })))
const WidgetsGallery = lazy(() => import('./features/dev/WidgetsGallery').then((m) => ({ default: m.WidgetsGallery })))
const ChordExplorer = lazy(() => import('./features/explore/ChordExplorer').then((m) => ({ default: m.ChordExplorer })))
const CircleOfFifths = lazy(() => import('./features/explore/CircleOfFifths').then((m) => ({ default: m.CircleOfFifths })))
const ExploreHub = lazy(() => import('./features/explore/ExploreHub').then((m) => ({ default: m.ExploreHub })))
const Metronome = lazy(() => import('./features/explore/Metronome').then((m) => ({ default: m.Metronome })))
const ProgressionJam = lazy(() => import('./features/explore/ProgressionJam').then((m) => ({ default: m.ProgressionJam })))
const ScaleExplorer = lazy(() => import('./features/explore/ScaleExplorer').then((m) => ({ default: m.ScaleExplorer })))
const LessonPlayer = lazy(() => import('./features/learn/LessonPlayer').then((m) => ({ default: m.LessonPlayer })))
const FreePlay = lazy(() => import('./features/play/FreePlay').then((m) => ({ default: m.FreePlay })))
const ChordTrainer = lazy(() => import('./features/practice/ChordTrainer').then((m) => ({ default: m.ChordTrainer })))
const EarTraining = lazy(() => import('./features/practice/EarTraining').then((m) => ({ default: m.EarTraining })))
const KeyQuiz = lazy(() => import('./features/practice/KeyQuiz').then((m) => ({ default: m.KeyQuiz })))
const NoteRush = lazy(() => import('./features/practice/NoteRush').then((m) => ({ default: m.NoteRush })))
const PracticeHub = lazy(() => import('./features/practice/PracticeHub').then((m) => ({ default: m.PracticeHub })))
const RhythmTap = lazy(() => import('./features/practice/RhythmTap').then((m) => ({ default: m.RhythmTap })))
const Settings = lazy(() => import('./features/settings/Settings').then((m) => ({ default: m.Settings })))
const SongList = lazy(() => import('./features/songs/SongList').then((m) => ({ default: m.SongList })))
const SongPlayer = lazy(() => import('./features/songs/SongPlayer').then((m) => ({ default: m.SongPlayer })))

interface Route {
  pattern: string
  /** Pages take their URL params (e.g. lessonId) as props. */
  page: ComponentType<any>
  tab: Tab
  /** Full-screen pages (lessons, games, tools) hide the navigation. */
  focus?: boolean
}

const ROUTES: Route[] = [
  { pattern: '/', page: Home, tab: 'home' },
  { pattern: '/learn', page: LearnPath, tab: 'learn' },
  { pattern: '/learn/:lessonId', page: LessonPlayer, tab: 'learn', focus: true },
  { pattern: '/practice', page: PracticeHub, tab: 'practice' },
  { pattern: '/practice/note-rush', page: NoteRush, tab: 'practice', focus: true },
  { pattern: '/practice/chord-trainer', page: ChordTrainer, tab: 'practice', focus: true },
  { pattern: '/practice/rhythm', page: RhythmTap, tab: 'practice', focus: true },
  { pattern: '/practice/ear', page: EarTraining, tab: 'practice', focus: true },
  { pattern: '/practice/key-quiz', page: KeyQuiz, tab: 'practice', focus: true },
  { pattern: '/explore', page: ExploreHub, tab: 'explore' },
  { pattern: '/explore/chords', page: ChordExplorer, tab: 'explore', focus: true },
  { pattern: '/explore/scales', page: ScaleExplorer, tab: 'explore', focus: true },
  { pattern: '/explore/circle', page: CircleOfFifths, tab: 'explore', focus: true },
  { pattern: '/explore/progressions', page: ProgressionJam, tab: 'explore', focus: true },
  { pattern: '/explore/metronome', page: Metronome, tab: 'explore', focus: true },
  { pattern: '/play', page: FreePlay, tab: 'play', focus: true },
  { pattern: '/songs', page: SongList, tab: 'songs' },
  { pattern: '/songs/:songId', page: SongPlayer, tab: 'songs', focus: true },
  { pattern: '/settings', page: Settings, tab: 'settings' },
  { pattern: '/dev', page: Gallery, tab: 'home', focus: true },
  { pattern: '/dev/widgets', page: WidgetsGallery, tab: 'home', focus: true },
]

function resolve(path: string) {
  for (const r of ROUTES) {
    const params = matchPath(r.pattern, path)
    if (params) return { ...r, params }
  }
  return { ...ROUTES[0], params: {} }
}

/** Keep the DOM and the audio engine in sync with settings. */
function useSettingsSync() {
  const uiScale = useSettings((s) => s.uiScale)
  const volume = useSettings((s) => s.volume)
  const reverb = useSettings((s) => s.reverb)
  useEffect(() => {
    document.documentElement.dataset.scale = uiScale
  }, [uiScale])
  useEffect(() => audio.setVolume(volume), [volume])
  useEffect(() => audio.setReverb(reverb), [reverb])
}

export function App() {
  const path = usePath()
  const route = resolve(path)
  const onboarded = useSettings((s) => s.onboarded)
  useSettingsSync()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  const Page = route.page
  return (
    <MotionConfig reducedMotion="user">
      <Aurora />
      {route.focus ? (
        <Suspense fallback={<Loading />}>
          <Page key={path} {...route.params} />
        </Suspense>
      ) : (
        <>
          <Sidebar active={route.tab} />
          <main className="min-h-dvh md:pl-24 lg:pl-64">
            <Suspense fallback={<Loading />}>
              <motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
                <Page {...route.params} />
              </motion.div>
            </Suspense>
          </main>
          <TabBar active={route.tab} />
        </>
      )}
      <XpToaster />
      {!onboarded && <Onboarding />}
    </MotionConfig>
  )
}

function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" aria-label="Loading">
      <span className="size-10 animate-spin rounded-full border-4 border-white/10 border-t-gold" />
    </div>
  )
}
