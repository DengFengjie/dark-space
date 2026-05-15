/**
 * Three.js 天体场景对象创建与更新模块
 * 包括：太阳、行星、轨道线、星空、探测器轨迹、标签
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

import { calcPlanetPosition, generateOrbitPath } from '../utils/orbitCalc.js'
import { eclipticToRender } from '../utils/scaleHelper.js'

// ────────────────────────────────────────────────────────
// 探测器模型配置表（GLB 文件路径）
// ────────────────────────────────────────────────────────
export const PROBE_MODELS = {
  voyager1:          '/models/probes/Voyager_Probe.glb',
  voyager2:          '/models/probes/Voyager_Probe.glb',
  juno:              '/models/probes/Juno.glb',
  parker:            '/models/probes/Parker_Solar_Probe.glb',
  galileo:           '/models/probes/Galileo.glb',
  cassini:           '/models/probes/Cassini_Huygens.glb',
  rosetta:           '/models/probes/Rosetta.glb',
  pioneer:           '/models/probes/Pioneer.glb',
  ace:               '/models/probes/Advanced_Composition_Explorer.glb',
  deepImpact:        '/models/probes/Deep_Impact.glb',
  marsGlobalSurveyor:'/models/probes/Mars_Global_Surveyor.glb',
}

// 共享 GLTF/Draco 加载器
const _gltfLoader = new GLTFLoader()
const _dracoLoader = new DRACOLoader()
_dracoLoader.setDecoderPath('/draco/gltf/')
_gltfLoader.setDRACOLoader(_dracoLoader)

/**
 * 加载单个探测器 GLB 模型，返回 Promise<THREE.Group|null>
 * 使用 fetch 获取 ArrayBuffer，手动修复 GLB JSON 块中的 null 字节填充问题
 * （部分建模工具用 0x00 填充代替规范要求的 0x20，导致 JSON.parse 报错）
 * 失败时 resolve(null)，不抛出异常
 */
export function loadProbeModel(modelFile) {
  return new Promise(async (resolve) => {
    if (!modelFile) { resolve(null); return }
    let url
    try { url = new URL(modelFile, window.location.href).href } catch { url = modelFile }
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()

      // 修复 GLB JSON 块的 null 字节填充
      // GLB 头 12 字节：magic(4) + version(4) + totalLength(4)
      // JSON 块：chunkLength(4) + chunkType(4) + chunkData
      const view = new DataView(buffer)
      const magic = view.getUint32(0, true)
      if (magic === 0x46546C67) {  // 确认是合法 GLB（magic = "glTF"）
        const jsonChunkLen = view.getUint32(12, true)
        const jsonStart = 20  // 12(头) + 4(长度字段) + 4(类型字段)
        const bytes = new Uint8Array(buffer)
        for (let i = jsonStart; i < jsonStart + jsonChunkLen; i++) {
          if (bytes[i] === 0) bytes[i] = 32  // null(0x00) → 空格(0x20)
        }
      }

      _gltfLoader.parse(buffer, '', (gltf) => {
        const model = gltf.scene
        model.scale.setScalar(1.5)
        model.traverse(child => {
          if (child.isMesh) {
            child.castShadow = false
            child.receiveShadow = false
            if (child.material) {
              // 替换为 MeshBasicMaterial，不依赖场景光照，模型始终清晰
              const oldMat = child.material
              const newMat = new THREE.MeshBasicMaterial({
                color: oldMat.color ? oldMat.color.clone() : 0xFFFFFF,
                map: oldMat.map || null,
                transparent: oldMat.transparent,
                opacity: oldMat.opacity,
                side: oldMat.side,
                depthWrite: oldMat.depthWrite !== false
              })
              oldMat.dispose()
              child.material = newMat
            }
          }
        })
        resolve(model)
      }, (err) => {
        console.warn(`[probe] 模型解析失败 (${modelFile}):`, err)
        resolve(null)
      })
    } catch (err) {
      console.warn(`[probe] 模型加载失败 (${modelFile}):`, err)
      resolve(null)
    }
  })
}


// ── 渲染坐标系转换：黄道坐标(AU) → Three.js场景坐标 ──
function auToScene(x, y, z) {
  const r = eclipticToRender(x, y, z)
  return new THREE.Vector3(r.rx, r.ry, r.rz)
}

