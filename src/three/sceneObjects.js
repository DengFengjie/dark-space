/**
 * Three.js 天体场景对象创建与更新模块
 * 包括：太阳、行星、轨道线、星空、探测器轨迹、标签
 */
import * as THREE from 'three'
import { calcPlanetPosition, generateOrbitPath } from '../utils/orbitCalc.js'
import { eclipticToRender } from '../utils/scaleHelper.js'

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
    radius: 1.8, color: 0x9C8F7A,
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
    radius: 3.2, color: 0xE8C07A,
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
    radius: 3.5, color: 0x4B8FDB,
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
    radius: 2.5, color: 0xC1440E,
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
    radius: 11, color: 0xC88B3A,
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
    radius: 9, color: 0xEAD5A0,
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
    radius: 5.5, color: 0x7DE8E8,
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
    radius: 5.2, color: 0x4070DD,
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
export function createStarfield(scene, count = 15000) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // 均匀分布在大球壳上
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 2000 + Math.random() * 500

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
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: false  // 星星大小不随距离变化
  })

  const stars = new THREE.Points(geo, mat)
  stars.name = 'starfield'
  stars.renderOrder = -1
  scene.add(stars)
  return stars
}

/**
 * 创建太阳（含发光效果）
 */
export function createSun(scene) {
  const group = new THREE.Group()
  group.name = '太阳_group'

  // 太阳主体
  const geo = new THREE.SphereGeometry(15, 64, 64)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFD060,
    emissive: 0xFF8800,
    emissiveIntensity: 2,
    roughness: 1,
    metalness: 0
  })
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

  // 外发光晕层
  const glowGeo = new THREE.SphereGeometry(17, 32, 32)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xFF6600,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide
  })
  group.add(new THREE.Mesh(glowGeo, glowMat))

  // 点光源（照亮行星）
  const light = new THREE.PointLight(0xFFEECC, 3, 0, 1.5)  // 0=无衰减上限
  light.position.set(0, 0, 0)
  scene.add(light)

  // 环境光（模拟星际散射）
  scene.add(new THREE.AmbientLight(0x111133, 0.5))

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
    roughness: 0.85,
    metalness: 0.05
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
 * 创建探测器轨迹管线
 * @param {THREE.Scene} scene
 * @param {Array<{x,y,z}>} points - 渲染坐标点（已转换）
 * @param {number} color - 轨迹颜色
 * @param {string} name - 探测器名称
 * @returns {THREE.Mesh|null}
 */
export function createProbeTrajectory(scene, points, color = 0x00FFFF, name = 'probe') {
  if (!points || points.length < 2) return null

  const pts = points.map(p => auToScene(p.x, p.y, p.z))
  const curve = new THREE.CatmullRomCurve3(pts)
  const segments = Math.min(pts.length * 3, 600)

  const tubeGeo = new THREE.TubeGeometry(curve, segments, 0.25, 6, false)
  const tubeMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75
  })

  const tube = new THREE.Mesh(tubeGeo, tubeMat)
  tube.name = `trajectory_${name}`
  scene.add(tube)

  // 轨迹末端亮点（当前位置标记）
  const dotGeo = new THREE.SphereGeometry(1.2, 16, 16)
  const dotMat = new THREE.MeshBasicMaterial({ color })
  const dot = new THREE.Mesh(dotGeo, dotMat)
  const last = pts[pts.length - 1]
  dot.position.copy(last)
  dot.name = `probe_dot_${name}`
  scene.add(dot)

  return { tube, dot, curve, pts }
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
