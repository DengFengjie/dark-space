<template>
  <div class="scene-page">
    <Header :show-date="true" />

    <!-- 左侧信息面板 -->
    <div class="side-panel">
      <div class="info-card">
        <div class="card-title">🔴 火星基础数据</div>
        <div class="stats">
          <div class="stat-item"><span class="label">直径</span><span class="value">6,779 公里</span></div>
          <div class="stat-item"><span class="label">距太阳</span><span class="value">2.28 亿公里（1.52 AU）</span></div>
          <div class="stat-item"><span class="label">公转周期</span><span class="value">687 地球日</span></div>
          <div class="stat-item"><span class="label">自转周期</span><span class="value">24 小时 37 分</span></div>
          <div class="stat-item"><span class="label">表面温度</span><span class="value">-125°C ~ 20°C</span></div>
          <div class="stat-item"><span class="label">重力</span><span class="value">地球的 38%（3.72 m/s²）</span></div>
          <div class="stat-item"><span class="label">大气成分</span><span class="value">95.3% CO₂</span></div>
          <div class="stat-item"><span class="label">逃逸速度</span><span class="value">5.03 km/s</span></div>
          <div class="stat-item"><span class="label">磁场</span><span class="value">极微弱（无全球磁场）</span></div>
          <div class="stat-item"><span class="label">卫星数量</span><span class="value">2 颗（火卫一、火卫二）</span></div>
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

    <!-- 右侧点击详情面板 -->
    <InfoPanel :body="selectedBodyInfo" @close="clearSelection" @focus="onFocusBody" />

    <!-- 悬停提示 -->
    <transition name="fade">
      <div v-if="hoveredName" class="hover-tip">{{ hoveredName }}</div>
    </transition>

    <!-- 探测器切换栏 -->
    <div class="probe-bar">
      <div class="probe-list">
        <div
          v-for="probe in probes"
          :key="probe.key"
          class="probe-item"
          :class="{ active: visibleProbes[probe.key] }"
          @click="toggleProbe(probe.key)"
        >
          <span class="probe-dot" :style="{ background: probe.color }"></span>
          <span class="probe-name">{{ probe.name }}</span>
        </div>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="controls">
      <button @click="toggleOrbits" class="control-btn">{{ showOrbits ? '隐藏' : '显示' }}轨道</button>
      <button @click="toggleRotation" class="control-btn">{{ isRotating ? '暂停' : '恢复' }}运行</button>
      <button @click="resetCamera" class="control-btn">重置视角</button>
      <div class="speed-control">
        <span class="speed-label">速度</span>
        <select v-model="animSpeed" class="speed-select">
          <option :value="0.25">0.25×</option>
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="5">5×</option>
          <option :value="10">10×</option>
        </select>
      </div>
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
const showOrbits = ref(true)
const isRotating = ref(true)
const hoveredName = ref('')
const selectedBodyInfo = ref(null)
const animSpeed = ref(1)

let scene, camera, renderer, controls, animationId
let marsMesh, sunMesh, dirLight
let probeObjects = []
let moonObjects = [] // 火卫一、火卫二
let orbitLines = []
let marsRotation = 0

const MARS_RADIUS = 3.5
const SUN_DISTANCE = 80

// ── 火星探测器配置 ──
const probes = [
  { key: 'curiosity',    name: '好奇号',       color: '#4FC3F7', orbitRadius: 0, surface: true,  surfaceAngle: 0.8,  surfacePhi: 0.3  },
  { key: 'perseverance', name: '毅力号',        color: '#FF7043', orbitRadius: 0, surface: true,  surfaceAngle: -0.5, surfacePhi: 0.4  },
  { key: 'tianwen1',     name: '天问一号/祝融号', color: '#FF1744', orbitRadius: 0, surface: true,  surfaceAngle: 1.5,  surfacePhi: -0.3 },
  { key: 'maven',        name: 'MAVEN',         color: '#00E5FF', orbitRadius: 6.5, orbitSpeed: 0.0028, orbitInclination: Math.PI / 2.5 },
  { key: 'mro',          name: 'MRO 侦察轨道器', color: '#FFEA00', orbitRadius: 5.5, orbitSpeed: 0.0038, orbitInclination: Math.PI / 2   },
  { key: 'odyssey',      name: '奥德赛号',       color: '#69F0AE', orbitRadius: 7.2, orbitSpeed: 0.0022, orbitInclination: Math.PI / 2.2 },
]
const visibleProbes = reactive(Object.fromEntries(probes.map(p => [p.key, true])))

