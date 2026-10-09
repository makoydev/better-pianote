import { STATIC } from './qa'
import { MotionGlobalConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { audio } from './lib/audio/engine'
import { installComputerKeys } from './lib/input/keys'
import { autoConnectMidi } from './lib/input/midi'

if (STATIC) MotionGlobalConfig.skipAnimations = true

installComputerKeys()
void autoConnectMidi()

// Browsers only allow sound after a tap or key press, so unlock audio on the first one.
const unlock = () => {
  audio.unlock()
  window.removeEventListener('pointerdown', unlock)
  window.removeEventListener('keydown', unlock)
}
window.addEventListener('pointerdown', unlock)
window.addEventListener('keydown', unlock)

// Wait (briefly) for the music font so notes never flash as empty boxes.
await Promise.race([document.fonts.load('40px Bravura', ''), new Promise((r) => setTimeout(r, 1500))])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
