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
        <div class="panel-title">☀️ 太阳系全景</div>
        <div class="celestial-list">
          <div v-for="body in celestialBodies" :key="body.key" class="celestial-item" @click="onCelestialClick(body.key)">
            <span class="celestial-icon" :style="{ background: body.color }"></span>
            <span class="celestial-name">{{ body.name }}</span>
            <span class="celestial-tag">{{ body.type }}</span>
          </div>
        </div>
      </div>

      <div class="panel-card probes-card">
        <div class="panel-title">🚀 探测器轨迹</div>
        <div class="panel-desc" style="margin-bottom:6px;font-size:10px;color:rgba(255,255,255,0.4)">轨迹与时间轴联动，圆点表示当前时刻探测器位置</div>
        <div class="probe-scroll">
          <div class="probe-list">
            <div
              v-for="(probe, idx) in probeList"
              :key="probe.key"
              class="probe-item"
              :class="{ active: store.showProbeTrajectories }"
              @click="onProbeClick(probe.key)"
            >
              <span class="probe-dot" :style="{ background: probe.colorHex }"></span>
              <span class="probe-name">{{ probe.name }}</span>
              <span class="probe-agency">{{ probe.agency }}</span>
            </div>
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
  updateLabels, updateProbePositions, PLANET_CONFIG, PROBE_MODELS, PROBE_INFO, loadProbeModel
} from '../three/sceneObjects.js'
import { BodyRaycaster, SelectionHighlight } from '../three/controls.js'
import {
  generateVoyager1Trajectory, generateVoyager2Trajectory,
  generateJunoTrajectory, generateParkerTrajectory,
  generateGalileoTrajectory, generateCassiniTrajectory,
  generateRosettaTrajectory, sampleTrajectoryAt,
  generatePioneerTrajectory, generateACETrajectory,
  generateDeepImpactTrajectory, generateMarsGlobalSurveyorTrajectory
} from '../utils/orbitCalc.js'
import { dateStrToJulian } from '../utils/timeUtils.js'
import { getProbeTrajectory } from '../api/horizonsApi.js'
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
let probeObjects = []         // { line, dot, samples }
let raycaster, highlight

// UI状态
const hoveredName = ref('')
const selectedBodyInfo = ref(null)

// 天体列表（太阳 + 八大行星）
const celestialBodies = computed(() => {
  const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
  const planets = order.map(key => {
    const cfg = PLANET_CONFIG[key]
    return {
      key,
      name: cfg.name,
      type: '行星',
      color: '#' + cfg.color.toString(16).padStart(6, '0')
    }
  })
  return [
    { key: 'sun', name: '太阳', type: '恒星', color: '#FFD700' },
    ...planets
  ]
})

// 探测器配置（与 PROBE_MODELS 保持一致，仅保留有真实模型的探测器）
const probeList = [
  { key: 'voyager1',          name: '旅行者1号',       agency: 'NASA',     colorHex: '#00FFFF' },
  { key: 'voyager2',          name: '旅行者2号',       agency: 'NASA',     colorHex: '#00FF88' },
  { key: 'juno',              name: '朱诺号',          agency: 'NASA',     colorHex: '#FF6B4A' },
  { key: 'parker',            name: '帕克太阳探测器',  agency: 'NASA',     colorHex: '#FFD700' },
  { key: 'galileo',           name: '伽利略号',        agency: 'NASA/ESA', colorHex: '#B983FF' },
  { key: 'cassini',           name: '卡西尼号',        agency: 'NASA/ESA', colorHex: '#88CCFF' },
  { key: 'rosetta',           name: '罗塞塔号',        agency: 'ESA',      colorHex: '#66DDBB' },
  { key: 'pioneer',           name: '先驱者10号',      agency: 'NASA',     colorHex: '#FF9944' },
  { key: 'ace',               name: '先进成分探测器',  agency: 'NASA',     colorHex: '#44FFBB' },
  { key: 'deepImpact',        name: '深度撞击号',      agency: 'NASA',     colorHex: '#FF4488' },
  { key: 'marsGlobalSurveyor',name: '火星全球勘测者',  agency: 'NASA',     colorHex: '#FF6644' },
]

