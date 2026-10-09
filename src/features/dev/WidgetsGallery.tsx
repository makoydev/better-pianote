import type { ReactNode } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Staff } from '../../components/staff/Staff'
import { ChordBuilder } from '../../components/widgets/ChordBuilder'
import { IntervalLab } from '../../components/widgets/IntervalLab'
import { MetronomeWidget } from '../../components/widgets/MetronomeWidget'
import { NoteValues } from '../../components/widgets/NoteValues'
import { ProgressionWidget } from '../../components/widgets/ProgressionWidget'
import { StepPattern } from '../../components/widgets/StepPattern'

/** Developer page (#/dev/widgets): every lesson widget, for checking them by eye. */

const SECTIONS: { title: string; el: ReactNode }[] = [
  { title: 'Note values', el: <NoteValues /> },
  { title: 'Metronome', el: <MetronomeWidget bpm={80} beats={4} /> },
  { title: 'Interval lab', el: <IntervalLab /> },
  { title: 'Step pattern · C major', el: <StepPattern tonic="C4" scale="major" /> },
  { title: 'Step pattern · A natural minor', el: <StepPattern tonic="A3" scale="minor" /> },
  { title: 'Chord builder', el: <ChordBuilder /> },
  { title: 'Chord builder · A minor', el: <ChordBuilder root="A" quality="min" /> },
  { title: 'Progression · vi–IV–I–V in A', el: <ProgressionWidget keyName="A" romans={['vi', 'IV', 'I', 'V']} pattern="arpeggio" bpm={70} /> },
  { title: 'Progression · Canon in D', el: <ProgressionWidget keyName="D" romans={['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V']} pattern="ballad" /> },
  {
    title: 'Key signatures (lesson visuals)',
    el: (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="paper rounded-2xl px-3 py-2">
          <Staff items={[]} keySig={7} />
        </div>
        <div className="paper rounded-2xl px-3 py-2">
          <Staff items={[]} keySig={-7} />
        </div>
        <div className="paper rounded-2xl px-3 py-2">
          <Staff clef="bass" items={[{ notes: ['A2'], dur: 'w' }]} keySig={3} />
        </div>
        <div className="paper rounded-2xl px-3 py-2">
          <Staff items={[{ notes: ['B4'], dur: 'h' }, { dur: 'h' }, { bar: 'single' }, { dur: 'w' }]} time={[4, 4]} />
        </div>
      </div>
    ),
  },
]

export function WidgetsGallery() {
  return (
    <div className="min-h-dvh">
      <TopBar back="/" title="Widgets" subtitle="Lesson widget previews" />
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="glass rounded-3xl p-4 sm:p-5">
            <h2 className="mb-3 font-display text-2xl font-bold">{s.title}</h2>
            {s.el}
          </section>
        ))}
      </div>
    </div>
  )
}
