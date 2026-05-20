/**
 * JPL Horizons 星历数据 API 封装
 * 通过后端代理请求（避免跨域 & API频率限制）
 * 文档：https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */

const BASE_URL = '/api/horizons'

/**
 * 八大行星的 Horizons 天体编号
 * 格式：NAIF Body ID（整数字符串）
 * 参考：https://ssd.jpl.nasa.gov/?horizons_doc#target
 */
export const PLANET_IDS = {
  mercury: '199',
  venus:   '299',
  earth:   '399',
  mars:    '499',
  jupiter: '599',
  saturn:  '699',
  uranus:  '799',
  neptune: '899',
}

/**
 * 各行星一个完整公转周期（天），用于决定请求时间范围
 */
const PLANET_PERIODS_DAYS = {
  mercury:  87.97,
  venus:   224.70,
  earth:   365.25,
  mars:    686.97,
  jupiter: 4332.59,
  saturn:  10759.22,
  uranus:  30688.5,
  neptune: 60182.0,
}

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
  parker:            '-96',   // Parker Solar Probe (NAIF ID -96; 'PSP' 是文本名称会被当作小天体查询导致报错)
  galileo:           '-77',
  pioneer:           '-23',   // Pioneer 10
  ace:               '-92',   // Advanced Composition Explorer
  deepImpact:        '-140',  // Deep Impact
  // marsGlobalSurveyor: JPL Horizons Web API 中不存在该航天器的星历数据，使用本地生成轨迹替代
}

/**
 * 获取天体星历数据（位置、速度）
 * @param {string} target - Horizons天体编号
 * @param {string} startTime - 开始时间 'YYYY-MM-DD'
 * @param {string} stopTime - 结束时间 'YYYY-MM-DD'
 * @param {string} stepSize - 采样步长，如 '30d', '1m'
 * @returns {Promise<Array<{time, x, y, z}>>} 坐标点数组（AU）
 */
export async function getEphemeris(target, startTime, stopTime, stepSize = '1 d') {
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
  return getEphemeris(target, startTime, stopTime, '30 d')
}

/**
 * 批量获取多个探测器的轨迹（单次请求代替并发 N 次）
 * @param {Array<{key: string, probeKey: string, startTime: string, stopTime: string, stepSize?: string}>} requests
 *   - key: 返回数据中的键名（可与 probeKey 相同）
 *   - probeKey: 探测器键名（见 PROBE_IDS）
 *   - startTime / stopTime: 时间范围
 *   - stepSize: 可选，默认 '30d'
 * @returns {Promise<Record<string, Array<{time, x, y, z}>>>}
 *   返回 { voyager1: [...], voyager2: [...], ... }，失败的探测器返回空数组
 */
export async function getBatchProbeTrajectories(requests) {
  const items = requests
    .map(({ key, probeKey, startTime, stopTime, stepSize = '30 d' }) => {
      const target = PROBE_IDS[probeKey]
      if (!target) {
        console.warn(`未知探测器: ${probeKey}`)
        return null
      }
      return { key, target, startTime, stopTime, stepSize }
    })
    .filter(Boolean)

  if (items.length === 0) return {}

  try {
    const res = await fetch(`${BASE_URL}/ephemeris/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '批量请求失败')

    // 将 { key: { data: [...] } } 转换为 { key: [...] }
    const result = {}
    for (const [key, val] of Object.entries(data.data || {})) {
      result[key] = Array.isArray(val.data) ? val.data : []
    }
    return result
  } catch (err) {
    console.warn('JPL Horizons 批量 API 请求失败，使用模拟数据:', err.message)
    // 全部返回空数组，让调用方回退本地生成
    return Object.fromEntries(items.map(({ key }) => [key, []]))
  }
}

/**
 * 从 JPL Horizons 获取指定行星在某日期的精确位置
 * @param {string} planetKey  - 行星键名（mercury/venus/…/neptune）
 * @param {string} dateStr    - 日期字符串 'YYYY-MM-DD'
 * @returns {Promise<{x,y,z}|null>} 日心黄道直角坐标（AU），失败返回 null
 */
export async function getPlanetPosition(planetKey, dateStr) {
  const target = PLANET_IDS[planetKey]
  if (!target) {
    console.warn(`未知行星: ${planetKey}`)
    return null
  }
  // 取当日 + 次日，只需 1 个数据点
  const d    = new Date(dateStr)
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
  const data = await getEphemeris(target, dateStr, next, '1 d')
  return data && data.length > 0 ? data[0] : null
}

/**
 * 从 JPL Horizons 获取行星完整轨道路径（一个公转周期）
 * 后端路由 GET /api/horizons/planet-orbit 会自动计算时间范围和步长
 * @param {string} planetKey  - 行星键名
 * @param {string} centerDate - 轨道中心日期（用于确定当前轨道根数）
 * @param {number} steps      - 采样点数（默认 180）
 * @returns {Promise<Array<{time,x,y,z}>>} 轨道路径点数组，失败返回空数组
 */
export async function getPlanetOrbitPath(planetKey, centerDate, steps = 180) {
  try {
    const params = new URLSearchParams({ planet: planetKey, centerDate, steps })
    const res = await fetch(`${BASE_URL}/planet-orbit?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.success ? data.data : []
  } catch (err) {
    console.warn(`JPL Horizons 行星轨道请求失败(${planetKey}):`, err.message)
    return []
  }
}

/**
 * 批量获取多行星在同一日期的精确位置（供帧级更新使用）
 * @param {string[]} planetKeys - 行星键名数组，如 ['mars','jupiter']
 * @param {string} dateStr      - 日期字符串 'YYYY-MM-DD'
 * @returns {Promise<Record<string,{x,y,z}>>}
 *   { mercury: {x,y,z}, mars: {x,y,z}, ... }，失败的行星不出现在结果中
 */
export async function getBatchPlanetPositions(planetKeys, dateStr) {
  const d    = new Date(dateStr)
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)

  const items = planetKeys
    .map(key => {
      const target = PLANET_IDS[key]
      if (!target) return null
      return { key, target, startTime: dateStr, stopTime: next, stepSize: '1 d' }
    })
    .filter(Boolean)

  if (items.length === 0) return {}

  try {
    const res = await fetch(`${BASE_URL}/ephemeris/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '批量请求失败')

    const result = {}
    for (const [key, val] of Object.entries(data.data || {})) {
      const pts = Array.isArray(val.data) ? val.data : []
      if (pts.length > 0) result[key] = { x: pts[0].x, y: pts[0].y, z: pts[0].z }
    }
    return result
  } catch (err) {
    console.warn('JPL Horizons 批量行星位置请求失败:', err.message)
    return {}
  }
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
