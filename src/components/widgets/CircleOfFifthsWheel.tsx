import { Play } from 'lucide-react'
import { motion, useSpring, useTransform } from 'motion/react'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { playChord, playSequence } from '../../lib/audio/play'
import {
  CIRCLE,
  type Key,
  type Mode,
  chordSymbol,
  circleLabel,
  diatonicChords,
  keyFifths,
  keyName,
  keyScale,
  keySignature,
  midiOf,
  pitchName,
  relativeKey,
} from '../../lib/theory'
import { MusicText, SvgMusicText } from '../MusicText'
import { Staff, type StaffItem } from '../staff/Staff'
import { Button } from '../ui/Button'

/**
 * The circle of fifths. Majors on the outside, their relative minors inside. Tap a key and the wheel
 * turns it to the top; the window at the top then frames its chord family (IV I V with ii vi iii).
 * Works on its own (lessons use it with no props) or controlled by a page.
 */

const R_OUT = 100
const R_MID = 68
const R_IN = 41

const rad = (deg: number) => (deg * Math.PI) / 180
const pt = (r: number, deg: number): [number, number] => [r * Math.sin(rad(deg)), -r * Math.cos(rad(deg))]

function sector(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = pt(r2, a1)
  const [x2, y2] = pt(r2, a2)
  const [x3, y3] = pt(r1, a2)
  const [x4, y4] = pt(r1, a1)
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`
}

const sigText = (f: number) => (f === 0 ? '0' : f > 0 ? `${f}♯` : `${-f}♭`)
const ringDistance = (a: number, b: number) => (((a - b) % 12) + 18) % 12 - 6

const MAJOR_FAMILY: Record<number, [string, string]> = { [-1]: ['IV', 'ii'], 0: ['I', 'vi'], 1: ['V', 'iii'] }
const MINOR_FAMILY: Record<number, [string, string]> = { [-1]: ['VI', 'iv'], 0: ['III', 'i'], 1: ['VII', 'v'] }

function keyAt(index: number, mode: Mode): Key {
  const c = CIRCLE[index]
  return { tonic: mode === 'major' ? c.major : c.minor, mode }
}

export interface CircleOfFifthsWheelProps {
  /** Selected position (0 = C major / A minor, clockwise). Uncontrolled when omitted. */
  index?: number
  mode?: Mode
  onSelect?: (index: number, mode: Mode) => void
  /** Show the key's signature, scale and chords under the wheel (default: on when uncontrolled). */
  details?: boolean
  /** Turn the selected key to the top (default on). */
  spin?: boolean
  /** Play the key's home chord when tapped (default on). */
  sound?: boolean
  className?: string
}

export function CircleOfFifthsWheel({ index: indexProp, mode: modeProp, onSelect, details, spin = true, sound = true, className = '' }: CircleOfFifthsWheelProps) {
  const [own, setOwn] = useState<{ index: number; mode: Mode }>({ index: 0, mode: 'major' })
  const index = indexProp ?? own.index
  const mode = modeProp ?? own.mode
  const showDetails = details ?? indexProp === undefined
  const uid = useId().replace(/:/g, '')

  // Cumulative rotation so the wheel always turns the short way round.
  const rotTarget = useRef(-index * 30)
  const lastIndex = useRef(index)
  const rot = useSpring(spin ? -index * 30 : 0, { stiffness: 90, damping: 17 })
  const counter = useTransform(rot, (v) => -v)
  useEffect(() => {
    rotTarget.current -= ringDistance(index, lastIndex.current) * 30
    lastIndex.current = index
    rot.set(spin ? rotTarget.current : 0)
  }, [index, spin, rot])

  const select = (i: number, m: Mode) => {
    if (indexProp === undefined) setOwn({ index: i, mode: m })
    onSelect?.(i, m)
    if (sound) {
      const k = keyAt(i, m)
      void playChord(diatonicChords(k)[0].chord)
    }
  }
  const onKey = (e: KeyboardEvent, i: number, m: Mode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(i, m)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      select((i + (e.key === 'ArrowRight' ? 1 : 11)) % 12, m)
    }
  }

  const key = keyAt(index, mode)
  const fifths = keyFifths(key)
  const family = (i: number) => ringDistance(i, index)

  return (
    <div className={className}>
      <div className={`relative mx-auto aspect-square w-full ${indexProp === undefined ? 'max-w-[28rem]' : 'max-w-[34rem]'}`}>
        <svg viewBox="-112 -112 224 224" className="size-full overflow-visible" role="group" aria-label="Circle of fifths">
          <defs>
            <radialGradient id={`${uid}-core`}>
              <stop offset="0%" stopColor="#2a2858" />
              <stop offset="100%" stopColor="#141331" />
            </radialGradient>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* The family window: fixed at the top, the wheel turns underneath it. */}
          {spin && (
            <path
              d={sector(R_IN - 2, R_OUT + 6, -46, 46)}
              fill="none"
              stroke="#ffc857"
              strokeWidth={2.2}
              strokeDasharray="5 4"
              opacity={0.75}
            />
          )}

          <motion.g style={{ rotate: rot }}>
            {CIRCLE.map((c, i) => {
              const a = i * 30
              const d = family(i)
              const inFamily = Math.abs(d) <= 1
              const hue = (i * 30 + 350) % 360
              const selMajor = i === index && mode === 'major'
              const selMinor = i === index && mode === 'minor'
              const [romOut, romIn] = (mode === 'major' ? MAJOR_FAMILY : MINOR_FAMILY)[d] ?? ['', '']
              const [lx, ly] = pt(83, a)
              const [mx, my] = pt(56, a)
              const [rx, ry] = pt(46.5, a)
              const [ox, oy] = pt(97, a)
              return (
                <g key={i}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${keyName({ tonic: c.major, mode: 'major' })}, ${Math.abs(c.fifths)} ${c.fifths >= 0 ? 'sharps' : 'flats'}`}
                    aria-pressed={selMajor}
                    onClick={() => select(i, 'major')}
                    onKeyDown={(e) => onKey(e, i, 'major')}
                    className="cursor-pointer outline-none [&:focus-visible>path]:stroke-gold"
                  >
                    <path
                      d={sector(R_MID, R_OUT, a - 15, a + 15)}
                      fill={selMajor ? '#ffc857' : `hsl(${hue} 70% ${inFamily ? 62 : 58}% / ${inFamily ? 0.42 : 0.16})`}
                      stroke="#0d0c24"
                      strokeWidth={1.6}
                      className="transition-[fill] duration-300 hover:brightness-125"
                    />
                    {/* Key name with its sharp/flat count underneath, kept upright as the wheel turns. */}
                    <motion.g style={{ rotate: counter }}>
                      <text x={lx} y={ly + 2} textAnchor="middle" fontSize={c.fifths === 6 ? 11 : 15} fontWeight={800} fill={selMajor ? '#1f1b33' : '#f7f3ea'} className="pointer-events-none font-display">
                        <SvgMusicText text={circleLabel(i, 'major')} />
                      </text>
                      <text x={lx} y={ly + 12} textAnchor="middle" fontSize={7} fontWeight={800} fill={selMajor ? '#3b2f12' : '#b9b5d6'} className="pointer-events-none">
                        <SvgMusicText text={sigText(c.fifths)} />
                      </text>
                    </motion.g>
                  </g>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={keyName({ tonic: c.minor, mode: 'minor' })}
                    aria-pressed={selMinor}
                    onClick={() => select(i, 'minor')}
                    onKeyDown={(e) => onKey(e, i, 'minor')}
                    className="cursor-pointer outline-none [&:focus-visible>path]:stroke-gold"
                  >
                    <path
                      d={sector(R_IN, R_MID, a - 15, a + 15)}
                      fill={selMinor ? '#ffc857' : `hsl(${hue} 55% ${inFamily ? 55 : 45}% / ${inFamily ? 0.36 : 0.12})`}
                      stroke="#0d0c24"
                      strokeWidth={1.6}
                      className="transition-[fill] duration-300 hover:brightness-125"
                    />
                    <motion.g style={{ rotate: counter }}>
                      {c.fifths === 6 ? (
                        <text x={mx} y={my - 1} textAnchor="middle" fontSize={9} fontWeight={800} fill={selMinor ? '#1f1b33' : '#e3dff7'} className="pointer-events-none font-display">
                          <tspan x={mx}>
                            <SvgMusicText text="D♯m" />
                          </tspan>
                          <tspan x={mx} dy={9}>
                            <SvgMusicText text="E♭m" />
                          </tspan>
                        </text>
                      ) : (
                        <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={selMinor ? '#1f1b33' : '#e3dff7'} className="pointer-events-none font-display">
                          <SvgMusicText text={circleLabel(i, 'minor')} />
                        </text>
                      )}
                    </motion.g>
                  </g>
                  {inFamily && romOut && (
                    <>
                      <motion.g style={{ rotate: counter }}>
                        <text x={ox} y={oy + 2.5} textAnchor="middle" fontSize={6.5} fontWeight={900} fill={selMajor ? '#1f1b33' : '#ffc857'} className="pointer-events-none">
                          {romOut}
                        </text>
                      </motion.g>
                      <motion.g style={{ rotate: counter }}>
                        <text x={rx} y={ry + 2.5} textAnchor="middle" fontSize={6} fontWeight={900} fill={selMinor ? '#1f1b33' : '#ffc857'} className="pointer-events-none">
                          {romIn}
                        </text>
                      </motion.g>
                    </>
                  )}
                </g>
              )
            })}
          </motion.g>

          <circle r={R_IN - 3} fill={`url(#${uid}-core)`} stroke="rgba(255,255,255,.08)" />
          <circle r={R_IN - 3} fill="none" stroke="#ffc857" strokeOpacity={0.35} strokeWidth={6} filter={`url(#${uid}-glow)`} />
          <text y={-4} textAnchor="middle" fontSize={key.tonic.acc ? 19 : 22} fontWeight={800} fill="#f7f3ea" className="font-display">
            <SvgMusicText text={pitchName(key.tonic) + (mode === 'minor' ? 'm' : '')} />
          </text>
          <text y={11} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#ffc857">
            {mode.toUpperCase()}
          </text>
          <text y={22} textAnchor="middle" fontSize={7} fontWeight={700} fill="#b9b5d6">
            <SvgMusicText text={fifths === 0 ? 'no ♯ or ♭' : `${Math.abs(fifths)} ${fifths > 0 ? '♯' : '♭'}`} />
          </text>
        </svg>
      </div>
      {showDetails && <KeyDetails index={index} mode={mode} className="mt-5" />}
    </div>
  )
}

