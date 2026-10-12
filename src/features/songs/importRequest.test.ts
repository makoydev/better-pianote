import { describe, expect, it } from 'vitest'
import { onImportRequest, requestImport, takeImportRequest } from './importRequest'

const file = (name: string) => new File(['<score-partwise/>'], name)

describe('files sent to the Songs page', () => {
  it('wait until the page takes them, once', () => {
    const a = file('a.mxl')
    requestImport([a])
    expect(takeImportRequest()).toEqual([a])
    expect(takeImportRequest()).toEqual([])
  })

  it('reach an open page straight away, and the same drop only once', () => {
    const got: File[][] = []
    const stop = onImportRequest(() => got.push(takeImportRequest()))
    const b = file('b.musicxml')
    const c = file('c.xml')
    requestImport([b, c])
    // A second handler seeing the same drop hands over the same File objects: ignored.
    requestImport([c, b])
    expect(got).toEqual([[b, c]])
    // After the page closes, files wait for the next time it opens.
    stop()
    const d = file('d.mxl')
    requestImport([d])
    expect(got).toHaveLength(1)
    expect(takeImportRequest()).toEqual([d])
  })
})
