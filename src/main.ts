import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { loadThemePreference, themeMarker } from './themes/themePreference'
import './assets/main.css'

// Adopt the persisted theme before mount so first paint matches the choice.
const themePreference = loadThemePreference()
vuetify.theme.change(themePreference)
document.documentElement.dataset.theme = themeMarker(themePreference)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(vuetify)
app.mount('#app')
