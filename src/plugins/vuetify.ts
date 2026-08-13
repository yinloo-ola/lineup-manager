import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

// Vuetify instance. Component registration + treeshaking are handled by
// vite-plugin-vuetify (autoImport) in vite.config.ts.
export default createVuetify({
  theme: { defaultTheme: 'light' },
  icons: { defaultSet: 'mdi' }
})
