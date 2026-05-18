/**
 * 木星深度探索场景模块
 * 负责创建和管理高精度木星三维场景，包括云层纹理、大气光晕、标注系统等
 *
 * 木星与月球/火星的关键差异：
 *  - 气态巨行星，无固体地形，不使用高程位移贴图
 *  - 提供程序化横向条纹 CanvasTexture 作为 fallback，资源缺失时仍可运行
 *  - 支持云层缓慢自转（大气流动感）
 *  - 显示模式：natural / bands（云带增强） / wireframe
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { lonLatToVector3, getMarkerColor, JUPITER_RADIUS_KM } from '../utils/jupiterGeo.js'

// 场景中木星球体的半径（单位：场景单位）
const DEFAULT_JUPITER_RADIUS = 10

// ─────────────────────────────────────────────────────────────────────────────
// 程序化 Fallback 纹理
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成木星横向云带 CanvasTexture（用于外部纹理加载失败时的 fallback）
 * 配色基于 Voyager / Hubble 观测的木星云带真实色系
 * @returns {THREE.CanvasTexture}
 */
function createProceduralJupiterTexture() {
  const W = 2048
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // 木星云带由纬度决定，定义典型的带/区颜色和纬度范围
  // lat: -90..90 → canvas Y: H..0
  const bands = [
    // [latNorth, latSouth, color]（北-南范围，颜色）
    // 南极
    { n: -75, s: -90, color: '#7B5C3E' },
    // 南极带
    { n: -58, s: -75, color: '#C8A872' },
    // 南温带
    { n: -40, s: -58, color: '#8B5A2B' },
    // 南温带区（含小红斑）
    { n: -28, s: -40, color: '#E8C89A' },
    // 南赤道带（SEB，含大红斑）
    { n: -8,  s: -28, color: '#9B5E2D' },
    // 赤道区（EZ）
    { n: 8,   s: -8,  color: '#F5DEB3' },
    // 北赤道带（NEB）
    { n: 22,  s:  8,  color: '#8B5A1E' },
    // 北热带区
    { n: 32,  s: 22,  color: '#D4A870' },
    // 北温带
    { n: 44,  s: 32,  color: '#7B4A1A' },
    // 北温带区
    { n: 55,  s: 44,  color: '#DEAD8A' },
    // 北极带
    { n: 70,  s: 55,  color: '#6B4226' },
    // 北极
    { n: 90,  s: 70,  color: '#5A3520' },
  ]

  const latToY = (lat) => H * (1 - (lat + 90) / 180)

  bands.forEach(b => {
    const y0 = latToY(b.n)
    const y1 = latToY(b.s)
    const gradient = ctx.createLinearGradient(0, y0, 0, y1)
    gradient.addColorStop(0,   b.color)
    gradient.addColorStop(0.3, adjustColor(b.color, 15))
    gradient.addColorStop(0.7, adjustColor(b.color, -10))
    gradient.addColorStop(1,   b.color)
    ctx.fillStyle = gradient
    ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0) + 1)
  })

  // 绘制随机横向纹理扰动（模拟云流）
  ctx.globalAlpha = 0.12
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * H
    const w = 80 + Math.random() * 300
    const x = Math.random() * W
    const h = 2 + Math.random() * 8
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#3d1e00'
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1.0

  // 大红斑（示意位置）
  const grsX = W * 0.15
  const grsY = latToY(-22)
  const grsRx = W * 0.04
  const grsRy = H * 0.03
  const grsGrad = ctx.createRadialGradient(grsX, grsY, 0, grsX, grsY, grsRx)
  grsGrad.addColorStop(0,   '#C0392B')
  grsGrad.addColorStop(0.5, '#E74C3C')
  grsGrad.addColorStop(1,   'rgba(180,60,40,0)')
  ctx.fillStyle = grsGrad
  ctx.beginPath()
  ctx.ellipse(grsX, grsY, grsRx, grsRy, 0, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** 简单颜色亮度调整（HEX string → adjusted HEX string） */
function adjustColor(hex, delta) {
  const n = parseInt(hex.replace('#',''), 16)
  const r = Math.max(0, Math.min(255, (n >> 16) + delta))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta))
  const b = Math.max(0, Math.min(255, (n & 0xff) + delta))
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// DeepJupiterScene 类
// ─────────────────────────────────────────────────────────────────────────────

