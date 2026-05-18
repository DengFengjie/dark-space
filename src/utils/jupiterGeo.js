/**
 * 木星地理工具函数
 * 负责经纬度与 Three.js 坐标系的转换、标注分类颜色等
 *
 * 注意：木星是流体大气，表面特征（云带、风暴）随时间漂移，
 * 页面标注坐标均为可视化用途的近似值。
 */

import * as THREE from 'three'

/** 木星平均赤道半径（单位：公里） */
export const JUPITER_RADIUS_KM = 69911

/** 木星极半径（扁率约 0.0649） */
export const JUPITER_POLAR_RADIUS_KM = 66854

/**
 * 标注类别颜色映射
 * 整体使用木星标志性暖橙 / 金黄 / 奶白色系
 */
export const MARKER_CATEGORY_COLORS = {
  storm:       0xFFB347, // 橙金  — 大红斑等风暴
  belt:        0xC78C4E, // 棕橙  — 云带（暗区 Belt）
  zone:        0xFFE4B5, // 奶白  — 亮带（Zone）
  polar:       0x9DB5D4, // 冰蓝  — 极区气旋
  mission:     0x6DB9EF, // 蓝白  — 探测任务
  moon_shadow: 0xBBBBBB, // 灰    — 卫星凌日/投影
  other:       0xFFFFFF  // 白    — 其他
}

/**
 * 将木星系 System-III 经纬度（十进制度）转换为 Three.js Vector3
 *
 * @param {number} lonDeg 经度，0-360（System III，东正），也接受 -180~180
 * @param {number} latDeg 纬度，北正南负（planetographic / planetocentric 均可，差异对可视化影响微小）
 * @param {number} radius 球体半径（场景单位）
 * @param {number} altitude 距球面的高度偏移（场景单位，用于让标注浮于球面上方）
 * @returns {THREE.Vector3}
 */
export function lonLatToVector3(lonDeg, latDeg, radius, altitude = 0) {
  const lon = THREE.MathUtils.degToRad(lonDeg)
  const lat = THREE.MathUtils.degToRad(latDeg)
  const r = radius + altitude

  // Three.js: Y 轴向上，赤道面为 XZ 平面
  const x = r * Math.cos(lat) * Math.sin(lon)
  const y = r * Math.sin(lat)
  const z = r * Math.cos(lat) * Math.cos(lon)

  return new THREE.Vector3(x, y, z)
}

/**
 * 将 Three.js Vector3 坐标转换回经纬度
 * @param {THREE.Vector3} position
 * @param {number} radius
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
 * 根据类别获取标注颜色（Number）
 * @param {string} category
 * @returns {number}
 */
export function getMarkerColor(category) {
  return MARKER_CATEGORY_COLORS[category] ?? MARKER_CATEGORY_COLORS.other
}

/**
 * 格式化坐标字符串，统一显示为 NS / EW
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatCoordinates(lat, lon) {
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`
  const lonStr = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`
  return `${latStr}, ${lonStr}`
}

/**
 * 根据相机距离和重要性决定标注是否可见（LOD）
 * @param {number} importance   0-100
 * @param {number} cameraDistance  相机到木星中心的距离（场景单位）
 * @returns {boolean}
 */
export function shouldShowMarker(importance, cameraDistance) {
  if (cameraDistance > 80 && importance < 80) return false
  if (cameraDistance > 45 && importance < 60) return false
  if (cameraDistance > 25 && importance < 40) return false
  return true
}
