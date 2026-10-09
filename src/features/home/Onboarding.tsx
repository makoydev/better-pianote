import { ArrowRight, CheckCircle2, Guitar, Keyboard, Mic, Piano, Sparkles, Usb } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { LogoMark } from '../../components/layout/Logo'
import { Button } from '../../components/ui/Button'
import { connectMidi } from '../../lib/input/midi'
import { startMic } from '../../lib/input/mic'
import { go } from '../../router'
import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'

/** First launch: say hi, hook up the keyboard, pick where to start. */
export function Onboarding() {
  const [step, setStep] = useState(0)
  const name = useSettings((s) => s.name)
  const set = useSettings((s) => s.set)
  const midi = useLive((s) => s.midi)
  const devices = useLive((s) => s.midiDevices)
  const mic = useLive((s) => s.mic)
  const connected = midi === 'ready' && devices.length > 0

  const finish = (path: string) => {
    set({ onboarded: true })
    go(path)
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-night-950/85 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-night-800 p-7 shadow-2xl sm:p-10">
        <span aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-violet/25 blur-3xl" />
        <span aria-hidden className="absolute -bottom-24 -left-24 size-72 rounded-full bg-coral/20 blur-3xl" />
        <div className="relative mb-6 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-gold' : 'w-2 bg-white/20'}`} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="relative text-center">
              <motion.div initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="mx-auto mb-5 w-fit">
                <LogoMark size={96} />
              </motion.div>
              <h1 className="font-display text-5xl font-bold">Welcome to Tonic</h1>
              <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
                Learn piano properly: read notes, build chords, play scales, and finally understand the progressions you already play by ear.
              </p>
              <label className="mx-auto mt-7 block max-w-sm text-left">
                <span className="text-sm font-extrabold uppercase tracking-widest text-ink-mute">What should we call you? (optional)</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => set({ name: e.target.value.slice(0, 30) })}
                  onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
                  placeholder="Your name"
                  className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-night-900 px-4 text-xl font-bold text-ink placeholder:text-ink-mute focus:border-gold"
                />
              </label>
              <Button size="xl" iconRight={ArrowRight} className="mt-7" onClick={() => setStep(1)}>
                Let’s go
              </Button>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="relative">
              <h2 className="text-center font-display text-4xl font-bold">How will you play?</h2>
              <p className="mt-2 text-center text-lg text-ink-soft">The app listens to your playing, so lessons and games react to your real keys.</p>
              <div className="mt-6 space-y-3">
                <Choice
                  icon={<Usb size={26} />}
                  color="#3ddc97"
                  title="My keyboard, with a USB cable"
                  detail="Best. Works in Chrome or Edge. Plug the CT-S1’s USB port into your computer, then press here."
                  done={connected}
                  doneText={connected ? `Connected: ${devices[0]}` : undefined}
                  onClick={() => void connectMidi()}
                  disabled={midi === 'unsupported'}
                  note={midi === 'unsupported' ? 'This browser can’t read MIDI. Try Chrome or Edge.' : midi === 'ready' && !connected ? 'Allowed, but no keyboard found yet. Is it plugged in and on?' : midi === 'denied' ? 'MIDI access was blocked.' : undefined}
                />
                <Choice
                  icon={<Mic size={26} />}
                  color="#9b8cff"
                  title="Listen through the microphone"
                  detail="Great for iPad. Hears one note at a time."
                  done={mic === 'on'}
                  doneText="Listening!"
                  onClick={() => void startMic()}
                  disabled={mic === 'unsupported'}
                />
                <Choice
                  icon={<Keyboard size={26} />}
                  color="#ffc857"
                  title="On-screen keys for now"
                  detail="Tap the keys on screen, or use your computer keyboard (A S D F …)."
                  onClick={() => setStep(2)}
                />
              </div>
              <div className="mt-6 flex justify-end">
                <Button iconRight={ArrowRight} onClick={() => setStep(2)}>
                  {connected || mic === 'on' ? 'Next' : 'Skip for now'}
                </Button>
              </div>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="relative text-center">
              <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-3xl bg-teal/15 text-teal">
                <Guitar size={40} />
              </div>
              <h2 className="font-display text-4xl font-bold">Your ear is a superpower</h2>
              <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
                You already play by ear and know chords from guitar. Tonic connects what your hands know to what’s on the page, with “Guitar brain” notes along the way.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Button size="xl" icon={Piano} onClick={() => finish('/learn/u1-l1')}>
                  First lesson
                </Button>
                <Button size="xl" variant="violet" icon={Sparkles} onClick={() => finish('/play')}>
                  Free Play
                </Button>
              </div>
              <button type="button" onClick={() => finish('/')} className="mt-4 text-sm font-bold text-ink-mute hover:text-ink">
                Look around first
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function Choice({
  icon,
  color,
  title,
  detail,
  onClick,
  done,
  doneText,
  disabled,
  note,
}: {
  icon: React.ReactNode
  color: string
  title: string
  detail: string
  onClick: () => void
  done?: boolean
  doneText?: string
  disabled?: boolean
  note?: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-40 ${done ? 'border-good bg-good/10' : 'border-white/8 bg-night-750 hover:border-white/25'}`}
    >
      <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}26`, color }}>
        {done ? <CheckCircle2 size={26} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-extrabold">{title}</span>
        <span className="block text-sm text-ink-mute">{done && doneText ? doneText : detail}</span>
        {note && <span className="mt-1 block text-sm font-bold text-gold">{note}</span>}
      </span>
    </motion.button>
  )
}
