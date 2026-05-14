/**
 * Three.js 场景初始化模块
 * 负责创建场景、相机、渲染器、轨道控制器
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 初始化Three.js场景
 * @param {HTMLElement} container - 挂载容器
 * @param {Object} options - 配置选项
 * @returns {{ scene, camera, renderer, controls, onResize }}
 */
export function initThree(container, options = {}) {
  // ── 场景 ──
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000008)

  // ── 相机 ──
  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight
  const camera = new THREE.PerspectiveCamera(
    options.fov || 60,
    w / h,
    options.near || 0.01,
    options.far || 8000
  )
  camera.position.set(
    options.cameraX ?? 0,
    options.cameraY ?? 120,
    options.cameraZ ?? 280
  )
  camera.lookAt(0, 0, 0)

  // ── 渲染器 ──
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,  // 解决深度冲突（Z-fighting）
    powerPreference: 'high-performance'
  })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  container.appendChild(renderer.domElement)

  // ── 轨道控制器 ──
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = options.minDistance ?? 1
  controls.maxDistance = options.maxDistance ?? 4000
  controls.enablePan = true
  controls.panSpeed = 0.8
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 1.2
  controls.target.set(0, 0, 0)
  controls.update()

  // ── 响应窗口大小 ──
  const onResize = () => {
    const cw = container.clientWidth || window.innerWidth
    const ch = container.clientHeight || window.innerHeight
    camera.aspect = cw / ch
    camera.updateProjectionMatrix()
    renderer.setSize(cw, ch)
  }
  window.addEventListener('resize', onResize)

  return { scene, camera, renderer, controls, onResize }
}

/**
 * 销毁Three.js场景，释放内存
 */
export function disposeThree(scene, renderer, onResize) {
  if (onResize) window.removeEventListener('resize', onResize)

  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      } else {
        if (obj.material.map) obj.material.map.dispose()
        obj.material.dispose()
      }
    }
  })

  if (renderer) {
    renderer.renderLists.dispose()
    renderer.dispose()
  }
}

/**
 * 平滑相机飞行动画（使用线性插值+缓动函数）
 * @param {THREE.Camera} camera
 * @param {OrbitControls} controls
 * @param {THREE.Vector3} targetPos - 相机目标位置
 * @param {THREE.Vector3} lookAtPos - 注视点位置
 * @param {number} duration - 动画时长（毫秒）
 * @returns {Promise<void>}
 */
export function flyToPosition(camera, controls, targetPos, lookAtPos, duration = 1200) {
  const startCamPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const start = performance.now()

  return new Promise((resolve) => {
    const tick = (now) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = easeInOutCubic(t)

      camera.position.lerpVectors(startCamPos, targetPos, eased)
      controls.target.lerpVectors(startTarget, lookAtPos, eased)
      controls.update()

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/** 三次缓动函数 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
