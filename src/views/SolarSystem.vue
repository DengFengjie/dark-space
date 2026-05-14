<template>
  <div class="solar-scene">
    <!-- 统一导航头 -->
    <Header :show-date="true" />

    <!-- 3D渲染容器 -->
    <div ref="canvasRef" class="canvas-container" @click.self="clearSelection" />

    <!-- 悬浮提示（行星名称） -->
    <transition name="fade">
      <div v-if="hoveredName" class="hover-tip">{{ hoveredName }}</div>
    </transition>

    <!-- 天体信息面板 -->
    <InfoPanel
      :body="selectedBodyInfo"
      @close="clearSelection"
      @focus="onFocusBody"
    />

    <!-- 底部时间轴 -->
    <Timeline />

    <!-- 左侧操作面板 -->
    <div class="side-panel">
      <div class="panel-card">
        <div class="panel-title">🌌 太阳系全景</div>
        <div class="panel-desc">基于开普勒轨道方程，实时计算八大行星精确位置。点击天体查看详情，拖动时间轴观察公转。</div>
      </div>

      <div class="panel-card probes-card">
        <div class="panel-title">🚀 探测器轨迹</div>
        <div class="probe-list">
          <div
            v-for="probe in probeList"
            :key="probe.key"
            class="probe-item"
            :class="{ active: store.showProbeTrajectories }"
          >
            <span class="probe-dot" :style="{ background: probe.colorHex }"></span>
            <span class="probe-name">{{ probe.name }}</span>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-title">📡 当前状态</div>
        <div class="status-list">
          <div class="status-row">
            <span class="s-key">模拟时间</span>
            <span class="s-val">{{ store.currentDateStr }}</span>
          </div>
          <div class="status-row">
            <span class="s-key">儒略日</span>
            <span class="s-val">{{ store.julianDay.toFixed(1) }}</span>
          </div>
          <div class="status-row">
            <span class="s-key">播放状态</span>
            <span class="s-val" :class="{ playing: store.isPlaying }">{{ store.isPlaying ? '▶ 播放中' : '⏸ 暂停' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useSpaceStore } from '../stores/useSpaceStore.js'
import { initThree, disposeThree, flyToPosition } from '../three/initThree.js'
import {
  createStarfield, createSun, createPlanet, createOrbitLine,
  updatePlanetPositions, createProbeTrajectory, addPlanetLabel,
  updateLabels, PLANET_CONFIG
} from '../three/sceneObjects.js'
import { BodyRaycaster, SelectionHighlight } from '../three/controls.js'
import { generateVoyager1Trajectory, generateVoyager2Trajectory } from '../utils/orbitCalc.js'
import Header from '../components/Header.vue'
import InfoPanel from '../components/InfoPanel.vue'
import Timeline from '../components/Timeline.vue'
import * as THREE from 'three'

const store = useSpaceStore()
const canvasRef = ref(null)

// 场景对象
let scene, camera, renderer, controls, onResize
let animationId = null

// 场景内容
const planetMeshes = {}       // { key: Mesh }
const orbitLines = {}         // { key: Line }
const labels = []             // Sprite[]
let probeObjects = []         // { tube, dot }
let raycaster, highlight

// UI状态
const hoveredName = ref('')
const selectedBodyInfo = ref(null)

// 探测器配置（用于侧边栏展示）
const probeList = [
  { key: 'v1', name: '旅行者1号', colorHex: '#00FFFF' },
  { key: 'v2', name: '旅行者2号', colorHex: '#00FF88' }
]

// ──────────────────────────────────────────────────────────
// 初始化场景
// ──────────────────────────────────────────────────────────
function initScene() {
  const result = initThree(canvasRef.value, {
    cameraY: 110, cameraZ: 260,
    minDistance: 2, maxDistance: 3000
  })
  scene = result.scene
  camera = result.camera
  renderer = result.renderer
  controls = result.controls
  onResize = result.onResize

  // 星空
  createStarfield(scene)

  // 太阳
  const { mesh: sunMesh } = createSun(scene)

  // 行星 + 轨道 + 标签
  const jd = store.julianDay
  Object.keys(PLANET_CONFIG).forEach(key => {
    orbitLines[key] = createOrbitLine(scene, key, jd)
    planetMeshes[key] = createPlanet(scene, key, jd)
    const lbl = addPlanetLabel(scene, planetMeshes[key])
    labels.push(lbl)
  })

  // 探测器轨迹
  buildProbeTrajectories()

  // 射线检测
  const clickable = [sunMesh, ...Object.values(planetMeshes)]
  raycaster = new BodyRaycaster(camera, renderer.domElement, clickable)
  highlight = new SelectionHighlight()

  raycaster.onBodyClick((body) => {
    highlight.select(body)
    selectedBodyInfo.value = body.userData.info
    store.setSelectedBody(body.userData.info)
  })

  raycaster.onBodyHover((body) => {
    hoveredName.value = body ? body.name : ''
  })
}

// ──────────────────────────────────────────────────────────
// 探测器轨迹
// ──────────────────────────────────────────────────────────
function buildProbeTrajectories() {
  // 清除旧轨迹
  probeObjects.forEach(obj => {
    if (obj?.tube) { scene.remove(obj.tube); obj.tube.geometry.dispose() }
    if (obj?.dot) { scene.remove(obj.dot); obj.dot.geometry.dispose() }
  })
  probeObjects = []

  if (!store.showProbeTrajectories) return

  const v1Points = generateVoyager1Trajectory()
  const v2Points = generateVoyager2Trajectory()

  const v1 = createProbeTrajectory(scene, v1Points, 0x00FFFF, 'voyager1')
  const v2 = createProbeTrajectory(scene, v2Points, 0x00FF88, 'voyager2')

  if (v1) probeObjects.push(v1)
  if (v2) probeObjects.push(v2)
}

// ──────────────────────────────────────────────────────────
// 动画循环
// ──────────────────────────────────────────────────────────
let lastTime = 0
function animate(timestamp) {
  animationId = requestAnimationFrame(animate)
  const delta = (timestamp - lastTime) / 1000
  lastTime = timestamp

  // 推进模拟时间
  store.advanceTime()

  // 更新行星位置（时间推进时）
  updatePlanetPositions(planetMeshes, store.julianDay)

  // 更新标签位置
  if (store.showLabels) updateLabels(labels)
  labels.forEach(l => { l.visible = store.showLabels })

  // 轨道线显隐
  Object.values(orbitLines).forEach(l => { if (l) l.visible = store.showOrbits })

  // 行星自转
  Object.values(planetMeshes).forEach(m => {
    if (m) m.rotation.y += 0.003
  })

  controls.update()
  renderer.render(scene, camera)
}

// ──────────────────────────────────────────────────────────
// 清除选中
// ──────────────────────────────────────────────────────────
function clearSelection() {
  highlight?.deselect()
  selectedBodyInfo.value = null
  store.clearSelectedBody()
}

// ──────────────────────────────────────────────────────────
// 聚焦某天体
// ──────────────────────────────────────────────────────────
function onFocusBody(info) {
  const key = Object.keys(PLANET_CONFIG).find(k =>
    PLANET_CONFIG[k].name === info.name || PLANET_CONFIG[k].nameEn === info.nameEn
  )
  const mesh = key ? planetMeshes[key] : null
  if (!mesh) return

  const bodyPos = mesh.position.clone()
  const cfg = PLANET_CONFIG[key]
  const r = cfg?.radius || 5
  const dist = r * 8 + 20

  const camPos = new THREE.Vector3(
    bodyPos.x + dist * 0.5,
    bodyPos.y + dist * 0.4,
    bodyPos.z + dist
  )

  flyToPosition(camera, controls, camPos, bodyPos, 1400)
}

// ──────────────────────────────────────────────────────────
// 监听 store 变化
// ──────────────────────────────────────────────────────────
watch(() => store.showProbeTrajectories, () => buildProbeTrajectories())

// ──────────────────────────────────────────────────────────
// 生命周期
// ──────────────────────────────────────────────────────────
onMounted(() => {
  initScene()
  animate(0)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  raycaster?.dispose()
  disposeThree(scene, renderer, onResize)
})
</script>

<style scoped>
.solar-scene {
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
}

/* 悬浮提示 */
.hover-tip {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 8, 30, 0.85);
  border: 1px solid rgba(100, 163, 255, 0.4);
  border-radius: 20px;
  padding: 6px 18px;
  color: #64a3ff;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  z-index: 150;
  backdrop-filter: blur(8px);
}

/* 左侧面板 */
.side-panel {
  position: absolute;
  left: 20px;
  top: 76px;
  width: 240px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-card {
  background: rgba(0, 8, 28, 0.85);
  border: 1px solid rgba(100, 163, 255, 0.25);
  border-radius: 14px;
  padding: 14px 16px;
  backdrop-filter: blur(16px);
  color: #fff;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #64a3ff;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.panel-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.6;
}

/* 探测器列表 */
.probe-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.probe-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  opacity: 0.4;
  transition: opacity 0.2s;
}

.probe-item.active {
  opacity: 1;
}

.probe-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.probe-name {
  font-size: 12px;
  color: #ccc;
}

/* 状态列表 */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.s-key { color: rgba(255, 255, 255, 0.45); }
.s-val { color: #ddd; font-family: monospace; font-size: 11px; }
.s-val.playing { color: #4fc3f7; }

/* 淡入淡出 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .side-panel { display: none; }
}
</style>
