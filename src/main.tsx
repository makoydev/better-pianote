import { STATIC } from './qa'
import { MotionGlobalConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { audio, prefetchSamples } from './lib/audio/engine'
import { installClickBlur } from './lib/focus'
import { installComputerKeys } from './lib/input/keys'
import { autoStartMic } from './lib/input/mic'
import { autoConnectMidi } from './lib/input/midi'
import { registerServiceWorker } from './lib/offline'
import { loadLibrary } from './state/library'

if (STATIC) MotionGlobalConfig.skipAnimations = true

installComputerKeys()
installClickBlur()
void autoConnectMidi()
void autoStartMic()
void loadLibrary()

// Browsers only allow sound after a tap or key press. On touch screens (iPad) that "activation" only
// happens when the finger lifts, so listen for every kind of tap. The listeners stay: iOS pauses the audio
// again when the iPad locks, and the next tap has to wake it (cheap when it's already running).
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
const unlock = () => {
  if (audio.ctx?.state !== 'running') audio.unlock()
}
UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }))

// After an update an open tab can ask for files that are gone (screens load on demand): reload once to get
// the new version. If that already happened a moment ago, the error screen offers Reload instead.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('tonic-reloaded') ?? 0)
    if (Date.now() - last < 15_000) return
    sessionStorage.setItem('tonic-reloaded', String(Date.now()))
  } catch {
    return
  }
  e.preventDefault()
  window.location.reload()
})

// Wait (briefly) for the music font so notes never flash as empty boxes.
await Promise.race([document.fonts.load('40px Bravura', ''), new Promise((r) => setTimeout(r, 1500))])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Download the piano once the first screen is up, so it's ready before your first note.
window.setTimeout(prefetchSamples, 800)

// Offline support for the built app (not the dev server, not automated screenshots).
if (import.meta.env.PROD && !STATIC) registerServiceWorker()
