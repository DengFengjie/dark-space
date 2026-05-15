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
// 天体深度探索模块
const JupiterEye = () => import('./views/JupiterEye.vue')
const MoonSecret = () => import('./views/MoonSecret.vue')
const MarsWonder = () => import('./views/MarsWonder.vue')

const routes = [
  // 主页
  { path: '/', name: 'Home', component: Home },
  // 深空任务视界（时间轴驱动）
  { path: '/solar-system', name: 'SolarSystem', component: SolarSystem },
  { path: '/moon', name: 'Moon', component: MoonView },
  { path: '/mars', name: 'Mars', component: MarsView },
  { path: '/gallery', name: 'Gallery', component: Gallery },
  // 天体深度探索（自由漫游）
  { path: '/jupiter-eye', name: 'JupiterEye', component: JupiterEye },
  { path: '/moon-secret', name: 'MoonSecret', component: MoonSecret },
  { path: '/mars-wonder', name: 'MarsWonder', component: MarsWonder }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')