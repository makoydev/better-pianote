import { describe, expect, it } from 'vitest'
import { CONTAINER, makeZip } from './testkit'
import { decodeText, readScoreText } from './zip'

const XML = '<?xml version="1.0"?><score-partwise><part-list/></score-partwise>'
const enc = (s: string) => new TextEncoder().encode(s)

describe('reading score files', () => {
  it('passes plain MusicXML through', async () => {
    expect(await readScoreText(enc(XML))).toBe(XML)
  })

  it('unzips .mxl files, stored or deflated, with or without data descriptors', async () => {
    for (const deflate of [false, true]) {
      for (const descriptor of [false, true]) {
        const zip = await makeZip([
          { name: 'META-INF/container.xml', text: CONTAINER('music/score.musicxml'), deflate },
          { name: 'music/score.musicxml', text: XML, deflate, descriptor },
        ])
        expect(await readScoreText(zip)).toBe(XML)
      }
    }
  })

  it('picks the MusicXML root file named in the container', async () => {
    const container =
      '<container><rootfiles><rootfile full-path="cover.pdf" media-type="application/pdf"/><rootfile full-path="b.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>'
    const zip = await makeZip([
      { name: 'META-INF/container.xml', text: container },
      { name: 'a.xml', text: '<other/>' },
      { name: 'b.xml', text: XML, deflate: true },
    ])
    expect(await readScoreText(zip)).toBe(XML)
  })

  it('falls back to the first .xml file without a container', async () => {
    const zip = await makeZip([{ name: 'song.xml', text: XML, deflate: true }])
    expect(await readScoreText(zip)).toBe(XML)
  })

  it('explains MuseScore, PDF and MIDI files', async () => {
    const mscz = await makeZip([{ name: 'song.mscx', text: '<museScore/>' }])
    await expect(readScoreText(mscz)).rejects.toThrow(/MuseScore file/)
    await expect(readScoreText(enc('%PDF-1.7 …'))).rejects.toThrow(/PDF/)
    await expect(readScoreText(new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6]))).rejects.toThrow(/MIDI/)
    await expect(readScoreText(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]))).rejects.toThrow(/damaged/)
  })

  it('decodes UTF-8 and UTF-16 with or without a byte-order mark', () => {
    const utf16 = (s: string, le: boolean, bom: boolean) => {
      const units = [...(bom ? [0xfeff] : []), ...Array.from(s, (c) => c.charCodeAt(0))]
      const b = new Uint8Array(units.length * 2)
      units.forEach((u, i) => {
        b[i * 2 + (le ? 0 : 1)] = u & 0xff
        b[i * 2 + (le ? 1 : 0)] = u >> 8
      })
      return b
    }
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc(XML)]))).toBe(XML)
    expect(decodeText(utf16(XML, true, true))).toBe(XML)
    expect(decodeText(utf16(XML, false, true))).toBe(XML)
    expect(decodeText(utf16(XML, true, false))).toBe(XML)
    expect(decodeText(utf16(XML, false, false))).toBe(XML)
    expect(decodeText(enc('<a>Für Elise</a>'))).toBe('<a>Für Elise</a>')
  })
})
