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
    description: '好奇号是NASA火星科学实验室（MSL）任务的核心探测器，也是迄今最大的火星车。2012年8月6日通过"天空起重机"创新方式着陆于盖尔撞击坑，目标是探索火星过去是否存在适合微生物生存的环境。它首次证明火星古代曾存在液态水，发现了有机分子，并探测到甲烷季节性变化。截至2024年已累计行驶超过29公里，拍摄超过60万张照片。',
    landing: '2012-08-06',
    launch: '2011-11-26',
    status: '活跃',
    location: '盖尔撞击坑（Gale Crater）',
    mass: '899 公斤',
    power: '核能（MMRTG 放射性同位素热电机）',
    speed: '最高约 0.14 km/h',
    totalPhotos: '约 695,000 张',
    totalDistance: '> 29 公里',
    designLife: '2年（已超期运行 > 12年）',
    instruments: ['MAHLI 手持透镜成像仪', 'ChemCam 化学相机激光光谱仪', 'RAD 辐射评估探测器', 'SAM 样品分析仪', 'CheMin X射线衍射仪', 'MAST 桅杆相机', 'REMS 环境监测站'],
    highlights: ['首次证实古代火星存在液态水', '发现有机分子（生命构成要素）', '探测到甲烷季节性变化', '成功测量火星表面辐射水平']
  },
  perseverance: {
    name: '毅力号',
    nameEn: 'Perseverance',
    color: '#CD853F',
    icon: '🤖',
    description: '毅力号是NASA火星2020任务的主探测器，于2021年2月18日着陆耶泽罗撞击坑——一处约35亿年前的古代三角洲遗址。它肩负寻找古代微生物生命迹象、采集岩石样本（供未来返回地球分析）及测试氧气生产技术的使命。随车搭载的"机智号"直升机已完成数十次飞行，是人类在其他星球实现动力飞行的首次尝试。',
    landing: '2021-02-18',
    launch: '2020-07-30',
    status: '活跃',
    location: '耶泽罗撞击坑（Jezero Crater）',
    mass: '1,025 公斤',
    power: '核能（MMRTG 放射性同位素热电机）',
    speed: '最高约 0.22 km/h',
    totalPhotos: '约 272,000 张',
    totalDistance: '> 25 公里',
    designLife: '至少1个火星年（约687天）',
    instruments: ['Mastcam-Z 变焦立体相机', 'SuperCam 超级相机（激光+光谱）', 'PIXL X射线岩石学分析仪', 'SHERLOC 有机物拉曼光谱仪', 'MEDA 气象环境分析仪', 'RIMFAX 雷达成像地下探测', 'MOXIE 氧气生产实验装置'],
    highlights: ['首次在火星上生产氧气（MOXIE）', '机智号完成火星首次动力飞行', '采集首批火星岩心样本', '在古代三角洲发现有机分子痕迹']
  },
  opportunity: {
    name: '机遇号',
    nameEn: 'Opportunity',
    color: '#A0522D',
    icon: '🤖',
    description: '机遇号是NASA火星探测漫游者（MER-B）任务的探测器，原设计寿命仅90个火星日（约90天），却奇迹般运行了超过5,111个火星日（约14年）。2004年1月25日借助气囊弹跳方式着陆鹰撞击坑，此后跨越多个陨击坑，最终在奋进撞击坑（直径约22公里）边缘开展深入探测。2018年6月因全球性沙尘暴切断太阳能供应，NASA于2019年2月宣布任务结束。',
    landing: '2004-01-25',
    launch: '2003-07-07',
    status: '已完成',
    statusEnd: '2019-02-13',
    location: '奋进撞击坑（Endeavour Crater）',
    mass: '185 公斤',
    power: '太阳能电池板',
    speed: '最高约 0.18 km/h',
    totalPhotos: '约 228,771 张',
    totalDistance: '45.16 公里（火星车史上最长）',
    designLife: '90天（实际运行约14年）',
    instruments: ['Pancam 全景相机', 'Navcam 导航相机', 'Mini-TES 热辐射光谱仪', 'APXS 阿尔法粒子X射线光谱仪', 'Mössbauer 穆斯堡尔光谱仪', 'RAT 岩石磨蚀工具', 'MI 显微成像仪'],
    highlights: ['创造火星车行驶距离纪录（45公里）', '首次在火星发现液态水曾存在的直接证据', '运行时长超过设计寿命55倍', '探测了奋进撞击坑边缘古老地层']
  }
}