export class DeepJupiterScene {
  constructor(container) {
    this.container = container

    this.scene        = null
    this.camera       = null
    this.renderer     = null
    this.controls     = null
    this.jupiterMesh  = null
    this.cloudMesh    = null  // 可选的外层薄云壳
    this.atmosMesh    = null  // 大气辉光壳

    this.markerGroups    = new Map() // id -> { group, clickable }
    this.clickableMarkers = []       // 用于射线检测
    this.ringMeshes      = []        // 高亮环

    this.onResizeCallback = null
    this.selectedMarker   = null
    this._labelsVisible   = true
    this._loadedMarkers   = []
    this._disposed        = false
    this._animFrameId     = null

    // 纹理引用
    this._colorTexture = null  // 主纹理（自然）
    this._hasTexture   = false // 是否成功加载了外部纹理

    // 云层自转
    this._cloudRotation      = true
    this._cloudRotationSpeed = 0.00015 // rad/frame

    // 当前显示模式
    this._displayMode = 'natural'

    this.textureLoader = new THREE.TextureLoader()
  }

  // ───────────────────────── 初始化 ─────────────────────────

  /**
   * 初始化场景
   * @param {Object} options
   * @param {'low'|'medium'|'high'} options.quality    质量档位
   * @param {boolean} options.cloudRotation           是否开启云层自转
   * @param {number}  options.cloudRotationSpeed      自转速度（rad/frame）
   */
  async init(options = {}) {
    const {
      quality           = 'medium',
      cloudRotation     = true,
      cloudRotationSpeed = 0.00015
    } = options

    this._cloudRotation      = cloudRotation
    this._cloudRotationSpeed = cloudRotationSpeed

    // 场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x020105)

    // 相机
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    )
    this.camera.position.set(0, 0, 32)

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.container.appendChild(this.renderer.domElement)
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // 轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 12
    this.controls.maxDistance = 120

    // 星空
    this._createStarfield()

    // 加载纹理并创建木星
    const colorTex = await this._loadJupiterTexture(quality)
    this._createJupiter(colorTex)

    // 加载标注
    await this._loadCoreMarkers()

    // 窗口自适应
    this._setupResizeHandler()

