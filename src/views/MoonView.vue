<template>
  <div class="scene-page">
    <Header :show-date="true" />

    <!-- 左侧信息面板 -->
    <div class="side-panel">
      <div class="info-card">
        <div class="card-title">🌙 月球基础数据</div>
        <div class="stats">
          <div class="stat-item"><span class="label">直径</span><span class="value">3,474公里</span></div>
          <div class="stat-item"><span class="label">距地球</span><span class="value">38.4万公里</span></div>
          <div class="stat-item"><span class="label">公转周期</span><span class="value">27.3地球日</span></div>
          <div class="stat-item"><span class="label">自转周期</span><span class="value">27.3天（潮汐锁定）</span></div>
          <div class="stat-item"><span class="label">表面温度</span><span class="value">-173°C ~ 127°C</span></div>
          <div class="stat-item"><span class="label">重力</span><span class="value">地球的1/6（1.62 m/s²）</span></div>
          <div class="stat-item"><span class="label">逃逸速度</span><span class="value">2.38 km/s</span></div>
          <div class="stat-item"><span class="label">磁场</span><span class="value">极微弱（铁质内核已冷却）</span></div>
        </div>
      </div>

      <div class="info-card timeline-card">
        <div class="card-title">🚀 探测历史</div>
        <div class="timeline">
          <div class="tl-item" v-for="event in explorationEvents" :key="event.year + event.name">
            <span class="tl-year">{{ event.year }}</span>
            <span class="tl-dot"></span>
            <div class="tl-content">
              <span class="tl-name">{{ event.name }}</span>
              <span class="tl-desc">{{ event.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <InfoPanel :body="selectedProbeInfo" @close="clearSelection" @focus="onFocusProbe" />

    <transition name="fade">
      <div v-if="hoveredName" class="hover-tip">{{ hoveredName }}</div>
    </transition>

    <!-- 右下角月相观测面板 -->
    <div class="moon-phase-panel">
      <canvas ref="moonPhaseCanvas" width="120" height="120"></canvas>
      <div class="phase-info">
        <span class="phase-name">{{ moonPhaseName }}</span>
        <span class="phase-progress">{{ moonPhaseProgress }}%</span>
      </div>
    </div>

    <div class="probe-bar">
      <div class="probe-list">
        <div v-for="probe in probes" :key="probe.key" class="probe-item" :class="{ active: visibleProbes[probe.key] }" @click="toggleProbe(probe.key)">
          <span class="probe-dot" :style="{ background: probe.color }"></span>
          <span class="probe-name">{{ probe.name }}</span>
        </div>
      </div>
    </div>

    <div class="controls">
      <button @click="toggleOrbits" class="control-btn">{{ showOrbits ? '隐藏' : '显示' }}轨道</button>
      <button @click="toggleRotation" class="control-btn">{{ isRotating ? '暂停' : '恢复' }}旋转</button>
      <button @click="resetCamera" class="control-btn">重置视角</button>
    </div>

    <div ref="canvasContainer" class="canvas-container"></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Header from '../components/Header.vue'
import InfoPanel from '../components/InfoPanel.vue'

const canvasContainer = ref(null)
const moonPhaseCanvas = ref(null)
const showOrbits = ref(true)
const isRotating = ref(true)
const hoveredName = ref('')
const selectedProbeInfo = ref(null)
const moonPhaseName = ref('新月')
const moonPhaseProgress = ref(0)

let scene, camera, renderer, controls, animationId
let moonMesh, earthMesh, moonOrbitLine
let earthRotation = 0
let dirLight, sunMesh
let moonProbeGroup

const MOON_ORBIT_RADIUS = 20
const SUN_DISTANCE = 60

let probeObjects = []
const probes = [
  { key: 'lro',      name: 'LRO 勘测轨道器',    color: '#00FFFF', orbitRadius: 2.0, orbitSpeed: 0.0042, orbitInclination: Math.PI / 2 },
  { key: 'change5',  name: '嫦娥五号',           color: '#FF4444', orbitRadius: 2.4, orbitSpeed: 0.0032, orbitInclination: Math.PI / 2.2 },
  { key: 'change6',  name: '嫦娥六号',           color: '#FF6644', orbitRadius: 2.2, orbitSpeed: 0.0037, orbitInclination: Math.PI / 1.8 },
  { key: 'queqiao',  name: '鹊桥中继星',        color: '#FF88AA', orbitRadius: 5.0, orbitSpeed: 0.0016, orbitInclination: Math.PI / 3, eccentricity: 0.55 },
  { key: 'apollo11', name: '阿波罗11号',         color: '#FFD700', orbitRadius: 2.1, orbitSpeed: 0.0037, orbitInclination: Math.PI / 2 },
  { key: 'capstone', name: 'CAPSTONE',           color: '#BB88FF', orbitRadius: 6.0, orbitSpeed: 0.0013, orbitInclination: Math.PI / 4, eccentricity: 0.6 },
  { key: 'luna1',    name: '月球1号（苏联）',    color: '#88FFAA', orbitRadius: 0,    orbitSpeed: 0.0008, orbitInclination: 0,          flyby: true },
]
const visibleProbes = reactive(Object.fromEntries(probes.map(p => [p.key, true])))

const explorationEvents = [
  { year: 1959, name: '月球1号', desc: '苏联·首个飞越月球的探测器' },
  { year: 1959, name: '月球3号', desc: '苏联·首次拍摄月球背面' },
  { year: 1966, name: '勘测者1号', desc: '美国·首次软着陆月球' },
  { year: 1969, name: '阿波罗11号', desc: '美国·人类首次登月' },
  { year: 1972, name: '阿波罗17号', desc: '美国·末次载人登月' },
  { year: 2009, name: 'LRO', desc: '美国·高精度月球测绘' },
  { year: 2013, name: '嫦娥三号', desc: '中国·玉兔月球车着陆' },
  { year: 2019, name: '嫦娥四号', desc: '中国·首次月背着陆' },
  { year: 2020, name: '嫦娥五号', desc: '中国·首次月球取样返回' },
  { year: 2022, name: 'CAPSTONE', desc: '美国·验证NRHO轨道' },
  { year: 2024, name: '嫦娥六号', desc: '中国·首次月背取样返回' },
]

const PHASE_NAMES = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月']
const PHASE_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

const toggleOrbits = () => {
  showOrbits.value = !showOrbits.value
  if (moonOrbitLine) moonOrbitLine.visible = showOrbits.value
  probeObjects.forEach(obj => {
    if (obj.orbitLine) obj.orbitLine.visible = showOrbits.value && visibleProbes[obj.key]
  })
}
const toggleRotation = () => { isRotating.value = !isRotating.value }

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.set(0, 10, 30)
  controls.target.set(-12, 0, 0)
  controls.update()
}

const toggleProbe = (key) => {
  visibleProbes[key] = !visibleProbes[key]
  probeObjects.forEach(obj => {
    if (obj.key === key) {
      const show = visibleProbes[key] && showOrbits.value
      if (obj.orbitLine) obj.orbitLine.visible = show
      if (obj.dot) obj.dot.visible = visibleProbes[key]
    }
  })
}
const clearSelection = () => { selectedProbeInfo.value = null }
const onFocusProbe = (info) => {
  const match = probeObjects.find(o => o.info?.name === info.name)
  if (!match?.dot || !controls || !camera) return
  const pos = match.dot.getWorldPosition(new THREE.Vector3())
  controls.target.copy(pos)
  camera.position.lerp(new THREE.Vector3(pos.x + 5, pos.y + 3, pos.z + 5), 0.6)
  controls.update()
}

// ── 实时月相计算 ──
function computeMoonPhase(rotation) {
  // 将公转角度规一化到 [0, 2π)
  let angle = rotation % (Math.PI * 2)
  if (angle < 0) angle += Math.PI * 2
  // 当 earthRotation=0 时月球在 x 最大处（近光源），此时为新月
  // 阶段 0 = 新月, 阶段 4 = 满月
  const phaseIdx = Math.round((angle / (Math.PI * 2)) * 8) % 8
  moonPhaseName.value = PHASE_NAMES[phaseIdx]
  moonPhaseProgress.value = Math.round((angle / (Math.PI * 2)) * 100)
}

// ── 绘制右下角月相 Canvas ──
function drawMoonPhase(rotation) {
  const canvas = moonPhaseCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const cx = 60, cy = 60, r = 48
  ctx.clearRect(0, 0, 120, 120)

  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0)'

  // 月球轮廓圆
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()
  ctx.strokeStyle = 'rgba(100,163,255,0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 将公转角度映射到月相（0→新月，π→满月：月球在光源同侧时从地球看到暗面）
  // 月球位置 x = -12 + 20*cos(rotation)，光源在 x≈60 右侧
  // rotation=0 → moon x=8（近光源）→ 暗面朝地球 → 新月
  // rotation=π → moon x=-32（远离光源）→ 亮面朝地球 → 满月
  let phase = rotation % (Math.PI * 2)
  if (phase < 0) phase += Math.PI * 2

  const cosA = Math.cos(phase)

  // 绘制亮面
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#e8e0c8'
  ctx.fill()

  // 明暗分界（terminator）
  // 用椭圆遮罩模拟：cosA > 0 时亮面在右边（盈），< 0 时在左边（亏）
  const termX = cx + cosA * r

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2)
  ctx.clip()

  // 暗面
  const darkWidth = Math.abs(cosA) * r * 2
  if (Math.abs(cosA) > 0.02) {
    const darkStart = cosA > 0 ? termX : termX - darkWidth
    ctx.fillStyle = '#1a1a2e'
    ctx.beginPath()
    ctx.ellipse(termX, cy, r * 1.02, r * 1.02, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  // 重新描边
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(100,163,255,0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

const textureLoader = new THREE.TextureLoader()
function loadTexture(path) {
  return new Promise(resolve => {
    textureLoader.load(path,
      tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex) },
      undefined,
      () => { console.warn(`纹理加载失败: ${path}`); resolve(null) }
    )
  })
}

function generateOrbitPoints(orbitRadius, inclination, eccentricity = 0, segments = 200) {
  const pts = []
  const a = orbitRadius
  const b = eccentricity > 0 ? a * Math.sqrt(1 - eccentricity * eccentricity) : a
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * a
    const z = Math.sin(angle) * b
    const v = new THREE.Vector3(x, 0, z)
    v.applyAxisAngle(new THREE.Vector3(1, 0, 0), inclination - Math.PI / 2)
    pts.push(v)
  }
  return pts
}

