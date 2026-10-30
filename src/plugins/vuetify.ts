import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { toVuetifyTheme, ttDark, ttLight } from '@/themes/tokens'

// Vuetify instance. Component registration + treeshaking are handled by
// vite-plugin-vuetify (autoImport) in vite.config.ts. The two named themes
// build from the one token file; the persisted preference selects at startup.
export default createVuetify({
  theme: {
    defaultTheme: 'ttLight',
    themes: {
      ttLight: toVuetifyTheme(ttLight, false),
      ttDark: toVuetifyTheme(ttDark, true)
    }
  },
  icons: { defaultSet: 'mdi' }
})
