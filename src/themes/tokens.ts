// The venue theme's single token source. Both Vuetify themes build from this —
// components reference them only through Vuetify theme variables (rgb(var(--v-theme-*))),
// never literals, so a palette change is a one-file edit.

export interface ThemeTokens {
  primary: string
  onPrimary: string
  background: string
  surface: string
  surfaceRaised: string
  border: string
  onSurface: string
  onSurfaceMuted: string
  success: string
  onSuccess: string
  warning: string
  onWarning: string
  error: string
  onError: string
}

export const ttLight: ThemeTokens = {
  primary: '#1e56d6',
  onPrimary: '#ffffff',
  background: '#eef1f7',
  surface: '#ffffff',
  surfaceRaised: '#f4f6fb',
  border: '#dfe4ee',
  onSurface: '#17203a',
  onSurfaceMuted: '#5c6579',
  success: '#14804a',
  onSuccess: '#ffffff',
  warning: '#92600a',
  onWarning: '#ffffff',
  error: '#b3323c',
  onError: '#ffffff'
}

export const ttDark: ThemeTokens = {
  primary: '#5b8bff',
  onPrimary: '#0b1120',
  background: '#0b1120',
  surface: '#151d31',
  surfaceRaised: '#1b2440',
  border: '#2b3859',
  onSurface: '#e7ecf8',
  onSurfaceMuted: '#97a2bd',
  success: '#4fce8b',
  onSuccess: '#0b1120',
  warning: '#e8b45a',
  onWarning: '#0b1120',
  error: '#f08b95',
  onError: '#0b1120'
}

/** Map the tokens onto a Vuetify theme definition. */
export function toVuetifyTheme(t: ThemeTokens, dark: boolean) {
  return {
    dark,
    colors: {
      primary: t.primary,
      'on-primary': t.onPrimary,
      background: t.background,
      surface: t.surface,
      'surface-raised': t.surfaceRaised,
      'outline-soft': t.border,
      'on-surface': t.onSurface,
      'on-surface-muted': t.onSurfaceMuted,
      success: t.success,
      'on-success': t.onSuccess,
      warning: t.warning,
      'on-warning': t.onWarning,
      error: t.error,
      'on-error': t.onError
    }
  }
}
