/**
 * 火星地理工具函数
 * 负责经纬度与 Three.js 坐标系的转换、标注分类等
 */

import * as THREE from 'three'

// 火星平均半径（单位：公里）
export const MARS_RADIUS_KM = 3389.5

// 标注类别颜色映射（以橙红系为主色调体现火星风格）
export const MARKER_CATEGORY_COLORS = {
  landing_site: 0xff7043, // 橙红 - 着陆/巡视点
  volcano:      0xff5722, // 深橙 - 火山
  canyon:       0xd84315, // 棕红 - 峡谷
  crater:       0xffa726, // 琥珀 - 撞击坑
  plain:        0xe64a19, // 砖红 - 平原
  basin:        0xbf360c, // 暗红 - 盆地
  polar_cap:    0x90caf9, // 浅蓝 - 极冠
  other:        0xffffff  // 白色 - 其他
}

/**
 * 将火星面经纬度（十进制度）转换为 Three.js Vector3 坐标
 * @param {number} lonDeg 经度 (East +, West -)，使用行星质心坐标系（MOLA 约定 0-360 或 -180~180）
 * @param {number} latDeg 纬度 (North +, South -)
 * @param {number} radius 球体半径（场景单位）
 * @param {number} altitude 高度偏移（用于在球体表面之上显示标注）
 * @returns {THREE.Vector3}
 */
export function lonLatToVector3(lonDeg, latDeg, radius, altitude = 0) {
  const lon = THREE.MathUtils.degToRad(lonDeg)
  const lat = THREE.MathUtils.degToRad(latDeg)
  const r = radius + altitude

  // Three.js Y 轴向上，Z 轴向前
  const x = r * Math.cos(lat) * Math.sin(lon)
  const y = r * Math.sin(lat)
  const z = r * Math.cos(lat) * Math.cos(lon)

  return new THREE.Vector3(x, y, z)
}

/**
 * 将 Three.js Vector3 坐标转换回火星面经纬度
 * @param {THREE.Vector3} position
 * @param {number} radius 球体半径
 * @returns {{ lon: number, lat: number }}
 */
export function vector3ToLonLat(position, radius) {
  const lat = Math.asin(position.y / radius)
  const lon = Math.atan2(position.x, position.z)
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
 * @param {number} cameraDistance 相机到火星中心的距离
 * @returns {boolean}
 */
export function shouldShowMarker(importance, cameraDistance) {
  if (cameraDistance > 80 && importance < 80) return false
  if (cameraDistance > 45 && importance < 60) return false
  if (cameraDistance > 25 && importance < 40) return false
  return true
}
