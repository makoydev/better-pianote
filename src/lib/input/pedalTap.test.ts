import { describe, expect, it, vi } from 'vitest'
import { useLive } from '../../state/live'
import { noteOff, noteOn } from './bus'
import { onPedalTap } from './pedalTap'

const tap = () => {
  useLive.setState({ sustain: true })
  useLive.setState({ sustain: false })
}

describe('pedal tap', () => {
  it('a quick press and release with nothing played counts', () => {
    const fired = vi.fn()
    const off = onPedalTap(fired)
    tap()
    expect(fired).toHaveBeenCalledTimes(1)
    off()
  })

  it("pedalling while you play doesn't count", () => {
    const fired = vi.fn()
    const off = onPedalTap(fired)
    noteOn(60, 0.7, 'midi')
    tap()
    noteOff(60, 'midi')
    // Just played: still not a tap.
    tap()
    expect(fired).not.toHaveBeenCalled()
    off()
  })

  it('holding the pedal down is not a tap', () => {
    vi.useFakeTimers()
    const fired = vi.fn()
    const off = onPedalTap(fired)
    useLive.setState({ sustain: true })
    vi.advanceTimersByTime(1000)
    useLive.setState({ sustain: false })
    expect(fired).not.toHaveBeenCalled()
    off()
    vi.useRealTimers()
  })
})
