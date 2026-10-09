import type { GuitarShape } from './chordTools'

/** A small chord box, the way guitar books draw it: strings vertical, nut on top. */
export function GuitarDiagram({ shape, size = 150 }: { shape: GuitarShape; size?: number }) {
  const frets = [...shape.frets]
  const played = frets.filter((f) => f !== 'x').map(Number)
  const maxFret = Math.max(4, ...played)
  const rows = Math.min(5, maxFret)
  const w = 100
  const h = 120
  const left = 14
  const top = 24
  const gapX = (w - 2 * left) / 5
  const gapY = (h - top - 8) / rows
  const x = (s: number) => left + s * gapX
  const y = (f: number) => top + (f - 0.5) * gapY
  const ink = '#f7f3ea'
  return (
    <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Guitar chord shape ${shape.frets}`} className="shrink-0">
      <rect x={left} y={top - 3} width={w - 2 * left} height={3.5} rx={1} fill={ink} />
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`f${i}`} x1={left} x2={w - left} y1={top + i * gapY} y2={top + i * gapY} stroke={ink} strokeOpacity={0.5} strokeWidth={1} />
      ))}
      {frets.map((_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + rows * gapY} stroke={ink} strokeOpacity={0.75} strokeWidth={s < 3 ? 1.4 : 1} />
      ))}
      {shape.barre && (
        <rect
          x={x(6 - shape.barre.from) - 4.5}
          y={y(shape.barre.fret) - 4.5}
          width={x(6 - shape.barre.to) - x(6 - shape.barre.from) + 9}
          height={9}
          rx={4.5}
          fill="#3ee6c8"
        />
      )}
      {frets.map((f, s) =>
        f === 'x' ? (
          <text key={`m${s}`} x={x(s)} y={top - 8} textAnchor="middle" fontSize={10} fontWeight={800} fill="#938fbb">
            ×
          </text>
        ) : f === '0' ? (
          <circle key={`o${s}`} cx={x(s)} cy={top - 11} r={3.4} fill="none" stroke={ink} strokeWidth={1.4} />
        ) : (
          <circle key={`d${s}`} cx={x(s)} cy={y(Number(f))} r={4.6} fill="#3ee6c8" />
        ),
      )}
    </svg>
  )
}
