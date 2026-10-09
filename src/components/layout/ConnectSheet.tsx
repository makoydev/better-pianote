import { Bluetooth, CheckCircle2, Keyboard, Mic, MicOff, Usb } from 'lucide-react'
import { connectMidi } from '../../lib/input/midi'
import { startMic, stopMic } from '../../lib/input/mic'
import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/controls'
import { Modal } from '../ui/Modal'

/** How to hook up a Casio CT-S1 (or any keyboard), plus the mic and computer-key fallbacks. */
export function ConnectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const midi = useLive((s) => s.midi)
  const devices = useLive((s) => s.midiDevices)
  const mic = useLive((s) => s.mic)
  const micLevel = useLive((s) => s.micLevel)
  const keysOctave = useLive((s) => s.keysOctave)
  const midiThru = useSettings((s) => s.midiThru)
  const demoToKeyboard = useSettings((s) => s.demoToKeyboard)
  const computerKeys = useSettings((s) => s.computerKeys)
  const set = useSettings((s) => s.set)
  const connected = midi === 'ready' && devices.length > 0

  return (
    <Modal open={open} onClose={onClose} title="Connect your keyboard" wide>
      <div className="space-y-5 text-ink-soft">
        <section className="rounded-2xl border border-white/8 bg-night-850 p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-good/15 text-good">
              <Usb size={24} />
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-ink">USB cable (best)</h3>
              <p className="text-sm">The app sees every key you press, how hard, and your sustain pedal.</p>
            </div>
          </div>
          <ol className="mb-4 space-y-2 pl-1 text-[0.98rem]">
            <li>
              <b className="text-ink">1.</b> Plug a USB cable into the keyboard's <b className="text-ink">USB TO HOST</b> port and your computer. On the CT-S1
              that's the small <b className="text-ink">micro-USB</b> port on the back. The bigger USB-A port (USB TO DEVICE) is for Casio's Bluetooth adapter
              and won't talk to a computer.
            </li>
            <li>
              <b className="text-ink">2.</b> Turn the keyboard on. Use <b className="text-ink">Chrome or Edge</b> (Safari and iPhone/iPad browsers can't read MIDI yet).
            </li>
            <li>
              <b className="text-ink">3.</b> Press Connect and allow MIDI access.
            </li>
          </ol>
          {midi === 'ready' && !connected && <Troubleshoot />}
          {connected ? (
            <div className="flex items-center gap-2 rounded-xl bg-good/12 px-4 py-3 font-extrabold text-good">
              <CheckCircle2 size={22} /> Connected: {devices.join(', ')}. Play a note!
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={Usb} onClick={() => void connectMidi()} disabled={midi === 'unsupported' || midi === 'requesting'}>
                {midi === 'requesting' ? 'Waiting for permission…' : 'Connect'}
              </Button>
              <span className="text-sm">
                {midi === 'unsupported' && 'This browser has no MIDI support. Try Chrome or Edge, or use the mic below.'}
                {midi === 'denied' && 'MIDI access was blocked. Allow it from the address bar’s site settings, then try again.'}
                {midi === 'ready' && 'MIDI is on, but no keyboard is plugged in yet.'}
              </span>
            </div>
          )}
          <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-bold text-ink">Also play the app's piano sound</span>
                <span className="text-sm">Off: your keyboard makes its own sound.</span>
              </span>
              <Toggle checked={midiThru} onChange={(v) => set({ midiThru: v })} label="Play app sound for keyboard notes" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-bold text-ink">Play demos through my keyboard</span>
                <span className="text-sm">Example chords come out of the keyboard's speakers.</span>
              </span>
              <Toggle checked={demoToKeyboard} onChange={(v) => set({ demoToKeyboard: v })} label="Play demos through my keyboard" />
            </label>
          </div>
        </section>

        <section className="flex gap-3 rounded-2xl border border-white/8 bg-night-850 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky/15 text-sky">
            <Bluetooth size={24} />
          </span>
          <div>
            <h3 className="text-lg font-extrabold text-ink">Bluetooth</h3>
            <p className="text-sm">
              With Casio's WU-BT10 adapter the CT-S1 can do Bluetooth MIDI. Pair it in your computer's Bluetooth/MIDI settings first
              (on a Mac: Audio MIDI Setup → MIDI Studio → Bluetooth), then press Connect above.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-night-850 p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">
              <Mic size={24} />
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-ink">No cable? Use the microphone</h3>
              <p className="text-sm">Works on iPad too. It hears single notes in games and lessons, and whole chords in Free Play and chord exercises. Turn the keyboard up a little and keep the room quiet.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {mic === 'on' ? (
              <Button variant="secondary" icon={MicOff} onClick={stopMic}>
                Stop listening
              </Button>
            ) : (
              <Button variant="violet" icon={Mic} onClick={() => void startMic()} disabled={mic === 'unsupported' || mic === 'starting'}>
                Start listening
              </Button>
            )}
            {mic === 'on' && (
              <div className="flex h-3 w-40 overflow-hidden rounded-full bg-white/10" aria-label="Mic level">
                <div className="h-full bg-sky transition-[width] duration-75" style={{ width: `${micLevel * 100}%` }} />
              </div>
            )}
            {mic === 'denied' && <span className="text-sm text-bad">Microphone access was blocked.</span>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-night-850 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Keyboard size={24} />
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-ink">Computer keyboard</h3>
                <p className="text-sm">Handy away from the piano. Z and X change octave (now: C{keysOctave}).</p>
              </div>
            </div>
            <Toggle checked={computerKeys} onChange={(v) => set({ computerKeys: v })} label="Computer keyboard playing" />
          </div>
          <KeyHints />
        </section>
      </div>
    </Modal>
  )
}

/** Shown when MIDI is allowed but no keyboard appears. */
function Troubleshoot() {
  return (
    <div className="mb-4 rounded-xl border border-gold/30 bg-gold/8 p-4 text-[0.95rem]">
      <div className="mb-1.5 font-extrabold text-gold">No keyboard found yet. Check these:</div>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          The cable is in the small <b className="text-ink">micro-USB “USB TO HOST”</b> port, not the bigger USB-A port.
        </li>
        <li>
          The cable carries <b className="text-ink">data</b>. Many micro-USB cables only charge: if nothing changes, try another cable.
        </li>
        <li>The keyboard is switched on, and any USB-C adapter is pushed in firmly.</li>
        <li>
          On a Mac, open <b className="text-ink">Audio MIDI Setup</b> → Window → Show MIDI Studio. If “CASIO USB-MIDI” isn’t there, the Mac
          can’t see the keyboard yet (cable or port).
        </li>
      </ul>
      <div className="mt-2 text-sm">It connects by itself as soon as the keyboard shows up. No need to reload.</div>
    </div>
  )
}

function KeyHints() {
  const top = [['W', 'C♯'], ['E', 'E♭'], null, ['T', 'F♯'], ['Y', 'A♭'], ['U', 'B♭'], null, ['O', 'C♯'], ['P', 'E♭']] as const
  const bottom = [['A', 'C'], ['S', 'D'], ['D', 'E'], ['F', 'F'], ['G', 'G'], ['H', 'A'], ['J', 'B'], ['K', 'C'], ['L', 'D'], [';', 'E']] as const
  const cap = 'flex h-12 w-11 flex-col items-center justify-center rounded-lg border text-xs font-bold'
  return (
    <div className="overflow-x-auto">
      <div className="ml-6 flex gap-1.5">
        {top.map((k, i) =>
          k ? (
            <span key={i} className={`${cap} border-white/15 bg-night-700 text-ink`}>
              <span className="text-base">{k[0]}</span>
              <span className="text-ink-mute">{k[1]}</span>
            </span>
          ) : (
            <span key={i} className="w-11" />
          ),
        )}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {bottom.map((k) => (
          <span key={k[0] + k[1]} className={`${cap} border-white/20 bg-ink/90 text-night-900`}>
            <span className="text-base">{k[0]}</span>
            <span className="text-night-600">{k[1]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