// ────────────────────────────────────────────────────────
// 行星配置表
// ────────────────────────────────────────────────────────
export const PLANET_CONFIG = {
  mercury: {
    name: '水星', nameEn: 'Mercury',
    radius: 1.34, color: 0x9C8F7A,
    orbitColor: 0x554433,
    description: '距太阳最近的行星，表面布满陨石坑，昼夜温差高达600°C',
    stats: {
      '直径': '4,879 km',
      '质量': '3.30 × 10²³ kg',
      '距太阳': '0.387 AU',
      '公转周期': '88 天',
      '自转周期': '58.6 天',
      '表面温度': '-180°C ~ 430°C',
      '卫星数': '0'
    },
    explorations: [
      { year: 1974, name: '水手10号', type: '飞越' },
      { year: 2008, name: '信使号', type: '飞越/轨道器' },
      { year: 2025, name: 'BepiColombo', type: '轨道器（途中）' }
    ]
  },
  venus: {
    name: '金星', nameEn: 'Venus',
    radius: 3.32, color: 0xE8C07A,
    orbitColor: 0x776633,
    description: '太阳系中最热的行星，浓密二氧化碳大气层产生强烈温室效应',
    stats: {
      '直径': '12,104 km',
      '质量': '4.87 × 10²⁴ kg',
      '距太阳': '0.723 AU',
      '公转周期': '225 天',
      '自转周期': '243 天（逆转）',
      '表面温度': '462°C',
      '卫星数': '0'
    },
    explorations: [
      { year: 1970, name: '金星7号', type: '着陆器' },
      { year: 1990, name: '麦哲伦号', type: '轨道器' },
      { year: 2006, name: '金星快车', type: '轨道器' }
    ]
  },
  earth: {
    name: '地球', nameEn: 'Earth',
    radius: 3.50, color: 0x4B8FDB,
    atmosphereColor: 0x87CEEB,
    orbitColor: 0x2244AA,
    hasAtmosphere: true,
    description: '太阳系第三颗行星，目前已知唯一孕育生命的星球',
    stats: {
      '直径': '12,742 km',
      '质量': '5.97 × 10²⁴ kg',
      '距太阳': '1.000 AU',
      '公转周期': '365.25 天',
      '自转周期': '23.9 小时',
      '表面温度': '-89°C ~ 58°C',
      '卫星数': '1（月球）'
    },
    explorations: [
      { year: 1957, name: '斯普特尼克1号', type: '人类首颗卫星' },
      { year: 1969, name: '阿波罗11号', type: '首次载人登月' },
      { year: 2021, name: '国际空间站', type: '永久性空间站' }
    ]
  },
  mars: {
    name: '火星', nameEn: 'Mars',
    radius: 1.86, color: 0xC1440E,
    orbitColor: 0x771100,
    description: '被称为红色星球，表面富含氧化铁，是人类深空探测的重点目标',
    stats: {
      '直径': '6,779 km',
      '质量': '6.39 × 10²³ kg',
      '距太阳': '1.524 AU',
      '公转周期': '687 天',
      '自转周期': '24.6 小时',
      '表面温度': '-87°C ~ -5°C',
      '卫星数': '2（火卫一、火卫二）'
    },
    explorations: [
      { year: 1976, name: '海盗1号', type: '着陆器' },
      { year: 2012, name: '好奇号', type: '巡视器' },
      { year: 2021, name: '毅力号', type: '巡视器+直升机' },
      { year: 2021, name: '天问一号+祝融号', type: '轨道器+巡视器' }
    ]
  },
  jupiter: {
    name: '木星', nameEn: 'Jupiter',
    radius: 10.24, color: 0xC88B3A,
    orbitColor: 0x664400,
    description: '太阳系最大行星，其大红斑是持续数百年的超级风暴',
    stats: {
      '直径': '139,820 km',
      '质量': '1.90 × 10²⁷ kg',
      '距太阳': '5.203 AU',
      '公转周期': '11.86 年',
      '自转周期': '9.9 小时',
      '表面温度': '-108°C',
      '卫星数': '95颗'
    },
    explorations: [
      { year: 1979, name: '旅行者1/2号', type: '飞越' },
      { year: 1995, name: '伽利略号', type: '轨道器+探针' },
      { year: 2016, name: '朱诺号', type: '轨道器' }
    ]
  },
  saturn: {
    name: '土星', nameEn: 'Saturn',
    radius: 8.53, color: 0xEAD5A0,
    orbitColor: 0x886633,
    hasRing: true,
    description: '以壮观的光环系统著称，密度是八大行星中最低的',
    stats: {
      '直径': '116,460 km',
      '质量': '5.68 × 10²⁶ kg',
      '距太阳': '9.537 AU',
      '公转周期': '29.4 年',
      '自转周期': '10.7 小时',
      '表面温度': '-139°C',
      '卫星数': '146颗'
    },
    explorations: [
      { year: 1979, name: '先驱者11号', type: '飞越' },
      { year: 1980, name: '旅行者1号', type: '飞越' },
      { year: 2004, name: '卡西尼号', type: '轨道器+惠更斯探针' }
    ]
  },
  uranus: {
    name: '天王星', nameEn: 'Uranus',
    radius: 3.72, color: 0x7DE8E8,
    orbitColor: 0x336677,
    description: '侧向自转的冰巨星，自转轴倾斜约98°，拥有独特的环系统',
    stats: {
      '直径': '50,724 km',
      '质量': '8.68 × 10²⁵ kg',
      '距太阳': '19.19 AU',
      '公转周期': '84 年',
      '自转周期': '17.2 小时（逆向）',
      '表面温度': '-197°C',
      '卫星数': '27颗'
    },
    explorations: [
      { year: 1986, name: '旅行者2号', type: '飞越（唯一一次）' }
    ]
  },
  neptune: {
    name: '海王星', nameEn: 'Neptune',
    radius: 3.61, color: 0x4070DD,
    orbitColor: 0x223388,
    description: '太阳系最远的行星，拥有太阳系最强风速（超过2100 km/h）',
    stats: {
      '直径': '49,244 km',
      '质量': '1.02 × 10²⁶ kg',
      '距太阳': '30.07 AU',
      '公转周期': '164.8 年',
      '自转周期': '16.1 小时',
      '表面温度': '-201°C',
      '卫星数': '16颗'
    },
    explorations: [
      { year: 1989, name: '旅行者2号', type: '飞越（唯一一次）' }
    ]
  }
}

