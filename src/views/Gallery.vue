<template>
  <div class="gallery-page">
    <Header />

    <div class="gallery-content">
      <!-- 标题区 -->
      <div class="page-hero">
        <h1 class="hero-title">🔴 火星任务画廊</h1>
        <p class="hero-sub">来自NASA火星车的真实探测影像 · 数据实时同步自 NASA Open API</p>
      </div>

      <!-- 控制栏 -->
      <div class="control-bar">
        <!-- 火星车选择 -->
        <div class="rover-tabs">
          <button
            v-for="r in roverList"
            :key="r.key"
            class="rover-tab"
            :class="{ active: selectedRover === r.key }"
            @click="selectRover(r.key)"
          >
            <span class="tab-icon">{{ r.icon }}</span>
            <div class="tab-text">
              <span class="tab-name">{{ r.name }}</span>
              <span class="tab-status" :class="r.status === '活跃' ? 'active' : 'done'">{{ r.status }}</span>
            </div>
          </button>
        </div>

        <!-- 日期选择 -->
        <div class="date-picker">
          <label>📅 地球日期</label>
          <input
            type="date"
            v-model="selectedDate"
            :min="minDate"
            :max="maxDate"
            @change="fetchPhotos"
            class="date-input"
          />
        </div>

        <!-- 相机筛选 -->
        <div class="camera-filter">
          <label>📷 相机</label>
          <select v-model="selectedCamera" class="filter-select" @change="applyFilters">
            <option value="">全部相机</option>
            <option v-for="cam in availableCameras" :key="cam" :value="cam">{{ cam }}</option>
          </select>
        </div>
      </div>

      <!-- 火星车信息卡 -->
      <div v-if="currentRoverConfig" class="rover-info-card">
        <div class="rover-details">
          <span class="ri-label">着陆日期</span><span class="ri-val">{{ currentRoverConfig.landing }}</span>
          <span class="ri-label">着陆地点</span><span class="ri-val">{{ currentRoverConfig.location }}</span>
          <span class="ri-label">质量</span><span class="ri-val">{{ currentRoverConfig.mass }}</span>
          <span class="ri-label">任务状态</span>
          <span class="ri-val" :class="currentRoverConfig.status === '活跃' ? 'status-active' : 'status-done'">
            {{ currentRoverConfig.status }}
          </span>
        </div>
        <p class="rover-desc">{{ currentRoverConfig.description }}</p>
      </div>

      <!-- 统计图表 -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-number">{{ photos.length }}</div>
          <div class="stat-desc">当日照片</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ availableCameras.length }}</div>
          <div class="stat-desc">活跃相机</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ filteredPhotos.length }}</div>
          <div class="stat-desc">显示中</div>
        </div>
        <!-- ECharts 相机分布图 -->
        <div class="chart-wrap">
          <div ref="chartRef" class="echarts-container" />
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <span>正在从NASA服务器获取影像数据...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && filteredPhotos.length === 0" class="empty-state">
        <div class="empty-icon">🔭</div>
        <h3>该日期暂无照片数据</h3>
        <p>请尝试选择其他日期，好奇号通常在火星每个工作日都有拍摄记录。</p>
        <button class="retry-btn" @click="tryRandomDate">随机日期</button>
      </div>

      <!-- 照片网格 -->
      <div v-else class="photo-grid">
        <div
          v-for="photo in filteredPhotos"
          :key="photo.id"
          class="photo-card"
          @click="openLightbox(photo)"
        >
          <div class="photo-thumb">
            <img
              :src="photo.img_src"
              :alt="`火星照片 ${photo.id}`"
              loading="lazy"
              @error="handleImgError($event)"
            />
            <div class="photo-overlay">
              <span class="overlay-icon">🔍</span>
              <span class="overlay-text">点击放大</span>
            </div>
          </div>
          <div class="photo-meta">
            <span class="meta-cam">📷 {{ photo.camera?.name }}</span>
            <span class="meta-sol">Sol {{ photo.sol }}</span>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="filteredPhotos.length > 0 && hasMore" class="load-more">
        <button class="load-more-btn" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- Lightbox 灯箱 -->
    <transition name="lightbox">
      <div v-if="lightboxPhoto" class="lightbox" @click.self="closeLightbox">
        <div class="lightbox-inner">
          <button class="lb-close" @click="closeLightbox">✕</button>
          <img :src="lightboxPhoto.img_src" class="lb-image" :alt="`火星照片 ${lightboxPhoto.id}`" />
          <div class="lb-info">
            <div class="lb-row"><b>火星车：</b>{{ lightboxPhoto.rover?.name }}</div>
            <div class="lb-row"><b>相机：</b>{{ lightboxPhoto.camera?.full_name }}</div>
            <div class="lb-row"><b>地球日期：</b>{{ lightboxPhoto.earth_date }}</div>
            <div class="lb-row"><b>火星日（Sol）：</b>{{ lightboxPhoto.sol }}</div>
            <div class="lb-row"><b>照片ID：</b>{{ lightboxPhoto.id }}</div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Header from '../components/Header.vue'
