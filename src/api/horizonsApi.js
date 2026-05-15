/**
 * JPL Horizons 星历数据 API 封装
 * 通过后端代理请求（避免跨域 & API频率限制）
 * 文档：https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */

const BASE_URL = '/api/horizons'

/**
 * 已知探测器的 Horizons 天体编号
 */
export const PROBE_IDS = {
  voyager1:          '-31',
  voyager2:          '-32',
  newHorizons:       '-98',
  cassini:           '-82',
  juno:              '-61',
  dawn:              '-203',
  rosetta:           '-226',
  tianwen1:          '-5',
  parker:            'PSP',   // Parker Solar Probe
  galileo:           '-77',
  pioneer:           '-23',   // Pioneer 10
  ace:               '-92',   // Advanced Composition Explorer
  deepImpact:        '-140',  // Deep Impact
  marsGlobalSurveyor:'-94',   // Mars Global Surveyor
}

/**
 * 获取天体星历数据（位置、速度）
 * @param {string} target - Horizons天体编号
 * @param {string} startTime - 开始时间 'YYYY-MM-DD'
 * @param {string} stopTime - 结束时间 'YYYY-MM-DD'
 * @param {string} stepSize - 采样步长，如 '30d', '1m'
 * @returns {Promise<Array<{time, x, y, z}>>} 坐标点数组（AU）
 */
export async function getEphemeris(target, startTime, stopTime, stepSize = '30d') {
  try {
    const params = new URLSearchParams({ target, startTime, stopTime, stepSize })
    const res = await fetch(`${BASE_URL}/ephemeris?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.success ? data.data : []
  } catch (err) {
    console.warn('JPL Horizons API 请求失败，使用模拟数据:', err.message)
    return []
  }
}

/**
 * 获取探测器完整轨迹
 * @param {string} probeKey - 探测器键名（见 PROBE_IDS）
 * @param {string} startTime - 开始时间
 * @param {string} stopTime - 结束时间
 * @returns {Promise<Array>}
 */
export async function getProbeTrajectory(probeKey, startTime, stopTime) {
  const target = PROBE_IDS[probeKey]
  if (!target) {
    console.warn(`未知探测器: ${probeKey}`)
    return []
  }
  return getEphemeris(target, startTime, stopTime, '30d')
}

/**
 * 探测器信息配置
 */
export const PROBE_CONFIG = {
  voyager1: {
    name: '旅行者1号',
    nameEn: 'Voyager 1',
    agency: 'NASA',
    launchDate: '1977-09-05',
    color: 0x00FFFF,
    description: '目前飞行最远的人造天体，已飞越太阳系边界进入星际空间',
    milestones: [
      { date: '1979-03-05', event: '飞越木星' },
      { date: '1980-11-12', event: '飞越土星' },
      { date: '1990-02-14', event: '拍摄"暗淡蓝点"照片' },
      { date: '2012-08-25', event: '进入星际空间' }
    ],
    currentDistance: '约232.7亿公里 (155 AU)',
    status: '运行中（远程通信中）'
  },
  voyager2: {
    name: '旅行者2号',
    nameEn: 'Voyager 2',
    agency: 'NASA',
    launchDate: '1977-08-20',
    color: 0x00FF88,
    description: '唯一探访过太阳系所有四颗气态巨星的探测器',
    milestones: [
      { date: '1979-07-09', event: '飞越木星' },
      { date: '1981-08-25', event: '飞越土星' },
      { date: '1986-01-24', event: '飞越天王星' },
      { date: '1989-08-25', event: '飞越海王星' },
      { date: '2018-11-05', event: '进入星际空间' }
    ],
    currentDistance: '约194.3亿公里 (130 AU)',
    status: '运行中（星际空间）'
  },
  newHorizons: {
    name: '新视野号',
    nameEn: 'New Horizons',
    agency: 'NASA',
    launchDate: '2006-01-19',
    color: 0xFFAA00,
    description: '首个近距离探测冥王星和柯伊伯带天体的探测器',
    milestones: [
      { date: '2007-02-28', event: '飞越木星获得引力加速' },
      { date: '2015-07-14', event: '飞越冥王星' },
      { date: '2019-01-01', event: '飞越阿罗科思（Arrokoth）' }
    ],
    currentDistance: '约90.7亿公里 (60.7 AU)',
    status: '运行中（柯伊伯带）'
  }
}