// ────────────────────────────────────────────────────────
// 创建函数
// ────────────────────────────────────────────────────────

/**
 * 创建星空背景（粒子系统）
 */
export function createStarfield(scene, count = 1800) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // 均匀分布在大球壳上
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 3000 + Math.random() * 1500

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    // 微微随机色温（白→淡蓝→淡黄）
    const warm = Math.random()
    colors[i * 3]     = 0.85 + warm * 0.15
    colors[i * 3 + 1] = 0.88 + warm * 0.06
    colors[i * 3 + 2] = 0.95 - warm * 0.2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const mat = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: false
  })

  const stars = new THREE.Points(geo, mat)
  stars.name = 'starfield'
  stars.renderOrder = -1
  scene.add(stars)
  return stars
}

/**
 * 创建太阳（小型光点 + 光晕 Sprite）
 */
export function createSun(scene) {
  const group = new THREE.Group()
  group.name = '太阳_group'

  // 太阳光点（小尺寸明亮球体）
  const geo = new THREE.SphereGeometry(2.5, 32, 32)
  const mat = new THREE.MeshBasicMaterial({ color: 0xFFF4E0 })
  const sunMesh = new THREE.Mesh(geo, mat)
  sunMesh.name = '太阳'
  sunMesh.userData = {
    type: 'star',
    info: {
      name: '太阳',
      nameEn: 'Sun',
      description: '太阳是太阳系的中心恒星，占太阳系总质量的99.86%，直径约139.2万公里。',
      stats: {
        '类型': 'G2V型主序星',
        '直径': '1,392,700 km',
        '质量': '1.989 × 10³⁰ kg',
        '表面温度': '5,778 K',
        '核心温度': '1,500万 K',
        '年龄': '约 46 亿年',
        '自转周期': '25天（赤道）'
      },
      explorations: [
        { year: 1990, name: '尤利西斯号', type: '太阳极地探测' },
        { year: 2018, name: '帕克太阳探测器', type: '近日探测（最近49 R☉）' },
        { year: 2020, name: '太阳轨道飞行器', type: '欧空局轨道器' }
      ]
    }
  }
  group.add(sunMesh)

  // 光晕 Sprite（始终面向相机，模拟恒星光芒）
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 128
  glowCanvas.height = 128
  const ctx = glowCanvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255, 240, 200, 1)')
  gradient.addColorStop(0.08, 'rgba(255, 200, 100, 0.9)')
  gradient.addColorStop(0.25, 'rgba(255, 150, 40, 0.5)')
  gradient.addColorStop(0.5, 'rgba(255, 100, 20, 0.12)')
  gradient.addColorStop(1, 'rgba(255, 60, 10, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const glowTex = new THREE.CanvasTexture(glowCanvas)
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
  }))
  glowSprite.scale.set(30, 30, 1)
  group.add(glowSprite)

  // 点光源（照亮行星）— decay=0 关闭距离衰减，使远近行星都能被照亮
  const light = new THREE.PointLight(0xFFEECC, 2, 0, 0)
  light.position.set(0, 0, 0)
  scene.add(light)

  // 环境光（模拟星际散射）— 提升强度确保行星暗面也有基础照明
  scene.add(new THREE.AmbientLight(0x334466, 1.0))

  scene.add(group)
  return { group, mesh: sunMesh }
}

