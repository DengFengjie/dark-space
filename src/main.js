import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import './styles/global.css'
import App from './App.vue'

// 路由懒加载
const Home = () => import('./views/Home.vue')
const SolarSystem = () => import('./views/SolarSystem.vue')
const Gallery = () => import('./views/Gallery.vue')
const MarsView = () => import('./views/MarsView.vue')
const MoonView = () => import('./views/MoonView.vue')

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/solar-system', name: 'SolarSystem', component: SolarSystem },
  { path: '/gallery', name: 'Gallery', component: Gallery },
  { path: '/mars', name: 'Mars', component: MarsView },
  { path: '/moon', name: 'Moon', component: MoonView }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
