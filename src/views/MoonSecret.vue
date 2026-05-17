<template>
  <div class="moon-scene">
    <!-- 3D渲染容器 -->
    <div ref="canvasRef" class="canvas-container" @mousedown="onCanvasClick" />

    <!-- 左侧标注面板 -->
    <div class="side-panel">
      <div class="panel-card">
        <div class="panel-title">🌙 月球秘境</div>

        <!-- 场景控制 -->
        <div class="control-group">
          <label>质量档位</label>
          <div class="seg-control">
            <button
              v-for="opt in qualityOptions"
              :key="opt.value"
              :class="['seg-btn', { active: quality === opt.value }]"
              @click="setQuality(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="control-group">
          <label>显示模式</label>
          <div class="seg-control">
            <button
              v-for="opt in displayModeOptions"
              :key="opt.value"
              :class="['seg-btn', { active: displayMode === opt.value }]"
              @click="setDisplayMode(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="control-group">
          <label>地形夸张</label>
          <input 
            type="range" 
            min="0" 
            max="20" 
            step="0.5" 
            v-model.number="displacementScale"
            @input="updateDisplacementScale"
          />
          <span>{{ displacementScale.toFixed(1) }}x</span>
        </div>
        <div class="control-group">
          <button @click="toggleLabels">{{ showLabels ? '隐藏' : '显示' }}标注</button>
        </div>

        <!-- 标注点列表 -->
        <div class="markers-section">
          <div class="panel-title" style="margin-top: 8px;">📍 地理标注 <span class="marker-count">{{ allMarkers.length }}</span></div>
          
          <!-- 按类别分组展示 -->
          <div 
            v-for="(group, cat) in groupedMarkers" 
            :key="cat"
            class="category-group"
          >
            <div 
              class="category-header"
              @click="toggleCategory(cat)"
              :style="{ color: getCategoryColor(cat) }"
            >
              <span class="cat-icon">{{ getCategoryIcon(cat) }}</span>
              <span>{{ getCategoryLabel(cat) }}</span>
              <span class="cat-count">({{ group.length }})</span>
              <span class="cat-toggle">{{ collapsedCategories.has(cat) ? '▶' : '▼' }}</span>
            </div>
            <div v-if="!collapsedCategories.has(cat)" class="marker-list">
              <button
                v-for="marker in group"
                :key="marker.id"
                class="marker-btn"
                :class="{ active: selectedMarker && selectedMarker.id === marker.id }"
                :style="{ borderLeftColor: getCategoryColor(marker.category) }"
                @click="onMarkerListClick(marker)"
              >
                {{ marker.nameZh }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧详情面板 -->
    <transition name="slide">
      <div v-if="selectedMarker" class="detail-panel">
        <div class="detail-header">
          <div class="detail-title-row">
            <span 
              class="detail-category-tag"
              :style="{ background: getCategoryColor(selectedMarker.category) + '33', borderColor: getCategoryColor(selectedMarker.category) }"
            >
              {{ getCategoryIcon(selectedMarker.category) }} {{ getCategoryLabel(selectedMarker.category) }}
            </span>
          </div>
          <div class="detail-name-row">
            <h3>{{ selectedMarker.nameZh }}</h3>
            <button class="close-btn" @click="closeDetailPanel">&times;</button>
          </div>
          <div class="detail-name-en">{{ selectedMarker.nameEn }}</div>
        </div>
        <div class="detail-content">
          <p class="summary">{{ selectedMarker.summary }}</p>
          <div class="details-grid">
            <div v-for="(value, key) in selectedMarker.details" :key="key" class="detail-row">
              <span class="detail-key">{{ key }}</span>
              <span class="detail-value">{{ value }}</span>
            </div>
            <div v-if="selectedMarker.diameterKm" class="detail-row">
              <span class="detail-key">直径</span>
              <span class="detail-value">{{ selectedMarker.diameterKm }} km</span>
            </div>
          </div>
          <div class="coordinates">
            📍 坐标: {{ formatCoordinates(selectedMarker.lat, selectedMarker.lon) }}
          </div>
          <div class="source">数据来源: {{ selectedMarker.source }}</div>
          <div class="actions">
            <button @click="flyToCurrentMarker">🚀 飞到此处</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载月球模型中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { DeepMoonScene } from '../three/deepMoonScene.js'
import { formatCoordinates } from '../utils/moonGeo.js'

// 场景引用
const canvasRef = ref(null)
let moonScene = null

// UI状态
const quality = ref('medium')
const displayMode = ref('natural')
const displacementScale = ref(1.8)
const showLabels = ref(true)
const selectedMarker = ref(null)
const isLoading = ref(false)

// 质量/显示模式选项
const qualityOptions = [
  { value: 'low',    label: '4K' },
  { value: 'medium', label: '8K' },
  { value: 'high',   label: '16K' }
]
const displayModeOptions = [
  { value: 'natural',          label: '自然' },
  { value: 'heightGray',       label: '高程' },
  { value: 'displacementOnly', label: '线框' }
]

// 标注数据
const allMarkers = ref([])
const collapsedCategories = reactive(new Set())

// 类别配置
const CATEGORY_CONFIG = {
  landing_site: { label: '着陆点',   icon: '🚀', color: '#64a3ff' },
  crater:       { label: '撞击坑',   icon: '🌑', color: '#ff6b4a' },
  mare:         { label: '月海/月洋', icon: '🌊', color: '#4fc3f7' },
  montes:       { label: '山脉',     icon: '⛰️', color: '#8bc34a' },
  mons:         { label: '山峰',     icon: '🏔️', color: '#8bc34a' },
  vallis:       { label: '月谷/月溪', icon: '🏞️', color: '#ff9800' },
  rupes:        { label: '断崖',     icon: '📐', color: '#9c27b0' },
  other:        { label: '其他',     icon: '📌', color: '#ffffff' }
}

function getCategoryLabel(cat) {
  return CATEGORY_CONFIG[cat]?.label || cat
}
function getCategoryIcon(cat) {
  return CATEGORY_CONFIG[cat]?.icon || '📌'
}
function getCategoryColor(cat) {
  return CATEGORY_CONFIG[cat]?.color || '#ffffff'
}

// 按类别分组（保持类别显示顺序）
const CATEGORY_ORDER = ['landing_site', 'crater', 'mare', 'montes', 'mons', 'vallis', 'rupes', 'other']

const groupedMarkers = computed(() => {
  const groups = {}
  allMarkers.value.forEach(m => {
    const cat = m.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  })
  // 按 importance 降序排序
  Object.values(groups).forEach(arr => arr.sort((a, b) => (b.importance || 0) - (a.importance || 0)))
  // 按预定顺序返回
  const ordered = {}
  CATEGORY_ORDER.forEach(cat => {
    if (groups[cat]) ordered[cat] = groups[cat]
  })
  // 附加未知类别
  Object.keys(groups).forEach(cat => {
    if (!ordered[cat]) ordered[cat] = groups[cat]
  })
  return ordered
})

function toggleCategory(cat) {
  if (collapsedCategories.has(cat)) {
    collapsedCategories.delete(cat)
  } else {
    collapsedCategories.add(cat)
  }
}

/**
 * 初始化场景
 */
async function initScene() {
  if (!canvasRef.value) return
  
  isLoading.value = true
  try {
    if (moonScene) {
      moonScene.dispose()
    }
    
    moonScene = new DeepMoonScene(canvasRef.value)
    await moonScene.init({
      quality: quality.value,
      enableDisplacement: true,
      displacementScale: displacementScale.value
    })

    // 获取已加载的完整标注列表
    allMarkers.value = moonScene.getMarkers()
  } catch (error) {
    console.error('Failed to initialize moon scene:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * 处理画布点击（点击3D模型上的标注）
 */
function onCanvasClick(event) {
  if (!moonScene) return
  
  const clickedMarker = moonScene.handleMouseDown(event)
  if (clickedMarker) {
    selectedMarker.value = clickedMarker
  } else {
    selectedMarker.value = null
  }
}

/**
 * 点击左侧列表中的标注
 */
function onMarkerListClick(marker) {
  selectedMarker.value = marker
  if (moonScene) {
    moonScene.flyToMarker(marker)
  }
}

/**
 * 设置质量档位并重新加载场景
 */
async function setQuality(val) {
  if (val === quality.value) return
  quality.value = val
  selectedMarker.value = null
  await initScene()
}

/**
 * 设置显示模式（无需重载场景，即时切换）
 */
function setDisplayMode(val) {
  if (val === displayMode.value) return
  displayMode.value = val
  if (moonScene) {
    moonScene.updateDisplayMode(val)
  }
}

/**
 * 重新加载场景（内部使用）
 */
async function reloadScene() {
  selectedMarker.value = null
  await initScene()
}

/**
 * 更新地形夸张倍率
 */
function updateDisplacementScale() {
  if (moonScene) {
    moonScene.updateDisplacementScale(displacementScale.value)
  }
}

/**
 * 切换标注显示
 */
function toggleLabels() {
  showLabels.value = !showLabels.value
  if (moonScene) {
    moonScene.setLabelsVisible(showLabels.value)
  }
}

/**
 * 飞行到当前选中标记
 */
function flyToCurrentMarker() {
  if (moonScene && selectedMarker.value) {
    moonScene.flyToMarker(selectedMarker.value)
  }
}

/**
 * 关闭详情面板
 */
function closeDetailPanel() {
  selectedMarker.value = null
  if (moonScene) {
    moonScene.deselectMarker()
  }
}

// 生命周期
onMounted(() => {
  initScene()
})

onUnmounted(() => {
  if (moonScene) {
    moonScene.dispose()
  }
})
</script>

<style scoped>
.moon-scene {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000008;
}

.canvas-container {
  position: absolute;
  inset: 0;
  z-index: 0;
  cursor: grab;
}

.canvas-container:active {
  cursor: grabbing;
}

/* ── 左侧面板 ── */
.side-panel {
  position: absolute;
  left: 16px;
  top: 16px;
  bottom: 16px;
  width: 256px;
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.panel-card {
  background: rgba(0, 8, 28, 0.88);
  border: 1px solid rgba(100, 163, 255, 0.25);
  border-radius: 14px;
  padding: 14px 14px 10px;
  backdrop-filter: blur(16px);
  color: #fff;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #64a3ff;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.marker-count {
  font-size: 11px;
  background: rgba(100, 163, 255, 0.2);
  border-radius: 10px;
  padding: 1px 6px;
  color: #64a3ff;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.control-group label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.control-group input[type="range"] {
  padding: 0;
  background: transparent;
  accent-color: #64a3ff;
  width: 100%;
}

.control-group span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
}

/* 普通按钮（显示/隐藏标注） */
.control-group > button {
  background: rgba(100, 163, 255, 0.12);
  border: 1px solid rgba(100, 163, 255, 0.30);
  border-radius: 7px;
  padding: 6px 10px;
  color: #64a3ff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  letter-spacing: 0.3px;
}

.control-group > button:hover {
  background: rgba(100, 163, 255, 0.24);
  border-color: rgba(100, 163, 255, 0.5);
}

/* ── Segmented Control ── */
.seg-control {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(100, 163, 255, 0.18);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.seg-btn {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 5px 4px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.seg-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
}

.seg-btn.active {
  background: rgba(100, 163, 255, 0.22);
  border-color: rgba(100, 163, 255, 0.55);
  color: #90c4ff;
  font-weight: 600;
  box-shadow: 0 0 8px rgba(100, 163, 255, 0.15);
}

/* 标注列表区域 */
.markers-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 2px;
}

.markers-section::-webkit-scrollbar {
  width: 4px;
}
.markers-section::-webkit-scrollbar-track {
  background: transparent;
}
.markers-section::-webkit-scrollbar-thumb {
  background: rgba(100, 163, 255, 0.3);
  border-radius: 2px;
}

.category-group {
  margin-bottom: 6px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 4px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.category-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.cat-icon {
  font-size: 12px;
}

.cat-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
}

.cat-toggle {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.marker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 4px;
  margin-top: 2px;
}

.marker-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-left-width: 2px;
  border-radius: 5px;
  padding: 5px 8px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.marker-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.marker-btn.active {
  background: rgba(100, 163, 255, 0.15);
  border-color: rgba(100, 163, 255, 0.6);
  border-left-color: #64a3ff;
  color: #fff;
}

/* ── 右侧详情面板 ── */
.detail-panel {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 320px;
  max-height: calc(100vh - 32px);
  background: rgba(0, 8, 28, 0.90);
  border: 1px solid rgba(100, 163, 255, 0.25);
  border-radius: 14px;
  padding: 16px;
  backdrop-filter: blur(16px);
  color: #fff;
  z-index: 200;
  overflow-y: auto;
}

.detail-panel::-webkit-scrollbar {
  width: 4px;
}
.detail-panel::-webkit-scrollbar-thumb {
  background: rgba(100, 163, 255, 0.3);
  border-radius: 2px;
}

.detail-title-row {
  margin-bottom: 6px;
}

.detail-category-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
}

.detail-name-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.detail-name-row h3 {
  font-size: 17px;
  font-weight: 700;
  color: #64a3ff;
  margin: 0;
  line-height: 1.3;
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s;
}

.close-btn:hover {
  color: #fff;
}

.detail-name-en {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin: 4px 0 12px;
  line-height: 1.4;
}

.summary {
  font-size: 12.5px;
  line-height: 1.6;
  margin-bottom: 12px;
  color: #ddd;
}

.details-grid {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.detail-key {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.detail-value {
  font-size: 11px;
  color: #ccc;
  text-align: right;
  word-break: break-all;
}

.coordinates {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 6px;
}

.source {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.actions button {
  width: 100%;
  background: rgba(100, 163, 255, 0.18);
  border: 1px solid rgba(100, 163, 255, 0.4);
  border-radius: 7px;
  padding: 8px 12px;
  color: #64a3ff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.actions button:hover {
  background: rgba(100, 163, 255, 0.3);
}

/* ── 加载指示器 ── */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 300;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(100, 163, 255, 0.3);
  border-top: 4px solid #64a3ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ── 过渡动画 ── */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .side-panel {
    display: none;
  }
  .detail-panel {
    width: calc(100vw - 32px);
    right: 16px;
    left: 16px;
    top: auto;
    bottom: 16px;
    max-height: 60vh;
  }
}
</style>