// ── 探测历史时间线 ──
const explorationEvents = [
  { year: 1965, name: '水手 4 号',    desc: '美国·首次飞掠火星，拍摄首批近景照片' },
  { year: 1971, name: '水手 9 号',    desc: '美国·首个进入火星轨道的探测器' },
  { year: 1976, name: '海盗 1/2 号',  desc: '美国·首次软着陆火星，寻找生命迹象' },
  { year: 1997, name: '旅居者号',     desc: '美国·首辆火星漫游车（探路者任务）' },
  { year: 2004, name: '机遇号/勇气号', desc: '美国·发现火星曾存在液态水的证据' },
  { year: 2006, name: 'MRO',          desc: '美国·火星侦察轨道器，高分辨率拍摄' },
  { year: 2012, name: '好奇号',        desc: '美国·核动力漫游车，仍在盖尔陨坑运行' },
  { year: 2014, name: 'MAVEN',         desc: '美国·研究火星大气层逃逸机制' },
  { year: 2021, name: '毅力号/机智号', desc: '美国·首次在火星实现动力飞行' },
  { year: 2021, name: '天问一号',      desc: '中国·祝融号漫游车着陆乌托邦平原' },
]

// ── 切换轨道 ──
const toggleOrbits = () => {
  showOrbits.value = !showOrbits.value
  orbitLines.forEach(line => { line.visible = showOrbits.value })
  probeObjects.forEach(obj => {
    if (obj.orbitLine) obj.orbitLine.visible = showOrbits.value && visibleProbes[obj.key]
  })
}

const toggleRotation = () => { isRotating.value = !isRotating.value }

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.set(0, 12, 28)
  controls.target.set(0, 0, 0)
  controls.update()
}

const toggleProbe = (key) => {
  visibleProbes[key] = !visibleProbes[key]
  probeObjects.forEach(obj => {
    if (obj.key !== key) return
    const show = visibleProbes[key]
    if (obj.orbitLine) obj.orbitLine.visible = show && showOrbits.value
    if (obj.dot) obj.dot.visible = show
  })
}

const clearSelection = () => { selectedBodyInfo.value = null }

const onFocusBody = (info) => {
  // 先找探测器
  const probeMatch = probeObjects.find(o => o.info?.name === info.name)
  if (probeMatch?.dot && controls && camera) {
    const pos = probeMatch.dot.getWorldPosition(new THREE.Vector3())
    controls.target.copy(pos)
    camera.position.lerp(new THREE.Vector3(pos.x + 6, pos.y + 4, pos.z + 6), 0.6)
    controls.update()
    return
  }
  // 再找天体
  const moonMatch = moonObjects.find(o => o.mesh?.userData?.info?.name === info.name)
  if (moonMatch?.mesh && controls && camera) {
    const pos = moonMatch.mesh.position.clone()
    controls.target.copy(pos)
    camera.position.lerp(new THREE.Vector3(pos.x + 4, pos.y + 2, pos.z + 4), 0.6)
    controls.update()
  }
}

// ── 纹理加载 ──
const textureLoader = new THREE.TextureLoader()
function loadTexture(path) {
  return new Promise(resolve => {
    textureLoader.load(
      path,
      tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex) },
      undefined,
      () => { console.warn(`纹理加载失败: ${path}`); resolve(null) }
    )
  })
}

// ── 轨道点生成 ──
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
  const mat = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.5, gapSize: 0.3 })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

