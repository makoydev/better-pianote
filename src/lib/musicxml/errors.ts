/** A problem with the file someone picked, in words they can act on (shown as is). */
export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export const HOW_TO_EXPORT = 'In MuseScore (or another notation app), choose File → Export → MusicXML, then import that file.'
