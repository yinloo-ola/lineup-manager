import { describe, it, expect, vi, afterEach } from 'vitest'
import { startPolling } from '../polling'

afterEach(() => {
  vi.useRealTimers()
})

function visibilityDeps(intervalMs = 20_000) {
  let visibility: 'visible' | 'hidden' = 'visible'
  const visibilityCbs: (() => void)[] = []
  return {
    deps: {
      intervalMs,
      setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args),
      clearInterval: (...args: Parameters<typeof clearInterval>) => clearInterval(...args),
      visibilityState: () => visibility,
      onVisibilityChange: (cb: () => void) => {
        visibilityCbs.push(cb)
        return () => void 0
      }
    },
    setVisibility(v: 'visible' | 'hidden') {
      visibility = v
      if (v === 'visible') for (const cb of [...visibilityCbs]) cb()
    }
  }
}

describe('startPolling', () => {
  it('fires the load on every interval tick while visible', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { deps } = visibilityDeps(20_000)
    startPolling(fn, deps)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20_000)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(20_000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not fire while the tab is hidden, and fires on return', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { deps, setVisibility } = visibilityDeps(20_000)
    startPolling(fn, deps)
    setVisibility('hidden')
    vi.advanceTimersByTime(60_000)
    expect(fn).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('stop() ends polling', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { deps } = visibilityDeps(20_000)
    const stop = startPolling(fn, deps)
    stop()
    vi.advanceTimersByTime(60_000)
    expect(fn).not.toHaveBeenCalled()
  })
})
