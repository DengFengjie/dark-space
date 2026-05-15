<template>
  <header class="site-header" :class="{ scrolled: isScrolled }">
    <div class="header-inner">
      <!-- Logo区 -->
      <div class="logo" @click="goHome">
        <span class="logo-icon">🌌</span>
        <span class="logo-text">深空探测平台</span>
      </div>

      <!-- 主导航 -->
      <nav class="main-nav">
        <router-link to="/solar-system" class="nav-item" active-class="nav-active">
          <span class="nav-icon">☀️</span>
          <span class="nav-label">太阳系</span>
        </router-link>
        <router-link to="/moon" class="nav-item" active-class="nav-active">
          <span class="nav-icon">🌙</span>
          <span class="nav-label">月球</span>
        </router-link>
        <router-link to="/mars" class="nav-item" active-class="nav-active">
          <span class="nav-icon">🔴</span>
          <span class="nav-label">火星</span>
        </router-link>
      </nav>

      <!-- 右侧操作区 -->
      <div class="header-actions">
        <div v-if="showDate" class="current-date">
          <span class="date-icon">🕐</span>
          <span>{{ currentSystemTime }}</span>
        </div>
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSpaceStore } from '../stores/useSpaceStore.js'

const props = defineProps({
  showDate: {
    type: Boolean,
    default: false
  },
  transparent: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const store = useSpaceStore()
const isScrolled = ref(false)
const now = ref(new Date())

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const currentSystemTime = computed(() => {
  const d = now.value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  const weekday = WEEKDAY_NAMES[d.getDay()]
  return `${year}-${month}-${day} ${weekday} ${hours}:${minutes}:${seconds}`
})

const goHome = () => router.push('/')

const handleScroll = () => {
  isScrolled.value = window.scrollY > 30
}

let timerId = null

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  timerId = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (timerId) clearInterval(timerId)
})
</script>

<style scoped>
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 12px 32px;
  background: rgba(0, 5, 20, 0.85);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(100, 163, 255, 0.15);
  transition: all 0.3s ease;
}

.site-header.scrolled {
  background: rgba(0, 5, 20, 0.97);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.header-inner {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 32px;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

/* 主导航 */
.main-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.25s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

.nav-item:hover {
  color: #fff;
  background: rgba(100, 163, 255, 0.15);
  border-color: rgba(100, 163, 255, 0.3);
}

.nav-item.nav-active {
  color: #64a3ff;
  background: rgba(100, 163, 255, 0.2);
  border-color: rgba(100, 163, 255, 0.5);
}

.nav-icon {
  font-size: 16px;
}

/* 右侧操作 */
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-date {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  color: #a0c0ff;
  font-size: 13px;
  font-family: monospace;
}

@media (max-width: 768px) {
  .site-header { padding: 10px 16px; }
  .logo-text { display: none; }
  .nav-label { display: none; }
  .nav-item { padding: 8px 10px; }
  .current-date { display: none; }
}
</style>
