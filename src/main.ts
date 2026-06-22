import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from 'unhead/client'
import { headSymbol } from '@unhead/vue'
import App from './App.vue'
import router from './router'
import '@vuepic/vue-datepicker/dist/main.css'
import './assets/main.css'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const head = createHead()
app.provide(headSymbol, head)

app.use(pinia)
app.use(router)
app.mount('#app')