import { getMarsRoverPhotos, ROVER_CONFIG } from '../api/nasaApi.js'
import * as echarts from 'echarts'

// ── 状态 ──
const selectedRover = ref('curiosity')
const selectedDate = ref('2023-06-15')
const selectedCamera = ref('')
const photos = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const hasMore = ref(false)
const lightboxPhoto = ref(null)
const chartRef = ref(null)
let chart = null

// ── 火星车配置 ──
const roverList = [
  { key: 'curiosity', name: '好奇号', icon: '🤖', status: '活跃' },
  { key: 'perseverance', name: '毅力号', icon: '🤖', status: '活跃' },
  { key: 'opportunity', name: '机遇号', icon: '🤖', status: '已完成' }
]

const currentRoverConfig = computed(() => ROVER_CONFIG[selectedRover.value])

// 日期范围限制
const minDate = computed(() => {
  const configs = { curiosity: '2012-08-07', perseverance: '2021-02-19', opportunity: '2004-01-26' }
  return configs[selectedRover.value] || '2004-01-01'
})
const maxDate = computed(() => {
  const configs = { curiosity: '2024-12-31', perseverance: '2024-12-31', opportunity: '2018-06-11' }
  return configs[selectedRover.value] || '2024-12-31'
})

// ── 相机列表 ──
const availableCameras = computed(() => {
  const cams = new Set(photos.value.map(p => p.camera?.name).filter(Boolean))
  return [...cams].sort()
})

// ── 过滤后的照片 ──
const filteredPhotos = computed(() => {
  if (!selectedCamera.value) return photos.value
  return photos.value.filter(p => p.camera?.name === selectedCamera.value)
})

// ── 获取照片 ──
async function fetchPhotos() {
  loading.value = true
  currentPage.value = 1
  photos.value = []
  selectedCamera.value = ''

  try {
    const result = await getMarsRoverPhotos(selectedRover.value, selectedDate.value, 1)
    photos.value = result
    hasMore.value = result.length >= 25
  } finally {
    loading.value = false
    await nextTick()
    updateChart()
  }
}

async function loadMore() {
  loadingMore.value = true
  currentPage.value++
  try {
    const more = await getMarsRoverPhotos(selectedRover.value, selectedDate.value, currentPage.value)
    photos.value.push(...more)
    hasMore.value = more.length >= 25
  } finally {
    loadingMore.value = false
    updateChart()
  }
}

function selectRover(key) {
  selectedRover.value = key
  // 重置到该火星车的典型日期
  const dates = { curiosity: '2023-06-15', perseverance: '2022-03-01', opportunity: '2015-06-03' }
  selectedDate.value = dates[key] || '2023-06-15'
  fetchPhotos()
}

function applyFilters() {
  // 过滤由 computed 处理，此处仅为触发点
}

function tryRandomDate() {
  const start = new Date(minDate.value).getTime()
  const end = new Date(maxDate.value).getTime()
  const rand = new Date(start + Math.random() * (end - start))
  selectedDate.value = rand.toISOString().split('T')[0]
  fetchPhotos()
}

// ── ECharts 相机分布图 ──
function updateChart() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value, 'dark')
  }
  const camCounts = {}
  photos.value.forEach(p => {
    const cam = p.camera?.name || '未知'
    camCounts[cam] = (camCounts[cam] || 0) + 1
  })
  const data = Object.entries(camCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['50%', '80%'],
      center: ['50%', '50%'],
      data,
      itemStyle: {
        borderColor: '#001020',
        borderWidth: 2
      },
      label: {
        color: '#aaa',
        fontSize: 10
      }
    }]
  }, true)
}

// ── 灯箱 ──
function openLightbox(photo) { lightboxPhoto.value = photo }
function closeLightbox() { lightboxPhoto.value = null }

// ── 错误图片处理 ──
function handleImgError(event) {
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzFhMGEwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj7wn5agPC90ZXh0Pjwvc3ZnPg=='
}

// ── 键盘关闭灯箱 ──
const handleKey = (e) => { if (e.key === 'Escape') closeLightbox() }

onMounted(() => {
  fetchPhotos()
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  chart?.dispose()
})

watch(chartRef, (el) => {
  if (el && photos.value.length) updateChart()
})
</script>

<style scoped>
.gallery-page {
  min-height: 100vh;
  background: #000510;
  color: #fff;
  padding-top: 60px;
}

