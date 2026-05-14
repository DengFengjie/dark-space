const express = require('express')
const path = require('path')
const https = require('https')
const app = express()

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
app.get('/api/nasa/mars-photos/rovers/:rover/photos', (req, res) => {
  const { rover } = req.params
  const { earth_date, page = 1 } = req.query
  const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY'

  const apiUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?earth_date=${earth_date || '2023-06-15'}&page=${page}&api_key=${NASA_KEY}`

  https.get(apiUrl, (apiRes) => {
    let data = ''
    apiRes.on('data', chunk => { data += chunk })
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data)
        res.json(parsed)
      } catch (e) {
        res.status(502).json({ success: false, error: '解析NASA API响应失败' })
      }
    })
  }).on('error', (err) => {
    console.error('NASA API 请求失败:', err.message)
    res.status(502).json({ success: false, error: err.message, photos: [] })
  })
})

// NASA Rover 基本信息
app.get('/api/nasa/mars-photos/rovers/:rover', (req, res) => {
  const { rover } = req.params
  const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY'

  const apiUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}?api_key=${NASA_KEY}`

  https.get(apiUrl, (apiRes) => {
    let data = ''
    apiRes.on('data', chunk => { data += chunk })
    apiRes.on('end', () => {
      try {
        res.json(JSON.parse(data))
      } catch (e) {
        res.status(502).json({ success: false, error: '解析失败' })
      }
    })
  }).on('error', (err) => {
    res.status(502).json({ success: false, error: err.message })
  })
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

app.get('/api/planets', (req, res) => res.json(celestialData.planets))

app.get('/api/solar-system', (req, res) => {
  res.json({
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
