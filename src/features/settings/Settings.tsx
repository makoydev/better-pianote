import { Download, Keyboard, Monitor, Music, RotateCcw, Sparkles, Undo2, Upload, User, Volume2 } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { ConnectionPill } from '../../components/layout/ConnectionPill'
import { Page } from '../../components/layout/Page'
import { Button } from '../../components/ui/Button'
import { Segmented, Slider, Toggle } from '../../components/ui/controls'
import { audio } from '../../lib/audio/engine'
import { type Backup, canUndoImport, exportBackup, lastBackupAt, readBackup, undoImport } from '../../lib/backup'
import { openShortcuts } from '../../lib/shortcuts'
import { useProgress } from '../../state/progress'
import { resetPracticeStats } from '../practice/shared/stats'
import { useSongRuns } from '../songs/history'
import { ImportPreview } from './ImportPreview'
import { type KeyLabels, type Naming, type UiScale, useSettings } from '../../state/settings'

export function Settings() {
  const s = useSettings()
  const set = s.set
  const goal = useProgress((p) => p.dailyGoal)
  const setGoal = useProgress((p) => p.setGoal)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [lastBackup, setLastBackup] = useState(lastBackupAt)
  const file = useRef<HTMLInputElement>(null)

  return (
    <Page title="Settings" subtitle="Make it yours. Everything saves automatically on this device.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<Keyboard size={22} />} title="Your keyboard">
          <Row label="Connection" hint="USB cable, Bluetooth, microphone or on-screen keys.">
            <ConnectionPill />
          </Row>
          <ToggleRow label="App piano sound for keyboard notes" hint="Off: your keyboard makes its own sound." checked={s.midiThru} onChange={(v) => set({ midiThru: v })} />
          <ToggleRow label="Play demos through my keyboard" hint="Example chords come out of your keyboard's speakers." checked={s.demoToKeyboard} onChange={(v) => set({ demoToKeyboard: v })} />
          <ToggleRow label="Computer keys play notes" hint="A S D F … for white keys, W E T Y U for black keys, Z / X octave." checked={s.computerKeys} onChange={(v) => set({ computerKeys: v })} />
          <ToggleRow label="I'm using headphones" hint="The mic can't hear the app then, so it never has to ignore the app's notes and clicks." checked={s.headphones} onChange={(v) => set({ headphones: v })} />
          <ToggleRow label="Top C continues" hint="Playing the highest C (C7) works like Enter or a pedal tap: Continue, Start, Play again. Handy with the mic." checked={s.topCContinue} onChange={(v) => set({ topCContinue: v })} />
          <Row label="Shortcuts" hint="Keys and hands-free moves for every screen (or press ?).">
            <Button size="sm" variant="secondary" icon={Keyboard} onClick={openShortcuts}>
              Show shortcuts
            </Button>
          </Row>
          <ToggleRow label="Exact octave in games" hint="Off: any C counts as C (in games, and from computer keys in songs). Songs on a USB or on-screen keyboard always want the written octave; the mic never does." checked={s.strictOctave} onChange={(v) => set({ strictOctave: v })} />
        </Section>

        <Section icon={<Monitor size={22} />} title="Display">
          <Row label="Size" hint="Bigger is easier to read from the piano.">
            <Segmented<UiScale>
              value={s.uiScale}
              onChange={(v) => set({ uiScale: v })}
              size="sm"
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
                { value: 'xl', label: 'Extra' },
              ]}
            />
          </Row>
          <ToggleRow label="Rainbow notes" hint="Each note name gets its own colour (C red, D orange, E yellow …)." checked={s.colorNotes} onChange={(v) => set({ colorNotes: v })} />
          <Row label="Names on keys">
            <Segmented<KeyLabels>
              value={s.keyLabels}
              onChange={(v) => set({ keyLabels: v })}
              size="sm"
              options={[
                { value: 'all', label: 'All' },
                { value: 'c', label: 'Only C' },
                { value: 'none', label: 'None' },
              ]}
            />
          </Row>
          <ToggleRow label="Keep the screen on while practising" hint="Lessons, games, songs and tools. Your hands are on the keys, not the screen." checked={s.keepAwake} onChange={(v) => set({ keepAwake: v })} />
          <ToggleRow label="Note names under the staff" hint="Training wheels for reading. Turn off when you're ready." checked={s.staffLabels} onChange={(v) => set({ staffLabels: v })} />
          <Row label="Note names" hint="Single notes on the keyboard, the staff, lessons and songs. Chord and key names (Dm, G major) and game answers stay in letters.">
            <Segmented<Naming>
              value={s.naming}
              onChange={(v) => set({ naming: v })}
              size="sm"
              options={[
                { value: 'letters', label: 'C D E' },
                { value: 'solfege', label: 'Do Re Mi' },
              ]}
            />
          </Row>
        </Section>

        <Section icon={<Volume2 size={22} />} title="Sound">
          <Row label="Volume">
            <div className="flex w-56 items-center gap-3">
              <Slider value={s.volume} min={0} max={1} step={0.05} onChange={(v) => set({ volume: v })} label="Volume" />
              <Button size="sm" variant="secondary" onClick={() => audio.play([60, 64, 67], { dur: 1.2, strum: 0.04 })}>
                Test
              </Button>
            </div>
          </Row>
          <ToggleRow label="Concert-hall reverb" checked={s.reverb} onChange={(v) => set({ reverb: v })} />
          <ToggleRow label="Feedback sounds" hint="Little dings for right answers." checked={s.uiSounds} onChange={(v) => set({ uiSounds: v })} />
        </Section>

        <Section icon={<User size={22} />} title="You">
          <Row label="Your name" hint="For the greeting on the home screen.">
            <input
              value={s.name}
              onChange={(e) => set({ name: e.target.value.slice(0, 30) })}
              placeholder="Optional"
              className="h-11 w-48 rounded-xl border border-white/10 bg-night-850 px-3 font-bold text-ink placeholder:text-ink-mute"
            />
          </Row>
          <Row label="Daily goal">
            <Segmented
              value={goal}
              onChange={setGoal}
              size="sm"
              options={[
                { value: 20, label: '20' },
                { value: 40, label: '40' },
                { value: 60, label: '60' },
                { value: 100, label: '100 XP' },
              ]}
            />
          </Row>
          <Row
            label="Move your progress"
            hint={`Your progress and imported songs live in this browser. Export them to move to another device (or keep a backup). ${backupNote(lastBackup)}`}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={Download}
                onClick={() => void exportBackup().then(() => setLastBackup(lastBackupAt()))}
              >
                Export
              </Button>
              <Button size="sm" variant="secondary" icon={Upload} onClick={() => file.current?.click()}>
                Import
              </Button>
              <input
                ref={file}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setImportMsg(null)
                    readBackup(f).then(setPending, (err: Error) => setImportMsg(err.message))
                  }
                  e.target.value = ''
                }}
              />
              {canUndoImport() && (
                <Button size="sm" variant="ghost" icon={Undo2} onClick={undoImport}>
                  Undo import
                </Button>
              )}
            </div>
          </Row>
          {importMsg && <p className="text-sm font-bold text-bad">{importMsg}</p>}
          <ImportPreview backup={pending} onClose={() => setPending(null)} />
          <Row label="Welcome tour" hint="See the first-launch steps again (connecting your keyboard, where to start).">
            <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => set({ onboarded: false })}>
              Show welcome again
            </Button>
          </Row>
          <Row label="Start over" hint="Clears lessons, XP, streaks and scores.">
            <Button
              size="sm"
              variant={confirmReset ? 'danger' : 'ghost'}
              icon={RotateCcw}
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true)
                  window.setTimeout(() => setConfirmReset(false), 4000)
                  return
                }
                useProgress.getState().resetAll()
                // Scores live in a few places: the games' trends and weak spots, and each song's run history.
                resetPracticeStats()
                useSongRuns.setState({ runs: {} })
                setConfirmReset(false)
              }}
            >
              {confirmReset ? 'Tap again to reset' : 'Reset progress'}
            </Button>
          </Row>
        </Section>
      </div>

      <section className="mt-8 rounded-3xl border border-white/8 p-6 text-sm leading-relaxed text-ink-mute">
        <div className="mb-2 flex items-center gap-2 font-extrabold text-ink-soft">
          <Music size={18} /> Credits
        </div>
        <p>
          Piano sound: <b className="text-ink-soft">Salamander Grand Piano</b> by Alexander Holm (Yamaha C5), licensed{' '}
          <a className="underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          , via the Tone.js audio collection.
        </p>
        <p>
          Music notation font: <b className="text-ink-soft">Bravura</b> by Steinberg Media Technologies, licensed under the SIL Open Font License 1.1.
        </p>
        <p>Songs in the Songs section are public-domain melodies.</p>
      </section>
    </Page>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-extrabold">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold">{icon}</span>
        {title}
      </h2>
      <div className="divide-y divide-white/6">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="font-bold text-ink">{label}</div>
        {hint && <div className="text-sm text-ink-mute">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function backupNote(at: number | null): string {
  if (!at) return 'No backup yet.'
  const days = Math.floor((Date.now() - at) / 864e5)
  return `Last backup: ${days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`
}

/** A setting that's a switch: the whole row (text included) toggles it. */
function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{label}</span>
        {hint && <span className="block text-sm text-ink-mute">{hint}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </label>
  )
}
