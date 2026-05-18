require('dotenv').config()

const express = require('express')
const path = require('path')
const https = require('https')
const app = express()

const MARS_VISTA_API_KEY = process.env.MARS_VISTA_API_KEY || ''
const MARS_VISTA_BASE_URL = 'https://api.marsvista.dev/api/v2'
const NEBULUM_BASE_URL = 'https://rovers.nebulum.one/api/v1'

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (apiRes) => {
      let data = ''
      apiRes.on('data', chunk => { data += chunk })
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
            const err = new Error(`HTTP ${apiRes.statusCode}`)
            err.statusCode = apiRes.statusCode
            err.response = parsed
            reject(err)
            return
          }
          resolve(parsed)
        } catch (e) {
          reject(new Error('解析外部 API 响应失败'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy(new Error('外部 API 请求超时'))
    })
  })
}

function normalizeMarsVistaPhoto(item) {
  const attrs = item.attributes || {}
  const rover = item.relationships?.rover || {}
  const roverAttrs = rover.attributes || {}
  const camera = item.relationships?.camera || {}
  const cameraAttrs = camera.attributes || {}

  return {
    id: item.id,
    sol: attrs.sol,
    camera: {
      id: camera.id,
      name: camera.id || 'UNKNOWN',
      rover_id: rover.id,
      full_name: cameraAttrs.full_name || camera.id || 'Unknown Camera'
    },
    img_src: attrs.img_src || attrs.images?.large || attrs.images?.medium || attrs.images?.full || attrs.images?.small,
    earth_date: attrs.earth_date,
    rover: {
      id: rover.id,
      name: roverAttrs.name || rover.id,
      landing_date: roverAttrs.landing_date || null,
      launch_date: roverAttrs.launch_date || null,
      status: roverAttrs.status || null
    },
    title: attrs.title,
    caption: attrs.caption,
    credit: attrs.credit,
    images: attrs.images,
    dimensions: attrs.dimensions,
    nasa_id: attrs.nasa_id
  }
}

async function fetchMarsVistaPhotos({ rover, earthDate, sol, page = 1, camera }) {
  if (!MARS_VISTA_API_KEY) {
    throw new Error('MARS_VISTA_API_KEY 未配置')
  }

  const params = new URLSearchParams({
    rovers: rover,
    page: String(page),
    per_page: '25',
    include: 'rover,camera'
  })

  if (earthDate) params.set('earth_date', earthDate)
  if (sol) params.set('sol', String(sol))
  if (camera) params.set('cameras', camera)

  const data = await requestJson(`${MARS_VISTA_BASE_URL}/photos?${params}`, {
    'x-api-key': MARS_VISTA_API_KEY,
    Accept: 'application/json'
  })

  return {
    photos: Array.isArray(data.data) ? data.data.map(normalizeMarsVistaPhoto).filter(p => p.img_src) : [],
    source: 'mars-vista',
    meta: data.meta || null,
    pagination: data.pagination || null,
    links: data.links || null
  }
}

async function fetchNebulumPhotos({ rover, earthDate, sol, page = 1, camera }) {
  const params = new URLSearchParams({ page: String(page) })
  if (earthDate) params.set('earth_date', earthDate)
  if (sol) params.set('sol', String(sol))
  if (camera) params.set('camera', camera)

  const data = await requestJson(`${NEBULUM_BASE_URL}/rovers/${rover}/photos?${params}`)
  return {
    photos: data.photos || [],
    source: 'nebulum',
    meta: null,
    pagination: null,
    links: null
  }
}

async function fetchRoverPhotos(options) {
  try {
    return await fetchMarsVistaPhotos(options)
  } catch (err) {
    console.warn(`Mars Vista API 不可用，回退 Nebulum: ${err.message}`)
    const result = await fetchNebulumPhotos(options)
    return {
      ...result,
      fallback: true,
      fallback_reason: err.message
    }
  }
}

// 中间件
app.use(express.json())
app.use(express.static(path.join(__dirname, '../dist')))

// CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// ── JPL Horizons 代理路由 ──
const ephemerisRouter = require('./routes/ephemeris')
app.use('/api/horizons', ephemerisRouter)

// ── NASA Mars Rover Photos API 代理 ──
// 避免前端跨域，同时可在此加缓存
app.get('/api/nasa/mars-photos/rovers/:rover/photos', async (req, res) => {
  const { rover } = req.params
  const { earth_date, sol, page = 1, camera } = req.query

  try {
    const result = await fetchRoverPhotos({
      rover,
      earthDate: earth_date,
      sol,
      page,
      camera
    })
    res.json(result)
  } catch (err) {
    console.error('NASA API 请求失败:', err.message)
    res.status(502).json({ success: false, error: err.message, photos: [] })
  }
})

