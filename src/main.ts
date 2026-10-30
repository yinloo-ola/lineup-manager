import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { loadThemePreference, themeMarker } from './themes/themePreference'
import './assets/main.css'

// Adopt the persisted theme before mount so first paint matches the choice.
vuetify.theme.global.name.value = loadThemePreference()
document.documentElement.dataset.theme = themeMarker(loadThemePreference())

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(vuetify)
app.mount('#app')
