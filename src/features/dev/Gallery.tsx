import { Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'

/** Developer page (#/dev): every notation case in one place, for checking rendering. */

const odeToJoy: StaffItem[] = [
  { notes: [{ note: 'E4', finger: 3 }], chord: 'C' },
  { notes: ['E4'] },
  { notes: ['F4'] },
  { notes: ['G4'] },
  { bar: 'single' },
  { notes: ['G4'], chord: 'G' },
  { notes: ['F4'] },
  { notes: ['E4'] },
  { notes: ['D4'] },
  { bar: 'single' },
  { notes: ['C4'], chord: 'C' },
  { notes: ['C4'] },
  { notes: ['D4'] },
  { notes: ['E4'] },
  { bar: 'single' },
  { notes: ['E4'], dur: 'q', dots: 1, chord: 'G' },
  { notes: ['D4'], dur: '8' },
  { notes: ['D4'], dur: 'h' },
  { bar: 'final' },
]

const rhythm: StaffItem[] = [
  { notes: ['B4'], dur: 'q', text: '1' },
  { notes: ['B4'], dur: '8', text: '2' },
  { notes: ['B4'], dur: '8', text: '&' },
  { notes: ['B4'], dur: '16', text: '3' },
  { notes: ['B4'], dur: '16', text: 'e' },
  { notes: ['B4'], dur: '16', text: '&' },
  { notes: ['B4'], dur: '16', text: 'a' },
  { dur: 'q', text: '4' },
  { bar: 'single' },
  { notes: ['B4'], dur: 'h', text: '1' },
  { dur: 'h', text: '3' },
  { bar: 'final' },
]

const chords: StaffItem[] = [
  { notes: ['C4', 'E4', 'G4'], dur: 'w', chord: 'C' },
  { notes: ['C4', 'D4', 'G4'], dur: 'w', chord: 'Csus2' },
  { notes: ['F#4', 'A4', 'C#5'], dur: 'w', chord: 'F♯m' },
  { notes: ['Eb4', 'G4', 'Bb4', 'D5'], dur: 'h', chord: 'E♭maj7' },
  { notes: ['B3', 'D4', 'F4', 'Ab4'], dur: 'q', chord: 'Bdim7' },
  { notes: ['A5', 'C6', 'E6'], dur: 'q', chord: 'Am' },
]

const grand: StaffItem[] = [
  { notes: ['C3', 'G3', 'E4', 'C5'], dur: 'w', chord: 'C' },
  { notes: ['A2', 'E3', 'C4', 'E4', 'A4'], dur: 'h', chord: 'Am' },
  { notes: ['F2', 'C3', 'A3', 'F4', 'A4'], dur: 'h', chord: 'F' },
  { notes: ['G2', 'D3', 'B3', 'D4', 'G4'], dur: 'q', chord: 'G' },
  { notes: ['C4'], dur: 'q', staff: 'bass' },
  { dur: 'h', staff: 'bass' },
]

const furElise: StaffItem[] = [
  { notes: ['E5'], dur: '16' },
  { notes: ['D#5'], dur: '16' },
  { bar: 'single' },
  { notes: ['E5'], dur: '16' },
  { notes: ['D#5'], dur: '16' },
  { notes: ['E5'], dur: '16' },
  { notes: ['B4'], dur: '16' },
  { notes: ['D5'], dur: '16' },
  { notes: ['C5'], dur: '16' },
  { bar: 'single' },
  { notes: ['A4'], dur: '8', chord: 'Am' },
  { dur: '16' },
  { notes: ['C4'], dur: '16' },
  { notes: ['E4'], dur: '16' },
  { notes: ['A4'], dur: '16' },
  { bar: 'single' },
  { notes: ['B4'], dur: '8', chord: 'E' },
  { dur: '16' },
  { notes: ['E4'], dur: '16' },
  { notes: ['G#4'], dur: '16' },
  { notes: ['B4'], dur: '16' },
  { bar: 'single' },
  { notes: ['C5'], dur: '8', chord: 'Am', tie: true },
  { notes: ['C5'], dur: '8' },
]

export function Gallery() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1 className="font-display text-4xl font-bold">Notation gallery</h1>
      <div className="paper rounded-3xl p-4">
        <Staff items={odeToJoy} time={[4, 4]} spacing="proportional" endBar={false} />
      </div>
      <div className="paper rounded-3xl p-4">
        <Staff items={[{ notes: ['C4'], dur: 'w', state: 'active' }, { notes: ['G4'], dur: 'w', state: 'correct' }, { notes: ['F5'], dur: 'w', state: 'wrong' }, { notes: ['A5'], dur: 'w' }, { notes: ['C6'], dur: 'w', state: 'ghost' }]} sp={22} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="paper rounded-3xl p-4">
          <Staff items={chords} keySig={0} />
        </div>
        <div className="paper rounded-3xl p-4">
          <Staff clef="bass" items={[{ notes: ['G2'], dur: 'h' }, { notes: ['B2'], dur: 'h' }, { notes: ['D3'], dur: 'q' }, { notes: ['F3'] }, { notes: ['A3'] }, { notes: ['C4'] }, { notes: ['E2'], dur: '8' }, { notes: ['C2'], dur: '8' }]} time={[4, 4]} spacing="proportional" />
        </div>
      </div>
      <div className="paper rounded-3xl p-4">
        <Staff clef="grand" items={grand} keySig={0} time={[4, 4]} spacing="proportional" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="paper rounded-3xl p-4">
          <Staff items={[{ notes: ['F#4'], dur: 'q' }, { notes: ['F4'], dur: 'q' }, { notes: ['Bb4'], dur: 'q' }, { bar: 'single' }, { notes: ['F4'], dur: 'q' }, { notes: ['C5'], dur: 'h' }]} keySig={2} time={[3, 4]} spacing="proportional" />
        </div>
        <div className="paper rounded-3xl p-4">
          <Staff items={[{ notes: ['Bb3'], dur: 'h' }, { notes: ['Eb5'], dur: 'h' }]} keySig={-4} time={[4, 4]} />
        </div>
      </div>
      <div className="paper rounded-3xl p-4">
        <Staff clef="rhythm" items={rhythm} time={[4, 4]} spacing="proportional" />
      </div>
      <div className="paper rounded-3xl p-4">
        <Staff items={furElise} time={[3, 8]} spacing="proportional" labels={false} />
      </div>
      <div className="glass rounded-3xl p-4 pt-40">
        <Piano from={48} to={84} sparks marks={{ 60: 'target', 64: { kind: 'chord', label: '3' }, 67: 'root', 62: 'scale', 66: 'hint', 69: 'good', 71: 'bad' }} fingers={{ 60: 1, 64: 3, 67: 5 }} octaveLabels />
      </div>
      <div className="glass rounded-3xl p-4">
        <Piano from={36} to={96} labels="c" height={150} />
      </div>
    </div>
  )
}
