/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

/**
 * Offline support: writes dist/sw.js (from scripts/service-worker.js) with the list of every file in the build,
 * so the app, its fonts and the piano samples work without a connection after the first visit.
 */
function serviceWorker(): Plugin {
  return {
    name: 'tonic-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f)
          return statSync(p).isDirectory() ? walk(p) : [p]
        })
      const publicFiles = walk('public').map((f) => relative('public', f).split('\\').join('/'))
      const files = [...Object.keys(bundle), ...publicFiles].filter(
        // Skip hidden files, source maps, and font subsets for scripts the app's text never uses.
        (f) => !f.split('/').some((part) => part.startsWith('.')) && !f.endsWith('.map') && !/-(cyrillic|greek|vietnamese)/.test(f),
      )
      const version = createHash('sha1').update(files.sort().join('\n')).digest('hex').slice(0, 10)
      const source = readFileSync('scripts/service-worker.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build also works from a sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