    // 动画
    this._animate()
  }

  // ───────────────────────── 星空 ─────────────────────────

  _createStarfield() {
    const count = 2500
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 100 + Math.random() * 60

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // 偏暖白，与木星橙金背景呼应
      const warm = Math.random()
      colors[i * 3]     = 0.90 + warm * 0.10
      colors[i * 3 + 1] = 0.87 + warm * 0.08
      colors[i * 3 + 2] = 0.80 - warm * 0.12
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size:        0.4,
      vertexColors: true,
      transparent: true,
      opacity:     0.75,
      sizeAttenuation: true
    })

    const stars = new THREE.Points(geo, mat)
    stars.renderOrder = -1
    this.scene.add(stars)
  }

  // ───────────────────────── 纹理加载 ─────────────────────────

  /**
   * 加载木星颜色纹理，失败时回退程序化 CanvasTexture
   */
  async _loadJupiterTexture(quality) {
    const BASE = '/models/bodies/jupiter/'
    let manifest

    try {
      const res = await fetch(`${BASE}jupiter_assets_manifest.json`)
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`)
      manifest = await res.json()
    } catch (e) {
      console.warn('[DeepJupiterScene] manifest 加载失败，使用程序化 fallback', e)
      return createProceduralJupiterTexture()
    }

    const level    = (manifest.levels || {})[quality] || (manifest.levels || {}).medium || {}
    const fallback = manifest.fallback || {}

    const colorFileName = level.color || fallback.color || null
    if (!colorFileName) {
      console.info('[DeepJupiterScene] manifest 中无纹理路径，使用程序化 fallback')
      return createProceduralJupiterTexture()
    }

    return new Promise((resolve) => {
      this.textureLoader.load(
        `${BASE}${colorFileName}`,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          tex.generateMipmaps = true
          this._hasTexture = true
          resolve(tex)
        },
        undefined,
        (err) => {
          console.warn(`[DeepJupiterScene] 纹理加载失败: ${colorFileName}，使用程序化 fallback`, err)
          resolve(createProceduralJupiterTexture())
        }
      )
    })
  }

  // ───────────────────────── 木星球体 ─────────────────────────

  _createJupiter(colorTex) {
    this._colorTexture = colorTex

    // 主球体（高段数以保证圆润）
    const geo = new THREE.SphereGeometry(DEFAULT_JUPITER_RADIUS, 256, 128)

    const mat = new THREE.MeshStandardMaterial({
      map:       this._colorTexture,
      roughness: 0.85,
      metalness: 0.0,
      side:      THREE.FrontSide
    })

    this.jupiterMesh      = new THREE.Mesh(geo, mat)
    this.jupiterMesh.name = 'jupiter'
    this.jupiterMesh.userData = {
      type:     'jupiter_body',
      radiusKm: JUPITER_RADIUS_KM
    }
    this.scene.add(this.jupiterMesh)

    // 灯光 —— 均匀展示
    const ambient = new THREE.AmbientLight(0xffeedd, 0.45)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffe0a0, 0x1a0e00, 0.55)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfff0e0, 0.45)
    sun.position.set(8, 4, 8)
    this.scene.add(sun)

    // 大气辉光壳
    this._createAtmosphere()
  }

  _createAtmosphere() {
    // 外层半透明壳，模拟大气边缘辉光
    const atmoGeo = new THREE.SphereGeometry(DEFAULT_JUPITER_RADIUS * 1.022, 64, 32)
    const atmoMat = new THREE.MeshPhongMaterial({
      color:       0xd4883a,
      transparent: true,
      opacity:     0.08,
      depthWrite:  false,
      side:        THREE.FrontSide
    })
    this.atmosMesh = new THREE.Mesh(atmoGeo, atmoMat)
    this.jupiterMesh.add(this.atmosMesh)

    // 背光边缘辉光（背面渲染）
    const rimGeo = new THREE.SphereGeometry(DEFAULT_JUPITER_RADIUS * 1.04, 64, 32)
    const rimMat = new THREE.MeshPhongMaterial({
      color:       0xffa040,
      transparent: true,
      opacity:     0.05,
      depthWrite:  false,
      side:        THREE.BackSide
    })
    this.jupiterMesh.add(new THREE.Mesh(rimGeo, rimMat))
  }

  // ───────────────────────── 显示模式 ─────────────────────────

  /**
   * 切换显示模式
   * @param {'natural'|'bands'|'wireframe'} mode
   */
  updateDisplayMode(mode) {
    if (!this.jupiterMesh || !this.jupiterMesh.material) return
    this._displayMode = mode
    const mat = this.jupiterMesh.material

    switch (mode) {
      case 'natural':
        mat.map       = this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffffff)
        mat.emissive.set(0x000000)
        mat.emissiveIntensity = 0
        if (this.atmosMesh) this.atmosMesh.visible = true
        break

      case 'bands':
        // 云带增强：使用相同纹理但提升对比度感知（调深底色）
        mat.map       = this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffddaa)       // 叠加暖色调强化云带
        mat.emissive.set(0x110800)
        mat.emissiveIntensity = 0.12
        if (this.atmosMesh) this.atmosMesh.visible = false
        break

      case 'wireframe':
        mat.map       = null
        mat.wireframe = true
        mat.color.set(0xffb347)       // 橙金线框
        mat.emissive.set(0x000000)
        mat.emissiveIntensity = 0
        if (this.atmosMesh) this.atmosMesh.visible = false
        break
    }
    mat.needsUpdate = true
  }

  // ───────────────────────── 云层自转控制 ─────────────────────────

  setCloudRotation(enabled) {
    this._cloudRotation = enabled
  }

  setCloudRotationSpeed(speed) {
    this._cloudRotationSpeed = speed
  }

  // ───────────────────────── 大气辉光强度 ─────────────────────────

  setAtmosphereIntensity(value) {
    if (this.atmosMesh) {
      this.atmosMesh.material.opacity = 0.08 * value
      this.atmosMesh.material.needsUpdate = true
    }
  }

  // ───────────────────────── 标注数据加载 ─────────────────────────

  async _loadCoreMarkers() {
    try {
      const res = await fetch('/models/bodies/jupiter/jupiter_markers_core.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const markers = await res.json()
      this._loadedMarkers = markers
      this._createMarkers(markers)
    } catch (e) {
      console.warn('[DeepJupiterScene] 标注加载失败:', e)
    }
  }

  getMarkers() {
    return this._loadedMarkers
  }

  hasTexture() {
    return this._hasTexture
  }

  // ───────────────────────── 标注渲染 ─────────────────────────

  _createMarkers(markers) {
    this._clearAllMarkers()
    markers.forEach(marker => {
      const mg = this._createMarker(marker)
      if (mg) {
        this.markerGroups.set(marker.id, mg)
        this.scene.add(mg.group)
        if (mg.clickable) this.clickableMarkers.push(mg.clickable)
      }
    })
  }

  _createMarker(marker) {
    const group    = new THREE.Group()
    group.name     = `jupiter_marker_${marker.id}`
    group.userData = { type: 'jupiter_marker', marker, originalPosition: null }

    const color = getMarkerColor(marker.category)
    const pos   = lonLatToVector3(marker.lon, marker.lat, DEFAULT_JUPITER_RADIUS, 0.18)
    group.position.copy(pos)
    group.userData.originalPosition = pos.clone()

    // 可点击圆点
    const dotGeo = new THREE.SphereGeometry(0.06, 12, 12)
    const dotMat = new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true })
    const dot    = new THREE.Mesh(dotGeo, dotMat)
    dot.userData = group.userData
    group.add(dot)

    // 文字 Sprite
    const sprite = this._createTextSprite(marker.nameZh, color)
    const normal = pos.clone().normalize()
    sprite.position.copy(normal.multiplyScalar(0.55))
    sprite.userData = { isLabel: true }
    group.add(sprite)

    group.userData.labelSprite = sprite

    return { group, clickable: dot }
  }

  _createTextSprite(text, color) {
    const fontSize = 28
    const padding  = 16
    const canvas   = document.createElement('canvas')
    const ctx      = canvas.getContext('2d')

    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const tw  = ctx.measureText(text).width
    canvas.width  = tw + padding * 2
    canvas.height = fontSize + padding

    // 重绘（canvas 尺寸改变后 context 状态重置）
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 深色半透明背景
    ctx.fillStyle = 'rgba(10, 5, 0, 0.65)'
    const rr = 8
    ctx.beginPath()
    ctx.moveTo(rr, 0)
    ctx.lineTo(canvas.width - rr, 0)
    ctx.arcTo(canvas.width, 0, canvas.width, rr, rr)
    ctx.lineTo(canvas.width, canvas.height - rr)
    ctx.arcTo(canvas.width, canvas.height, canvas.width - rr, canvas.height, rr)
    ctx.lineTo(rr, canvas.height)
    ctx.arcTo(0, canvas.height, 0, canvas.height - rr, rr)
    ctx.lineTo(0, rr)
    ctx.arcTo(0, 0, rr, 0, rr)
    ctx.closePath()
    ctx.fill()

    // 文字颜色
    const r = (color >> 16) & 0xff
    const g = (color >> 8)  & 0xff
    const b =  color        & 0xff
    ctx.fillStyle     = `rgb(${r},${g},${b})`
    ctx.textBaseline  = 'middle'
    ctx.fillText(text, padding, canvas.height / 2)

    const texture  = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map:         texture,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
      sizeAttenuation: true
    })

    const sprite = new THREE.Sprite(material)
    const aspect = canvas.width / canvas.height
    const sprH   = 0.32
    sprite.scale.set(sprH * aspect, sprH, 1)

    return sprite
  }

  _clearAllMarkers() {
    this.markerGroups.forEach(({ group }) => {
      group.traverse(child => {
        if (child.isSprite && child.material) {
          if (child.material.map) child.material.map.dispose()
          child.material.dispose()
        }
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose()
          if (child.material) child.material.dispose()
        }
      })
      this.scene.remove(group)
    })
    this.markerGroups.clear()
    this.clickableMarkers = []
    this._clearHighlightRings()
  }

  // ───────────────────────── 标注显隐 ─────────────────────────

  setLabelsVisible(visible) {
    this._labelsVisible = visible
    this.markerGroups.forEach(({ group }) => { group.visible = visible })
    this.ringMeshes.forEach(ring => { ring.visible = visible })
  }

  // ───────────────────────── 高亮环 ─────────────────────────

  _createHighlightRing(marker) {
    const pos    = lonLatToVector3(marker.lon, marker.lat, DEFAULT_JUPITER_RADIUS, 0.22)
    const normal = pos.clone().normalize()

    const ringGeo = new THREE.TorusGeometry(0.24, 0.009, 8, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color:       0xffb347,
      transparent: true,
      opacity:     0.90,
      depthTest:   false
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.copy(pos)
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

    this.scene.add(ring)
    this.ringMeshes.push(ring)
    return ring
  }

  _clearHighlightRings() {
    this.ringMeshes.forEach(ring => {
      if (ring.geometry) ring.geometry.dispose()
      if (ring.material) ring.material.dispose()
      this.scene.remove(ring)
    })
    this.ringMeshes = []
  }

  // ───────────────────────── 选中 / 飞行 ─────────────────────────

  selectMarker(marker) {
    this.selectedMarker = marker
    this._clearHighlightRings()
    if (this._labelsVisible) this._createHighlightRing(marker)
  }

  deselectMarker() {
    this.selectedMarker = null
    this._clearHighlightRings()
  }

  flyToMarker(marker, duration = 1200) {
    const targetPos = lonLatToVector3(marker.lon, marker.lat, DEFAULT_JUPITER_RADIUS, 0)
    const normal    = targetPos.clone().normalize()
    const cameraPos = targetPos.clone().add(normal.multiplyScalar(8))
    this._flyToPosition(cameraPos, targetPos.clone(), duration)
    this.selectMarker(marker)
  }

  _flyToPosition(targetCameraPos, targetLookAt, duration) {
    const startPos    = this.camera.position.clone()
    const startLookAt = this.controls.target.clone()
    const startTime   = Date.now()

    const tick = () => {
      if (this._disposed) return
      const elapsed  = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease     = 1 - Math.pow(1 - progress, 3)

      this.camera.position.lerpVectors(startPos, targetCameraPos, ease)
      this.controls.target.lerpVectors(startLookAt, targetLookAt, ease)

      if (progress < 1) requestAnimationFrame(tick)
    }
    tick()
  }

  // ───────────────────────── 鼠标交互 ─────────────────────────

  handleMouseDown(event) {
    const rect  = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
       ((event.clientX - rect.left) / rect.width)  * 2 - 1,
      -((event.clientY - rect.top)  / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)

    const allClickable = [...this.clickableMarkers]
    this.markerGroups.forEach(({ group }) => {
      group.children.forEach(child => { if (child.isSprite) allClickable.push(child) })
    })

    const hits = raycaster.intersectObjects(allClickable, false)
    if (hits.length > 0) {
      const obj = hits[0].object
      let markerData = obj.userData.marker
      if (!markerData && obj.isSprite) {
        const parent = obj.parent
        if (parent && parent.userData.marker) markerData = parent.userData.marker
      }
      if (markerData) {
        this.selectMarker(markerData)
        return markerData
      }
    }

    this.deselectMarker()
    return null
  }

  // ───────────────────────── 窗口自适应 ─────────────────────────

  _setupResizeHandler() {
    const handler = () => {
      if (!this.camera || !this.renderer) return
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
    window.addEventListener('resize', handler)
    this.onResizeCallback = handler
  }

  // ───────────────────────── 动画循环 ─────────────────────────

  _animate() {
    if (this._disposed || !this.renderer || !this.scene || !this.camera) return
    this._animFrameId = requestAnimationFrame(() => this._animate())

    // 云层缓慢自转
    if (this._cloudRotation && this.jupiterMesh) {
      this.jupiterMesh.rotation.y += this._cloudRotationSpeed
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  // ───────────────────────── 销毁 ─────────────────────────

  dispose() {
    this._disposed = true
    if (this._animFrameId) cancelAnimationFrame(this._animFrameId)

    if (this.onResizeCallback) {
      window.removeEventListener('resize', this.onResizeCallback)
    }

    this._clearAllMarkers()
    this._clearHighlightRings()

    if (this.renderer) {
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
      }
      this.renderer.dispose()
    }

    if (this.scene) {
      const clean = (obj) => {
        while (obj.children.length > 0) {
          const child = obj.children[0]
          obj.remove(child)
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose())
              } else {
                child.material.dispose()
              }
            }
          }
          clean(child)
        }
      }
      clean(this.scene)
    }

    if (this._colorTexture) this._colorTexture.dispose()

    this.scene         = null
    this.camera        = null
    this.renderer      = null
    this.controls      = null
    this.jupiterMesh   = null
    this.atmosMesh     = null
    this.markerGroups.clear()
    this.clickableMarkers = []
    this.ringMeshes       = []
    this.selectedMarker   = null
    this._loadedMarkers   = []
    this._colorTexture    = null
  }
}