function computeDotPosition(angle, orbitRadius, inclination, eccentricity = 0) {
  const a = orbitRadius
  const b = eccentricity > 0 ? a * Math.sqrt(1 - eccentricity * eccentricity) : a
  const v = new THREE.Vector3(Math.cos(angle) * a, 0, Math.sin(angle) * b)
  v.applyAxisAngle(new THREE.Vector3(1, 0, 0), inclination - Math.PI / 2)
  return v
}

function createDashedLine(points, color, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.6, gapSize: 0.35 })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

async function initScene() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000008)
  canvasContainer.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 3
  controls.maxDistance = 120

  createStarfield()

  const [moonTex, earthTex] = await Promise.all([
    loadTexture('/textures/moon_diffuse.jpg'),
    loadTexture('/textures/earth_diffuse.jpg'),
  ])

  // 光源（在太阳位置）
  dirLight = new THREE.DirectionalLight(0xFFFFFF, 2.5)
  dirLight.position.set(SUN_DISTANCE, 5, 0)
  scene.add(dirLight)
  scene.add(new THREE.AmbientLight(0x333344))

  // 远景太阳（发光小球）
  const sunGeo = new THREE.SphereGeometry(2, 32, 32)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFDD88 })
  sunMesh = new THREE.Mesh(sunGeo, sunMat)
  sunMesh.position.set(SUN_DISTANCE, 5, 0)
  sunMesh.name = '太阳'
  sunMesh.userData = { info: { name: '太阳', nameEn: 'Sun', type: 'star', description: '太阳系中心恒星', stats: { '类型': '主序星' } } }
  scene.add(sunMesh)
  createLabel(sunMesh, '☀️ 太阳', 3)

  // ─── 地球 ───
  const earthGeo = new THREE.SphereGeometry(4, 64, 64)
  const earthMat = new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x333333, shininess: 25 })
  earthMesh = new THREE.Mesh(earthGeo, earthMat)
  earthMesh.position.set(-12, 0, 0)
  earthMesh.name = '地球'
  scene.add(earthMesh)

  const atmoGeo = new THREE.SphereGeometry(4.15, 48, 48)
  earthMesh.add(new THREE.Mesh(atmoGeo, new THREE.MeshPhongMaterial({ color: 0x4488cc, transparent: true, opacity: 0.18, depthWrite: false })))

  // ─── 月球 ───
  const moonGeo = new THREE.SphereGeometry(1.1, 64, 64)
  const moonMat = new THREE.MeshPhongMaterial({ map: moonTex, specular: 0x111111, shininess: 5 })
  moonMesh = new THREE.Mesh(moonGeo, moonMat)
  moonMesh.position.set(-12 + MOON_ORBIT_RADIUS, 0, 0)
  moonMesh.name = '月球'
  scene.add(moonMesh)

  // 月球绕地球轨道
  const moonOrbitPts = []
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2
    moonOrbitPts.push(new THREE.Vector3(-12 + Math.cos(a) * MOON_ORBIT_RADIUS, 0, Math.sin(a) * MOON_ORBIT_RADIUS))
  }
  moonOrbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(moonOrbitPts), new THREE.LineBasicMaterial({ color: 0x556688, transparent: true, opacity: 0.4 }))
  scene.add(moonOrbitLine)

  createLabel(earthMesh, '🌍 地球', 5.5)
  createLabel(moonMesh, '🌙 月球', 2)

  moonProbeGroup = new THREE.Group()
  moonProbeGroup.position.copy(moonMesh.position)
  scene.add(moonProbeGroup)

  probes.forEach(p => createProbe(p))
  setupRaycaster()

  // 初始月相
  drawMoonPhase(earthRotation)
  computeMoonPhase(earthRotation)

  resetCamera()
}

