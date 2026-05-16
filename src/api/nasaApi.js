/**
 * Mars Rover Photos API 封装
 * 数据源：后端代理优先使用 Mars Vista API，失败时回退 Nebulum API
 * 原 api.nasa.gov Mars Rover Photos API 已归档停用
 * 通过后端代理请求，避免跨域问题
 */

const BASE_URL = '/api/nasa'

/**
 * 获取火星车照片列表
 * @param {string} rover - 火星车名称：'curiosity' | 'perseverance' | 'opportunity'
 * @param {string} earthDate - 地球日期，格式 'YYYY-MM-DD'
 * @param {number} page - 分页（每页25张）
 * @returns {Promise<Array>} 照片对象数组
 */
export async function getMarsRoverPhotos(rover = 'curiosity', earthDate, page = 1) {
  const result = await getMarsRoverPhotosResponse(rover, earthDate, page)
  return result.photos || []
}

/**
 * 获取火星车照片响应（包含照片、数据源、分页信息）
 * @param {string} rover - 火星车名称
 * @param {string} earthDate - 地球日期，格式 'YYYY-MM-DD'
 * @param {number} page - 分页（每页25张）
 * @returns {Promise<{photos: Array, source?: string, pagination?: Object, meta?: Object}>}
 */
export async function getMarsRoverPhotosResponse(rover = 'curiosity', earthDate, page = 1) {
  try {
    const params = new URLSearchParams({
      earth_date: earthDate || '2023-06-15',
      page
    })
    const res = await fetch(`${BASE_URL}/mars-photos/rovers/${rover}/photos?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = await res.json()
    return {
      ...data,
      photos: data.photos || []
    }
  } catch (err) {
    console.warn('获取火星照片失败，使用示例数据:', err.message)
    return {
      photos: getFallbackPhotos(rover, earthDate),
      source: 'fallback',
      fallback: true,
      error: err.message
    }
  }
}

/**
 * 获取火星车最新有效日期（供 Gallery 初始加载使用）
 * @param {string} rover - 火星车名称
 * @returns {Promise<{max_date: string, max_sol: number|null, total_photos: number|null, source: string}>}
 */
export async function getRoverLatestDate(rover = 'curiosity') {
  const fallbacks = {
    curiosity:    '2024-01-01',
    perseverance: '2026-05-14',
    opportunity:  '2018-06-11'
  }
  try {
    const res = await fetch(`${BASE_URL}/mars-photos/rovers/${rover}/latest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`获取 ${rover} 最新日期失败，使用 fallback:`, err.message)
    return {
      rover,
      max_date: fallbacks[rover] || '2024-01-01',
      max_sol: null,
      total_photos: null,
      source: 'fallback'
    }
  }
}

/**
 * 获取火星车清单信息（任务周期、总照片数等）
 * @param {string} rover - 火星车名称
 * @returns {Promise<Object|null>}
 */
