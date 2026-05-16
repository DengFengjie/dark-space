<template>
  <div class="gallery-page">
    <Header :show-date="true" />

    <div class="gallery-content">
      <!-- 标题区 -->
      <div class="page-hero">
        <h1 class="hero-title">🔴 火星任务画廊</h1>
        <p class="hero-sub">来自NASA火星车的真实探测影像 · 数据优先同步自 Mars Vista API</p>
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


        <!-- 已浏览日期范围（只读展示） -->
        <div v-if="dateRangeLabel" class="date-range-badge">
          <span class="date-range-icon">📅</span>
          <span>{{ dateRangeLabel }}</span>
        </div>

        <div v-if="sourceLabel" class="source-badge">
          <span>🛰️</span>
          <span>{{ sourceLabel }}</span>
        </div>
      </div>

      <!-- 火星车信息卡 -->
      <div v-if="currentRoverConfig" class="rover-info-card">
        <!-- 左侧：关键参数表 -->
        <div class="rover-stats-grid">
          <div class="ri-item">
            <span class="ri-label">发射日期</span>
            <span class="ri-val">{{ currentRoverConfig.launch }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">着陆日期</span>
            <span class="ri-val">{{ currentRoverConfig.landing }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">着陆地点</span>
            <span class="ri-val">{{ currentRoverConfig.location }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">质量</span>
            <span class="ri-val">{{ currentRoverConfig.mass }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">动力来源</span>
            <span class="ri-val">{{ currentRoverConfig.power }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">行驶速度</span>
            <span class="ri-val">{{ currentRoverConfig.speed }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">累计行驶</span>
            <span class="ri-val ri-highlight">{{ currentRoverConfig.totalDistance }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">累计拍摄</span>
            <span class="ri-val ri-highlight">{{ currentRoverConfig.totalPhotos }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">设计寿命</span>
            <span class="ri-val">{{ currentRoverConfig.designLife }}</span>
          </div>
          <div class="ri-item">
            <span class="ri-label">任务状态</span>
            <span class="ri-val" :class="currentRoverConfig.status === '活跃' ? 'status-active' : 'status-done'">
              {{ currentRoverConfig.status }}
            </span>
          </div>
        </div>

        <!-- 右侧：描述 + 亮点 + 科学仪器 -->
        <div class="rover-right">
          <p class="rover-desc">{{ currentRoverConfig.description }}</p>

          <div class="rover-highlights">
            <div class="rh-title">🏆 任务亮点</div>
            <ul class="rh-list">
              <li v-for="h in currentRoverConfig.highlights" :key="h">{{ h }}</li>
            </ul>
          </div>

          <div class="rover-instruments">
            <div class="ri-instr-title">🔬 科学仪器</div>
            <div class="ri-instr-tags">
              <span v-for="ins in currentRoverConfig.instruments" :key="ins" class="instr-tag">{{ ins }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计 + 相机筛选（合并模块） -->
      <div class="stats-section">
        <!-- 左：数字统计 + 饼图 -->
        <div class="stats-left">
          <div class="stat-card">
            <div class="stat-number">{{ photos.length }}</div>
            <div class="stat-desc">已加载照片</div>
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

        <!-- 分隔线 -->
        <div v-if="availableCameras.length > 0" class="stats-divider"></div>

        <!-- 右：相机筛选面板 -->
        <div v-if="availableCameras.length > 0" class="stats-cam">
          <div class="cam-panel-header">
            <span class="cam-panel-icon">📷</span>
            <span class="cam-panel-title">相机筛选</span>
            <span class="cam-panel-hint">{{ availableCameras.length }} 个相机 · {{ filteredPhotos.length }} 张</span>
          </div>
          <div class="cam-panel-body">
            <select v-model="selectedCamera" class="cam-select">
              <option value="">🌐 全部相机（显示所有）</option>
              <option
                v-for="cam in availableCameras"
                :key="cam"
                :value="cam"
              >📷 {{ cam }} — {{ getCameraFullName(cam) }}</option>
            </select>
            <div v-if="selectedCamera" class="cam-active-hint">
              <span class="cam-active-dot"></span>
              当前：<b>{{ selectedCamera }}</b> · {{ getCameraFullName(selectedCamera) }}
              <button class="cam-clear-btn" @click="selectedCamera = ''">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <span>正在从火星服务器获取影像数据...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && filteredPhotos.length === 0 && exhausted" class="empty-state">
        <div class="empty-icon">🔭</div>
        <h3>暂无更多照片</h3>
        <p>当前火星车的照片数据已全部加载完毕。</p>
        <button class="retry-btn" @click="resetAndFetch">重新加载</button>
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
      <div v-if="filteredPhotos.length > 0 && !exhausted" class="load-more">
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
import { getMarsRoverPhotosResponse, getRoverLatestDate, ROVER_CONFIG } from '../api/nasaApi.js'
import * as echarts from 'echarts'

// ── 状态 ──
const selectedRover = ref('curiosity')
const selectedCamera = ref('')
const photos = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const lightboxPhoto = ref(null)
const chartRef = ref(null)
const exhausted = ref(false)   // 是否已无更多数据可加载
const oldestDate = ref('')     // 已加载的最早日期（用于展示，响应式）
const newestDate = ref('')     // 已加载的最新日期（用于展示，响应式）
const dataSource = ref('')      // 当前数据源
let chart = null

// 内部分批状态（对用户不可见）
let currentDate = ''           // 当前正在加载的日期
let currentPage = 1            // 当前日期的页码

// ── 火星车配置 ──
const roverList = [
  { key: 'curiosity',     name: '好奇号', icon: '🤖', status: '活跃' },
  { key: 'perseverance',  name: '毅力号', icon: '🤖', status: '活跃' },
  { key: 'opportunity',   name: '机遇号', icon: '🤖', status: '已完成' }
]

const currentRoverConfig = computed(() => ROVER_CONFIG[selectedRover.value])

// 各火星车的最早着陆日期（用于限制 loadMore 向前推的边界）
const roverMinDate = {
  curiosity:    '2012-08-07',
  perseverance: '2021-02-19',
  opportunity:  '2004-01-26'
}

// ── 已浏览日期范围展示 ──
const dateRangeLabel = computed(() => {
  if (!newestDate.value && !oldestDate.value) return ''
  if (newestDate.value === oldestDate.value) return `当前日期：${newestDate.value}`
  return `已浏览：${oldestDate.value} ~ ${newestDate.value}`
})

const sourceLabel = computed(() => {
  const labels = {
    'mars-vista': 'Mars Vista',
    nebulum: 'Nebulum 备用源',
    fallback: '本地示例数据'
  }
  return labels[dataSource.value] || ''
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

// 将日期字符串往前推一天
function prevDay(dateStr) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// ── 初始加载（先查最新有效日期，再从最新开始加载） ──
async function fetchPhotos() {
  loading.value = true
  exhausted.value = false
  photos.value = []
  selectedCamera.value = ''
  newestDate.value = ''
  oldestDate.value = ''
  dataSource.value = ''
  currentPage = 1

  try {
    // Step 1：查询该火星车最新有效日期
    const latestInfo = await getRoverLatestDate(selectedRover.value)
    currentDate = latestInfo.max_date

    // Step 2：用最新日期加载第一页照片
    const result = await getMarsRoverPhotosResponse(selectedRover.value, currentDate, 1)
    dataSource.value = result.source || ''
    const list = result.photos || []
    if (list.length > 0) {
      photos.value = list
      newestDate.value = list[0]?.earth_date || currentDate
      oldestDate.value = list[list.length - 1]?.earth_date || currentDate
      const totalPages = result.pagination?.total_pages || 1
      if (currentPage >= totalPages) {
        currentPage = 999 // 标记当前日期已满载，下次 loadMore 推到前一天
      }
    } else {
      // 最新日期也没数据（机遇号等情况），标记当前日期已满，loadMore 会继续往前找
      currentPage = 999
    }
  } finally {
    loading.value = false
    await nextTick()
    updateChart()
  }
}

// ── 加载更多（当前日期下一页 or 推到前一天） ──
async function loadMore() {
  if (loadingMore.value || exhausted.value) return
  loadingMore.value = true

  const minDate = roverMinDate[selectedRover.value] || '2004-01-01'

  try {
    // 如果当前页已经加载完（< 25张），往前推一天
    if (currentPage >= 999) {
      const next = prevDay(currentDate)
      // 超出最早日期，标记穷尽
      if (next < minDate) {
        exhausted.value = true
        return
      }
      currentDate = next
      currentPage = 1
    } else {
      currentPage++
    }

    // 最多连续跳过 30 天无数据的日期
    let skipCount = 0
    while (skipCount < 30) {
      const result = await getMarsRoverPhotosResponse(selectedRover.value, currentDate, currentPage)
      dataSource.value = result.source || dataSource.value
      const list = result.photos || []
      if (list.length > 0) {
        photos.value.push(...list)
        oldestDate.value = list[list.length - 1]?.earth_date || currentDate
        const totalPages = result.pagination?.total_pages || 1
        if (currentPage >= totalPages) {
          currentPage = 999 // 当前日期已满
        }
        break
      } else {
        // 这天没数据，继续往前
        const next = prevDay(currentDate)
        if (next < minDate) {
          exhausted.value = true
          break
        }
        currentDate = next
        currentPage = 1
        skipCount++
      }
    }
    if (skipCount >= 30) {
      // 连续30天无数据视为穷尽
      exhausted.value = true
    }
  } finally {
    loadingMore.value = false
    updateChart()
  }
}

function selectRover(key) {
  selectedRover.value = key
  fetchPhotos()
}

function resetAndFetch() {
  fetchPhotos()
}

// ── 相机全名映射 ──
function getCameraFullName(abbr) {
  const names = {
    FHAZ:                  'Front Hazard Avoidance Camera',
    RHAZ:                  'Rear Hazard Avoidance Camera',
    MAST:                  'Mast Camera',
    CHEMCAM:               'Chemistry & Camera Complex',
    MAHLI:                 'Mars Hand Lens Imager',
    MARDI:                 'Mars Descent Imager',
    NAVCAM:                'Navigation Camera',
    PANCAM:                'Panoramic Camera',
    MINITES:               'Miniature Thermal Emission Spectrometer',
    NAVCAM_LEFT:           'Navigation Camera – Left',
    NAVCAM_RIGHT:          'Navigation Camera – Right',
    MCZ_LEFT:              'Mastcam-Z Left',
    MCZ_RIGHT:             'Mastcam-Z Right',
    FRONT_HAZCAM_LEFT_A:   'Front Left Hazard Avoidance Camera – A',
    FRONT_HAZCAM_RIGHT_A:  'Front Right Hazard Avoidance Camera – A',
    REAR_HAZCAM_LEFT:      'Rear Left Hazard Avoidance Camera',
    REAR_HAZCAM_RIGHT:     'Rear Right Hazard Avoidance Camera',
    SHERLOC_WATSON:        'SHERLOC Watson Camera',
    SKYCAM:                'Sky Camera',
    EDL_RUCAM:             'Rover Up-Look Camera',
    EDL_RDCAM:             'Rover Down-Look Camera',
    EDL_DDCAM:             'Descent Stage Down-Look Camera',
    SUPERCAM_RMI:          'SuperCam Remote Micro-Imager'
  }
  return names[abbr] || abbr
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

// ── ECharts resize ──
const handleResize = () => { chart?.resize() }

// ── 键盘关闭灯箱 ──
const handleKey = (e) => { if (e.key === 'Escape') closeLightbox() }

onMounted(() => {
  fetchPhotos()
  window.addEventListener('keydown', handleKey)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('resize', handleResize)
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

/* ── 相机筛选（嵌入统计模块右侧） ── */
.cam-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.cam-panel-icon { font-size: 18px; }

.cam-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.cam-panel-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  margin-left: 4px;
}

.cam-panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cam-select {
  width: 100%;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  appearance: auto;
}

.cam-select:focus {
  border-color: rgba(255, 107, 74, 0.5);
  background: rgba(255, 107, 74, 0.06);
}

.cam-select option {
  background: #0a0a14;
  color: #e0e0e0;
}

/* 已选相机提示行 */
.cam-active-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.5);
  flex-wrap: wrap;
}

.cam-active-hint b {
  color: #FF6B4A;
  font-family: monospace;
}

.cam-active-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #FF6B4A;
  flex-shrink: 0;
  animation: dot-pulse 1.5s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.cam-clear-btn {
  padding: 2px 10px;
  background: rgba(255, 107, 74, 0.12);
  border: 1px solid rgba(255, 107, 74, 0.35);
  border-radius: 12px;
  color: #FF6B4A;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s;
}

.cam-clear-btn:hover {
  background: rgba(255, 107, 74, 0.25);
  border-color: rgba(255, 107, 74, 0.7);
}

/* ── 日期范围徽标 ── */
.date-range-badge, .source-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(255, 107, 74, 0.08);
  border: 1px solid rgba(255, 107, 74, 0.2);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.date-range-badge { margin-left: auto; }

.source-badge {
  background: rgba(79, 195, 247, 0.08);
  border-color: rgba(79, 195, 247, 0.25);
  color: rgba(180, 230, 255, 0.72);
}

.date-range-icon { font-size: 13px; }

/* ── 火星车信息卡 ── */
.rover-info-card {
  margin: 16px 40px;
  padding: 20px 24px;
  background: rgba(193, 68, 14, 0.08);
  border: 1px solid rgba(193, 68, 14, 0.3);
  border-radius: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

/* 左侧参数网格 */
.rover-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 28px;
  min-width: 300px;
  flex-shrink: 0;
}

.ri-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ri-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ri-val {
  font-size: 13px;
  color: #e0e0e0;
  font-weight: 500;
  line-height: 1.4;
}

.ri-highlight {
  color: #FF8C5A;
  font-weight: 700;
}

.status-active { color: #4fc3f7 !important; font-weight: 600; }
.status-done   { color: #888 !important; }

/* 右侧内容区 */
.rover-right {
  flex: 1;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rover-desc {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.75;
  margin: 0;
}

/* 任务亮点 */
.rh-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 200, 100, 0.85);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rh-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rh-list li {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}

/* 科学仪器 */
.ri-instr-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(130, 200, 255, 0.8);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ri-instr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.instr-tag {
  padding: 3px 10px;
  background: rgba(79, 195, 247, 0.08);
  border: 1px solid rgba(79, 195, 247, 0.22);
  border-radius: 20px;
  font-size: 11.5px;
  color: rgba(160, 220, 255, 0.75);
  font-family: monospace;
}

/* ── 统计 + 相机筛选（合并模块） ── */
.stats-section {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 40px 4px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  margin: 0 40px;
  overflow: hidden;
}

/* 左侧：数字+饼图 */
.stats-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px 16px 0;
  flex: 1;
  min-width: 0;
}

/* 垂直分隔线 */
.stats-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 0;
  flex-shrink: 0;
}

/* 右侧：相机筛选 */
.stats-cam {
  padding: 16px 0 16px 24px;
  min-width: 280px;
  max-width: 400px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-card {
  text-align: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  flex-shrink: 0;
}

.stat-number {
  font-size: 30px;
  font-weight: bold;
  color: #FF6B4A;
  font-family: monospace;
}

.stat-desc { font-size: 12px; color: rgba(255, 255, 255, 0.45); margin-top: 4px; }

.chart-wrap {
  flex: 1;
  min-width: 140px;
  height: 110px;
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
