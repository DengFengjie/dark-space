<template>
  <div class="home-page">
    <!-- 星空背景 -->
    <div class="starfield" ref="starfield"></div>
    
    <!-- 导航栏 -->
    <nav class="navbar" :class="{ scrolled: isScrolled }">
      <div class="nav-container">
        <div class="logo">
          <span class="logo-icon">🌌</span>
          <span class="logo-text">深空探测可视化平台</span>
        </div>
        <ul class="nav-menu">
          <li><a href="#home" class="nav-link active">首页</a></li>
          <li><a href="#features" class="nav-link">功能</a></li>
          <li><a href="#exploration" class="nav-link">探索</a></li>
          <li><a href="#about" class="nav-link">关于</a></li>
        </ul>
      </div>
    </nav>

    <!-- 主横幅区域 -->
    <section id="home" class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="title-line">把太阳系装进</span>
          <span class="title-highlight">浏览器</span>
        </h1>
        <p class="hero-subtitle">
          基于 JPL 星历 · WebGL 渲染 · 开普勒轨道引擎的深空探测可视化平台
        </p>
        <div class="hero-buttons">
          <button @click="goToExplore" class="btn btn-primary">
            <span>开始探索</span>
            <span class="btn-icon">→</span>
          </button>
          <button @click="scrollToFeatures" class="btn btn-secondary">
            了解更多
          </button>
        </div>
        
        <!-- 统计数据 -->
        <div class="hero-stats">
          <div class="stat-item">
            <div class="stat-number">8</div>
            <div class="stat-label">大行星实时解算</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">11+</div>
            <div class="stat-label">深空探测器轨迹</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">60fps</div>
            <div class="stat-label">WebGL 渲染目标</div>
          </div>
        </div>
      </div>
      
      <!-- 滚动指示器 -->
      <div class="scroll-indicator">
        <div class="mouse"></div>
        <p>向下滚动探索更多</p>
      </div>
    </section>

    <!-- 深空任务视界 -->
    <section id="features" class="features-section">
      <div class="section-header">
        <h2 class="section-title">深空任务视界</h2>
        <p class="section-subtitle">时间轴驱动、全场景联动——从行星轨道到探测器飞行路径，从历史弹道到第一线影像，同屏呈现，随时可查</p>
      </div>
      
      <div class="features-grid">
        <div class="feature-card" v-for="(feature, index) in features" :key="index" @click="feature.action">
          <!-- 内联SVG图标 -->
          <div class="feature-icon-wrap">
            <!-- 太阳系全景 -->
            <svg v-if="feature.svgId === 'solar'" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="10" fill="#FFD060" opacity="0.95"/>
              <circle cx="40" cy="40" r="10" fill="url(#sunGlow)" />
              <ellipse cx="40" cy="40" rx="20" ry="6" stroke="#4B8FDB" stroke-width="1.2" fill="none" opacity="0.7"/>
              <ellipse cx="40" cy="40" rx="29" ry="9" stroke="#C88B3A" stroke-width="1.2" fill="none" opacity="0.6"/>
              <ellipse cx="40" cy="40" rx="38" ry="12" stroke="#7DE8E8" stroke-width="1" fill="none" opacity="0.5"/>
              <circle cx="60" cy="40" r="2.5" fill="#4B8FDB"/>
              <circle cx="69" cy="40" r="3.5" fill="#C88B3A"/>
              <circle cx="21" cy="37" r="1.5" fill="#9C8F7A"/>
              <defs>
                <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#FF8800" stop-opacity="0.6"/>
                  <stop offset="100%" stop-color="#FF8800" stop-opacity="0"/>
                </radialGradient>
              </defs>
            </svg>
            <!-- 地月系统 -->
            <svg v-if="feature.svgId === 'moon'" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="36" cy="40" r="16" fill="#2A6FD4"/>
              <circle cx="36" cy="40" r="16" fill="url(#earthGrad)"/>
              <ellipse cx="36" cy="40" rx="16" ry="5" fill="#1A5FAD" opacity="0.4"/>
              <circle cx="36" cy="30" r="5" fill="#3DAF6E" opacity="0.85"/>
              <circle cx="29" cy="44" r="4" fill="#3DAF6E" opacity="0.7"/>
              <!-- 月球轨道 -->
              <ellipse cx="36" cy="40" rx="30" ry="9" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>
              <!-- 月球 -->
              <circle cx="66" cy="40" r="6" fill="#C8C8C8"/>
              <circle cx="64" cy="38" r="1.5" fill="#A0A0A0" opacity="0.6"/>
              <circle cx="67" cy="42" r="1" fill="#B0B0B0" opacity="0.5"/>
              <defs>
                <radialGradient id="earthGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#5BA3FF"/>
                  <stop offset="100%" stop-color="#1A4DAD"/>
                </radialGradient>
              </defs>
            </svg>
            <!-- 火星探测 -->
            <svg v-if="feature.svgId === 'mars'" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="36" r="22" fill="url(#marsGrad)"/>
              <ellipse cx="36" cy="30" rx="8" ry="5" fill="#A83010" opacity="0.4"/>
              <ellipse cx="46" cy="42" rx="6" ry="4" fill="#8B2500" opacity="0.35"/>
              <!-- 极冠 -->
              <ellipse cx="40" cy="15.5" rx="7" ry="2.5" fill="rgba(255,255,255,0.55)"/>
              <!-- 巡视器 -->
              <rect x="30" y="54" width="12" height="5" rx="1.5" fill="#D4A820"/>
              <rect x="27" y="55" width="4" height="3" rx="1" fill="#B8921A"/>
              <rect x="39" y="55" width="4" height="3" rx="1" fill="#B8921A"/>
              <line x1="36" y1="50" x2="36" y2="54" stroke="#CCC" stroke-width="1.5"/>
              <rect x="32" y="48" width="8" height="3" rx="0.5" fill="#888"/>
              <defs>
                <radialGradient id="marsGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#FF7050"/>
                  <stop offset="100%" stop-color="#9B2A00"/>
                </radialGradient>
              </defs>
            </svg>
            <!-- 任务画廊 -->
            <svg v-if="feature.svgId === 'gallery'" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- 相机主体 -->
              <rect x="14" y="30" width="52" height="36" rx="6" fill="#1A2A4A" stroke="#64a3ff" stroke-width="1.5"/>
              <!-- 取景器 -->
              <rect x="28" y="22" width="24" height="10" rx="3" fill="#1A2A4A" stroke="#64a3ff" stroke-width="1.2"/>
              <!-- 镜头 -->
              <circle cx="40" cy="48" r="13" fill="#0D1A2E" stroke="#64a3ff" stroke-width="1.5"/>
              <circle cx="40" cy="48" r="9" fill="#0D1A2E" stroke="#4fc3f7" stroke-width="1"/>
              <circle cx="40" cy="48" r="5" fill="#FF6B4A" opacity="0.85"/>
              <circle cx="38" cy="46" r="1.5" fill="rgba(255,255,255,0.4)"/>
              <!-- 快门灯 -->
              <circle cx="56" cy="37" r="3" fill="#FFD700" opacity="0.9"/>
            </svg>
          </div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
          <button class="feature-btn" @click.stop="feature.action">
            立即体验 →
          </button>
        </div>
      </div>
    </section>

    <!-- 天体深度探索 -->
    <section id="exploration" class="exploration-section">
      <div class="section-header">
        <h2 class="section-title">天体深度探索</h2>
        <p class="section-subtitle">离开轨道视角，以 WebGL 完全沉浸进单颗天体——360° 自由旋转、无极缩放，从赤道到极冠逐寸探索地貌细节</p>
      </div>
      
      <div class="targets-container">
        <div 
          class="target-card" 
          v-for="(target, index) in targets" 
          :key="index"
          @click="target.action"
        >
          <div class="target-visual">
            <div class="target-sphere" :style="{ background: target.gradient }"></div>
            <div class="target-glow" :style="{ background: target.glowColor }"></div>
            <div class="target-badge">{{ target.badge }}</div>
          </div>
          <div class="target-info">
            <h3>{{ target.name }}</h3>
            <p>{{ target.description }}</p>
            <div class="target-stats">
              <div v-for="(stat, key) in target.stats" :key="key" class="target-stat">
                <span class="stat-key">{{ key }}</span>
                <span class="stat-value">{{ stat }}</span>
              </div>
            </div>
          </div>
          <div class="target-overlay">
            <button class="explore-btn">沉浸探索 →</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 技术亮点区域 -->
    <section class="tech-section">
      <div class="section-header">
        <h2 class="section-title">技术亮点</h2>
      </div>
      
      <div class="tech-grid">
        <div class="tech-item" v-for="(tech, index) in technologies" :key="index">
          <div class="tech-logo-wrap">
            <img :src="tech.logo" :alt="tech.name" class="tech-logo" :style="{ filter: tech.filter || '' }" />
          </div>
          <h4>{{ tech.name }}</h4>
          <p>{{ tech.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 关于区域 -->
    <section id="about" class="about-section">
      <div class="about-inner">
        <!-- 左：文字内容 -->
        <div class="about-text-col">
          <h2 class="section-title" style="-webkit-text-fill-color: unset; background: none; color: #fff;">关于平台</h2>
          <p class="about-tagline">Real Orbital Mechanics · Open Data Pipeline · Graceful Fallback</p>
          <p class="about-text">
            平台以 <strong>JPL Horizons Web API（DE441 数值积分）</strong> 为主要数据源，
            后端代理并缓存 P/V 矢量输出，行星定位精度可达 <0.1 角秒；
            网络不可达时无缝降级本地 <strong>DE440 开普勒引擎</strong>，
            经牛顿-拉弗森迭代解算真近点角，误差优于 0.01 AU，全环境可用。
            <strong>对数尺度映射算法</strong>突破宇宙比例极限，
            内外太阳系全貌同屏呈现。
          </p>
          <p class="about-text" style="margin-top: 16px;">
            前端以 <strong>Vue 3 Composition API</strong> 统一管理时间、视角与选中状态，
            Three.js WebGL 管线负责行星、轨道线、探测器模型与星场的帧渲染；
            后端 <strong>Node.js</strong> 充当 JPL Horizons 与 NASA Open API 双代理缓存层，
            将星历与影像数据转化为前端直接消费的结构化 JSON，
            秒级刷新与离线降级同时兼备。
          </p>
          <div class="about-pillars">
            <div class="pillar-item">
              <span class="pillar-icon">🛰️</span>
              <div>
                <strong>双轨星历引擎</strong>
                <p>JPL Horizons 精确数值积分优先，本地 DE440 开普勒解算无缝兜底，全网络环境可用</p>
              </div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">📡</span>
              <div>
                <strong>多源开放数据接入</strong>
                <p>后端代理 JPL Horizons · NASA Open API，文件缓存层降低外部依赖风险</p>
              </div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">⚡</span>
              <div>
                <strong>WebGL 高效渲染</strong>
                <p>BufferGeometry 管理轨道几何 · 道格拉斯-普克轨迹抽稀 · 60fps 目标帧率</p>
              </div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">🔭</span>
              <div>
                <strong>沉浸式时序交互</strong>
                <p>TWEEN 平滑相机飞行 · Raycaster 天体拾取 · 时间轴拖动驱动全场景同步推演</p>
              </div>
            </div>
          </div>
        </div>
        <!-- 右：指标卡 -->
        <div class="about-metrics-col">
          <div class="metric-card">
            <div class="metric-value">DE440</div>
            <div class="metric-label">本地开普勒引擎基准历表</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">< 0.01 AU</div>
            <div class="metric-label">行星位置解算误差上限</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">60 fps</div>
            <div class="metric-label">WebGL 渲染帧率目标</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">10<sup>6</sup>+</div>
            <div class="metric-label">星场粒子可渲染上限</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-value">Open Data</div>
            <div class="metric-label">数据来源完全公开、可独立验证</div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'

const router = useRouter()
const starfield = ref(null)
const isScrolled = ref(false)

const features = [
  {
    svgId: 'solar',
    title: '太阳系全景',
    description: 'JPL Horizons 精确星历与本地开普勒引擎双轨驱动，对数尺度映射破解宇宙比例壁垒；拖动时间轴，八大行星公转与 11+ 条探测器飞行轨迹即时联动重演。',
    action: () => navigateTo('/solar-system')
  },
  {
    svgId: 'moon',
    title: '地月空间',
    description: '地月系统专属放大视图，以轨道动力学精确重建阿波罗与嫦娥历次任务飞行弹道；滑动时间轴，沿原始轨迹完整复刻人类踏上月球的每一步。',
    action: () => navigateTo('/moon')
  },
  {
    svgId: 'mars',
    title: '火星征途',
    description: '还原好奇号、毅力号、天问一号从地火转移轨道到地面巡视的完整路径；着陆点精确标注，任务状态实时可查，探测圈全貌一屏呈现。',
    action: () => navigateTo('/mars')
  },
  {
    svgId: 'gallery',
    title: '成果回廊',
    description: '直连 NASA Mars Rover Photo API，按任务日、太阳日与相机类型多维检索原始探测影像；ECharts 图表揭示拍摄规律，灯箱模式逐帧审读每一幅珍贵历史记录。',
    action: () => navigateTo('/gallery')
  }
]

const targets = [
  {
    name: '月球秘境',
    badge: '高精度模型',
    description: '高精度三维月球模型，精确标注陨石坑分布与阿波罗着陆点；自由缩放至月面，寂静海盆地与高地起伏历历在目，感受静止 38 万公里之外的荒芜之美。',
    gradient: 'radial-gradient(circle at 30% 30%, #D8D8D8, #8A8A8A, #111)',
    glowColor: 'radial-gradient(circle, rgba(200,200,200,0.3), transparent)',
    action: () => navigateTo('/moon-secret')
  },
  {
    name: '火星奇境',
    badge: '地貌探索',
    description: '基于真实地形数据的火星三维模型，呈现奥林帕斯山（海拔约 22 km，太阳系最高峰）与水手谷（深度达 7 km）的真实尺度；旋转、俯瞰，感受红色星球令人窒息的地貌震撼。',
    gradient: 'radial-gradient(circle at 30% 30%, #FF7050, #C1440E, #1a0500)',
    glowColor: 'radial-gradient(circle, rgba(193,68,14,0.3), transparent)',
    action: () => navigateTo('/mars-wonder')
  },
  {
    name: '木星巨眼',
    badge: '云带深处',
    description: '纹理源自朱诺号 JunoCam 真实拍摄数据；360° 自由旋转观察大气带纹与大红斑，每一道云纹背后都是一股时速超过 600 km/h 的高速气流。',
    gradient: 'radial-gradient(circle at 30% 30%, #E8A87C, #C77D43, #3A2318)',
    glowColor: 'radial-gradient(circle, rgba(200,125,67,0.35), transparent)',
    action: () => navigateTo('/jupiter-eye')
  }
]

const technologies = [
  {
    name: 'Vue 3',
    logo: 'https://vuejs.org/logo.svg',
    desc: 'Composition API + Pinia 统一管理时间轴、视角与选中状态，组件级响应驱动全场景联动更新'
  },
  {
    name: 'Three.js',
    logo: 'https://threejs.org/files/favicon.ico',
    filter: 'invert(1) brightness(2)',
    desc: 'WebGL 渲染管线 + PBR 材质，BufferGeometry 管理轨道几何，Raycaster 实现精准天体拾取与飞行动画'
  },
  {
    name: 'Vite 5',
    logo: 'https://vitejs.dev/logo.svg',
    desc: 'ESM 原生热替换，Rollup 按页面代码分割；毫秒级 HMR 保障调试效率，生产构建 gzip 体积最小化'
  },
  {
    name: 'Apache ECharts',
    logo: 'https://echarts.apache.org/zh/images/favicon.png',
    desc: '深度集成于探测影像回廊：拍摄量趋势折线、相机分布饼图、时间分布条形图，让原始数据自己说话'
  },
  {
    name: 'Node.js',
    logo: 'https://nodejs.org/static/images/logo.svg',
    desc: 'Express 代理 JPL Horizons · NASA Open API，内置文件缓存层；网络不可达时自动降级本地星历引擎'
  }
]

const navigateTo = (path) => {
  router.push(path)
}

const goToExplore = () => {
  navigateTo('/solar-system')
}

const scrollToFeatures = () => {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
}

// 星空背景动画
let scene, camera, renderer, stars
let animationId

const initStarfield = () => {
  if (!starfield.value) return
  
  const container = starfield.value
  const width = container.clientWidth
  const height = container.clientHeight
  
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.z = 50
  
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  container.appendChild(renderer.domElement)
  
  // 创建星星
  const geometry = new THREE.BufferGeometry()
  const vertices = []
  
  for (let i = 0; i < 5000; i++) {
    vertices.push(
      THREE.MathUtils.randFloatSpread(200),
      THREE.MathUtils.randFloatSpread(200),
      THREE.MathUtils.randFloatSpread(200)
    )
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  
  const material = new THREE.PointsMaterial({ 
    color: 0xFFFFFF, 
    size: 0.5,
    transparent: true,
    opacity: 0.8
  })
  
  stars = new THREE.Points(geometry, material)
  scene.add(stars)
  
  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  if (stars) {
    stars.rotation.x += 0.0002
    stars.rotation.y += 0.0003
  }
  
  renderer.render(scene, camera)
}

// 大小自适应
const handleResize = () => {
  if (!starfield.value || !renderer) return
  const container = starfield.value
  const width = container.clientWidth
  const height = container.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 滚动监听
const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

onMounted(() => {
  initStarfield()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.dispose()
  }
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.home-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}

/* 星空背景 */
.starfield {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}
.starfield canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* 导航栏 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 20px 50px;
  transition: all 0.3s ease;
  background: transparent;
}

.navbar.scrolled {
  background: rgba(0, 10, 30, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 24px;
  font-weight: bold;
  color: #fff;
}

.logo-icon {
  font-size: 32px;
}

.nav-menu {
  display: flex;
  list-style: none;
  gap: 40px;
}

.nav-link {
  color: #fff;
  text-decoration: none;
  font-size: 16px;
  transition: all 0.3s ease;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #64a3ff, #4fc3f7);
  transition: width 0.3s ease;
}

.nav-link:hover::after {
  width: 100%;
}

/* 主横幅区域 */
.hero-section {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.hero-content {
  text-align: center;
  color: #fff;
  max-width: 900px;
  padding: 0 20px;
}

.hero-title {
  font-size: 72px;
  font-weight: bold;
  margin-bottom: 20px;
  line-height: 1.2;
}

.title-line {
  display: block;
  font-size: 48px;
  opacity: 0.9;
}

.title-highlight {
  background: linear-gradient(135deg, #64a3ff, #4fc3f7, #64a3ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 30px rgba(100, 163, 255, 0.5);
}

.hero-subtitle {
  font-size: 24px;
  margin-bottom: 40px;
  opacity: 0.8;
  letter-spacing: 1px;
}

.hero-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 60px;
}

.btn {
  padding: 16px 40px;
  font-size: 18px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-primary {
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  color: #fff;
  box-shadow: 0 10px 30px rgba(100, 163, 255, 0.4);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 40px rgba(100, 163, 255, 0.6);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-3px);
}

.btn-icon {
  font-size: 20px;
  transition: transform 0.3s ease;
}

.btn:hover .btn-icon {
  transform: translateX(5px);
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 60px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 48px;
  font-weight: bold;
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}

.stat-label {
  font-size: 16px;
  opacity: 0.7;
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: #fff;
  opacity: 0.6;
}

.mouse {
  width: 30px;
  height: 50px;
  border: 2px solid #fff;
  border-radius: 15px;
  margin: 0 auto 10px;
  position: relative;
}

.mouse::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 10px;
  background: #fff;
  border-radius: 2px;
  animation: scroll 2s infinite;
}

@keyframes scroll {
  0%, 100% { opacity: 0; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(10px); }
}

.scroll-indicator p {
  font-size: 14px;
}

/* 功能特性区域 */
.features-section {
  position: relative;
  padding: 120px 50px;
  background: linear-gradient(to bottom, transparent, rgba(0, 10, 30, 0.8));
  z-index: 1;
}

.section-header {
  text-align: center;
  margin-bottom: 80px;
  color: #fff;
}

.section-title {
  font-size: 48px;
  font-weight: bold;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-subtitle {
  font-size: 20px;
  opacity: 0.7;
  max-width: 600px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
  max-width: 1400px;
  margin: 0 auto;
}

.feature-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 40px 30px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  text-align: center;
  color: #fff;
}

.feature-card:hover {
  transform: translateY(-10px);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(100, 163, 255, 0.5);
  box-shadow: 0 20px 50px rgba(100, 163, 255, 0.3);
}

.feature-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.feature-title {
  font-size: 24px;
  margin-bottom: 15px;
  color: #64a3ff;
}

.feature-description {
  font-size: 16px;
  line-height: 1.6;
  opacity: 0.8;
  margin-bottom: 20px;
}

.feature-btn {
  background: transparent;
  border: 2px solid #64a3ff;
  color: #64a3ff;
  padding: 12px 30px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 16px;
}

.feature-btn:hover {
  background: #64a3ff;
  color: #fff;
  box-shadow: 0 5px 20px rgba(100, 163, 255, 0.4);
}

/* 探索目标区域 */
.exploration-section {
  position: relative;
  padding: 120px 50px;
  z-index: 1;
}

.targets-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.target-card {
  position: relative;
  background: rgba(0, 10, 30, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 25px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s ease;
  height: 450px;
}

.target-card:hover {
  transform: translateY(-10px) scale(1.02);
  border-color: rgba(100, 163, 255, 0.5);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
}

.target-visual {
  position: relative;
  height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.target-sphere {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  box-shadow: inset -20px -20px 50px rgba(0, 0, 0, 0.8);
}

.target-glow {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.6;
}

.target-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: linear-gradient(135deg, rgba(100,163,255,0.25), rgba(79,195,247,0.2));
  border: 1px solid rgba(100,163,255,0.4);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #4fc3f7;
  letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
}

.target-info {
  padding: 30px;
  color: #fff;
}

.target-info h3 {
  font-size: 28px;
  margin-bottom: 10px;
  color: #64a3ff;
}

.target-info p {
  font-size: 16px;
  opacity: 0.8;
  margin-bottom: 20px;
  line-height: 1.6;
}

.target-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.target-stat {
  text-align: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.stat-key {
  display: block;
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  font-size: 14px;
  font-weight: bold;
  color: #64a3ff;
}

.target-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.target-card:hover .target-overlay {
  opacity: 1;
}

.explore-btn {
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  border: none;
  color: #fff;
  padding: 16px 40px;
  border-radius: 30px;
  font-size: 18px;
  cursor: pointer;
  font-weight: bold;
  box-shadow: 0 10px 30px rgba(100, 163, 255, 0.5);
  transition: all 0.3s ease;
}

.explore-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 15px 40px rgba(100, 163, 255, 0.7);
}

/* 技术亮点区域 */
.tech-section {
  padding: 100px 50px;
  background: rgba(0, 10, 30, 0.5);
  z-index: 1;
  position: relative;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 30px;
  max-width: 1400px;
  margin: 0 auto;
  text-align: center;
  color: #fff;
}

.tech-item {
  padding: 30px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  transition: all 0.3s ease;
}

.tech-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-5px);
}

.tech-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.tech-item h4 {
  font-size: 20px;
  margin-bottom: 10px;
  color: #64a3ff;
}

.tech-item p {
  font-size: 14px;
  opacity: 0.7;
}

/* 页脚 */
.footer {
  background: rgba(0, 5, 15, 0.95);
  padding: 60px 50px 30px;
  color: #fff;
  position: relative;
  z-index: 1;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 40px;
  max-width: 1200px;
  margin: 0 auto 40px;
}

.footer-section h4 {
  font-size: 20px;
  margin-bottom: 15px;
  color: #64a3ff;
}

.footer-section p {
  opacity: 0.7;
  line-height: 1.6;
}

.footer-section ul {
  list-style: none;
}

.footer-section ul li {
  margin-bottom: 10px;
}

.footer-section ul li a {
  color: #fff;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  cursor: pointer;
}

.footer-section ul li a:hover {
  opacity: 1;
  color: #64a3ff;
}

.footer-bottom {
  text-align: center;
  padding-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  opacity: 0.6;
}

/* ── 功能卡 SVG 图标 ── */
.feature-icon-wrap {
  width: 90px;
  height: 90px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(100, 163, 255, 0.08);
  border: 1px solid rgba(100, 163, 255, 0.2);
  border-radius: 22px;
  padding: 12px;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover .feature-icon-wrap {
  background: rgba(100, 163, 255, 0.18);
  border-color: rgba(100, 163, 255, 0.5);
  box-shadow: 0 0 24px rgba(100, 163, 255, 0.25);
}

.feature-icon-wrap svg {
  width: 100%;
  height: 100%;
}

/* ── 技术 Logo ── */
.tech-logo-wrap {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 10px;
  transition: background 0.3s ease, transform 0.3s ease;
}

.tech-item:hover .tech-logo-wrap {
  background: rgba(100, 163, 255, 0.15);
  transform: scale(1.08);
}

.tech-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* ── 关于 - 双栏布局 ── */
.about-section {
  padding: 120px 50px;
  position: relative;
  z-index: 1;
}

.about-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 80px;
  align-items: start;
}

.about-text-col {
  color: #fff;
}

.about-text-col .section-title {
  text-align: left;
  margin-bottom: 10px;
}

.about-tagline {
  font-size: 13px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #4fc3f7;
  opacity: 0.8;
  margin-bottom: 28px;
}

.about-text {
  font-size: 16px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.78);
  margin-bottom: 0;
}

.about-text strong {
  color: #fff;
}

.about-pillars {
  margin-top: 36px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.pillar-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  background: rgba(100, 163, 255, 0.06);
  border: 1px solid rgba(100, 163, 255, 0.15);
  border-radius: 14px;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.pillar-item:hover {
  background: rgba(100, 163, 255, 0.12);
  border-color: rgba(100, 163, 255, 0.35);
}

.pillar-icon {
  font-size: 28px;
  flex-shrink: 0;
  margin-top: 2px;
}

.pillar-item strong {
  display: block;
  font-size: 15px;
  color: #fff;
  margin-bottom: 5px;
}

.pillar-item p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  margin: 0;
}

/* ── 指标卡 ── */
.about-metrics-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px 24px;
  text-align: center;
  backdrop-filter: blur(6px);
  transition: border-color 0.3s ease, background 0.3s ease;
}

.metric-card:hover {
  border-color: rgba(100, 163, 255, 0.4);
  background: rgba(100, 163, 255, 0.07);
}

.metric-card.accent {
  background: linear-gradient(135deg, rgba(100, 163, 255, 0.15), rgba(79, 195, 247, 0.1));
  border-color: rgba(100, 163, 255, 0.35);
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 6px;
  line-height: 1.2;
}

.metric-value sup {
  font-size: 16px;
}

.metric-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navbar {
    padding: 15px 20px;
  }
  
  .nav-menu {
    gap: 20px;
  }
  
  .hero-title {
    font-size: 48px;
  }
  
  .title-line {
    font-size: 32px;
  }
  
  .hero-buttons {
    flex-direction: column;
  }
  
  .hero-stats {
    gap: 30px;
  }
  
  .features-section,
  .exploration-section,
  .tech-section,
  .about-section {
    padding: 80px 20px;
  }
  
  .section-title {
    font-size: 36px;
  }

  /* about 双栏 → 单栏 */
  .about-inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .about-text-col .section-title {
    text-align: center;
  }

  .about-tagline {
    text-align: center;
  }

  .about-pillars {
    grid-template-columns: 1fr;
  }

  .about-metrics-col {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .metric-card {
    flex: 1 1 140px;
  }

  /* features-grid 2列 → 1列 */
  .features-grid {
    grid-template-columns: 1fr;
  }

  /* tech-grid 5列 → 2列或3列 */
  .tech-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1200px) {
  .tech-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .tech-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .tech-grid {
    grid-template-columns: 1fr;
  }
}

</style>