/**
 * 创建单颗行星
 * @param {THREE.Scene} scene
 * @param {string} key - 行星键名
 * @param {number} jd - 儒略日
 * @returns {THREE.Mesh}
 */
export function createPlanet(scene, key, jd) {
  const cfg = PLANET_CONFIG[key]
  if (!cfg) return null

  const pos = calcPlanetPosition(key, jd)
  const scenePos = auToScene(pos.x, pos.y, pos.z)

  const geo = new THREE.SphereGeometry(cfg.radius, 64, 64)
  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: 0.55,
    metalness: 0.1
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = cfg.name
  mesh.position.copy(scenePos)
  mesh.userData = {
    type: 'planet',
    key,
    info: {
      name: cfg.name,
      nameEn: cfg.nameEn,
      description: cfg.description,
      stats: cfg.stats,
      explorations: cfg.explorations || []
    }
  }

  // 地球大气层
  if (cfg.hasAtmosphere) {
    const atmGeo = new THREE.SphereGeometry(cfg.radius * 1.07, 32, 32)
    const atmMat = new THREE.MeshStandardMaterial({
      color: cfg.atmosphereColor || 0x87CEEB,
      transparent: true,
      opacity: 0.18,
      side: THREE.FrontSide,
      depthWrite: false
    })
    mesh.add(new THREE.Mesh(atmGeo, atmMat))
  }

  // 土星环
  if (cfg.hasRing) {
    const ringInner = cfg.radius * 1.35
    const ringOuter = cfg.radius * 2.3
    const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 128)
    // 修正UV，使环纹理正确显示
    const pos2d = ringGeo.attributes.position
    const uv = ringGeo.attributes.uv
    for (let i = 0; i < pos2d.count; i++) {
      const x = pos2d.getX(i), y = pos2d.getY(i)
      const r = Math.sqrt(x * x + y * y)
      uv.setXY(i, (r - ringInner) / (ringOuter - ringInner), 0)
    }
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xD4B483,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2.3
    mesh.add(ring)
  }

  scene.add(mesh)
  return mesh
}

/**
 * 创建行星轨道线（基于真实开普勒轨道计算）
 */
export function createOrbitLine(scene, key, jd) {
  const cfg = PLANET_CONFIG[key]
  if (!cfg) return null

  const rawPoints = generateOrbitPath(key, jd, 360)
  const pts = rawPoints.map(p => auToScene(p.x, p.y, p.z))

  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({
    color: cfg.orbitColor || 0x334455,
    transparent: true,
    opacity: 0.5
  })

  const line = new THREE.Line(geo, mat)
  line.name = `orbit_${key}`
  scene.add(line)
  return line
}

/**
 * 更新所有行星位置（每帧调用，时间推进时重算位置）
 * @param {Object} planetMeshes - { key: THREE.Mesh }
 * @param {number} jd - 当前儒略日
 */
export function updatePlanetPositions(planetMeshes, jd) {
  for (const [key, mesh] of Object.entries(planetMeshes)) {
    if (!mesh) continue
    const pos = calcPlanetPosition(key, jd)
    const sp = auToScene(pos.x, pos.y, pos.z)
    mesh.position.copy(sp)
  }
}

