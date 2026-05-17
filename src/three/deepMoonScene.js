/**
 * 月球深度探索场景模块
 * 负责创建和管理高精度月球三维场景，包括模型、纹理、标注等
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { lonLatToVector3, getMarkerColor, MOON_RADIUS_KM } from '../utils/moonGeo.js'

// 默认月球半径（场景单位）
const DEFAULT_MOON_RADIUS = 10

// 类别中文映射
const CATEGORY_LABELS = {
  landing_site: '着陆点',
  crater: '撞击坑',
  mare: '月海/月洋',
  montes: '山脉',
  mons: '山峰',
  vallis: '月谷/月溪',
  rupes: '断崖',
  other: '其他'
}

/**
 * 深度月球场景类
 */
export class DeepMoonScene {
  constructor(container) {
    this.container = container
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.moonMesh = null
    this.markerGroups = new Map() // id -> group
    this.clickableMarkers = [] // 用于射线检测的可点击对象数组
    this.ringMeshes = [] // 高亮环网格
    this.onResizeCallback = null
    this.selectedMarker = null
    this.displacementScale = 1.8 // 地形夸张倍率
    this._labelsVisible = true
    this._loadedMarkers = [] // 保存原始 marker 数组
    this._disposed = false   // 动画循环停止标志
    this._colorTexture = null  // 彩色纹理引用（用于显示模式切换）
    this._heightTexture = null // 高程纹理引用

    // 资源加载器
    this.textureLoader = new THREE.TextureLoader()
    this.loadingManager = new THREE.LoadingManager()
  }