function createOrbitLine(radius, color = 0x886655, opacity = 0.45) {
  const pts = []
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  return new THREE.Line(geo, mat)
}

// ── Canvas 标签 ──
function createLabel(mesh, text, yOffset, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.font = 'bold 26px Microsoft YaHei, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 38)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  sprite.scale.set(6, 1.5, 1)
  sprite.position.set(0, yOffset, 0)
  mesh.add(sprite)
}

// ── 星空 ──
function createStarfield() {
  const geo = new THREE.BufferGeometry()
  const count = 3000
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    const r = 800 + Math.random() * 700
    pos[i * 3] = r * Math.sin(p) * Math.cos(t)
    pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t)
    pos[i * 3 + 2] = r * Math.cos(p)
    const w = Math.random()
    col[i * 3] = 0.9 + w * 0.1
    col[i * 3 + 1] = 0.85 + w * 0.08
    col[i * 3 + 2] = 0.8 - w * 0.15
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.8, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.85
  })))
}

// ── 探测器描述 ──
function getProbeDesc(key) {
  const d = {
    curiosity:    '好奇号（Curiosity）由 NASA 于 2012 年 8 月着陆盖尔陨坑，是核动力漫游车，通过分析岩石与土壤，证实火星古代曾具备支持微生物生存的条件，目前仍在正常运行。',
    perseverance: '毅力号（Perseverance）于 2021 年 2 月着陆耶泽洛陨坑，携带机智号（Ingenuity）直升机，首次实现外星动力飞行，同时收集岩石样本以备未来取样返回任务。',
    tianwen1:     '天问一号是中国首次独立完成的火星探测任务，2021 年 5 月祝融号漫游车成功着陆乌托邦平原，使中国成为继美国之后第二个将漫游车成功送上火星的国家。',
    maven:        'MAVEN（火星大气与挥发物演化卫星）于 2014 年进入火星轨道，专门研究火星大气层的逃逸机制，揭示了火星失去大气层与液态水的历史过程。',
    mro:          '火星侦察轨道器（MRO）自 2006 年起运行，搭载高分辨率成像科学相机（HiRISE），能拍摄分辨率达 25 cm 的地表照片，为漫游车着陆选址提供关键支持。',
    odyssey:      '奥德赛号（Mars Odyssey）是迄今在轨运行时间最长的火星探测器，自 2001 年起服务至今，发现了火星地表浅层大量水冰存在的证据。',
  }
  return d[key] || '正在探索火星奥秘的探测器。'
}

function getProbeStats(key) {
  const s = {
    curiosity:    { '发射时间': '2011-11-26', '着陆时间': '2012-08-06', '发射机构': 'NASA / JPL', '着陆点': '盖尔陨坑', '动力方式': '核动力（RTG）', '任务状态': '地面运行中' },
    perseverance: { '发射时间': '2020-07-30', '着陆时间': '2021-02-18', '发射机构': 'NASA / JPL', '着陆点': '耶泽洛陨坑', '特色载荷': '机智号直升机', '任务状态': '地面运行中' },
    tianwen1:     { '发射时间': '2020-07-23', '着陆时间': '2021-05-15', '发射机构': 'CNSA', '着陆点': '乌托邦平原', '漫游车': '祝融号', '任务状态': '已完成巡视' },
    maven:        { '发射时间': '2013-11-18', '入轨时间': '2014-09-22', '发射机构': 'NASA / LASP', '任务类型': '大气科学轨道器', '轨道高度': '150~6200 km', '任务状态': '轨道运行中' },
    mro:          { '发射时间': '2005-08-12', '入轨时间': '2006-03-10', '发射机构': 'NASA / JPL', '主要载荷': 'HiRISE 高分相机', '分辨率': '25 cm/像素', '任务状态': '轨道运行中' },
    odyssey:      { '发射时间': '2001-04-07', '入轨时间': '2001-10-24', '发射机构': 'NASA / JPL', '主要成就': '发现极地水冰', '运行时长': '> 23 年（最长记录）', '任务状态': '轨道运行中' },
  }
  return s[key] || {}
}