/** Key signature, scale and diatonic chords for a key on the circle. */
export function KeyDetails({ index, mode, className = '' }: { index: number; mode: Mode; className?: string }) {
  const key = keyAt(index, mode)
  const fifths = keyFifths(key)
  const sig = keySignature(fifths)
  const rel = relativeKey(key)
  const chords = diatonicChords(key)
  const scale = useMemo(() => {
    const k = keyAt(index, mode)
    return [...keyScale(k), { ...k.tonic, oct: k.tonic.oct + 1 }]
  }, [index, mode])
  const items: StaffItem[] = useMemo(() => scale.map((n, i) => ({ key: `${index}-${mode}-${i}`, notes: [n], dur: 'q' })), [scale, index, mode])
  // I, IV and V (i, iv, v in minor): the chords most songs in the key lean on.
  const primary = [0, 3, 4]
  const enharmonic = CIRCLE[index].fifths === 6 ? (mode === 'major' ? 'Also written as G♭ major (6 flats).' : 'Also written as E♭ minor (6 flats).') : null

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-3xl font-bold">
            <MusicText text={keyName(key).replace(/^./, (s) => s.toUpperCase())} />
          </h3>
          <p className="text-ink-soft">
            {fifths === 0 ? (
              'No sharps or flats'
            ) : (
              <MusicText text={`${Math.abs(fifths)} ${fifths > 0 ? 'sharp' : 'flat'}${Math.abs(fifths) > 1 ? 's' : ''}: ${sig.letters.map((l) => l + (sig.acc > 0 ? '♯' : '♭')).join(' ')}`} />
            )}
            {' · '}
            <span className="text-ink-mute">
              relative {rel.mode}: <MusicText text={`${pitchName(rel.tonic)} ${rel.mode}`} />
            </span>
          </p>
          {enharmonic && (
            <p className="text-sm text-ink-mute">
              <MusicText text={enharmonic} />
            </p>
          )}
        </div>
        <Button size="md" variant="secondary" icon={Play} onClick={() => playSequence(scale.map(midiOf), { gap: 0.3, dur: 0.5 })}>
          Scale
        </Button>
      </div>
      <div className="paper rounded-3xl px-4 py-2">
        <Staff clef="treble" keySig={fifths} items={items} sp={16} minSlot={3.6} labels />
      </div>
      <div>
        <div className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Chords in this key · tap to hear</div>
        <div className="flex flex-wrap gap-2">
          {chords.map((d, i) => {
            const main = primary.includes(i)
            const dim = d.chord.type.id === 'dim'
            return (
              <motion.button
                key={`${index}-${mode}-${i}`}
                type="button"
                whileTap={{ scale: 0.93 }}
                whileHover={{ y: -2 }}
                onClick={() => void playChord(d.chord)}
                className={`flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-3 py-2 transition-colors ${
                  main ? 'border-gold/60 bg-gold/15' : dim ? 'border-white/10 bg-night-750/70' : 'border-violet/40 bg-violet/12'
                }`}
              >
                <span className={`text-sm font-extrabold ${main ? 'text-gold' : dim ? 'text-ink-mute' : 'text-violet'}`}>{d.roman}</span>
                <span className="font-display text-xl font-bold">
                  <MusicText text={chordSymbol(d.chord)} />
                </span>
              </motion.button>
            )
          })}
        </div>
        <p className="mt-2 text-sm text-ink-mute">
          Gold = the three main chords ({mode === 'major' ? 'I, IV, V' : 'i, iv, v'}). Most songs in this key use mostly these.
        </p>
      </div>
    </div>
  )
}