  /**
   * 初始化场景
   * @param {Object} options - 初始化选项
   * @param {string} options.quality - 质量档位 ('low', 'medium', 'high')
   * @param {boolean} options.enableDisplacement - 是否启用位移贴图
   * @param {number} options.displacementScale - 位移贴图缩放比例
   */
  async init(options = {}) {
    const {
      quality = 'medium',
      enableDisplacement = true,
      displacementScale = 1.8
    } = options

    this.displacementScale = displacementScale

    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000008)

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    )
    this.camera.position.set(0, 0, 30)

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    this.container.appendChild(this.renderer.domElement)
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // 创建轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 5
    this.controls.maxDistance = 100

    // 添加星空背景
    this.createStarfield()

    // 加载月球资源并创建月球
    const textures = await this.loadMoonAssets(quality, enableDisplacement)
    await this.createMoon(textures)

    // 加载核心标注
    await this.loadCoreMarkers()

    // 设置窗口大小调整事件
    this.setupResizeHandler()

    // 开始动画循环
    this.animate()
  }

  /**
   * 创建星空背景
   */
  createStarfield() {
    const starCount = 2000
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 100 + Math.random() * 50

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      const warm = Math.random()
      colors[i * 3] = 0.85 + warm * 0.15
      colors[i * 3 + 1] = 0.88 + warm * 0.06
      colors[i * 3 + 2] = 0.95 - warm * 0.2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true
    })

    const stars = new THREE.Points(geo, mat)
    stars.renderOrder = -1
    this.scene.add(stars)
  }

  /**
   * 加载月球资源
   */
  async loadMoonAssets(quality, enableDisplacement) {
    const manifestResponse = await fetch('/models/bodies/moon/moon_assets_manifest.json')
    const manifest = await manifestResponse.json()
    
    const basePath = '/models/bodies/moon/'
    const level = manifest.levels[quality] || manifest.levels.medium
    
    const colorPath = `${basePath}${level.color}`
    let heightPath = null
    if (enableDisplacement) {
      heightPath = `${basePath}${level.height}`
    }

    const texturesToLoad = [
      { key: 'color', path: colorPath }
    ]
    
    if (heightPath) {
      texturesToLoad.push({ key: 'height', path: heightPath })
    }

    const loadedTextures = {}
    
    const loadTexture = (key, path) => {
      return new Promise((resolve, reject) => {
        this.textureLoader.load(
          path,
          (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            texture.generateMipmaps = true
            loadedTextures[key] = texture
            resolve()
          },
          undefined,
          (error) => {
            console.warn(`Moon texture loading failed for ${path}:`, error)
            reject(error)
          }
        )
      })
    }

    // 各纹理独立加载，单个失败不影响其余
    const loadPromises = texturesToLoad.map(({ key, path }) =>
      loadTexture(key, path).catch(err => {
        console.warn(`Skipping failed texture [${key}]: ${path}`, err)
      })
    )
    await Promise.all(loadPromises)
    
    return loadedTextures
  }

  /**
   * 创建月球网格
   */
  async createMoon(textures = {}) {
    const geometry = new THREE.SphereGeometry(
      DEFAULT_MOON_RADIUS,
      256,
      128
    )

    const manifestResponse = await fetch('/models/bodies/moon/moon_assets_manifest.json')
    const manifest = await manifestResponse.json()
    const { minElevationKm, maxElevationKm, referenceRadiusKm } = manifest.heightMap

    const trueScale = (maxElevationKm - minElevationKm) / referenceRadiusKm * DEFAULT_MOON_RADIUS

    // 保存纹理引用，供 updateDisplayMode 切换
    this._colorTexture = textures.color || null
    this._heightTexture = textures.height || null

    const materialParams = {
      map: this._colorTexture,
      normalMap: textures.normal || null,
      roughness: 1,
      metalness: 0,
      side: THREE.FrontSide
    }

    if (this._heightTexture) {
      materialParams.displacementMap = this._heightTexture
      materialParams.displacementScale = this.displacementScale
      materialParams.displacementBias = -0.5
    }

    const material = new THREE.MeshStandardMaterial(materialParams)

    this.moonMesh = new THREE.Mesh(geometry, material)
    this.moonMesh.name = 'moon'
    this.moonMesh.userData = {
      type: 'moon_body',
      radiusKm: MOON_RADIUS_KM,
      trueDisplacementScale: trueScale
    }
    this.scene.add(this.moonMesh)

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    this.scene.add(directionalLight)
  }

  /**
   * 切换显示模式
   * @param {'natural'|'heightGray'|'displacementOnly'} mode
   */
  updateDisplayMode(mode) {
    if (!this.moonMesh || !this.moonMesh.material) return
    const mat = this.moonMesh.material

    switch (mode) {
      case 'natural':
        mat.map = this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffffff)
        break
      case 'heightGray':
        // 用高程图作为颜色贴图，呈现灰度地形图效果
        mat.map = this._heightTexture || this._colorTexture
        mat.wireframe = false
        mat.color.set(0xffffff)
        break
      case 'displacementOnly':
        // 线框模式展示纯地形起伏
        mat.map = null
        mat.wireframe = true
        mat.color.set(0x88ccff)
        break
    }
    mat.needsUpdate = true
  }

  /**
   * 加载核心标注数据
   */
  async loadCoreMarkers() {
    try {
      const response = await fetch('/models/bodies/moon/moon_markers_core.json')
      if (!response.ok) {
        throw new Error(`Failed to load markers: ${response.status}`)
      }
      const markers = await response.json()
      this._loadedMarkers = markers
      this.createMarkers(markers)
    } catch (error) {
      console.warn('Failed to load moon markers:', error)
    }
  }

  /**
   * 获取已加载的所有标注数据（供 Vue 组件使用）
   * @returns {Array}
   */
  getMarkers() {
    return this._loadedMarkers
  }

  /**
   * 创建文字标签 Sprite
   * @param {string} text 文字内容
   * @param {number} color 颜色 (hex number)
   * @returns {THREE.Sprite}
   */
  createTextSprite(text, color) {
    const canvas = document.createElement('canvas')
    // 自适应宽度
    const fontSize = 28
    const padding = 16
    const ctx = canvas.getContext('2d')
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const textWidth = ctx.measureText(text).width
    canvas.width = textWidth + padding * 2
    canvas.height = fontSize + padding

    // 重绘（canvas 尺寸改变后 ctx 状态重置）
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 8, 28, 0.55)'
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

    // 文字
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.textBaseline = 'middle'
    ctx.fillText(text, padding, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,    // 文字永远在前，不被球体遮挡
      depthWrite: false,
      sizeAttenuation: true
    })

    const sprite = new THREE.Sprite(material)
    // 根据 canvas 宽高比设置 sprite 尺寸（world units）
    const aspect = canvas.width / canvas.height
    const spriteHeight = 0.3 // 文字高度为 0.3 个单位
    sprite.scale.set(spriteHeight * aspect, spriteHeight, 1)

    return sprite
  }

  /**
   * 创建标注点
   */
  createMarkers(markers) {
    this.clearAllMarkers()

    markers.forEach(marker => {
      const markerGroup = this.createMarker(marker)
      if (markerGroup) {
        this.markerGroups.set(marker.id, markerGroup)
        this.scene.add(markerGroup.group)
        
        if (markerGroup.clickable) {
          this.clickableMarkers.push(markerGroup.clickable)
        }
      }
    })
  }

  /**
   * 创建单个标注
   */
  createMarker(marker) {
    const group = new THREE.Group()
    group.name = `moon_marker_${marker.id}`
    group.userData = { 
      type: 'moon_marker', 
      marker,
      originalPosition: null
    }

    const markerColor = getMarkerColor(marker.category)

    // 计算3D位置（在月球表面上方一点）
    const pos = lonLatToVector3(
      marker.lon, 
      marker.lat, 
      DEFAULT_MOON_RADIUS, 
      0.18
    )
    group.position.copy(pos)
    group.userData.originalPosition = pos.clone()

    // 创建小球（点击区域，稍大以便点击）
    const dotGeometry = new THREE.SphereGeometry(0.055, 12, 12)
    const dotMaterial = new THREE.MeshBasicMaterial({ 
      color: markerColor,
      depthTest: true,
      depthWrite: true
    })
    const dot = new THREE.Mesh(dotGeometry, dotMaterial)
    dot.userData = group.userData
    group.add(dot)

    // 创建文字 Sprite，在球点上方偏移
    const sprite = this.createTextSprite(marker.nameZh, markerColor)
    // 根据球法线方向偏移文字（沿 pos 方向抬高）
    const normal = pos.clone().normalize()
    // 文字放在点位法线方向上方 0.5 个单位
    const labelOffset = normal.multiplyScalar(0.55)
    sprite.position.copy(labelOffset)
    sprite.userData = { isLabel: true }
    group.add(sprite)

    // 保存对 sprite 的引用，方便显隐控制
    group.userData.labelSprite = sprite

    return {
      group,
      clickable: dot
    }
  }

  /**
   * 清除所有标注
   */
  clearAllMarkers() {
    this.markerGroups.forEach(({ group }) => {
      // 释放 Sprite 贴图
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
    this.clearHighlightRings()
  }

  /**
   * 设置所有标注的显隐状态
   * @param {boolean} visible
   */
  setLabelsVisible(visible) {
    this._labelsVisible = visible
    this.markerGroups.forEach(({ group }) => {
      group.visible = visible
    })
    this.ringMeshes.forEach(ring => {
      ring.visible = visible
    })
  }

  /**
   * 创建高亮环
   */
  createHighlightRing(marker) {
    const pos = lonLatToVector3(
      marker.lon,
      marker.lat,
      DEFAULT_MOON_RADIUS,
      0.22
    )
    const normal = pos.clone().normalize()

    const ringGeometry = new THREE.TorusGeometry(0.22, 0.008, 8, 64)
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x64a3ff,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.position.copy(pos)
    
    ring.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    )

    this.scene.add(ring)
    this.ringMeshes.push(ring)
    return ring
  }

  /**
   * 清除高亮环
   */
  clearHighlightRings() {
    this.ringMeshes.forEach(ring => {
      if (ring.geometry) ring.geometry.dispose()
      if (ring.material) ring.material.dispose()
      this.scene.remove(ring)
    })
    this.ringMeshes = []
  }

  /**
   * 选中标注
   */
  selectMarker(marker) {
    this.selectedMarker = marker
    this.clearHighlightRings()
    if (this._labelsVisible) {
      this.createHighlightRing(marker)
    }
  }

  /**
   * 取消选中标注
   */
  deselectMarker() {
    this.selectedMarker = null
    this.clearHighlightRings()
  }

  /**
   * 飞行到指定标注
   */
  flyToMarker(marker, duration = 1200) {
    const targetPos = lonLatToVector3(
      marker.lon,
      marker.lat,
      DEFAULT_MOON_RADIUS,
      0
    )
    
    const normal = targetPos.clone().normalize()
    const cameraTarget = targetPos.clone()
    const cameraPos = targetPos.clone().add(normal.multiplyScalar(6))

    this.flyToPosition(cameraPos, cameraTarget, duration)

    // 同步选中高亮
    this.selectMarker(marker)
  }

  /**
   * 相机飞行到指定位置
   */
  flyToPosition(targetCameraPos, targetLookAt, duration) {
    const startPosition = this.camera.position.clone()
    const startLookAt = new THREE.Vector3()
    this.controls.target.clone(startLookAt)

    const startTime = Date.now()

    const animateFly = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      
      this.camera.position.lerpVectors(startPosition, targetCameraPos, easeProgress)
      this.controls.target.lerpVectors(startLookAt, targetLookAt, easeProgress)
      
      if (progress < 1) {
        requestAnimationFrame(animateFly)
      }
    }

    animateFly()
  }

  /**
   * 处理鼠标点击事件
   */
  handleMouseDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)

    // 同时检测球点和文字 Sprite
    const allClickable = [...this.clickableMarkers]
    this.markerGroups.forEach(({ group }) => {
      group.children.forEach(child => {
        if (child.isSprite) allClickable.push(child)
      })
    })

    const intersects = raycaster.intersectObjects(allClickable, false)
    
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object
      // 从球点或 Sprite 的 userData 中拿 marker
      let markerData = clickedObject.userData.marker
      // 如果点到了 Sprite，从父 group 拿
      if (!markerData && clickedObject.isSprite) {
        const parentGroup = clickedObject.parent
        if (parentGroup && parentGroup.userData.marker) {
          markerData = parentGroup.userData.marker
        }
      }
      
      if (markerData) {
        this.selectMarker(markerData)
        return markerData
      }
    }
    
    this.deselectMarker()
    return null
  }

  /**
   * 更新地形夸张倍率
   */
  updateDisplacementScale(scale) {
    this.displacementScale = scale
    if (this.moonMesh && this.moonMesh.material) {
      this.moonMesh.material.displacementScale = scale
    }
  }

  /**
   * 设置窗口大小调整处理器
   */
  setupResizeHandler() {
    const resizeHandler = () => {
      if (!this.camera || !this.renderer) return
      
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    window.addEventListener('resize', resizeHandler)
    this.onResizeCallback = resizeHandler
  }

  /**
   * 动画循环
   */
  animate() {
    if (this._disposed || !this.renderer || !this.scene || !this.camera) return
    
    requestAnimationFrame(() => this.animate())
    
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * 销毁场景并清理资源
   */
  dispose() {
    this._disposed = true  // 停止动画循环

    if (this.onResizeCallback) {
      window.removeEventListener('resize', this.onResizeCallback)
    }
    
    // 清理标注
    this.clearAllMarkers()
    this.clearHighlightRings()
    
    if (this.renderer) {
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
      }
      this.renderer.dispose()
    }
    
    if (this.scene) {
      const cleanScene = (obj) => {
        while (obj.children.length > 0) {
          const child = obj.children[0]
          obj.remove(child)
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose())
              } else {
                child.material.dispose()
              }
            }
          }
          cleanScene(child)
        }
      }
      cleanScene(this.scene)
    }
    
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.moonMesh = null
    this.markerGroups.clear()
    this.clickableMarkers = []
    this.ringMeshes = []
    this.selectedMarker = null
    this._loadedMarkers = []
    this._colorTexture = null
    this._heightTexture = null
  }
}