// ── 创建探测器 ──
function createProbe(config, marsGroup) {
  const colorHex = new THREE.Color(config.color).getHex()

  if (config.surface) {
    // 地面漫游车：贴近火星表面的小球
    const phi = config.surfacePhi ?? 0
    const theta = config.surfaceAngle ?? 0
    const r = MARS_RADIUS + 0.18
    const pos = new THREE.Vector3(
      r * Math.cos(phi) * Math.cos(theta),
      r * Math.sin(phi),
      r * Math.cos(phi) * Math.sin(theta)
    )

    const dotGeo = new THREE.SphereGeometry(0.18, 12, 12)
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: colorHex }))
    dot.position.copy(pos)
    dot.name = config.name

    // 光晕
    const glowGeo = new THREE.SphereGeometry(0.32, 12, 12)
    const glowMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.2 })
    dot.add(new THREE.Mesh(glowGeo, glowMat))

    dot.userData = {
      info: {
        name: config.name,
        nameEn: config.key,
        type: 'probe',
        description: getProbeDesc(config.key),
        stats: getProbeStats(config.key)
      }
    }

    // 标签
    const c = document.createElement('canvas'); c.width = 280; c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = config.color
    ctx.font = 'bold 20px Microsoft YaHei, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(config.name, 140, 38)
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
    label.scale.set(4.5, 1.1, 1)
    label.position.set(0, 0.55, 0)
    dot.add(label)

    marsGroup.add(dot)
    probeObjects.push({ key: config.key, config, dot, angle: 0, info: dot.userData.info, isSurface: true })
    return
  }

  // 轨道探测器
  const inc = config.orbitInclination
  const pts = generateOrbitPoints(config.orbitRadius, inc, 0, 200)
  const orbitLine = createDashedLine(pts, colorHex, 0.35)
  scene.add(orbitLine)

  const dotGeo = new THREE.SphereGeometry(0.2, 14, 14)
  const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: colorHex }))
  dot.position.copy(computeDotPosition(Math.random() * Math.PI * 2, config.orbitRadius, inc))
  dot.name = config.name
  dot.userData = {
    info: {
      name: config.name,
      nameEn: config.key,
      type: 'probe',
      description: getProbeDesc(config.key),
      stats: getProbeStats(config.key)
    }
  }

  const c = document.createElement('canvas'); c.width = 280; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = config.color
  ctx.font = 'bold 20px Microsoft YaHei, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(config.name, 140, 38)
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  label.scale.set(4.5, 1.1, 1)
  label.position.set(0, 0.5, 0)
  dot.add(label)

  scene.add(dot)
  probeObjects.push({
    key: config.key, config, orbitLine, dot,
    angle: Math.random() * Math.PI * 2,
    info: dot.userData.info,
    isSurface: false
  })
}

// ── Raycaster 交互 ──
function setupRaycaster(marsGroup) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('click', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const targets = [marsMesh, sunMesh]
    moonObjects.forEach(o => { if (o.mesh) targets.push(o.mesh) })
    probeObjects.forEach(o => { if (o.dot) targets.push(o.dot) })

    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj) {
        if (obj.userData?.info) { selectedBodyInfo.value = obj.userData.info; return }
        obj = obj.parent
      }
    }
    selectedBodyInfo.value = null
  })

  renderer.domElement.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const targets = [marsMesh, sunMesh]
    moonObjects.forEach(o => { if (o.mesh) targets.push(o.mesh) })
    probeObjects.forEach(o => { if (o.dot) targets.push(o.dot) })

    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj) {
        if (obj.name && obj.name !== '') {
          hoveredName.value = obj.name
          renderer.domElement.style.cursor = 'pointer'
          return
        }
        obj = obj.parent
      }
    }
    hoveredName.value = ''
    renderer.domElement.style.cursor = ''
  })
}

