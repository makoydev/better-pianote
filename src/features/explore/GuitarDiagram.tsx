import { type GuitarVoicing, fretText } from './guitar'

/**
 * A small chord box, the way guitar books draw it: strings vertical, nut on top. Shapes higher up the neck start at
 * their lowest fret, labelled "5fr", without the nut.
 */
export function GuitarDiagram({ voicing, size = 150 }: { voicing: Pick<GuitarVoicing, 'frets' | 'barre'>; size?: number }) {
  const { frets, barre } = voicing
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const highest = Math.max(0, ...fretted)
  const atNut = highest <= 5
  const base = atNut ? 1 : Math.min(...fretted)
  const rows = Math.max(4, highest - base + 1)
  const w = 100
  const h = 120
  // Room on the left for the "12fr" label.
  const left = atNut ? 14 : 22
  const right = atNut ? 14 : 8
  const top = 24
  const gapX = (w - left - right) / 5
  const gapY = (h - top - 8) / rows
  const x = (s: number) => left + s * gapX
  const y = (f: number) => top + (f - base + 0.5) * gapY
  const ink = '#f7f3ea'
  return (
    <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Guitar chord shape ${fretText(frets)}`} className="shrink-0">
      {atNut ? (
        <rect x={left} y={top - 3} width={w - left - right} height={3.5} rx={1} fill={ink} />
      ) : (
        <text x={left - 4} y={y(base) + 3} textAnchor="end" fontSize={8.5} fontWeight={800} fill="#b9b5d6">
          {base}fr
        </text>
      )}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`f${i}`} x1={left} x2={w - right} y1={top + i * gapY} y2={top + i * gapY} stroke={ink} strokeOpacity={0.5} strokeWidth={1} />
      ))}
      {frets.map((_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + rows * gapY} stroke={ink} strokeOpacity={0.75} strokeWidth={s < 3 ? 1.4 : 1} />
      ))}
      {barre && (
        <rect
          x={x(6 - barre.from) - 4.5}
          y={y(barre.fret) - 4.5}
          width={x(6 - barre.to) - x(6 - barre.from) + 9}
          height={9}
          rx={4.5}
          fill="#3ee6c8"
        />
      )}
      {frets.map((f, s) =>
        f === null ? (
          <text key={`m${s}`} x={x(s)} y={top - 8} textAnchor="middle" fontSize={10} fontWeight={800} fill="#938fbb">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={`o${s}`} cx={x(s)} cy={top - 11} r={3.4} fill="none" stroke={ink} strokeWidth={1.4} />
        ) : (
          <circle key={`d${s}`} cx={x(s)} cy={y(f)} r={4.6} fill="#3ee6c8" />
        ),
      )}
    </svg>
  )
}
