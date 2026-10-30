<script setup lang="ts">
// The venue theme toggle (venue-ux R1): switches the named Vuetify theme,
// mirrors it onto html[data-theme] for the CSS tokens, and persists the
// choice. Used in the admin shell app bar and the umpire console header.
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import {
  loadThemePreference,
  saveThemePreference,
  themeMarker,
  type ThemeName
} from '@/themes/themePreference'

const theme = useTheme()

const current = computed<ThemeName>(() =>
  theme.global.name.value === 'ttDark' ? 'ttDark' : 'ttLight'
)

function apply(next: ThemeName): void {
  theme.global.name.value = next
  document.documentElement.dataset.theme = themeMarker(next)
  saveThemePreference(next)
}

function toggle(): void {
  apply(current.value === 'ttDark' ? 'ttLight' : 'ttDark')
}

// Adopt the persisted preference on first mount (covers views that never go
// through main.ts's early init).
apply(loadThemePreference())
</script>

<template>
  <v-btn
    icon
    variant="text"
    :aria-label="current === 'ttDark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggle"
  >
    <v-icon>{{ current === 'ttDark' ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
  </v-btn>
</template>