// ── 场景初始化 ──
async function initScene() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x0a0400)
  canvasContainer.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 5
  controls.maxDistance = 150

  createStarfield()

  // 纹理
  const marsTex = await loadTexture('/textures/mars_diffuse.jpg')

  // ── 光照 ──
  dirLight = new THREE.DirectionalLight(0xFFDDCC, 2.8)
  dirLight.position.set(SUN_DISTANCE, 8, 0)
  scene.add(dirLight)
  scene.add(new THREE.AmbientLight(0x221108, 1.5))

  // ── 远景太阳 ──
  const sunGeo = new THREE.SphereGeometry(3, 32, 32)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFEE88 })
  sunMesh = new THREE.Mesh(sunGeo, sunMat)
  sunMesh.position.set(SUN_DISTANCE, 8, 0)
  sunMesh.name = '太阳'
  sunMesh.userData = {
    info: {
      name: '太阳', nameEn: 'Sun', type: 'star',
      description: '太阳系中心恒星，质量占太阳系总质量的 99.86%，为火星提供光热能源。',
      stats: { '类型': '黄矮星（主序星）', '质量': '1.989 × 10³⁰ kg', '直径': '139.27 万公里', '表面温度': '约 5778 K', '距火星': '约 2.28 亿公里' }
    }
  }
  scene.add(sunMesh)
  createLabel(sunMesh, '☀️ 太阳', 4.5, '#FFEE88')

  // 太阳光晕
  const sunGlowGeo = new THREE.SphereGeometry(4.5, 32, 32)
  const sunGlowMat = new THREE.MeshBasicMaterial({ color: 0xFFCC44, transparent: true, opacity: 0.15, depthWrite: false })
  sunMesh.add(new THREE.Mesh(sunGlowGeo, sunGlowMat))

  // ── 火星 ──
  const marsGeo = new THREE.SphereGeometry(MARS_RADIUS, 64, 64)
  const marsMat = new THREE.MeshPhongMaterial({
    map: marsTex,
    color: marsTex ? 0xFFFFFF : 0xC1440E,
    specular: 0x110800,
    shininess: 8,
  })
  marsMesh = new THREE.Mesh(marsGeo, marsMat)
  marsMesh.name = '火星'
  marsMesh.userData = {
    info: {
      name: '火星', nameEn: 'Mars', type: 'planet',
      description: '太阳系第四颗行星，因富含氧化铁而呈现独特的红色。拥有太阳系最高火山奥林匹斯山（约 21.9 km）和最大峡谷水手峡谷，是人类深空探索的首要目标。',
      stats: {
        '直径': '6,779 公里',
        '质量': '6.39 × 10²³ kg',
        '公转周期': '687 地球日',
        '自转周期': '24 小时 37 分',
        '表面温度': '-125°C ~ 20°C',
        '重力': '3.72 m/s²',
        '大气压': '约 0.6% 地球大气压',
        '卫星数量': '2 颗',
      }
    }
  }
  scene.add(marsMesh)

  // 大气层光晕
  const atmoGeo = new THREE.SphereGeometry(MARS_RADIUS * 1.045, 48, 48)
  const atmoMat = new THREE.MeshPhongMaterial({ color: 0xFF6633, transparent: true, opacity: 0.12, depthWrite: false })
  marsMesh.add(new THREE.Mesh(atmoGeo, atmoMat))

  createLabel(marsMesh, '🔴 火星', MARS_RADIUS + 1.2, '#FF7043')

  // ── 火星本体 Group（漫游车随火星自转） ──
  const marsGroup = new THREE.Group()
  scene.add(marsGroup)

  // ── 火卫一 ──
  const phobosOrbitRadius = MARS_RADIUS * 2.4
  const phobosGeo = new THREE.SphereGeometry(0.55, 24, 24)
  const phobosMat = new THREE.MeshPhongMaterial({ color: 0x7A6C5A, specular: 0x080604, shininess: 5 })
  const phobosMesh = new THREE.Mesh(phobosGeo, phobosMat)
  phobosMesh.name = '火卫一（福波斯）'
  phobosMesh.userData = {
    info: {
      name: '火卫一（福波斯）', nameEn: 'Phobos', type: 'moon',
      description: '火星最大的卫星，形状不规则，轨道极低，公转周期仅 7.7 小时，甚至比火星自转更快。因潮汐力影响，预计 3000 万年后将被火星引力撕碎或坠落。',
      stats: { '平均半径': '约 11.3 km', '公转周期': '7 小时 39 分', '轨道高度': '约 6000 km', '特征': '运行速度超过火星自转' }
    }
  }
  phobosMesh.position.set(phobosOrbitRadius, 0, 0)
  scene.add(phobosMesh)
  createLabel(phobosMesh, '火卫一', 1.0, '#BBAA99')

  const phobosOrbit = createOrbitLine(phobosOrbitRadius, 0x886655, 0.5)
  scene.add(phobosOrbit)
  orbitLines.push(phobosOrbit)
  moonObjects.push({ mesh: phobosMesh, distance: phobosOrbitRadius, speed: 0.028, angle: 0.3 })

  // ── 火卫二 ──
  const deimosOrbitRadius = MARS_RADIUS * 3.8
  const deimosGeo = new THREE.SphereGeometry(0.38, 20, 20)
  const deimosMat = new THREE.MeshPhongMaterial({ color: 0x8C7B6A, specular: 0x080604, shininess: 5 })
  const deimosMesh = new THREE.Mesh(deimosGeo, deimosMat)
  deimosMesh.name = '火卫二（得摩斯）'
  deimosMesh.userData = {
    info: {
      name: '火卫二（得摩斯）', nameEn: 'Deimos', type: 'moon',
      description: '火星较小的卫星，也是形状不规则的小天体。轨道缓慢向外迁移，最终可能逃离火星引力范围。表面被厚厚的风化层覆盖，地形相对平坦。',
      stats: { '平均半径': '约 6.2 km', '公转周期': '30 小时 18 分', '轨道高度': '约 23460 km', '特征': '轨道缓慢向外扩张' }
    }
  }
  deimosMesh.position.set(deimosOrbitRadius, 0, 0)
  scene.add(deimosMesh)
  createLabel(deimosMesh, '火卫二', 0.8, '#BBAA99')

  const deimosOrbit = createOrbitLine(deimosOrbitRadius, 0x664433, 0.4)
  scene.add(deimosOrbit)
  orbitLines.push(deimosOrbit)
  moonObjects.push({ mesh: deimosMesh, distance: deimosOrbitRadius, speed: 0.012, angle: 2.1 })

  // ── 探测器 ──
  probes.forEach(p => createProbe(p, marsGroup))

  // ── 交互 ──
  setupRaycaster(marsGroup)

  resetCamera()
}