export async function getRoverManifest(rover = 'curiosity') {
  try {
    const res = await fetch(`${BASE_URL}/mars-photos/rovers/${rover}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.rover || null
  } catch (err) {
    console.warn('获取火星车信息失败:', err.message)
    return ROVER_MANIFESTS[rover] || null
  }
}

/**
 * 批量获取多个日期的照片数量（用于统计图表）
 * @param {string} rover - 火星车名称
 * @param {Array<string>} dates - 日期数组
 * @returns {Promise<Array<{date, count}>>}
 */
export async function getPhotoCountByDates(rover, dates) {
  const results = await Promise.allSettled(
    dates.map(async (date) => {
      const photos = await getMarsRoverPhotos(rover, date)
      return { date, count: photos.length }
    })
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
}

// ── 本地备用数据（API不可用时使用）──

const ROVER_MANIFESTS = {
  curiosity: {
    name: 'Curiosity',
    landing_date: '2012-08-06',
    launch_date: '2011-11-26',
    status: 'active',
    max_sol: 4000,
    max_date: '2024-01-01',
    total_photos: 695670,
    cameras: ['FHAZ', 'RHAZ', 'MAST', 'CHEMCAM', 'MAHLI', 'MARDI', 'NAVCAM']
  },
  perseverance: {
    name: 'Perseverance',
    landing_date: '2021-02-18',
    launch_date: '2020-07-30',
    status: 'active',
    max_sol: 1100,
    max_date: '2024-01-01',
    total_photos: 272062,
    cameras: ['EDL_RUCAM', 'EDL_RDCAM', 'EDL_DDCAM', 'FRONT_HAZCAM_LEFT_A', 'NAVCAM_LEFT', 'MCZ_LEFT']
  },
  opportunity: {
    name: 'Opportunity',
    landing_date: '2004-01-25',
    launch_date: '2003-07-07',
    status: 'complete',
    max_sol: 5111,
    max_date: '2018-06-11',
    total_photos: 228771,
    cameras: ['FHAZ', 'RHAZ', 'NAVCAM', 'PANCAM', 'MINITES']
  }
}

/**
 * 生成回退用的示例照片数据
 */
function getFallbackPhotos(rover, date) {
  const cameras = {
    curiosity: ['FHAZ', 'RHAZ', 'MAST', 'NAVCAM', 'CHEMCAM'],
    perseverance: ['FRONT_HAZCAM_LEFT_A', 'NAVCAM_LEFT', 'MCZ_LEFT', 'REAR_HAZCAM_LEFT'],
    opportunity: ['FHAZ', 'NAVCAM', 'PANCAM']
  }
  const roverCams = cameras[rover] || cameras.curiosity
  const manifest = ROVER_MANIFESTS[rover] || ROVER_MANIFESTS.curiosity

  // 返回示例数据结构
  return Array.from({ length: 15 }, (_, i) => ({
    id: 1000000 + i,
    sol: 3500 + i,
    camera: {
      id: i + 1,
      name: roverCams[i % roverCams.length],
      rover_id: 5,
      full_name: getCameraFullName(roverCams[i % roverCams.length])
    },
    img_src: `https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/03500/opgs/edr/ncam/NRB_623272234EDR_F0850948NCAM00595M_.JPG`,
    earth_date: date || '2023-06-15',
    rover: {
      id: 5,
      name: manifest.name,
      landing_date: manifest.landing_date,
      launch_date: manifest.launch_date,
      status: manifest.status
    }
  }))
}

function getCameraFullName(abbr) {
  const names = {
    FHAZ: 'Front Hazard Avoidance Camera',
    RHAZ: 'Rear Hazard Avoidance Camera',
    MAST: 'Mast Camera',
    CHEMCAM: 'Chemistry and Camera Complex',
    MAHLI: 'Mars Hand Lens Imager',
    MARDI: 'Mars Descent Imager',
    NAVCAM: 'Navigation Camera',
    NAVCAM_LEFT: 'Navigation Camera - Left',
    MCZ_LEFT: 'Mastcam-Z Left',
    FRONT_HAZCAM_LEFT_A: 'Front Left Hazard Avoidance Camera - A',
    REAR_HAZCAM_LEFT: 'Rear Left Hazard Avoidance Camera',
    PANCAM: 'Panoramic Camera'
  }
  return names[abbr] || abbr
}

/**
 * 火星车配置信息（用于UI展示）
 */
export const ROVER_CONFIG = {
  curiosity: {
    name: '好奇号',
    nameEn: 'Curiosity',
    color: '#FF8C00',
    icon: '🤖',
    description: '美国宇航局火星科学实验室任务的核心，2012年着陆盖尔撞击坑。',
    landing: '2012-08-06',
    status: '活跃',
    location: '盖尔撞击坑',
    mass: '899 公斤'
  },
  perseverance: {
    name: '毅力号',
    nameEn: 'Perseverance',
    color: '#CD853F',
    icon: '🤖',
    description: '2021年着陆耶泽罗撞击坑，寻找古代生命迹象并采集岩石样本。',
    landing: '2021-02-18',
    status: '活跃',
    location: '耶泽罗撞击坑',
    mass: '1,025 公斤'
  },
  opportunity: {
    name: '机遇号',
    nameEn: 'Opportunity',
    color: '#A0522D',
    icon: '🤖',
    description: '2004年着陆，远超设计寿命运行14年，2018年因沙尘暴失联。',
    landing: '2004-01-25',
    status: '已完成',
    location: '奋进撞击坑',
    mass: '185 公斤'
  }
}
