import { Guitar } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { Card } from '../../components/ui/Card'
import { type Chord, chordSymbol } from '../../lib/theory'
import { type GuitarVoicing, capoShapes, guitarVoicings, voicingName } from './guitar'
import { GuitarDiagram } from './GuitarDiagram'

/** How to play a voicing, in a sentence. */
function howTo(v: GuitarVoicing, symbol: string): string {
  if (v.form === 'open') return `The open ${symbol} chord.`
  const string = v.form === 'E' ? 'low E string' : 'A string'
  if (v.fret === 0) return `Root on the open ${string}.`
  const where = v.barre ? `Barre fret ${v.fret}, root on the ${string}.` : `Root on the ${string} at fret ${v.fret}.`
  return v.capo ? `${where} = ${v.capo.shape} shape, capo ${v.capo.fret}.` : where
}

/** A chord on the guitar: the open chord and movable barre shapes to choose from, plus capo options. */
export function GuitarCard({ chord, className = '' }: { chord: Chord; className?: string }) {
  const plain = useMemo(() => ({ root: chord.root, type: chord.type }), [chord.root, chord.type])
  const voicings = useMemo(() => guitarVoicings(plain), [plain])
  // Remember the kind of shape, so stepping through roots keeps you on (say) the A shape.
  const [form, setForm] = useState<GuitarVoicing['form']>('open')
  const v = voicings.find((x) => x.form === form) ?? voicings[0]
  const symbol = chordSymbol(plain)
  const capos = capoShapes(plain).filter((c) => !(v.capo && c.shape === v.capo.shape && c.fret === v.capo.fret))
  return (
    <Card className={`flex items-start gap-4 ${className}`}>
      <GuitarDiagram voicing={v} size={112} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-teal">
          <Guitar size={18} /> On guitar
        </div>
        {voicings.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {voicings.map((x) => (
              <button
                key={x.form}
                type="button"
                aria-pressed={x === v}
                onClick={() => setForm(x.form)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-extrabold transition-colors ${
                  x === v ? 'border-teal bg-teal/15 text-teal' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
                }`}
              >
                {voicingName(x)}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-ink-soft">
          <MusicText text={howTo(v, symbol)} />
        </p>
        {capos.length > 0 && (
          <p className="mt-1 text-sm text-ink-mute">
            <MusicText text={`With a capo: ${capos.map((c) => `${c.shape} shape, capo ${c.fret}`).join(' · ')}`} />
          </p>
        )}
      </div>
    </Card>
  )
}
