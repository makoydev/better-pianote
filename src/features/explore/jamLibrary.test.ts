import { describe, expect, it } from 'vitest'
import { MAX_SAVED, type SavedProgression, findByName, findByRomans, freeName, readSaved, removeFrom, saveTo } from './jamLibrary'

const entry = (name: string, romans = ['I', 'V', 'vi', 'IV']): Omit<SavedProgression, 'id'> => ({ name, romans, tonic: 2, bpm: 90, feel: 'ballad', length: 8 })

describe('my progressions', () => {
  it('saves new names first and replaces a name used before', () => {
    let list = saveTo([], entry('Sunday'), 'a')
    list = saveTo(list, entry('Blues', ['I7', 'IV7', 'I7', 'V7']), 'b')
    expect(list.map((p) => p.name)).toEqual(['Blues', 'Sunday'])
    list = saveTo(list, entry('  sunday ', ['vi', 'IV', 'I', 'V']), 'c')
    expect(list.map((p) => [p.id, p.name])).toEqual([
      ['a', 'sunday'],
      ['b', 'Blues'],
    ])
    expect(list[0].romans).toEqual(['vi', 'IV', 'I', 'V'])
  })

  it('finds a progression by name or by chords, and removes one', () => {
    const list = saveTo(saveTo([], entry('One'), 'a'), entry('Two', ['ii7', 'V7', 'Imaj7']), 'b')
    expect(findByName(list, 'two')?.id).toBe('b')
    expect(findByRomans(list, ['I', 'V', 'vi', 'IV'])?.id).toBe('a')
    expect(findByRomans(list, ['I', 'V'])).toBeUndefined()
    expect(findByRomans(list, [])).toBeUndefined()
    expect(removeFrom(list, 'a').map((p) => p.id)).toEqual(['b'])
  })

  it('suggests a free name', () => {
    expect(freeName([])).toBe('My progression')
    const list = saveTo(saveTo([], entry('My progression'), 'a'), entry('my progression 2'), 'b')
    expect(freeName(list)).toBe('My progression 3')
  })

  it('reads back only what still makes sense', () => {
    const good = { id: 'a', name: 'Good', romans: ['I', 'V/3', 'vi'], tonic: 7, bpm: 100, feel: 'waltz', length: 16 }
    const read = readSaved([
      good,
      { ...good, id: 'b', name: '' },
      { ...good, id: 'c', romans: ['I', 'XI'] },
      { ...good, id: 'd', romans: [] },
      { ...good, id: 'e', romans: Array(17).fill('I') },
      'nonsense',
      null,
      { ...good, id: 'a', name: 'Same id', tonic: 13, bpm: 400, feel: 'polka', length: 3 },
      { name: 'No id', romans: ['ii', 'V'] },
    ])
    expect(read[0]).toEqual(good)
    expect(read.map((p) => p.name)).toEqual(['Good', 'Same id', 'No id'])
    // Out-of-range settings fall back; a clashing or missing id gets a fresh one.
    expect(read[1]).toMatchObject({ tonic: 0, bpm: 160, feel: 'ballad', length: 8 })
    expect(new Set(read.map((p) => p.id)).size).toBe(3)
    expect(read[2]).toMatchObject({ tonic: 0, bpm: 76 })
    expect(readSaved('[]')).toEqual([])
    expect(readSaved({})).toEqual([])
  })

  it('keeps the list to a sensible size', () => {
    let list: SavedProgression[] = []
    for (let i = 0; i < MAX_SAVED + 5; i++) list = saveTo(list, entry(`P${i}`), `id${i}`)
    expect(list).toHaveLength(MAX_SAVED)
    expect(list[0].name).toBe(`P${MAX_SAVED + 4}`)
  })
})