function createStarfield() {
  const geo = new THREE.BufferGeometry()
  const count = 3000
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 800 + Math.random() * 700
    pos[i * 3] = r * Math.sin(p) * Math.cos(t)
    pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t)
    pos[i * 3 + 2] = r * Math.cos(p)
    const w = Math.random()
    col[i * 3] = 0.85 + w * 0.15; col[i * 3 + 1] = 0.88 + w * 0.06; col[i * 3 + 2] = 0.95 - w * 0.2
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.8, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.8 })))
}

function createLabel(mesh, text, yOffset) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Microsoft YaHei, sans-serif'; ctx.textAlign = 'center'
  ctx.fillText(text, 128, 38)
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  sprite.scale.set(6, 1.5, 1); sprite.position.set(0, yOffset, 0)
  mesh.add(sprite)
}

function createProbe(config) {
  const colorHex = new THREE.Color(config.color).getHex()
  const parent = config.flyby ? scene : moonProbeGroup
  const inc = config.orbitInclination
  const ecc = config.eccentricity || 0

  let orbitLine
  if (config.flyby) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-25, 2, -3), new THREE.Vector3(-6, 3, 8), new THREE.Vector3(15, -1, -10)
    )
    orbitLine = createDashedLine(curve.getPoints(200), colorHex, 0.5)
    scene.add(orbitLine)
  } else {
    const pts = generateOrbitPoints(config.orbitRadius, inc, ecc, 200)
    orbitLine = createDashedLine(pts, colorHex, 0.35)
    parent.add(orbitLine)
  }

  const dotGeo = new THREE.SphereGeometry(0.22, 16, 16)
  const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: colorHex }))
  if (config.flyby) {
    dot.position.set(-25, 2, -3)
  } else {
    dot.position.copy(computeDotPosition(Math.random() * Math.PI * 2, config.orbitRadius, inc, ecc))
  }
  dot.name = `probe_${config.key}`
  dot.userData = {
    info: {
      name: config.name, nameEn: config.key, type: 'probe',
      description: getProbeDesc(config.key), stats: getProbeStats(config.key)
    }
  }
  parent.add(dot)

  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const ctx = c.getContext('2d'); ctx.fillStyle = config.color; ctx.font = 'bold 20px Microsoft YaHei, sans-serif'; ctx.textAlign = 'center'
  ctx.fillText(config.name, 128, 38)
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  label.scale.set(4, 1, 1); label.position.set(0, 0.5, 0)
  dot.add(label)

  probeObjects.push({ key: config.key, config, orbitLine, dot, angle: Math.random() * Math.PI * 2, info: dot.userData.info })
}

