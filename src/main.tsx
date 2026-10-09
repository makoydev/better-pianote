import { STATIC } from './qa'
import { MotionGlobalConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { audio } from './lib/audio/engine'
import { installComputerKeys } from './lib/input/keys'
import { autoStartMic } from './lib/input/mic'
import { autoConnectMidi } from './lib/input/midi'

if (STATIC) MotionGlobalConfig.skipAnimations = true

installComputerKeys()
void autoConnectMidi()
void autoStartMic()

// Browsers only allow sound after a tap or key press. On touch screens (iPad) that "activation" only
// happens when the finger lifts, so listen for every kind of tap and keep trying until audio runs.
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
const unlock = () => {
  if (audio.unlock().state !== 'running') return
  UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock, true))
}
UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }))

// Wait (briefly) for the music font so notes never flash as empty boxes.
await Promise.race([document.fonts.load('40px Bravura', ''), new Promise((r) => setTimeout(r, 1500))])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
