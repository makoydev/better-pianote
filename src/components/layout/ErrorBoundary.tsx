import { House, RefreshCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { go } from '../../router'
import { Button } from '../ui/Button'

/** A screen that was loaded on demand and has since been replaced by a new version (after a deploy). */
function isStaleChunk(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Unable to preload/i.test(msg)
}

interface Props {
  resetKey: string
  children: ReactNode
}
interface State {
  error: unknown
  key: string
}

/**
 * Catches a screen that crashed or couldn't load, so the app shows a way out instead of going blank.
 * The usual cause is an update: an open tab still asks for the old version's files, which are gone.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  // Moving to another page gives that page a fresh start.
  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  render() {
    if (!this.state.error) return this.props.children
    const updated = isStaleChunk(this.state.error)
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-5 py-10">
        <div className="glass max-w-md rounded-3xl p-7 text-center">
          <h1 className="font-display text-3xl font-bold">{updated ? 'Tonic was updated' : 'Something went wrong'}</h1>
          <p className="mt-3 text-lg text-ink-soft">
            {updated ? 'A newer version is ready. Reload to get it; your progress is safe.' : 'This screen hit a problem. Your progress is safe.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button icon={RefreshCw} onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button variant="secondary" icon={House} onClick={() => go('/')}>
              Home
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