// ──────────────────────────────────────────────────────────
// 初始化场景
// ──────────────────────────────────────────────────────────
function initScene() {
  const result = initThree(canvasRef.value, {
    cameraY: 600, cameraZ: 1200,
    minDistance: 2, maxDistance: 8000
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
async function buildProbeTrajectories() {
  // 清除旧轨迹（含模型 + 标签）
  probeObjects.forEach(obj => {
    if (obj?.line)  { scene.remove(obj.line);  obj.line.geometry.dispose() }
    if (obj?.dot)   { scene.remove(obj.dot);   obj.dot.geometry.dispose() }
    if (obj?.model) { scene.remove(obj.model) }
    if (obj?.label) { scene.remove(obj.label) }
  })
  probeObjects = []

  if (!store.showProbeTrajectories) return

  // 并行加载全部 GLB 模型 + 请求真实轨迹数据（两组 Promise.all 同时进行）
  const [
    models,
    [v1Api, v2Api, junoApi, parkerApi, galileoApi, cassiniApi, rosettaApi,
     pioneerApi, aceApi, deepImpactApi, mgsApi]
  ] = await Promise.all([
    // 同时加载 11 个模型
    Promise.all([
      loadProbeModel(PROBE_MODELS.voyager1),
      loadProbeModel(PROBE_MODELS.voyager2),
      loadProbeModel(PROBE_MODELS.juno),
      loadProbeModel(PROBE_MODELS.parker),
      loadProbeModel(PROBE_MODELS.galileo),
      loadProbeModel(PROBE_MODELS.cassini),
      loadProbeModel(PROBE_MODELS.rosetta),
      loadProbeModel(PROBE_MODELS.pioneer),
      loadProbeModel(PROBE_MODELS.ace),
      loadProbeModel(PROBE_MODELS.deepImpact),
      loadProbeModel(PROBE_MODELS.marsGlobalSurveyor),
    ]),
    // 同时请求 11 条轨迹（通过后端代理 → JPL Horizons）
    Promise.all([
      getProbeTrajectory('voyager1',          '1977-09-05', '2030-01-01'),
      getProbeTrajectory('voyager2',          '1977-08-20', '2030-01-01'),
      getProbeTrajectory('juno',              '2011-08-05', '2026-12-31'),
      getProbeTrajectory('parker',            '2018-08-12', '2026-12-31'),
      getProbeTrajectory('galileo',           '1989-10-18', '2003-12-31'),
      getProbeTrajectory('cassini',           '1997-10-15', '2017-12-31'),
      getProbeTrajectory('rosetta',           '2004-03-02', '2016-12-31'),
      getProbeTrajectory('pioneer',           '1972-03-02', '2003-12-31'),
      getProbeTrajectory('ace',               '1997-08-25', '2030-01-01'),
      getProbeTrajectory('deepImpact',        '2005-01-12', '2013-12-31'),
      getProbeTrajectory('marsGlobalSurveyor','1996-11-07', '2006-12-31'),
    ])
  ])

  const [
    v1Model, v2Model, junoModel, parkerModel, galileoModel, cassiniModel, rosettaModel,
    pioneerModel, aceModel, deepImpactModel, mgsModel
  ] = models

  // 将 API 返回的 {time, x, y, z} 转为带 jd 的采样点；失败则回退到本地近似
  const toSamples = (apiData) => {
    if (!apiData || apiData.length < 2) return null
    return apiData.map(pt => ({
      jd: dateStrToJulian(pt.time),
      x: pt.x, y: pt.y, z: pt.z
    }))
  }

  const v1Points         = toSamples(v1Api)         || generateVoyager1Trajectory()
  const v2Points         = toSamples(v2Api)         || generateVoyager2Trajectory()
  const junoPoints       = toSamples(junoApi)       || generateJunoTrajectory(store.julianDay)
  const parkerPoints     = toSamples(parkerApi)     || generateParkerTrajectory()
  const galileoPoints    = toSamples(galileoApi)    || generateGalileoTrajectory()
  const cassiniPoints    = toSamples(cassiniApi)    || generateCassiniTrajectory()
  const rosettaPoints    = toSamples(rosettaApi)    || generateRosettaTrajectory()
  const pioneerPoints    = toSamples(pioneerApi)    || generatePioneerTrajectory()
  const acePoints        = toSamples(aceApi)        || generateACETrajectory()
  const deepImpactPoints = toSamples(deepImpactApi) || generateDeepImpactTrajectory()
  const mgsPoints        = toSamples(mgsApi)        || generateMarsGlobalSurveyorTrajectory()

  // 创建轨迹，传入预加载模型（加载成功则显示模型，失败则显示彩色小球）+ 探测器 info
  const v1         = createProbeTrajectory(scene, v1Points,         0x00FFFF, 'voyager1',           v1Model,         '旅行者1号',       PROBE_INFO.voyager1)
  const v2         = createProbeTrajectory(scene, v2Points,         0x00FF88, 'voyager2',           v2Model,         '旅行者2号',       PROBE_INFO.voyager2)
  const juno       = createProbeTrajectory(scene, junoPoints,       0xFF6B4A, 'juno',               junoModel,       '朱诺号',          PROBE_INFO.juno)
  const parker     = createProbeTrajectory(scene, parkerPoints,     0xFFD700, 'parker',             parkerModel,     '帕克太阳探测器',   PROBE_INFO.parker)
  const galileo    = createProbeTrajectory(scene, galileoPoints,    0xB983FF, 'galileo',            galileoModel,    '伽利略号',        PROBE_INFO.galileo)
  const cassini    = createProbeTrajectory(scene, cassiniPoints,    0x88CCFF, 'cassini',            cassiniModel,    '卡西尼号',        PROBE_INFO.cassini)
  const rosetta    = createProbeTrajectory(scene, rosettaPoints,    0x66DDBB, 'rosetta',            rosettaModel,    '罗塞塔号',        PROBE_INFO.rosetta)
  const pioneer    = createProbeTrajectory(scene, pioneerPoints,    0xFF9944, 'pioneer',            pioneerModel,    '先驱者10号',      PROBE_INFO.pioneer)
  const ace        = createProbeTrajectory(scene, acePoints,        0x44FFBB, 'ace',                aceModel,        '先进成分探测器',   PROBE_INFO.ace)
  const deepImpact = createProbeTrajectory(scene, deepImpactPoints, 0xFF4488, 'deepImpact',         deepImpactModel, '深度撞击号',      PROBE_INFO.deepImpact)
  const mgs        = createProbeTrajectory(scene, mgsPoints,        0xFF6644, 'marsGlobalSurveyor', mgsModel,        '火星全球勘测者',   PROBE_INFO.marsGlobalSurveyor)

  if (v1)         probeObjects.push(v1)
  if (v2)         probeObjects.push(v2)
  if (juno)       probeObjects.push(juno)
  if (parker)     probeObjects.push(parker)
  if (galileo)    probeObjects.push(galileo)
  if (cassini)    probeObjects.push(cassini)
  if (rosetta)    probeObjects.push(rosetta)
  if (pioneer)    probeObjects.push(pioneer)
  if (ace)        probeObjects.push(ace)
  if (deepImpact) probeObjects.push(deepImpact)
  if (mgs)        probeObjects.push(mgs)

  // 更新射线检测列表（天体 + 探测器 dot/model），使点击探测器也能弹出 InfoPanel
  const sunMesh = Object.values(planetMeshes).length > 0
    ? scene.getObjectByName('太阳')
    : null
  const clickable = [
    sunMesh,
    ...Object.values(planetMeshes)
  ].filter(Boolean)
  // 加入探测器的 dot 和 model（含 userData.info）
  for (const obj of probeObjects) {
    if (obj?.dot)   clickable.push(obj.dot)
    if (obj?.model) clickable.push(obj.model)
  }
  raycaster?.setClickableList(clickable)
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

  // 更新探测器圆点位置（时间联动）
  updateProbePositions(probeObjects, store.julianDay, sampleTrajectoryAt)

  // 更新标签位置
  if (store.showLabels) updateLabels(labels)
  labels.forEach(l => { l.visible = store.showLabels })

  // 轨道线显隐
  Object.values(orbitLines).forEach(l => { if (l) l.visible = store.showOrbits })

  // 行星自转
  Object.values(planetMeshes).forEach(m => {
    if (m) m.rotation.y += 0.003
  })

  // 探测器模型缓慢自转（增加立体感）
  probeObjects.forEach(obj => {
    if (obj?.model) obj.model.rotation.y += 0.004
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
// 左侧面板点击天体 → 聚焦 + 弹出介绍
// ──────────────────────────────────────────────────────────
function onCelestialClick(bodyKey) {
  let info = null
  let mesh = null

  if (bodyKey === 'sun') {
    mesh = scene?.getObjectByName('太阳')
    info = mesh?.userData?.info
  } else {
    mesh = planetMeshes[bodyKey]
    info = mesh?.userData?.info
  }

  if (!info) return

  // 弹出右侧介绍面板
  highlight?.deselect()
  if (mesh) highlight?.select(mesh)
  selectedBodyInfo.value = { ...info, type: mesh?.userData?.type || 'planet' }
  store.setSelectedBody(info)

  // 相机飞行到天体
  onFocusBody(info)
}

// ──────────────────────────────────────────────────────────
// 左侧面板点击探测器 → 聚焦 + 弹出介绍
// ──────────────────────────────────────────────────────────
function onProbeClick(probeKey) {
  const info = PROBE_INFO[probeKey]
  if (!info) return

  // 查找当前场景中的探测器对象
  const obj = probeObjects.find(o =>
    (o?.dot?.name === `probe_dot_${probeKey}`) ||
    (o?.model?.name === `probe_model_${probeKey}`)
  )

  const target = obj?.model || obj?.dot
  if (!target) return

  // 弹出右侧介绍面板
  highlight?.deselect()
  if (obj?.dot) highlight?.select(obj.dot)
  selectedBodyInfo.value = { ...info, type: 'probe' }
  store.setSelectedBody(info)

  // 相机飞行到探测器当前位置
  const bodyPos = target.position.clone()
  const dist = 60

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

/* 天体列表 */
.celestial-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.celestial-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.celestial-item:hover {
  background: rgba(100, 163, 255, 0.1);
}

.celestial-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.celestial-name {
  font-size: 12px;
  color: #ccc;
  flex: 1;
}

.celestial-tag {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
}

/* 探测器滚动容器 */
.probe-scroll {
  max-height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

/* 自定义滚动条 */
.probe-scroll::-webkit-scrollbar { width: 4px; }
.probe-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 2px; }
.probe-scroll::-webkit-scrollbar-thumb { background: rgba(100,163,255,0.35); border-radius: 2px; }
.probe-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,163,255,0.6); }

/* 探测器列表 */
.probe-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.probe-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  opacity: 0.4;
  transition: opacity 0.2s, background 0.2s;
  cursor: pointer;
}
.probe-item:hover {
  background: rgba(100, 163, 255, 0.1);
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

.probe-agency {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-left: auto;
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
