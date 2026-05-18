<template>
  <div class="jupiter-scene">
    <!-- 3D渲染容器 -->
    <div ref="canvasRef" class="canvas-container" @mousedown="onCanvasClick" />

    <!-- 左侧控制面板 -->
    <div class="side-panel">
      <div class="panel-card">
        <div class="panel-title">🟠 木星巨眼</div>

        <!-- 质量档位 -->
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

        <!-- 显示模式 -->
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

        <!-- 大气辉光 -->
        <div class="control-group">
          <label>大气辉光</label>
          <input
            type="range"
            min="0"
            max="4"
            step="0.1"
            v-model.number="atmosphereIntensity"
            @input="updateAtmosphere"
          />
          <span>{{ atmosphereIntensity.toFixed(1) }}x</span>
        </div>

        <!-- 云层自转 -->
        <div class="control-group toggle-group">
          <label>云层自转</label>
          <button
            :class="['toggle-btn', { active: cloudRotation }]"
            @click="toggleCloudRotation"
          >{{ cloudRotation ? '开启 ●' : '关闭 ○' }}</button>
        </div>

        <!-- 标注显隐 -->
        <div class="control-group">
          <button @click="toggleLabels">{{ showLabels ? '隐藏' : '显示' }}标注</button>
        </div>

        <!-- 纹理状态 -->
        <div class="texture-status">
          <span :class="['tex-dot', hasRealTexture ? 'real' : 'fallback']"></span>
          <span class="tex-label">{{ hasRealTexture ? 'NASA 真实纹理' : '程序化备用纹理' }}</span>
        </div>

        <!-- 地理标注列表 -->
        <div class="markers-section">
          <div class="panel-title" style="margin-top: 8px;">
            📍 大气标注
            <span class="marker-count">{{ allMarkers.length }}</span>
          </div>

          <div
            v-for="(group, cat) in groupedMarkers"
            :key="cat"
            class="category-group"
          >
            <div
              class="category-header"
              :style="{ color: getCategoryColor(cat) }"
              @click="toggleCategory(cat)"
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
        <!-- 资源署名 -->
        <div class="attribution">
          Texture: NASA Hubble OPAL / JPL<br>
          标注坐标为大气示意位置
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
              :style="{
                background: getCategoryColor(selectedMarker.category) + '33',
                borderColor: getCategoryColor(selectedMarker.category)
              }"
            >
              {{ getCategoryIcon(selectedMarker.category) }}
              {{ getCategoryLabel(selectedMarker.category) }}
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
            <div
              v-for="(value, key) in selectedMarker.details"
              :key="key"
              class="detail-row"
            >
              <span class="detail-key">{{ key }}</span>
              <span class="detail-value">{{ value }}</span>
            </div>
          </div>
          <div class="coordinates">
            📍 坐标: {{ formatCoordinates(selectedMarker.lat, selectedMarker.lon) }}
          </div>
          <div v-if="selectedMarker.note" class="marker-note">
            ⚠️ {{ selectedMarker.note }}
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
      <p>加载木星模型中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { DeepJupiterScene } from '../three/deepJupiterScene.js'
import { formatCoordinates } from '../utils/jupiterGeo.js'

// 场景引用
const canvasRef = ref(null)
let jupiterScene = null

// UI 状态
const quality              = ref('medium')
const displayMode          = ref('natural')
const atmosphereIntensity  = ref(1.0)
const cloudRotation        = ref(true)
const showLabels           = ref(true)
const selectedMarker       = ref(null)
const isLoading            = ref(false)
const hasRealTexture       = ref(false)  // 是否使用了真实 NASA 纹理（非程序化 fallback）

// 质量档位
const qualityOptions = [
  { value: 'low',    label: '1K' },
  { value: 'medium', label: '3K' },
  { value: 'high',   label: '6K' }
]

// 显示模式
const displayModeOptions = [
  { value: 'natural',   label: '自然' },
  { value: 'bands',     label: '云带' },
  { value: 'wireframe', label: '线框' }
]

// 标注数据
const allMarkers          = ref([])
const collapsedCategories = reactive(new Set())

