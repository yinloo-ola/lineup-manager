// Venue polling (venue-ux R7): both venue surfaces re-run their existing load
// functions on a fixed interval while the tab is visible, refresh immediately
// on return to the tab, and never poll in the background. The timing lives in
// startPolling (deps injected — unit-testable without a DOM); usePolling wraps
// it in component lifecycle.

import { onBeforeUnmount, onMounted } from 'vue'

export const POLL_INTERVAL_MS = 20_000

export interface PollerDeps {
  intervalMs: number
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  visibilityState: () => 'visible' | 'hidden'
  /** Register a visibility-change callback; returns its unregister. */
  onVisibilityChange: (cb: () => void) => () => void
}

/**
 * Poll `fn` every `intervalMs` while visible; on return to visibility, poll
 * once immediately. Returns a stop function. A poll failure is the caller's
 * concern — startPolling swallows nothing but never re-throws asynchronously.
 */
export function startPolling(
  fn: () => Promise<unknown> | unknown,
  deps: PollerDeps
): () => void {
  const tick = () => {
    if (deps.visibilityState() === 'visible') void fn()
  }
  const timer = deps.setInterval(tick, deps.intervalMs)
  const unregister = deps.onVisibilityChange(tick)
  return () => {
    deps.clearInterval(timer)
    unregister()
  }
}

/** Component-scoped polling bound to mount/unmount and the real browser env. */
export function usePolling(fn: () => Promise<unknown> | unknown, intervalMs = POLL_INTERVAL_MS): void {
  onMounted(() => {
    const stop = startPolling(fn, {
      intervalMs,
      setInterval: (cb, ms) => window.setInterval(cb, ms),
      clearInterval: (id) => window.clearInterval(id),
      visibilityState: () => document.visibilityState,
      onVisibilityChange: (cb) => {
        document.addEventListener('visibilitychange', cb)
        return () => document.removeEventListener('visibilitychange', cb)
      }
    })
    onBeforeUnmount(stop)
  })
}
