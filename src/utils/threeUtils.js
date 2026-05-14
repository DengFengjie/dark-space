import * as THREE from 'three'

/**
 * Three.js 工具类
 * 提供通用的3D场景创建和管理功能
 */
export class ThreeUtils {
  /**
   * 创建星空背景
   */
  static createStarfield(scene, starCount = 10000, spread = 2000) {
    const geometry = new THREE.BufferGeometry()
    const vertices = []
    
    for (let i = 0; i < starCount; i++) {
      vertices.push(
        THREE.MathUtils.randFloatSpread(spread),
        THREE.MathUtils.randFloatSpread(spread),
        THREE.MathUtils.randFloatSpread(spread)
      )
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    
    const material = new THREE.PointsMaterial({ 
      color: 0xFFFFFF, 
      size: 0.7,
      transparent: true,
      opacity: 0.8
    })
    
    const stars = new THREE.Points(geometry, material)
    scene.add(stars)
    return stars
  }

  /**
   * 创建天体（球体）
   */
  static createCelestialBody(scene, radius, color, position, name, options = {}) {
    const geometry = new THREE.SphereGeometry(radius, options.segments || 64, options.segments || 64)
    
    const materialConfig = {
      color,
      shininess: options.shininess || 30,
      specular: options.specular || 0x111111
    }
    
    if (options.emissive) {
      materialConfig.emissive = options.emissive
      materialConfig.emissiveIntensity = options.emissiveIntensity || 0.5
    }
    
    if (options.transparent) {
      materialConfig.transparent = true
      materialConfig.opacity = options.opacity || 0.5
    }
    
    const material = new THREE.MeshPhongMaterial(materialConfig)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.name = name
    scene.add(mesh)
    return mesh
  }

  /**
   * 创建轨道线
   */
  static createOrbit(scene, radius, color = 0x444444, opacity = 0.5) {
    const curve = new THREE.EllipseCurve(
      0, 0,
      radius, radius,
      0, 2 * Math.PI,
      false,
      0
    )
    
    const points = curve.getPoints(100)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ 
      color, 
      transparent: true, 
      opacity 
    })
    
    const orbit = new THREE.Line(geometry, material)
    orbit.rotation.x = -Math.PI / 2
    scene.add(orbit)
    return orbit
  }

  /**
   * 创建点光源
   */
  static createPointLight(color, intensity, distance, position) {
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.copy(position)
    return light
  }

  /**
   * 创建环境光
   */
  static createAmbientLight(color = 0x333333, intensity = 1) {
    return new THREE.AmbientLight(color, intensity)
  }

  /**
   * 初始化基础场景
   */
  static initScene(container, options = {}) {
    const scene = new THREE.Scene()
    
    const camera = new THREE.PerspectiveCamera(
      options.fov || 60,
      window.innerWidth / window.innerHeight,
      options.near || 0.1,
      options.far || 2000
    )
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: options.antialias !== false, 
      alpha: options.alpha !== false 
    })
    
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(options.bgColor || 0x000011)
    
    if (container) {
      container.appendChild(renderer.domElement)
    }
    
    return { scene, camera, renderer }
  }

  /**
   * 计算椭圆轨道上的位置
   */
  static calculateOrbitPosition(distance, angle, inclination = 0) {
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    const y = Math.sin(inclination) * distance
    
    return new THREE.Vector3(x, y, z)
  }

  /**
   * 创建土星环
   */
  static createPlanetaryRing(innerRadius, outerRadius, color, opacity = 0.6) {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64)
    const material = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity 
    })
    const ring = new THREE.Mesh(geometry, material)
    ring.rotation.x = Math.PI / 2
    return ring
  }

  /**
   * 创建大气层效果
   */
  static createAtmosphere(radius, color, opacity = 0.2) {
    const geometry = new THREE.SphereGeometry(radius * 1.05, 32, 32)
    const material = new THREE.MeshPhongMaterial({ 
      color,
      transparent: true,
      opacity 
    })
    return new THREE.Mesh(geometry, material)
  }

  /**
   * 处理窗口大小调整
   */
  static handleResize(camera, renderer) {
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    
    window.addEventListener('resize', onResize)
    return onResize
  }

  /**
   * 销毁场景资源
   */
  static disposeScene(scene, renderer) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose()
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose())
        } else {
          object.material.dispose()
        }
      }
    })
    renderer.dispose()
  }
}

/**
 * 动画管理器
 */
export class AnimationManager {
  constructor() {
    this.objects = []
    this.animationId = null
    this.isRotating = true
  }

  /**
   * 添加动画对象
   */
  addObject(obj) {
    this.objects.push(obj)
  }

  /**
   * 移除动画对象
   */
  removeObject(name) {
    this.objects = this.objects.filter(obj => obj.mesh.name !== name)
  }

  /**
   * 开始动画循环
   */
  start(camera, renderer, controls) {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      
      if (this.isRotating) {
        this.objects.forEach(obj => {
          // 公转
          if (obj.speed > 0 && obj.distance > 0) {
            obj.angle += obj.speed
            obj.mesh.position.x = Math.cos(obj.angle) * obj.distance
            obj.mesh.position.z = Math.sin(obj.angle) * obj.distance
          }
          
          // 自转
          if (obj.rotationSpeed !== 0) {
            obj.mesh.rotation.y += obj.rotationSpeed || 0.005
          }
        })
      }
      
      if (controls) {
        controls.update()
      }
      
      renderer.render(scene, camera)
    }
    
    animate()
  }

  /**
   * 停止动画
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * 切换旋转状态
   */
  toggleRotation() {
    this.isRotating = !this.isRotating
  }

  /**
   * 清空所有对象
   */
  clear() {
    this.objects = []
  }
}

/**
 * 场景管理器
 */
export class SceneManager {
  constructor(container) {
    this.container = container
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.animationManager = new AnimationManager()
    this.orbitLines = []
  }

  /**
   * 初始化场景
   */
  init() {
    const { scene, camera, renderer } = ThreeUtils.initScene(this.container)
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    
    // 创建星空背景
    ThreeUtils.createStarfield(scene)
    
    return this
  }

  /**
   * 清理场景
   */
  cleanup() {
    this.animationManager.stop()
    if (this.renderer) {
      ThreeUtils.disposeScene(this.scene, this.renderer)
    }
    this.orbitLines = []
  }

  /**
   * 显示/隐藏轨道
   */
  toggleOrbits(show) {
    this.orbitLines.forEach(orbit => {
      orbit.visible = show
    })
  }

  /**
   * 添加轨道线
   */
  addOrbit(radius, color = 0x444444) {
    const orbit = ThreeUtils.createOrbit(this.scene, radius, color)
    this.orbitLines.push(orbit)
    return orbit
  }
}