// ── 动画循环 ──
function animate() {
  animationId = requestAnimationFrame(animate)
  if (isRotating.value) {
    const spd = animSpeed.value

    // 火星自转
    marsMesh.rotation.y += 0.0018 * spd

    // 火卫一/二公转
    moonObjects.forEach(obj => {
      obj.angle += obj.speed * spd * 0.01
      obj.mesh.position.x = Math.cos(obj.angle) * obj.distance
      obj.mesh.position.z = Math.sin(obj.angle) * obj.distance
      obj.mesh.rotation.y += 0.003 * spd
    })

    // 轨道探测器公转
    probeObjects.forEach(obj => {
      if (obj.isSurface) return
      if (!visibleProbes[obj.key]) return
      const cfg = obj.config
      obj.angle += cfg.orbitSpeed * spd
      obj.dot.position.copy(computeDotPosition(obj.angle, cfg.orbitRadius, cfg.orbitInclination))
    })
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
.scene-page {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #0a0400;
}

/* ── 左侧面板 ── */
.side-panel {
  position: absolute;
  left: 16px;
  top: 76px;
  z-index: 100;
  width: 280px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.side-panel::-webkit-scrollbar { width: 3px; }
.side-panel::-webkit-scrollbar-track { background: transparent; }
.side-panel::-webkit-scrollbar-thumb { background: rgba(220, 100, 40, 0.3); border-radius: 2px; }

.info-card {
  background: rgba(20, 6, 0, 0.88);
  border: 1px solid rgba(220, 100, 40, 0.28);
  border-radius: 14px;
  padding: 14px 16px;
  backdrop-filter: blur(15px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.55);
}
.card-title {
  color: #ff7043;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.stats { display: flex; flex-direction: column; gap: 5px; }
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  border-left: 2px solid rgba(220, 100, 40, 0.4);
}
.stat-item .label { color: #888; font-size: 11px; flex-shrink: 0; }
.stat-item .value { color: #ffe8d8; font-size: 11px; font-weight: 500; text-align: right; margin-left: 6px; }

/* ── 时间线卡片 ── */
.timeline-card { max-height: 340px; overflow-y: auto; }
.timeline-card::-webkit-scrollbar { width: 3px; }
.timeline-card::-webkit-scrollbar-track { background: transparent; }
.timeline-card::-webkit-scrollbar-thumb { background: rgba(220, 100, 40, 0.3); border-radius: 2px; }

.timeline {
  display: flex;
  flex-direction: column;
  padding-left: 12px;
  border-left: 1px solid rgba(220, 100, 40, 0.28);
}
.tl-item { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; position: relative; }
.tl-year { font-size: 11px; font-weight: bold; color: #FFD700; min-width: 34px; font-family: monospace; flex-shrink: 0; }
.tl-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff7043; flex-shrink: 0; margin-left: -16px; margin-top: 5px; }
.tl-content { display: flex; flex-direction: column; gap: 2px; }
.tl-name { font-size: 11px; color: #ddd; font-weight: 500; }
.tl-desc { font-size: 10px; color: #777; }

/* ── 悬停提示 ── */
.hover-tip {
  position: absolute;
  top: 74px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 6, 0, 0.88);
  border: 1px solid rgba(220, 100, 40, 0.45);
  border-radius: 20px;
  padding: 6px 18px;
  color: #ff7043;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  z-index: 150;
  backdrop-filter: blur(8px);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── 探测器切换栏 ── */
.probe-bar {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(20, 6, 0, 0.88);
  border: 1px solid rgba(220, 100, 40, 0.22);
  border-radius: 28px;
  padding: 6px 16px;
  backdrop-filter: blur(14px);
}
.probe-list { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.probe-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0.45;
  border: 1px solid transparent;
}
.probe-item:hover { opacity: 0.8; background: rgba(255, 255, 255, 0.05); }
.probe-item.active { opacity: 1; border-color: rgba(220, 100, 40, 0.35); background: rgba(220, 80, 20, 0.1); }
.probe-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.probe-name { font-size: 11px; color: #ccc; white-space: nowrap; }

/* ── 控制栏 ── */
.controls {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  gap: 10px;
  align-items: center;
}
.control-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 10px 22px;
  border-radius: 22px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 13px;
  backdrop-filter: blur(10px);
}
.control-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(220, 100, 40, 0.55);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(220, 80, 20, 0.3);
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 22px;
  padding: 0 14px;
  height: 42px;
  backdrop-filter: blur(10px);
}
.speed-label { color: rgba(255, 255, 255, 0.6); font-size: 12px; white-space: nowrap; }
.speed-select {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 4px;
}
.speed-select option { background: #1a0800; color: #fff; }

.canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .side-panel { display: none; }
  .probe-bar { bottom: 68px; padding: 4px 8px; }
  .probe-list { gap: 2px; }
  .probe-item { padding: 4px 6px; }
  .probe-name { font-size: 10px; }
  .controls { gap: 6px; }
  .control-btn { padding: 8px 14px; font-size: 12px; }
}
</style>
