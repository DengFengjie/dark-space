/**
 * 月球地理工具函数
 * 负责经纬度与Three.js坐标系的转换、标注分类等
 */

import * as THREE from 'three'

// 月球半径（单位：公里，但在场景中会缩放）
export const MOON_RADIUS_KM = 1737.4

// 标注类别颜色映射
export const MARKER_CATEGORY_COLORS = {
  landing_site: 0x64a3ff, // 蓝色 - 任务点
  crater: 0xff6b4a,       // 橙色 - 陨石坑
  mare: 0x4fc3f7,         // 浅蓝 - 月海
  montes: 0x8bc34a,       // 绿色 - 山脉
  mons: 0x8bc34a,         // 绿色 - 山峰
  vallis: 0xff9800,       // 深橙 - 月谷
  rupes: 0x9c27b0,        // 紫色 - 断崖
  other: 0xffffff          // 白色 - 其他
}

/**
 * 将月面经纬度（十进制度）转换为 Three.js Vector3 坐标
 * @param {number} lonDeg 经度 (East +, West -)
 * @param {number} latDeg 纬度 (North +, South -)
 * @param {number} radius 球体半径
 * @param {number} altitude 高度偏移（用于在球体表面之上显示标注）
 * @returns {THREE.Vector3}
 */
export function lonLatToVector3(lonDeg, latDeg, radius, altitude = 0) {
  // NASA CGI Moon Kit 地图中心是 0° 经度，但有时需要调整对齐
  // 如果发现标注位置偏移，可以在此处调整 lonOffset
  const lonOffset = 0
  const adjustedLon = lonDeg + lonOffset

  const lon = THREE.MathUtils.degToRad(adjustedLon)
  const lat = THREE.MathUtils.degToRad(latDeg)
  const r = radius + altitude

  // 注意：Three.js 的 Y 轴是向上，Z 轴是向前
  // 月球坐标系：X 向右，Y 向上，Z 向屏幕外
  const x = r * Math.cos(lat) * Math.sin(lon)
  const y = r * Math.sin(lat)
  const z = r * Math.cos(lat) * Math.cos(lon)

  return new THREE.Vector3(x, y, z)
}

/**
 * 将 Three.js Vector3 坐标转换回月面经纬度
 * @param {THREE.Vector3} position 
 * @param {number} radius 球体半径
 * @returns {{ lon: number, lat: number }}
 */
export function vector3ToLonLat(position, radius) {
  const x = position.x
  const y = position.y
  const z = position.z

  const lat = Math.asin(y / radius)
  const lon = Math.atan2(x, z)

  return {
    lon: THREE.MathUtils.radToDeg(lon),
    lat: THREE.MathUtils.radToDeg(lat)
  }
}

/**
 * 获取标注类别的颜色
 * @param {string} category 
 * @returns {number}
 */
export function getMarkerColor(category) {
  return MARKER_CATEGORY_COLORS[category] || MARKER_CATEGORY_COLORS.other
}

/**
 * 计算标注的重要性得分（用于动态显示控制）
 * @param {Object} marker 
 * @returns {number}
 */
export function computeMarkerImportance(marker) {
  // importance 字段已预先计算，直接返回
  return marker.importance || 50
}

/**
 * 格式化坐标显示
 * @param {number} lat 
 * @param {number} lon 
 * @returns {string}
 */
export function formatCoordinates(lat, lon) {
  const latStr = lat >= 0 ? `${lat.toFixed(3)}°N` : `${Math.abs(lat).toFixed(3)}°S`
  const lonStr = lon >= 0 ? `${lon.toFixed(3)}°E` : `${Math.abs(lon).toFixed(3)}°W`
  return `${latStr}, ${lonStr}`
}

/**
 * 根据相机距离和重要性判断是否应显示标注
 * @param {number} importance 
 * @param {number} cameraDistance 相机到月球中心的距离
 * @returns {boolean}
 */
export function shouldShowMarker(importance, cameraDistance) {
  if (cameraDistance > 80 && importance < 80) return false
  if (cameraDistance > 45 && importance < 60) return false
  if (cameraDistance > 25 && importance < 40) return false
  return true
}