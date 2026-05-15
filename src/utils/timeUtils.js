/**
 * 时间工具函数
 * 处理Unix时间戳、儒略日、UTC日期之间的转换
 */

/**
 * Unix时间戳（毫秒）转儒略日
 */
export function unixToJulian(unixMs) {
  return (unixMs / 86400000) + 2440587.5
}

/**
 * 儒略日转Unix时间戳（毫秒）
 */
export function julianToUnix(jd) {
  return (jd - 2440587.5) * 86400000
}

/**
 * 计算J2000历元以来的儒略世纪数（用于轨道根数计算）
 * J2000.0 = JD 2451545.0
 */
export function julianCenturies(jd) {
  return (jd - 2451545.0) / 36525.0
}

/**
 * 格式化Unix时间戳为可读日期字符串
 * @param {number} unixMs - Unix时间戳（毫秒）
 * @param {string} locale - 语言环境，默认中文
 * @returns {string} 格式化的日期字符串
 */
export function formatDate(unixMs, locale = 'zh-CN') {
  return new Date(unixMs).toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 格式化为ISO日期字符串 YYYY-MM-DD
 */
export function formatISODate(unixMs) {
  return new Date(unixMs).toISOString().split('T')[0]
}

/**
 * 格式化年份
 */
export function formatYear(unixMs) {
  return new Date(unixMs).getFullYear()
}

/**
 * ISO日期字符串转Unix时间戳（毫秒）
 */
export function isoToUnix(isoStr) {
  return new Date(isoStr).getTime()
}

/**
 * ISO日期字符串（如 "2024-01-15"）转儒略日
 */
export function dateStrToJulian(dateStr) {
  return (new Date(dateStr).getTime() / 86400000) + 2440587.5
}

/**
 * 儒略日转公历日期对象
 * @param {number} jd - 儒略日
 * @returns {{ year, month, day }}
 */
export function julianToGregorian(jd) {
  const l = Math.floor(jd + 0.5) + 68569
  const n = Math.floor(4 * l / 146097)
  const ll = l - Math.floor((146097 * n + 3) / 4)
  const i = Math.floor(4000 * (ll + 1) / 1461001)
  const lll = ll - Math.floor(1461 * i / 4) + 31
  const j = Math.floor(80 * lll / 2447)
  const day = lll - Math.floor(2447 * j / 80)
  const month = j + 2 - 12 * Math.floor(j / 11)
  const year = 100 * (n - 49) + i + Math.floor(j / 11)
  return { year, month, day }
}

/**
 * 时间缩放标签配置
 * value 单位：每帧推进的毫秒数（按60fps计算）
 */
// value = 每小时毫秒数 / 60fps = 每帧推进毫秒数
const HOUR_PER_FRAME = 3600000 / 60
export const TIME_SCALES = [
  { label: '12小时/秒', value: HOUR_PER_FRAME * 12 },  // 720000
  { label: '24小时/秒', value: HOUR_PER_FRAME * 24 },  // 1440000
  { label: '2天/秒',    value: HOUR_PER_FRAME * 48 },  // 2880000
  { label: '1周/秒',    value: HOUR_PER_FRAME * 168 }  // 10080000
]
