import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from 'unhead/client'
import { headSymbol } from '@unhead/vue'
import App from './App.vue'
import router from './router'
import { initBaiduAnalytics } from './utils/baiduAnalytics'
import './assets/main.css'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const head = createHead()
app.provide(headSymbol, head)

// 百度统计：仅在正式域名启用，注入失败/域名不符时静默跳过
initBaiduAnalytics()

app.use(pinia)
app.use(router)
app.mount('#app')
