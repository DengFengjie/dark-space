/**
 * Three.js 交互控制模块
 * 包括：射线检测（鼠标点击/悬浮）、相机目标切换
 */
import * as THREE from 'three'

/**
 * 射线检测管理器
 * 支持点击选中天体、悬浮高亮
 */
export class BodyRaycaster {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement - renderer.domElement
   * @param {Array<THREE.Object3D>} clickableList - 可点击对象列表
   */
  constructor(camera, domElement, clickableList = []) {
    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.Points.threshold = 2
    this.mouse = new THREE.Vector2()
    this.camera = camera
    this.domElement = domElement
    this.clickableList = clickableList

    this._onClickCb = null
    this._onHoverCb = null

    this._boundClick = this._onClick.bind(this)
    this._boundMove  = this._onMouseMove.bind(this)

    domElement.addEventListener('click', this._boundClick)
    domElement.addEventListener('mousemove', this._boundMove)
  }

  /** 设置点击回调 */
  onBodyClick(fn) { this._onClickCb = fn }

  /** 设置悬浮回调 */
  onBodyHover(fn) { this._onHoverCb = fn }

  /** 更新可点击对象列表 */
  setClickableList(list) { this.clickableList = list }

  // ──────────────────────────────────────────
  _getScreenPos(event) {
    const rect = this.domElement.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((event.clientY - rect.top)  / rect.height) * 2 + 1
    }
  }

  _findHitBody(intersects) {
    for (const hit of intersects) {
      let obj = hit.object
      // 向上查找含 userData.info 的节点
      while (obj && !obj.userData?.info) obj = obj.parent
      if (obj?.userData?.info) return obj
    }
    return null
  }

  _onClick(event) {
    const { x, y } = this._getScreenPos(event)
    this.mouse.set(x, y)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObjects(this.clickableList, true)
    const body = this._findHitBody(hits)
    if (body && this._onClickCb) this._onClickCb(body)
  }

  _onMouseMove(event) {
    const { x, y } = this._getScreenPos(event)
    this.mouse.set(x, y)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObjects(this.clickableList, true)
    const body = this._findHitBody(hits)

    this.domElement.style.cursor = body ? 'pointer' : 'default'
    if (this._onHoverCb) this._onHoverCb(body)
  }

  /** 销毁监听器 */
  dispose() {
    this.domElement.removeEventListener('click', this._boundClick)
    this.domElement.removeEventListener('mousemove', this._boundMove)
  }
}

/**
 * 高亮选中天体（改变颜色/添加轮廓光）
 */
export class SelectionHighlight {
  constructor() {
    this._current = null
    this._originalColor = null
    this._originalEmissive = null
  }

  select(mesh) {
    if (this._current) this.deselect()
    if (!mesh?.material) return

    this._current = mesh
    this._originalColor = mesh.material.color.clone()
    this._originalEmissive = mesh.material.emissive?.clone() || new THREE.Color(0)

    mesh.material.emissive = new THREE.Color(0x334488)
    mesh.material.emissiveIntensity = 0.6
  }

  deselect() {
    if (!this._current?.material) { this._current = null; return }
    this._current.material.emissive = this._originalEmissive || new THREE.Color(0)
    this._current.material.emissiveIntensity = 0
    this._current = null
    this._originalColor = null
    this._originalEmissive = null
  }

  get current() { return this._current }
}

/**
 * 脉冲动画：让一个球体来回缩放，表示"活跃/选中"状态
 * 在 render loop 中每帧调用 update()
 */
export class PulseAnimation {
  constructor(mesh, speed = 1.5, amplitude = 0.08) {
    this.mesh = mesh
    this.speed = speed
    this.amplitude = amplitude
    this._baseScale = mesh.scale.x
    this._t = 0
    this._active = false
  }

  start() { this._active = true }
  stop() {
    this._active = false
    if (this.mesh) this.mesh.scale.setScalar(this._baseScale)
  }

  update(delta) {
    if (!this._active || !this.mesh) return
    this._t += delta * this.speed
    const s = this._baseScale + Math.sin(this._t) * this.amplitude * this._baseScale
    this.mesh.scale.setScalar(s)
  }
}