/* ── 页面标题 ── */
.page-hero {
  text-align: center;
  padding: 48px 20px 24px;
  background: linear-gradient(to bottom, rgba(193, 68, 14, 0.12), transparent);
}

.hero-title {
  font-size: 40px;
  font-weight: bold;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #FF6B4A, #FFD700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.5);
}

/* ── 控制栏 ── */
.control-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 40px;
  background: rgba(255, 255, 255, 0.04);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
}

.rover-tabs {
  display: flex;
  gap: 8px;
}

.rover-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.rover-tab:hover { background: rgba(255, 107, 74, 0.15); border-color: rgba(255, 107, 74, 0.4); }
.rover-tab.active {
  background: rgba(255, 107, 74, 0.2);
  border-color: rgba(255, 107, 74, 0.7);
  color: #FF6B4A;
}

.tab-icon { font-size: 18px; }
.tab-text { display: flex; flex-direction: column; }
.tab-name { font-weight: 600; }
.tab-status { font-size: 10px; }
.tab-status.active { color: #4fc3f7; }
.tab-status.done { color: #888; }

.date-picker, .camera-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.date-input, .filter-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.date-input::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }

/* ── 火星车信息卡 ── */
.rover-info-card {
  margin: 16px 40px;
  padding: 16px 20px;
  background: rgba(193, 68, 14, 0.1);
  border: 1px solid rgba(193, 68, 14, 0.3);
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.rover-details {
  display: grid;
  grid-template-columns: auto auto;
  gap: 6px 20px;
  align-items: center;
}

.ri-label { font-size: 12px; color: rgba(255, 255, 255, 0.45); }
.ri-val { font-size: 13px; color: #eee; font-weight: 500; }
.status-active { color: #4fc3f7 !important; }
.status-done { color: #888 !important; }

.rover-desc { font-size: 13px; color: rgba(255, 255, 255, 0.55); line-height: 1.6; flex: 1; min-width: 200px; }

/* ── 统计区 ── */
.stats-section {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 40px;
  flex-wrap: wrap;
}

.stat-card {
  text-align: center;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #FF6B4A;
  font-family: monospace;
}

.stat-desc { font-size: 12px; color: rgba(255, 255, 255, 0.45); margin-top: 4px; }

.chart-wrap {
  flex: 1;
  min-width: 200px;
  height: 120px;
}

.echarts-container { width: 100%; height: 100%; }

/* ── 加载状态 ── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 80px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.loader {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 107, 74, 0.2);
  border-top-color: #FF6B4A;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── 空状态 ── */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon { font-size: 64px; margin-bottom: 20px; }
.empty-state h3 { font-size: 20px; color: #fff; margin-bottom: 12px; }
.empty-state p { font-size: 14px; margin-bottom: 24px; }

.retry-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #C1440E, #FF6B4A);
  border: none;
  border-radius: 20px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.retry-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(193, 68, 14, 0.5); }

/* ── 照片网格 ── */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 16px 40px 40px;
}

.photo-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
}

.photo-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 107, 74, 0.5);
  box-shadow: 0 8px 32px rgba(193, 68, 14, 0.3);
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #1a0800;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.photo-card:hover .photo-thumb img {
  transform: scale(1.05);
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.25s;
}

.photo-card:hover .photo-overlay { opacity: 1; }
.overlay-icon { font-size: 32px; }
.overlay-text { font-size: 13px; color: #fff; font-weight: 600; }

.photo-meta {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-cam { color: #FF6B4A; }

/* ── 加载更多 ── */
.load-more {
  text-align: center;
  padding: 24px;
}

.load-more-btn {
  padding: 12px 40px;
  background: rgba(255, 107, 74, 0.15);
  border: 1px solid rgba(255, 107, 74, 0.5);
  color: #FF6B4A;
  border-radius: 24px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.load-more-btn:hover:not(:disabled) { background: rgba(255, 107, 74, 0.3); transform: translateY(-2px); }
.load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 灯箱 ── */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lightbox-inner {
  position: relative;
  max-width: 900px;
  width: 100%;
  background: #0a0500;
  border: 1px solid rgba(255, 107, 74, 0.3);
  border-radius: 16px;
  overflow: hidden;
}

.lb-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lb-image {
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
  display: block;
  background: #000;
}

.lb-info {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.lb-row {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.lb-row b { color: #FF6B4A; margin-right: 6px; }

/* 灯箱动画 */
.lightbox-enter-active, .lightbox-leave-active { transition: all 0.3s ease; }
.lightbox-enter-from, .lightbox-leave-to { opacity: 0; }

.gallery-content { max-width: 1600px; margin: 0 auto; }
</style>