function getProbeDesc(key) {
  const d = {
    lro: 'NASA于2009年发射的月球勘测轨道飞行器，对月球表面进行高分辨率三维测绘，为未来登陆选址提供关键数据。目前仍在轨运行。',
    change5: '中国嫦娥五号探测器，2020年成功从月球正面风暴洋区域采集约1.73公斤月壤样品返回地球，是中国首次地外天体采样返回。',
    change6: '中国嫦娥六号探测器，2024年实现人类首次月球背面采样返回，从南极-艾特肯盆地采集样品。',
    queqiao: '嫦娥四号中继通信卫星鹊桥，位于地月L2拉格朗日点晕轨道，为月背着陆器提供通信中继。',
    apollo11: '1969年NASA阿波罗11号任务，阿姆斯特朗和奥尔德林成为首批踏上月球表面的人类。"个人一小步,人类一大步。"',
    capstone: 'NASA于2022年发射的小型探测器，验证近直线晕轨道（NRHO）的稳定性，为未来月球门户空间站（Gateway）做准备。',
    luna1: '苏联于1959年发射的月球1号探测器，是人类首个飞越月球的航天器（因偏航未能撞击月球，最终进入日心轨道）。',
  }
  return d[key] || '正在探索月球奥秘的探测器。'
}

function getProbeStats(key) {
  const s = {
    lro:      { '发射时间': '2009-06-18', '发射机构': 'NASA / GSFC', '任务状态': '轨道运行中', '轨道高度': '约 50 km', '主要成就': '高精度月球三维地图' },
    change5:  { '发射时间': '2020-11-23', '发射机构': 'CNSA', '任务状态': '已完成（返回）', '着陆点': '风暴洋', '取样质量': '1.73 kg' },
    change6:  { '发射时间': '2024-05-03', '发射机构': 'CNSA', '任务状态': '已完成（返回）', '着陆点': '南极-艾特肯盆地', '成就': '首次月背取样' },
    queqiao:  { '发射时间': '2018-05-20', '发射机构': 'CNSA', '任务状态': 'L2晕轨道运行中', '位置': '地月L2点', '作用': '月背通信中继' },
    apollo11: { '发射时间': '1969-07-16', '发射机构': 'NASA', '登月时间': '1969-07-20', '宇航员': '阿姆斯特朗、奥尔德林', '历史意义': '人类首次载人登月' },
    capstone: { '发射时间': '2022-06-28', '发射机构': 'NASA / Advanced Space', '任务状态': 'NRHO轨道运行中', '轨道类型': '近直线晕轨道', '目的': '验证Gateway轨道' },
    luna1:    { '发射时间': '1959-01-02', '发射机构': '苏联', '任务状态': '日心轨道', '历史地位': '首个飞越月球的航天器', '成就': '首次测量太阳风' },
  }
  return s[key] || {}
}

