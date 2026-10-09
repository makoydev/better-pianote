import { Download, Keyboard, Monitor, Music, RotateCcw, Upload, User, Volume2 } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { ConnectionPill } from '../../components/layout/ConnectionPill'
import { Page } from '../../components/layout/Page'
import { Button } from '../../components/ui/Button'
import { Segmented, Slider, Toggle } from '../../components/ui/controls'
import { audio } from '../../lib/audio/engine'
import { libraryBackup, restoreLibrary } from '../../state/library'
import { useProgress } from '../../state/progress'
import { type KeyLabels, type Naming, type UiScale, useSettings } from '../../state/settings'

export function Settings() {
  const s = useSettings()
  const set = s.set
  const goal = useProgress((p) => p.dailyGoal)
  const setGoal = useProgress((p) => p.setGoal)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const { set: _set, ...settings } = useSettings.getState()
    void _set
    const p = useProgress.getState()
    const progress = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== 'function'))
    const library = libraryBackup()
    const blob = new Blob([JSON.stringify({ app: 'tonic', version: 2, exportedAt: new Date().toISOString(), settings, progress, library })], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tonic-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      if (data?.app !== 'tonic' || !data.progress) throw new Error('not a Tonic file')
      useProgress.setState(data.progress)
      if (data.settings) useSettings.setState(data.settings)
      let songs = 0
      try {
        songs = data.library ? await restoreLibrary(data.library) : 0
      } catch {
        setImportMsg('Progress imported, but this browser wouldn’t store the songs (private browsing?).')
        return
      }
      setImportMsg(songs ? `Progress and ${songs} song${songs === 1 ? '' : 's'} imported. Welcome back!` : 'Progress imported. Welcome back!')
    } catch {
      setImportMsg('That file doesn’t look like a Tonic progress file.')
    }
  }

  return (
    <Page title="Settings" subtitle="Make it yours. Everything saves automatically on this device.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<Keyboard size={22} />} title="Your keyboard">
          <Row label="Connection" hint="USB cable, Bluetooth, microphone or on-screen keys.">
            <ConnectionPill />
          </Row>
          <Row label="App piano sound for keyboard notes" hint="Off: your keyboard makes its own sound.">
            <Toggle checked={s.midiThru} onChange={(v) => set({ midiThru: v })} label="App sound for keyboard notes" />
          </Row>
          <Row label="Play demos through my keyboard" hint="Example chords come out of your keyboard's speakers.">
            <Toggle checked={s.demoToKeyboard} onChange={(v) => set({ demoToKeyboard: v })} label="Play demos through my keyboard" />
          </Row>
          <Row label="Computer keys play notes" hint="A S D F … for white keys, W E T Y U for black keys, Z / X octave.">
            <Toggle checked={s.computerKeys} onChange={(v) => set({ computerKeys: v })} label="Computer keys play notes" />
          </Row>
          <Row label="Exact octave in games" hint="Off: any C counts as C. On: it must be the written octave.">
            <Toggle checked={s.strictOctave} onChange={(v) => set({ strictOctave: v })} label="Exact octave in games" />
          </Row>
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
          <Row label="Rainbow notes" hint="Each note name gets its own colour (C red, D orange, E yellow …).">
            <Toggle checked={s.colorNotes} onChange={(v) => set({ colorNotes: v })} label="Rainbow notes" />
          </Row>
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
          <Row label="Note names under the staff" hint="Training wheels for reading. Turn off when you're ready.">
            <Toggle checked={s.staffLabels} onChange={(v) => set({ staffLabels: v })} label="Note names under the staff" />
          </Row>
          <Row label="Note names">
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
          <Row label="Concert-hall reverb">
            <Toggle checked={s.reverb} onChange={(v) => set({ reverb: v })} label="Reverb" />
          </Row>
          <Row label="Feedback sounds" hint="Little dings for right answers.">
            <Toggle checked={s.uiSounds} onChange={(v) => set({ uiSounds: v })} label="Feedback sounds" />
          </Row>
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
          <Row label="Move your progress" hint="Your progress and imported songs live in this browser. Export them to move to another device.">
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={Download} onClick={exportData}>
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
                  if (f) void importData(f)
                  e.target.value = ''
                }}
              />
            </div>
          </Row>
          {importMsg && <p className="text-sm font-bold text-teal">{importMsg}</p>}
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
