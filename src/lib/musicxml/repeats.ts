/** What a measure says about repeats and jumps (a subset of RawMeasure, so this stays easy to test). */
export interface RepeatMarks {
  forward: boolean
  /** Backward repeat at the end: how many times the section is played (0 = none). */
  backward: number
  endingStart: number[] | null
  endingStop: boolean
  segno: boolean
  coda: boolean
  tocoda: boolean
  dacapo: boolean
  dalsegno: boolean
  fine: boolean
}

/**
 * The order measures are played in, with repeats, first/second endings and D.C./D.S. jumps written out.
 * Conventions: after a D.C. or D.S. jump, repeats aren't taken again and only the last ending of each
 * group is played; "To Coda" and "Fine" only apply after the jump.
 */
export function playOrder(ms: RepeatMarks[]): { order: number[]; ok: boolean } {
  const n = ms.length
  const straight = { order: ms.map((_, i) => i), ok: false }

  // Ending ranges: from an ending's first measure to where it stops (or the next ending begins).
  const endings = new Map<number, { end: number; numbers: number[]; groupMax: number }>()
  for (let i = 0; i < n; i++) {
    const nums = ms[i].endingStart
    if (!nums) continue
    let j = i
    while (j < n - 1 && !ms[j].endingStop && !ms[j].backward && !ms[j + 1].endingStart) j++
    endings.set(i, { end: j, numbers: nums, groupMax: 0 })
  }
  // Endings that follow one another form a group (1st, 2nd …); after a jump only the last one plays.
  const starts = [...endings.keys()].sort((a, b) => a - b)
  for (let k = 0; k < starts.length; ) {
    let last = k
    while (last + 1 < starts.length && starts[last + 1] === endings.get(starts[last])!.end + 1) last++
    const group = starts.slice(k, last + 1)
    const max = Math.max(...group.flatMap((s) => endings.get(s)!.numbers))
    for (const s of group) endings.get(s)!.groupMax = max
    k = last + 1
  }
  const lastOfGroup = new Set(starts.filter((s) => endings.get(s)!.numbers.includes(endings.get(s)!.groupMax)))

  const segno = ms.findIndex((m) => m.segno)
  const order: number[] = []
  let i = 0
  let pass = 1
  let sectionStart = 0
  let jumped = false
  let cameBack = false
  while (i < n) {
    if (order.length > n * 12 + 64) return straight
    const m = ms[i]
    if (m.forward && !(cameBack && i === sectionStart)) {
      sectionStart = i
      pass = 1
    }
    cameBack = false
    const ending = endings.get(i)
    if (ending && !ending.numbers.includes(jumped ? ending.groupMax : pass)) {
      i = ending.end + 1
      continue
    }
    order.push(i)
    // What happens at the end of this measure.
    if (m.backward && !jumped) {
      if (pass < m.backward) {
        pass++
        i = sectionStart
        cameBack = true
        continue
      }
      pass = 1
      sectionStart = i + 1
    }
    // The last ending of a group closes its repeated section.
    const closing = [...endings.entries()].find(([s, e]) => e.end === i && lastOfGroup.has(s))
    if (closing && !m.backward) {
      pass = 1
      sectionStart = i + 1
    }
    if (jumped && m.fine) break
    if (jumped && m.tocoda) {
      const coda = ms.findIndex((x, k) => k > i && x.coda)
      if (coda > 0) {
        i = coda
        continue
      }
    }
    if (!jumped && m.dacapo) {
      jumped = true
      i = 0
      pass = 1
      sectionStart = 0
      continue
    }
    if (!jumped && m.dalsegno && segno >= 0 && segno <= i) {
      jumped = true
      i = segno
      pass = 1
      sectionStart = segno
      continue
    }
    i++
  }
  return { order, ok: true }
}