function setupRaycaster() {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  renderer.domElement.addEventListener('click', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const targets = [earthMesh, moonMesh, sunMesh]
    probeObjects.forEach(o => { if (o.dot) targets.push(o.dot) })
    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj) {
        if (obj.userData?.info) { selectedProbeInfo.value = obj.userData.info; return }
        obj = obj.parent
      }
    }
    selectedProbeInfo.value = null
  })
  renderer.domElement.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const targets = [earthMesh, moonMesh, sunMesh]
    probeObjects.forEach(o => { if (o.dot) targets.push(o.dot) })
    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj) {
        if (obj.name && obj.name !== '') { hoveredName.value = obj.name; renderer.domElement.style.cursor = 'pointer'; return }
        obj = obj.parent
      }
    }
    hoveredName.value = ''; renderer.domElement.style.cursor = ''
  })
}

function animate() {
  animationId = requestAnimationFrame(animate)
  if (isRotating.value) {
    earthRotation += 0.00016
    moonMesh.position.x = -12 + Math.cos(earthRotation) * MOON_ORBIT_RADIUS
    moonMesh.position.z = Math.sin(earthRotation) * MOON_ORBIT_RADIUS

    earthMesh.rotation.y += 0.00025
    moonMesh.rotation.y += 0.00016

    if (moonProbeGroup) moonProbeGroup.position.copy(moonMesh.position)

    probeObjects.forEach(obj => {
      if (!visibleProbes[obj.key]) return
      const cfg = obj.config
      obj.angle += cfg.orbitSpeed
      if (cfg.flyby) {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-25, 2, -3), new THREE.Vector3(-6, 3, 8), new THREE.Vector3(15, -1, -10)
        )
        const t = (obj.angle % (Math.PI * 6)) / (Math.PI * 6)
        obj.dot.position.copy(curve.getPointAt(t))
      } else {
        obj.dot.position.copy(computeDotPosition(obj.angle, cfg.orbitRadius, cfg.orbitInclination, cfg.eccentricity || 0))
      }
    })

    // 每 N 帧更新月相面板（降低更新频率）
    computeMoonPhase(earthRotation)
    if (Math.floor(earthRotation * 400) !== Math.floor((earthRotation - 0.00016) * 400)) {
      drawMoonPhase(earthRotation)
    }
  }
  controls.update()
  renderer.render(scene, camera)
}

