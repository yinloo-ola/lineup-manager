import { describe, it, expect } from 'vitest'
import { loadThemePreference, saveThemePreference, themeMarker } from '../themePreference'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v)
  }
}

describe('themePreference', () => {
  it('defaults to light when nothing is stored', () => {
    expect(loadThemePreference(fakeStorage())).toBe('ttLight')
    expect(loadThemePreference()).toBe('ttLight')
  })

  it('reads a stored dark preference', () => {
    expect(loadThemePreference(fakeStorage({ 'tt-theme': 'ttDark' }))).toBe('ttDark')
  })

  it('falls back to light on unknown values', () => {
    expect(loadThemePreference(fakeStorage({ 'tt-theme': 'sepia' }))).toBe('ttLight')
  })

  it('persists a choice that reads back', () => {
    const storage = fakeStorage()
    saveThemePreference('ttDark', storage)
    expect(loadThemePreference(storage)).toBe('ttDark')
  })

  it('tolerates a missing storage without throwing', () => {
    expect(() => saveThemePreference('ttDark')).not.toThrow()
  })

  it('maps theme names to html data-theme markers', () => {
    expect(themeMarker('ttLight')).toBe('light')
    expect(themeMarker('ttDark')).toBe('dark')
  })
})
