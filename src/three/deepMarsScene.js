/**
 * 火星深度探索场景模块
 * 负责创建和管理高精度火星三维场景，包括模型、纹理、标注等
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { lonLatToVector3, getMarkerColor, MARS_RADIUS_KM } from '../utils/marsGeo.js'

// 默认火星球体半径（场景单位）
const DEFAULT_MARS_RADIUS = 10

/**
 * 深度火星场景类
 */
export class DeepMarsScene {
  constructor(container) {
    this.container = container
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.marsMesh = null
    this.markerGroups = new Map() // id -> { group, clickable }
    this.clickableMarkers = []    // 用于射线检测的可点击对象数组
    this.ringMeshes = []          // 高亮环网格
    this.onResizeCallback = null
    this.selectedMarker = null
    this.displacementScale = 2.5  // 地形夸张倍率
    this._labelsVisible = true
    this._loadedMarkers = []      // 保存原始 marker 数组
    this._disposed = false        // 动画循环停止标志
    this._colorTexture = null     // 彩色纹理引用（显示模式切换）
    this._heightTexture = null    // 高程纹理引用
    this._hasHeightMap = false    // 是否成功加载了高程图

    this.textureLoader = new THREE.TextureLoader()
  }

  // ─────────────────────────────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────────────────────────────

  /**
   * 初始化场景
   * @param {Object} options
   * @param {string} options.quality          - 质量档位 'low' | 'medium' | 'high'
   * @param {boolean} options.enableDisplacement - 是否尝试加载位移贴图
   * @param {number}  options.displacementScale  - 地形夸张倍率
   */
  async init(options = {}) {
    const {
      quality = 'medium',
      enableDisplacement = true,
      displacementScale = 2.5
    } = options

    this.displacementScale = displacementScale

    // 场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050005)

    // 相机
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    )
    this.camera.position.set(0, 0, 30)

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
    this.controls.minDistance = 5
    this.controls.maxDistance = 100

    // 星空背景
    this._createStarfield()

    // 加载火星资源并创建球体
    const textures = await this._loadMarsAssets(quality, enableDisplacement)
    await this._createMars(textures)

    // 加载标注数据
    await this._loadCoreMarkers()

    // 窗口响应
    this._setupResizeHandler()

