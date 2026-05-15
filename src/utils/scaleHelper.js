/**
 * 宇宙尺度转换工具
 * 解决太阳系尺度差异巨大、无法线性表达的核心难题
 */

// 天文单位（公里）
export const AU_KM = 149597870.7

// 渲染比例：1 AU → 多少渲染单位（线性映射，保持真实轨道比例）
const RENDER_SCALE = 30

/**
 * 对数尺度映射（保留兼容，不再使用）
 */
export function auToLogRender(au) {
  if (au <= 0) return 0
  return Math.log10(au + 0.3) * 40 + 20
}

/**
 * 线性尺度映射：将天文单位距离映射到渲染坐标距离
 * 各行星轨道间距比例与真实太阳系一致
 * @param {number} au - 天文单位
 * @returns {number} 渲染单位
 */
export function auToLinearRender(au, scale = RENDER_SCALE) {
  return au * scale
}

/**
 * 3D坐标数组（AU）转渲染坐标（线性映射）
 * 保持方向，只缩放距离，轨道间距比例真实
 * @param {number} x - X坐标（AU）
 * @param {number} y - Y坐标（AU）
 * @param {number} z - Z坐标（AU）
 * @returns {{ rx, ry, rz }} 渲染坐标
 */
export function eclipticToRender(x, y, z) {
  if (Math.abs(x) < 1e-10 && Math.abs(y) < 1e-10 && Math.abs(z) < 1e-10) {
    return { rx: 0, ry: 0, rz: 0 }
  }
  return {
    rx: x * RENDER_SCALE,
    ry: z * RENDER_SCALE,
    rz: y * RENDER_SCALE
  }
}

/**
 * 动态天体缩放：根据摄像机距离动态调整天体可见大小
 * 远处时放大（确保可见），近处时恢复真实比例
 * @param {number} baseRadius - 基础渲染半径
 * @param {number} cameraDistance - 摄像机到天体的距离
 * @param {number} refDist - 参考距离（此距离时缩放=1）
 * @param {number} minScale - 最小缩放比
 * @param {number} maxScale - 最大缩放比
 */
export function dynamicBodyScale(baseRadius, cameraDistance, refDist = 100, minScale = 0.8, maxScale = 4) {
  const scale = Math.max(minScale, Math.min(maxScale, cameraDistance / refDist))
  return baseRadius * scale
}

/**
 * 公里转天文单位
 */
export function kmToAu(km) {
  return km / AU_KM
}

/**
 * 天文单位转公里
 */
export function auToKm(au) {
  return au * AU_KM
}

/**
 * 状态向量（公里）转渲染坐标
 * 用于将JPL Horizons返回的坐标（km）映射到Three.js场景
 */
export function stateVectorToRender(xKm, yKm, zKm) {
  const xAu = kmToAu(xKm)
  const yAu = kmToAu(yKm)
  const zAu = kmToAu(zKm)
  return eclipticToRender(xAu, yAu, zAu)
}
