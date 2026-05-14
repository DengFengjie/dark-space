<template>
  <div class="scene-page">
    <header class="page-header">
      <button @click="goHome" class="back-btn">← 返回首页</button>
      <h1 class="page-title">地月系统</h1>
      <nav class="view-nav">
        <router-link to="/solar-system" class="view-link">太阳系</router-link>
        <router-link to="/mars" class="view-link">火星</router-link>
        <router-link to="/moon" class="view-link active">月球</router-link>
      </nav>
    </header>

    <div class="info-panel">
      <div class="info-card">
        <h3>月球</h3>
        <p>月球是地球唯一的天然卫星，对地球的潮汐和气候有重要影响。月球表面布满陨石坑和月海。</p>
        <div class="stats">
          <div class="stat-item">
            <span class="label">直径</span>
            <span class="value">3,474公里</span>
          </div>
          <div class="stat-item">
            <span class="label">距地球</span>
            <span class="value">38.4万公里</span>
          </div>
          <div class="stat-item">
            <span class="label">公转周期</span>
            <span class="value">27.3地球日</span>
          </div>
          <div class="stat-item">
            <span class="label">表面温度</span>
            <span class="value">-173°C ~ 127°C</span>
          </div>
        </div>
      </div>
    </div>

    <div class="controls">
      <button @click="toggleOrbits" class="control-btn">
        {{ showOrbits ? '隐藏' : '显示' }}轨道
      </button>
      <button @click="toggleRotation" class="control-btn">
        {{ isRotating ? '暂停' : '恢复' }}旋转
      </button>
      <button @click="resetCamera" class="control-btn">重置视角</button>
    </div>

    <div ref="canvasContainer" class="canvas-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const router = useRouter()
const canvasContainer = ref(null)
const showOrbits = ref(true)
const isRotating = ref(true)

let scene, camera, renderer, controls
let celestialObjects = []
let orbitLines = []
let animationId

const goHome = () => router.push('/')

const toggleOrbits = () => {
  showOrbits.value = !showOrbits.value
  orbitLines.forEach(orbit => { orbit.visible = showOrbits.value })
}

const toggleRotation = () => {
  isRotating.value = !isRotating.value
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.set(0, 5, 15)
  controls.update()
}

const createStarfield = () => {
  const geometry = new THREE.BufferGeometry()
  const vertices = []
  for (let i = 0; i < 10000; i++) {
    vertices.push(
      THREE.MathUtils.randFloatSpread(2000),
      THREE.MathUtils.randFloatSpread(2000),
      THREE.MathUtils.randFloatSpread(2000)
    )
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  const material = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.7 })
  const stars = new THREE.Points(geometry, material)
  scene.add(stars)
}

const createCelestialBody = (radius, color, position, name) => {
  const geometry = new THREE.SphereGeometry(radius, 64, 64)
  const material = new THREE.MeshPhongMaterial({ color, shininess: 30, specular: 0x111111 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(position)
  mesh.name = name
  scene.add(mesh)
  return mesh
}

const createOrbit = (radius, color = 0x444444) => {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0)
  const points = curve.getPoints(100)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
  const orbit = new THREE.Line(geometry, material)
  orbit.rotation.x = -Math.PI / 2
  scene.add(orbit)
  orbitLines.push(orbit)
  return orbit
}

const initScene = () => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(0x000011)
  canvasContainer.value.appendChild(renderer.domElement)
  
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 5
  controls.maxDistance = 500
  
  createStarfield()
  
  // 地球
  const earth = createCelestialBody(4, 0x6B93D6, new THREE.Vector3(-8, 0, 0), '地球')
  celestialObjects.push({ mesh: earth, distance: 0, speed: 0.005, angle: 0 })
  
  // 月球
  const moon = createCelestialBody(1.5, 0xC0C0C0, new THREE.Vector3(8, 0, 0), '月球')
  celestialObjects.push({ mesh: moon, distance: 16, speed: 0.02, angle: 0 })
  createOrbit(16, 0x666666)
  
  const sunLight = new THREE.PointLight(0xFFFFFF, 1.5, 200)
  sunLight.position.set(50, 50, 50)
  scene.add(sunLight)
  
  const ambientLight = new THREE.AmbientLight(0x444444)
  scene.add(ambientLight)
  
  // 地球大气层效果
  const atmosphereGeometry = new THREE.SphereGeometry(4.2, 32, 32)
  const atmosphereMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x87CEEB,
    transparent: true,
    opacity: 0.2
  })
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  earth.add(atmosphere)
  
  resetCamera()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  if (isRotating.value) {
    celestialObjects.forEach(obj => {
      if (obj.speed > 0) {
        obj.angle += obj.speed
        obj.mesh.position.x = Math.cos(obj.angle) * obj.distance
        obj.mesh.position.z = Math.sin(obj.angle) * obj.distance
      }
      obj.mesh.rotation.y += 0.005
    })
  }
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  initScene()
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
})
</script>

<style scoped>
.scene-page {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000;
}

.page-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
  padding: 20px 40px;
  display: flex;
  align-items: center;
  gap: 30px;
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 10px 20px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  backdrop-filter: blur(10px);
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-5px);
}

.page-title {
  color: #fff;
  font-size: 28px;
  text-shadow: 0 0 10px rgba(100, 150, 255, 0.8);
}

.view-nav {
  margin-left: auto;
  display: flex;
  gap: 15px;
}

.view-link {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 10px 25px;
  border-radius: 25px;
  text-decoration: none;
  transition: all 0.3s ease;
  font-size: 14px;
  backdrop-filter: blur(10px);
}

.view-link:hover,
.view-link.active {
  background: rgba(100, 150, 255, 0.3);
  border-color: rgba(100, 150, 255, 0.8);
  box-shadow: 0 0 20px rgba(100, 150, 255, 0.5);
}

.info-panel {
  position: absolute;
  left: 20px;
  top: 100px;
  z-index: 100;
  max-width: 350px;
}

.info-card {
  background: rgba(0, 10, 30, 0.85);
  border: 1px solid rgba(100, 150, 255, 0.3);
  border-radius: 15px;
  padding: 20px;
  backdrop-filter: blur(15px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.info-card h3 {
  color: #64a3ff;
  font-size: 22px;
  margin-bottom: 10px;
  border-bottom: 2px solid rgba(100, 150, 255, 0.3);
  padding-bottom: 8px;
}

.info-card p {
  color: #ccc;
  line-height: 1.6;
  margin-bottom: 15px;
  font-size: 14px;
}

.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 3px solid #64a3ff;
}

.stat-item .label {
  color: #999;
  font-size: 13px;
}

.stat-item .value {
  color: #fff;
  font-weight: bold;
  font-size: 13px;
}

.controls {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  gap: 15px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 12px 30px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(100, 150, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(100, 150, 255, 0.3);
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
