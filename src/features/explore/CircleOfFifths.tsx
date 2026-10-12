import { Compass, Disc3, Lightbulb, Piano as PianoIcon, Waves } from 'lucide-react'
import { MusicText } from '../../components/MusicText'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Segmented, Toggle } from '../../components/ui/controls'
import { CircleOfFifthsWheel, KeyDetails } from '../../components/widgets/CircleOfFifthsWheel'
import { CIRCLE, type Key, type Mode, keyScale, midiOf, pcOf, pitchName } from '../../lib/theory'
import { usePref } from '../../state/prefs'
import { openFreePlay, openJamInKey, openScale } from './links'

const POSITIONS = CIRCLE.map((_, i) => i)

export function CircleOfFifths() {
  const [index, setIndex] = usePref('circle:index', 0, POSITIONS)
  const [mode, setMode] = usePref<Mode>('circle:mode', 'major', ['major', 'minor'])
  const [spin, setSpin] = usePref('circle:spin', true)
  const tonic = mode === 'major' ? CIRCLE[index].major : CIRCLE[index].minor
  const key: Key = { tonic, mode }
  const scale = keyScale(key)

  const marks: Record<number, KeyMark> = {}
  let prev = 59
  for (const n of [...scale, tonic]) {
    // Lay the scale out going up from the tonic, starting at or above middle C.
    let m = midiOf({ ...n, oct: 4 })
    while (m <= prev) m += 12
    prev = m
    marks[m] = { kind: pcOf(n) === pcOf(tonic) ? 'root' : 'scale', label: pitchName(n) }
  }

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Circle of Fifths" subtitle="All 24 keys and how they fit together" />
      <main className="mx-auto grid max-w-[1500px] gap-5 px-3 pt-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex flex-col gap-5">
          <Card>
            <CircleOfFifthsWheel
              index={index}
              mode={mode}
              spin={spin}
              details={false}
              onSelect={(i, m) => {
                setIndex(i)
                setMode(m)
              }}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'major', label: 'Major' },
                  { value: 'minor', label: 'Minor' },
                ]}
              />
              <label className="flex items-center gap-3 text-sm font-extrabold text-ink-soft">
                Turn to the top
                <Toggle checked={spin} onChange={setSpin} label="Turn the selected key to the top" />
              </label>
            </div>
            <p className="mt-3 flex gap-2 text-sm text-ink-mute">
              <Compass size={18} className="mt-0.5 shrink-0 text-gold" />
              Outer ring: major keys. Inner ring: their relative minors (same notes, different home). The dashed window frames the key's chord family.
            </p>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-gold">
              <Lightbulb size={18} /> Reading the circle
            </h2>
            <ul className="space-y-2.5 text-ink-soft">
              <li>
                <b className="text-ink">Clockwise</b>, each key adds a sharp: C → G → D → A… Each step goes up a 5th.
              </li>
              <li>
                <b className="text-ink">Counter-clockwise</b>, each key adds a flat: C → F → <MusicText text="B♭" /> → <MusicText text="E♭" />…
              </li>
              <li>
                Order of sharps: <b className="text-ink">F C G D A E B</b>, “<i>Father Charles Goes Down And Ends Battle</i>”. Flats are the same backwards:{' '}
                <b className="text-ink">B E A D G C F</b>.
              </li>
              <li>
                Sharp keys: the last sharp is a half step below the key name (<MusicText text="F♯ C♯" /> → D major). Flat keys: the second-to-last flat names the key
                (<MusicText text="B♭ E♭ A♭" /> → <MusicText text="E♭" /> major).
              </li>
              <li>Neighbours share six of their seven notes, so songs can slide between them smoothly. The keys either side of yours are its IV and V chords.</li>
            </ul>
          </Card>
        </section>
        <section className="flex min-w-0 flex-col gap-5">
          <Card>
            <KeyDetails index={index} mode={mode} />
            {/* Take the key into the other tools. */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
              <Button size="md" variant="secondary" icon={Waves} onClick={() => openScale(key)}>
                Practise this scale
              </Button>
              <Button size="md" variant="secondary" icon={Disc3} onClick={() => openJamInKey(key)}>
                Jam in this key
              </Button>
              <Button size="md" variant="secondary" icon={PianoIcon} onClick={() => openFreePlay(key)}>
                Free Play in this key
              </Button>
            </div>
          </Card>
          <Card className="pt-4">
            <div className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
              The <MusicText text={`${pitchName(tonic)} ${mode}`} /> scale on your keyboard
            </div>
            {/* Names only on the scale's keys, spelled for the key: the content here, not reading help. */}
            <Piano from={60} to={84} marks={marks} labels="marked" sparks sparkHeight={80} height={170} />
          </Card>
        </section>
      </main>
    </div>
  )
}