// NASA Rover 最新有效日期（供前端初始加载使用）
app.get('/api/nasa/mars-photos/rovers/:rover/latest', async (req, res) => {
  const { rover } = req.params

  // 硬编码的 fallback 日期（当 manifest 不可用时使用）
  const fallbackDates = {
    curiosity:    '2024-01-01',
    perseverance: '2026-05-14',
    opportunity:  '2018-06-11'
  }

  try {
    const data = await requestJson(`${NEBULUM_BASE_URL}/manifests/${rover}`)
    const manifest = data.photo_manifest
    if (manifest && manifest.max_date) {
      return res.json({
        rover,
        max_date: manifest.max_date,
        max_sol: manifest.max_sol,
        total_photos: manifest.total_photos,
        source: 'nebulum-manifest'
      })
    }
    throw new Error('manifest 响应格式异常')
  } catch (err) {
    console.warn(`获取 ${rover} manifest 失败，使用 fallback: ${err.message}`)
    res.json({
      rover,
      max_date: fallbackDates[rover] || '2024-01-01',
      max_sol: null,
      total_photos: null,
      source: 'fallback'
    })
  }
})

// NASA Rover 基本信息（manifest，前端 getRoverManifest() 调用）
app.get('/api/nasa/mars-photos/rovers/:rover', async (req, res) => {
  const { rover } = req.params
  const fallbackManifests = {
    curiosity: {
      name: 'Curiosity', landing_date: '2012-08-06', launch_date: '2011-11-26',
      status: 'active', max_sol: 4000, max_date: '2024-01-01', total_photos: 695670
    },
    perseverance: {
      name: 'Perseverance', landing_date: '2021-02-18', launch_date: '2020-07-30',
      status: 'active', max_sol: 1100, max_date: '2024-01-01', total_photos: 272062
    },
    opportunity: {
      name: 'Opportunity', landing_date: '2004-01-25', launch_date: '2003-07-07',
      status: 'complete', max_sol: 5111, max_date: '2018-06-11', total_photos: 228771
    }
  }

  try {
    const data = await requestJson(`${NEBULUM_BASE_URL}/manifests/${rover}`)
    const manifest = data.photo_manifest
    if (manifest) {
      return res.json({
        success: true,
        rover,
        source: 'nebulum-manifest',
        manifest: {
          name: manifest.name,
          landing_date: manifest.landing_date,
          launch_date: manifest.launch_date,
          status: manifest.status,
          max_sol: manifest.max_sol,
          max_date: manifest.max_date,
          total_photos: manifest.total_photos
        }
      })
    }
    throw new Error('manifest 响应格式异常')
  } catch (err) {
    console.warn(`获取 ${rover} manifest 失败，使用 fallback: ${err.message}`)
    res.json({
      success: true,
      rover,
      source: 'fallback',
      manifest: fallbackManifests[rover] || fallbackManifests.curiosity
    })
  }
})

// ── 原有天体数据API（保留兼容性）──
const celestialData = {
  planets: [
    { id: 1, name: '水星', nameEn: 'Mercury', distanceFromSun: '5790万公里', orbitalPeriod: '88天', diameter: '4,879公里', moons: 0 },
    { id: 2, name: '金星', nameEn: 'Venus', distanceFromSun: '1.08亿公里', orbitalPeriod: '225天', diameter: '12,104公里', moons: 0 },
    { id: 3, name: '地球', nameEn: 'Earth', distanceFromSun: '1.496亿公里', orbitalPeriod: '365.25天', diameter: '12,742公里', moons: 1 },
    { id: 4, name: '火星', nameEn: 'Mars', distanceFromSun: '2.28亿公里', orbitalPeriod: '687天', diameter: '6,779公里', moons: 2 },
    { id: 5, name: '木星', nameEn: 'Jupiter', distanceFromSun: '7.78亿公里', orbitalPeriod: '11.86年', diameter: '139,820公里', moons: 95 },
    { id: 6, name: '土星', nameEn: 'Saturn', distanceFromSun: '14.3亿公里', orbitalPeriod: '29.42年', diameter: '116,460公里', moons: 146 },
    { id: 7, name: '天王星', nameEn: 'Uranus', distanceFromSun: '28.7亿公里', orbitalPeriod: '84年', diameter: '50,724公里', moons: 27 },
    { id: 8, name: '海王星', nameEn: 'Neptune', distanceFromSun: '45亿公里', orbitalPeriod: '164.8年', diameter: '49,244公里', moons: 16 }
  ]
}

// ⚠️ deprecated：前端已改用本地静态配置（src/three/sceneObjects.js），此接口仅保留兼容性
app.get('/api/planets', (req, res) => {
  res.json({
    deprecated: true,
    message: '此接口已废弃，前端使用本地静态数据，此接口仅保留历史兼容性',
    data: celestialData.planets
  })
})

// ⚠️ deprecated：前端已改用本地静态配置，此接口仅保留兼容性
app.get('/api/solar-system', (req, res) => {
  res.json({
    deprecated: true,
    message: '此接口已废弃，前端使用本地静态数据，此接口仅保留历史兼容性',
    success: true,
    data: {
      name: '太阳系', age: '约46亿年',
      centerStar: { name: '太阳', type: 'G型主序星', diameter: '139.2万公里' },
      planetCount: 8
    }
  })
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '深空探测平台API运行中', time: new Date().toISOString() })
})

// SPA回退（必须放最后）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Internal Server Error' })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`\n========================================`)
  console.log(`  🌌 深空探测平台服务器`)
  console.log(`  访问地址: http://localhost:${PORT}`)
  console.log(`  Horizons API: /api/horizons/ephemeris`)
  console.log(`  NASA Photos:  /api/nasa/mars-photos/rovers/{rover}/photos`)
  console.log(`========================================\n`)
})