    // 动画循环
    this._animate()
  }

  // ─────────────────────────────────────────────────────────────────
  // 星空背景
  // ─────────────────────────────────────────────────────────────────

  _createStarfield() {
    const starCount = 2000
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 100 + Math.random() * 50

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // 偏暖白（匹配火星环境）
      const warm = Math.random()
      colors[i * 3]     = 0.88 + warm * 0.12
      colors[i * 3 + 1] = 0.85 + warm * 0.1
      colors[i * 3 + 2] = 0.82 - warm * 0.15
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    })

    const stars = new THREE.Points(geo, mat)
    stars.renderOrder = -1
    this.scene.add(stars)
  }

  // ─────────────────────────────────────────────────────────────────
  // 资源加载（含降级逻辑）
  // ─────────────────────────────────────────────────────────────────

  /**
   * 加载火星纹理资源
   * 优先尝试 manifest 指定的高分辨率贴图；失败时回退到 manifest.fallback
   */
  async _loadMarsAssets(quality, enableDisplacement) {
    const BASE = '/models/bodies/mars/'
    let manifest

    try {
      const res = await fetch(`${BASE}mars_assets_manifest.json`)
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`)
      manifest = await res.json()
    } catch (e) {
      console.warn('[DeepMarsScene] Failed to load manifest, using fallback only.', e)
      manifest = {
        levels: {},
        fallback: { color: '/textures/mars_diffuse.jpg', height: null }
      }
    }

    const level = (manifest.levels || {})[quality] || (manifest.levels || {}).medium || {}
    const fallback = manifest.fallback || { color: '/textures/mars_diffuse.jpg', height: null }

    // 尝试加载 color 纹理，失败则用 fallback
    let colorPath  = level.color  ? `${BASE}${level.color}`  : null
    let heightPath = (enableDisplacement && level.height) ? `${BASE}${level.height}` : null

    const loadTex = (path) => new Promise((resolve) => {
      if (!path) { resolve(null); return }
      this.textureLoader.load(
        path,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          tex.generateMipmaps = true
          resolve(tex)
        },
        undefined,
        () => {
          console.warn(`[DeepMarsScene] Texture not found: ${path}`)
          resolve(null)
        }
      )
    })

    // 并行加载，colorTex 失败时再尝试 fallback
    let [colorTex, heightTex] = await Promise.all([
      loadTex(colorPath),
      loadTex(heightPath)
    ])

    if (!colorTex) {
      console.info('[DeepMarsScene] Falling back to:', fallback.color)
      colorTex = await loadTex(fallback.color)
    }

    if (!heightTex && enableDisplacement && fallback.height) {
      heightTex = await loadTex(fallback.height)
    }

    this._hasHeightMap = !!heightTex

    return { color: colorTex, height: heightTex }
  }

  // ─────────────────────────────────────────────────────────────────
  // 火星球体
  // ─────────────────────────────────────────────────────────────────

  async _createMars(textures = {}) {
    const geometry = new THREE.SphereGeometry(DEFAULT_MARS_RADIUS, 256, 128)

    this._colorTexture  = textures.color  || null
    this._heightTexture = textures.height || null

    // 从 manifest 读取高度范围以计算真实比例
    let trueScale = 1.0
    try {
      const res  = await fetch('/models/bodies/mars/mars_assets_manifest.json')
      const mf   = await res.json()
      const hm   = mf.heightMap || {}
      const span = (hm.maxElevationKm || 21.9) - (hm.minElevationKm || -8.2)
      const ref  = hm.referenceRadiusKm || 3389.5
      trueScale  = (span / ref) * DEFAULT_MARS_RADIUS
    } catch {
      // 使用默认值
    }

    const materialParams = {
      map:       this._colorTexture,
      roughness: 1,
      metalness: 0,
      side: THREE.FrontSide
    }

    if (this._heightTexture) {
      materialParams.displacementMap   = this._heightTexture
      materialParams.displacementScale = this.displacementScale
      materialParams.displacementBias  = -0.5
    }

    const material = new THREE.MeshStandardMaterial(materialParams)

    this.marsMesh = new THREE.Mesh(geometry, material)
    this.marsMesh.name = 'mars'
    this.marsMesh.userData = {
      type: 'mars_body',
      radiusKm: MARS_RADIUS_KM,
      trueDisplacementScale: trueScale
    }
    this.scene.add(this.marsMesh)

    // 灯光 —— 展示模式：全球均匀可见，方便浏览高精度地形
    // 强环境光保证背光半球不黑，方向光保留少量立体感
    const ambient = new THREE.AmbientLight(0xffddc8, 0.4)
    this.scene.add(ambient)

    // 半球光：天空偏暖橙 / 地面偏深红，增加柔和层次
    const hemi = new THREE.HemisphereLight(0xffc080, 0x300a00, 0.6)
    this.scene.add(hemi)

    // 方向光弱化至 0.5，仅用于保留一点高光立体感
    const sun = new THREE.DirectionalLight(0xffe8d8, 0.5)
    sun.position.set(5, 5, 5)
    this.scene.add(sun)

    // 大气光晕（薄薄的橙红色）
    const atmoGeo = new THREE.SphereGeometry(DEFAULT_MARS_RADIUS * 1.018, 64, 32)
    const atmoMat = new THREE.MeshPhongMaterial({
      color: 0xff6633,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      side: THREE.FrontSide
    })
    this.marsMesh.add(new THREE.Mesh(atmoGeo, atmoMat))
  }

  // ─────────────────────────────────────────────────────────────────
  // 显示模式
  // ─────────────────────────────────────────────────────────────────

  /**
   * 切换显示模式
   * @param {'natural'|'heightGray'|'displacementOnly'} mode
   */
  updateDisplayMode(mode) {
    if (!this.marsMesh || !this.marsMesh.material) return
    const mat = this.marsMesh.material

    switch (mode) {
      case 'natural':
        mat.map = this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffffff)
        break
      case 'heightGray':
        // 用高程图（若有）展示灰度地形，无则回退自然贴图
        mat.map = this._heightTexture || this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffffff)
        break
      case 'displacementOnly':
        mat.map = null
        mat.wireframe = true
        mat.color.set(0xff8a50) // 橙红色线框，呼应火星色调
        break
    }
    mat.needsUpdate = true
  }

  // ─────────────────────────────────────────────────────────────────
  // 标注数据
  // ─────────────────────────────────────────────────────────────────

  async _loadCoreMarkers() {
    try {
      const res = await fetch('/models/bodies/mars/mars_markers_core.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const markers = await res.json()
      this._loadedMarkers = markers
      this._createMarkers(markers)
    } catch (e) {
      console.warn('[DeepMarsScene] Failed to load mars markers:', e)
    }
  }

  /** 获取已加载的标注列表（供 Vue 组件使用） */
  getMarkers() {
    return this._loadedMarkers
  }

  /** 是否已加载高程图（供 UI 显示提示） */
  hasHeightMap() {
    return this._hasHeightMap
  }

  // ─────────────────────────────────────────────────────────────────
  // 标注渲染
  // ─────────────────────────────────────────────────────────────────

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
    const group = new THREE.Group()
    group.name = `mars_marker_${marker.id}`
    group.userData = { type: 'mars_marker', marker, originalPosition: null }

    const color = getMarkerColor(marker.category)

    const pos = lonLatToVector3(marker.lon, marker.lat, DEFAULT_MARS_RADIUS, 0.18)
    group.position.copy(pos)
    group.userData.originalPosition = pos.clone()

    // 球点（可点击）
    const dotGeo = new THREE.SphereGeometry(0.055, 12, 12)
    const dotMat = new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true })
    const dot = new THREE.Mesh(dotGeo, dotMat)
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
    const tw = ctx.measureText(text).width
    canvas.width  = tw + padding * 2
    canvas.height = fontSize + padding

    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 半透明深色背景
    ctx.fillStyle = 'rgba(20, 5, 0, 0.60)'
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

    const r = (color >> 16) & 0xff
    const g = (color >> 8)  & 0xff
    const b =  color        & 0xff
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.textBaseline = 'middle'
    ctx.fillText(text, padding, canvas.height / 2)

    const texture  = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true
    })

    const sprite  = new THREE.Sprite(material)
    const aspect  = canvas.width / canvas.height
    const spriteH = 0.3
    sprite.scale.set(spriteH * aspect, spriteH, 1)

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

  // ─────────────────────────────────────────────────────────────────
  // 标注显隐
  // ─────────────────────────────────────────────────────────────────

  setLabelsVisible(visible) {
    this._labelsVisible = visible
    this.markerGroups.forEach(({ group }) => { group.visible = visible })
    this.ringMeshes.forEach(ring => { ring.visible = visible })
  }

  // ─────────────────────────────────────────────────────────────────
  // 高亮环
  // ─────────────────────────────────────────────────────────────────

  _createHighlightRing(marker) {
    const pos    = lonLatToVector3(marker.lon, marker.lat, DEFAULT_MARS_RADIUS, 0.22)
    const normal = pos.clone().normalize()

    const ringGeo = new THREE.TorusGeometry(0.22, 0.008, 8, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff7043,
      transparent: true,
      opacity: 0.9,
      depthTest: false
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

  // ─────────────────────────────────────────────────────────────────
  // 选中 / 飞行
  // ─────────────────────────────────────────────────────────────────

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
    const targetPos = lonLatToVector3(marker.lon, marker.lat, DEFAULT_MARS_RADIUS, 0)
    const normal    = targetPos.clone().normalize()
    const cameraPos = targetPos.clone().add(normal.multiplyScalar(6))
    this._flyToPosition(cameraPos, targetPos.clone(), duration)
    this.selectMarker(marker)
  }

  _flyToPosition(targetCameraPos, targetLookAt, duration) {
    const startPos    = this.camera.position.clone()
    const startLookAt = this.controls.target.clone()
    const startTime   = Date.now()

    const tick = () => {
      const elapsed  = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease     = 1 - Math.pow(1 - progress, 3)

      this.camera.position.lerpVectors(startPos, targetCameraPos, ease)
      this.controls.target.lerpVectors(startLookAt, targetLookAt, ease)

      if (progress < 1) requestAnimationFrame(tick)
    }
    tick()
  }

  // ─────────────────────────────────────────────────────────────────
  // 鼠标交互
  // ─────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────
  // 地形夸张
  // ─────────────────────────────────────────────────────────────────

  updateDisplacementScale(scale) {
    this.displacementScale = scale
    if (this.marsMesh && this.marsMesh.material && this._hasHeightMap) {
      this.marsMesh.material.displacementScale = scale
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 窗口自适应
  // ─────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────
  // 动画循环
  // ─────────────────────────────────────────────────────────────────

  _animate() {
    if (this._disposed || !this.renderer || !this.scene || !this.camera) return
    requestAnimationFrame(() => this._animate())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  // ─────────────────────────────────────────────────────────────────
  // 销毁
  // ─────────────────────────────────────────────────────────────────

  dispose() {
    this._disposed = true

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

    this.scene        = null
    this.camera       = null
    this.renderer     = null
    this.controls     = null
    this.marsMesh     = null
    this.markerGroups.clear()
    this.clickableMarkers  = []
    this.ringMeshes        = []
    this.selectedMarker    = null
    this._loadedMarkers    = []
    this._colorTexture     = null
    this._heightTexture    = null
  }
}