// ── 类别配置（木星暖橙 / 金黄色系）──
const CATEGORY_CONFIG = {
  storm:       { label: '风暴',   icon: '🌀', color: '#FFB347' },
  belt:        { label: '云带',   icon: '🟫', color: '#C78C4E' },
  zone:        { label: '亮带',   icon: '🌤️', color: '#FFE4B5' },
  polar:       { label: '极区',   icon: '🌐', color: '#9DB5D4' },
  mission:     { label: '探测任务', icon: '🛸', color: '#6DB9EF' },
  moon_shadow: { label: '卫星凌日', icon: '🌑', color: '#BBBBBB' },
  other:       { label: '其他',   icon: '📌', color: '#ffffff' }
}

const CATEGORY_ORDER = ['storm', 'polar', 'mission', 'belt', 'zone', 'moon_shadow', 'other']

function getCategoryLabel(cat) { return CATEGORY_CONFIG[cat]?.label || cat }
function getCategoryIcon(cat)  { return CATEGORY_CONFIG[cat]?.icon  || '📌' }
function getCategoryColor(cat) { return CATEGORY_CONFIG[cat]?.color || '#ffffff' }

// 标注按类别分组
const groupedMarkers = computed(() => {
  const groups = {}
  allMarkers.value.forEach(m => {
    const cat = m.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  })
  Object.values(groups).forEach(arr => arr.sort((a, b) => (b.importance || 0) - (a.importance || 0)))
  const ordered = {}
  CATEGORY_ORDER.forEach(cat => { if (groups[cat]) ordered[cat] = groups[cat] })
  Object.keys(groups).forEach(cat => { if (!ordered[cat]) ordered[cat] = groups[cat] })
  return ordered
})

function toggleCategory(cat) {
  if (collapsedCategories.has(cat)) {
    collapsedCategories.delete(cat)
  } else {
    collapsedCategories.add(cat)
  }
}

// ── 场景初始化 ──
async function initScene() {
  if (!canvasRef.value) return
  isLoading.value = true
  try {
    if (jupiterScene) jupiterScene.dispose()

    jupiterScene = new DeepJupiterScene(canvasRef.value)
    await jupiterScene.init({
      quality:            quality.value,
      cloudRotation:      cloudRotation.value,
      cloudRotationSpeed: 0.00015
    })

    allMarkers.value = jupiterScene.getMarkers()
    hasRealTexture.value = jupiterScene.hasTexture()
  } catch (err) {
    console.error('[JupiterEye] 初始化失败:', err)
  } finally {
    isLoading.value = false
  }
}

// ── 事件处理 ──
function onCanvasClick(event) {
  if (!jupiterScene) return
  const clicked = jupiterScene.handleMouseDown(event)
  selectedMarker.value = clicked || null
}

function onMarkerListClick(marker) {
  selectedMarker.value = marker
  if (jupiterScene) jupiterScene.flyToMarker(marker)
}

async function setQuality(val) {
  if (val === quality.value) return
  quality.value = val
  selectedMarker.value = null
  await initScene()
}

function setDisplayMode(val) {
  if (val === displayMode.value) return
  displayMode.value = val
  if (jupiterScene) jupiterScene.updateDisplayMode(val)
}

function updateAtmosphere() {
  if (jupiterScene) jupiterScene.setAtmosphereIntensity(atmosphereIntensity.value)
}

function toggleCloudRotation() {
  cloudRotation.value = !cloudRotation.value
  if (jupiterScene) jupiterScene.setCloudRotation(cloudRotation.value)
}

function toggleLabels() {
  showLabels.value = !showLabels.value
  if (jupiterScene) jupiterScene.setLabelsVisible(showLabels.value)
}

function flyToCurrentMarker() {
  if (jupiterScene && selectedMarker.value) jupiterScene.flyToMarker(selectedMarker.value)
}

function closeDetailPanel() {
  selectedMarker.value = null
  if (jupiterScene) jupiterScene.deselectMarker()
}

// ── 生命周期 ──
onMounted(() => { initScene() })
onUnmounted(() => { if (jupiterScene) jupiterScene.dispose() })
</script>

<style scoped>
/* ── 根容器 ── */
.jupiter-scene {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #060302;
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
  background: rgba(28, 14, 2, 0.88);
  border: 1px solid rgba(255, 179, 71, 0.25);
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
  color: #ffb347;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.marker-count {
  font-size: 11px;
  background: rgba(255, 179, 71, 0.2);
  border-radius: 10px;
  padding: 1px 6px;
  color: #ffb347;
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
  accent-color: #ffb347;
  width: 100%;
}

.control-group span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
}

