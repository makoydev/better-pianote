import type { Widget } from '../../content/types'
import { ChordBuilder } from './ChordBuilder'
import { CircleOfFifthsWheel } from './CircleOfFifthsWheel'
import { IntervalLab } from './IntervalLab'
import { KeyboardMap } from './KeyboardMap'
import { MetronomeWidget } from './MetronomeWidget'
import { NoteValues } from './NoteValues'
import { ProgressionWidget } from './ProgressionWidget'
import { StaffMapper } from './StaffMapper'
import { StepPattern } from './StepPattern'

/** Renders an interactive lesson widget from its data description. */
export function WidgetView({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'keyboard-map':
      return <KeyboardMap />
    case 'staff-mapper':
      return <StaffMapper clef={widget.clef} />
    case 'note-values':
      return <NoteValues />
    case 'metronome':
      return <MetronomeWidget bpm={widget.bpm} beats={widget.beats} />
    case 'interval-lab':
      return <IntervalLab />
    case 'step-pattern':
      return <StepPattern tonic={widget.tonic} scale={widget.scale} />
    case 'chord-builder':
      return <ChordBuilder root={widget.root} quality={widget.quality} />
    case 'circle-of-fifths':
      return <CircleOfFifthsWheel />
    case 'progression':
      return <ProgressionWidget keyName={widget.key} romans={widget.romans} bpm={widget.bpm} pattern={widget.pattern} />
  }
}
