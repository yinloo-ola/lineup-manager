// The user's theme choice, persisted in localStorage. Kept storage-injectable
// so the default stays pure and testable.

export type ThemeName = 'ttLight' | 'ttDark'

const KEY = 'tt-theme'

/** The browser storage when available; undefined elsewhere (tests inject fakes). */
function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

/** Read the persisted preference; anything unknown falls back to light. */
export function loadThemePreference(
  storage: Pick<Storage, 'getItem'> = defaultStorage()
): ThemeName {
  let value: string | null = null
  try {
    value = storage?.getItem(KEY) ?? null
  } catch {
    // Privacy modes can throw on read — fall back to light rather than break boot.
  }
  return value === 'ttDark' ? 'ttDark' : 'ttLight'
}

/** Persist the preference (no-op guard for environments without storage). */
export function saveThemePreference(
  theme: ThemeName,
  storage: Pick<Storage, 'getItem' | 'setItem'> = defaultStorage()
): void {
  if (!storage) return
  try {
    storage.setItem(KEY, theme)
  } catch {
    // Private-mode quota errors must never break a theme toggle.
  }
}

/** The html[data-theme] marker mirrored from the active theme (E2E asserts it; CSS may key on it). */
export function themeMarker(theme: ThemeName): 'light' | 'dark' {
  return theme === 'ttDark' ? 'dark' : 'light'
}