/* 云层自转行 */
.toggle-group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.toggle-group label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.toggle-btn {
  background: rgba(255, 179, 71, 0.08);
  border: 1px solid rgba(255, 179, 71, 0.25);
  border-radius: 6px;
  padding: 3px 10px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10.5px;
  cursor: pointer;
  transition: all 0.18s;
  letter-spacing: 0.2px;
}

.toggle-btn.active {
  background: rgba(255, 179, 71, 0.18);
  border-color: rgba(255, 179, 71, 0.50);
  color: #ffcc80;
}

/* 普通按钮（显示/隐藏标注） */
.control-group > button:not(.toggle-btn) {
  background: rgba(255, 179, 71, 0.12);
  border: 1px solid rgba(255, 179, 71, 0.30);
  border-radius: 7px;
  padding: 6px 10px;
  color: #ffb347;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  letter-spacing: 0.3px;
}

.control-group > button:not(.toggle-btn):hover {
  background: rgba(255, 179, 71, 0.24);
  border-color: rgba(255, 179, 71, 0.5);
}

/* ── Segmented Control ── */
.seg-control {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 179, 71, 0.18);
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
}

.seg-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
}

.seg-btn.active {
  background: rgba(255, 179, 71, 0.22);
  border-color: rgba(255, 179, 71, 0.55);
  color: #ffcc80;
  font-weight: 600;
  box-shadow: 0 0 8px rgba(255, 179, 71, 0.15);
}

/* ── 纹理状态指示 ── */
.texture-status {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.tex-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tex-dot.real     { background: #6dca6d; box-shadow: 0 0 5px rgba(109,202,109,0.5); }
.tex-dot.fallback { background: #aaa; }

.tex-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.2px;
}

/* ── 资源署名 ── */
.attribution {
  flex-shrink: 0;
  margin-top: 8px;
  padding: 6px 8px;
  border-top: 1px solid rgba(255, 179, 71, 0.12);
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.28);
  line-height: 1.55;
  letter-spacing: 0.1px;
}

/* ── 标注列表区域 ── */
.markers-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 2px;
}

.markers-section::-webkit-scrollbar       { width: 4px; }
.markers-section::-webkit-scrollbar-track { background: transparent; }
.markers-section::-webkit-scrollbar-thumb { background: rgba(255, 179, 71, 0.3); border-radius: 2px; }

.category-group { margin-bottom: 6px; }

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.category-header:hover { background: rgba(255, 255, 255, 0.05); }

.cat-icon   { font-size: 12px; }
.cat-count  { color: rgba(255, 255, 255, 0.4); font-size: 10px; }
.cat-toggle { margin-left: auto; font-size: 10px; color: rgba(255, 255, 255, 0.4); }

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
  background: rgba(255, 179, 71, 0.15);
  border-color: rgba(255, 179, 71, 0.6);
  border-left-color: #ffb347;
  color: #fff;
}

/* ── 右侧详情面板 ── */
.detail-panel {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 320px;
  max-height: calc(100vh - 32px);
  background: rgba(28, 14, 2, 0.92);
  border: 1px solid rgba(255, 179, 71, 0.25);
  border-radius: 14px;
  padding: 16px;
  backdrop-filter: blur(16px);
  color: #fff;
  z-index: 200;
  overflow-y: auto;
}

.detail-panel::-webkit-scrollbar       { width: 4px; }
.detail-panel::-webkit-scrollbar-thumb { background: rgba(255, 179, 71, 0.3); border-radius: 2px; }

.detail-title-row { margin-bottom: 6px; }

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
  color: #ffb347;
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
.close-btn:hover { color: #fff; }

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

.marker-note {
  font-size: 10.5px;
  color: rgba(255, 200, 100, 0.7);
  margin-bottom: 8px;
  line-height: 1.5;
  padding: 6px 8px;
  background: rgba(255, 179, 71, 0.06);
  border-left: 2px solid rgba(255, 179, 71, 0.3);
  border-radius: 0 4px 4px 0;
}

.source {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.actions button {
  width: 100%;
  background: rgba(255, 179, 71, 0.18);
  border: 1px solid rgba(255, 179, 71, 0.4);
  border-radius: 7px;
  padding: 8px 12px;
  color: #ffb347;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.actions button:hover {
  background: rgba(255, 179, 71, 0.3);
}

/* ── 加载指示器 ── */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(6, 3, 2, 0.88);
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
  border: 4px solid rgba(255, 179, 71, 0.3);
  border-top: 4px solid #ffb347;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ── 过渡动画 ── */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from,
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