onMounted(async () => {
  await initScene()
  animate()
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) renderer.dispose()
  if (controls) controls.dispose()
})
</script>

<style scoped>
.scene-page { width: 100vw; height: 100vh; position: relative; overflow: hidden; background: #000008; }

.side-panel {
  position: absolute; left: 16px; top: 76px; z-index: 100; width: 280px;
  max-height: calc(100vh - 160px); overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
}
.side-panel::-webkit-scrollbar { width: 3px; }
.side-panel::-webkit-scrollbar-track { background: transparent; }
.side-panel::-webkit-scrollbar-thumb { background: rgba(100, 163, 255, 0.3); border-radius: 2px; }

.info-card {
  background: rgba(0, 10, 30, 0.85); border: 1px solid rgba(100, 150, 255, 0.25);
  border-radius: 14px; padding: 14px 16px; backdrop-filter: blur(15px); box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}
.card-title { color: #64a3ff; font-size: 14px; font-weight: 700; margin-bottom: 10px; letter-spacing: 0.5px; }

.stats { display: flex; flex-direction: column; gap: 5px; }
.stat-item {
  display: flex; justify-content: space-between; align-items: center; padding: 5px 8px;
  background: rgba(255, 255, 255, 0.04); border-radius: 6px; border-left: 2px solid rgba(100, 150, 255, 0.35);
}
.stat-item .label { color: #888; font-size: 11px; flex-shrink: 0; }
.stat-item .value { color: #e8f0ff; font-size: 11px; font-weight: 500; text-align: right; margin-left: 6px; }

.timeline-card { max-height: 340px; overflow-y: auto; }
.timeline-card::-webkit-scrollbar { width: 3px; }
.timeline-card::-webkit-scrollbar-track { background: transparent; }
.timeline-card::-webkit-scrollbar-thumb { background: rgba(100, 163, 255, 0.3); border-radius: 2px; }

.timeline { display: flex; flex-direction: column; padding-left: 12px; border-left: 1px solid rgba(100, 163, 255, 0.25); }
.tl-item { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; position: relative; }
.tl-year { font-size: 11px; font-weight: bold; color: #FFD700; min-width: 34px; font-family: monospace; flex-shrink: 0; }
.tl-dot { width: 6px; height: 6px; border-radius: 50%; background: #64a3ff; flex-shrink: 0; margin-left: -16px; margin-top: 5px; }
.tl-content { display: flex; flex-direction: column; gap: 2px; }
.tl-name { font-size: 11px; color: #ddd; font-weight: 500; }
.tl-desc { font-size: 10px; color: #777; }

.hover-tip {
  position: absolute; top: 74px; left: 50%; transform: translateX(-50%);
  background: rgba(0, 8, 30, 0.85); border: 1px solid rgba(100, 163, 255, 0.4);
  border-radius: 20px; padding: 6px 18px; color: #64a3ff; font-size: 13px; font-weight: 600;
  pointer-events: none; z-index: 150; backdrop-filter: blur(8px);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 右下角月相面板 */
.moon-phase-panel {
  position: absolute;
  right: 20px;
  bottom: 60px;
  z-index: 110;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(0, 10, 30, 0.85);
  border: 1px solid rgba(100, 150, 255, 0.25);
  border-radius: 16px;
  padding: 12px 16px;
  backdrop-filter: blur(14px);
}
.moon-phase-panel canvas {
  display: block;
}
.phase-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.phase-name {
  color: #FFD700;
  font-size: 13px;
  font-weight: 600;
}
.phase-progress {
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  font-family: monospace;
}

.probe-bar {
  position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 100;
  background: rgba(0, 10, 30, 0.85); border: 1px solid rgba(100, 150, 255, 0.2);
  border-radius: 28px; padding: 6px 16px; backdrop-filter: blur(14px);
}
.probe-list { display: flex; gap: 6px; }
.probe-item {
  display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 16px;
  cursor: pointer; transition: all 0.25s ease; opacity: 0.45; border: 1px solid transparent;
}
.probe-item:hover { opacity: 0.8; background: rgba(255, 255, 255, 0.05); }
.probe-item.active { opacity: 1; border-color: rgba(100, 163, 255, 0.3); background: rgba(100, 163, 255, 0.08); }
.probe-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.probe-name { font-size: 11px; color: #ccc; white-space: nowrap; }

.controls { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 100; display: flex; gap: 10px; }
.control-btn {
  background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff; padding: 10px 22px; border-radius: 22px; cursor: pointer;
  transition: all 0.3s ease; font-size: 13px; backdrop-filter: blur(10px);
}
.control-btn:hover {
  background: rgba(255, 255, 255, 0.15); border-color: rgba(100, 150, 255, 0.5);
  transform: translateY(-2px); box-shadow: 0 5px 15px rgba(100, 150, 255, 0.25);
}

.canvas-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }

@media (max-width: 768px) {
  .side-panel { display: none; }
  .moon-phase-panel { right: 8px; bottom: 100px; padding: 8px; }
  .probe-bar { bottom: 60px; padding: 4px 8px; }
  .probe-list { gap: 2px; }
  .probe-item { padding: 4px 6px; }
  .probe-name { font-size: 10px; }
}
</style>