/**
 * 创建探测器轨迹虚线（支持时间联动 + 预加载模型/小球 + 中文名标签）
 * @param {THREE.Scene} scene
 * @param {Array<{x,y,z,jd?:number}>} points  - 原始数据点（AU）
 * @param {number} color      - 轨迹颜色（hex 数值）
 * @param {string} name       - 探测器 key（英文）
 * @param {THREE.Group|null} model - 已加载的 GLB 模型，null 则使用彩色小球
 * @param {string} labelName  - 显示的中文名称，空串则不创建标签
 * @returns {{ line, dot, model, label, pts, samples }|null}
 */
export function createProbeTrajectory(scene, points, color = 0x00FFFF, name = 'probe', model = null, labelName = '') {
  if (!points || points.length < 2) return null

  const pts = points.map(p => auToScene(p.x, p.y, p.z))
  const curve = new THREE.CatmullRomCurve3(pts)
  const segments = Math.min(pts.length * 3, 600)
  const curvePoints = curve.getPoints(segments)

  const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints)
  const lineMat = new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    dashSize: 4,
    gapSize: 2,
    linewidth: 1
  })

  const line = new THREE.Line(lineGeo, lineMat)
  line.computeLineDistances()
  line.name = `trajectory_${name}`
  scene.add(line)

  const last = pts[pts.length - 1]

  // 彩色小球（模型加载失败时的兜底标记）
  const dotGeo = new THREE.SphereGeometry(1.2, 16, 16)
  const dotMat = new THREE.MeshBasicMaterial({ color })
  const dot = new THREE.Mesh(dotGeo, dotMat)
  dot.position.copy(last)
  dot.name = `probe_dot_${name}`
  scene.add(dot)

  // 添加预加载的 GLB 模型，成功则隐藏小球
  if (model) {
    model.position.copy(last)
    model.name = `probe_model_${name}`

    scene.add(model)
    dot.visible = false
  }

  // 中文名标签（跟随模型/小球位置）
  let label = null
  if (labelName) {
    const colorStr = '#' + color.toString(16).padStart(6, '0')
    label = createTextLabel(labelName, colorStr)
    label.position.copy(last)
    label.position.y += 4
    label.name = `probe_label_${name}`
    scene.add(label)
  }

  return { line, dot, model, label, pts, samples: points }
}

/**
 * 创建文字精灵标签（用于行星名称显示）
 */
export function createTextLabel(text, color = '#64a3ff') {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, 256, 64)
  ctx.font = 'bold 26px "Microsoft YaHei", Arial'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 描边提升可读性
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'
  ctx.lineWidth = 3
  ctx.strokeText(text, 128, 32)
  ctx.fillText(text, 128, 32)

  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(18, 5, 1)
  sprite.name = `label_${text}`
  sprite.renderOrder = 999

  return sprite
}

/**
 * 为行星添加文字标签
 */
export function addPlanetLabel(scene, mesh, offsetY = 0) {
  const label = createTextLabel(mesh.name)
  const cfg = PLANET_CONFIG[mesh.userData.key]
  const r = cfg ? cfg.radius : 5
  label.position.copy(mesh.position)
  label.position.y += r + offsetY + 4
  label.userData.followMesh = mesh
  scene.add(label)
  return label
}

/**
 * 每帧更新标签位置（跟随行星移动）
 */
export function updateLabels(labels) {
  for (const label of labels) {
    const mesh = label.userData.followMesh
    if (!mesh) continue
    const cfg = PLANET_CONFIG[mesh.userData?.key]
    const r = cfg ? cfg.radius : 5
    label.position.copy(mesh.position)
    label.position.y += r + 4
  }
}

/**
 * 更新探测器当前位置标记到轨迹上对应时间的点
 * @param {Array} probeObjects - [{ tube, dot, samples }]
 * @param {number} jd - 当前儒略日
 * @param {Function} sampleFn - 插值函数 sampleTrajectoryAt
 */
export function updateProbePositions(probeObjects, jd, sampleFn) {
  if (!sampleFn) return
  for (const obj of probeObjects) {
    if (!obj?.dot || !obj?.samples) continue
    const pos = sampleFn(obj.samples, jd)
    if (pos) {
      const sp = auToScene(pos.x, pos.y, pos.z)
      obj.dot.position.copy(sp)
      // 同步更新模型位置
      if (obj.model) obj.model.position.copy(sp)
      // 同步更新中文名标签位置（标签在模型/小球上方 4 个单位）
      if (obj.label) {
        obj.label.position.copy(sp)
        obj.label.position.y += 4
      }
    }
  }
}
