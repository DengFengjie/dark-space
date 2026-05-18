/**
 * JPL Horizons 星历数据代理路由
 * 功能：代理前端请求，调用 JPL Horizons Web API，解析并缓存结果
 * 文档：https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */
const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

// 缓存目录
const CACHE_DIR = path.join(__dirname, '../cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

/**
 * GET /api/horizons/ephemeris
 * 参数：target, startTime, stopTime, stepSize
 */
router.get('/ephemeris', async (req, res) => {
  const { target, startTime, stopTime, stepSize = '30d' } = req.query

  if (!target || !startTime || !stopTime) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: target, startTime, stopTime'
    })
  }

  // ── 缓存命中检查 ──
  const cacheKey = `${target}_${startTime}_${stopTime}_${stepSize}`.replace(/[^a-z0-9_-]/gi, '_')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`)

  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath)
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 86400)
    if (ageDays < 7) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      return res.json({ success: true, cached: true, data: cached })
    }
  }

  // ── 调用 JPL Horizons API ──
  try {
    const horizonsUrl = buildHorizonsUrl(target, startTime, stopTime, stepSize)
    
    // 使用 node 内置 https 模块（避免额外依赖）
    const https = require('https')
    const rawData = await new Promise((resolve, reject) => {
      const req = https.get(horizonsUrl, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')) })
    })

    const points = parseHorizonsData(rawData)

    // 写入缓存
    fs.writeFileSync(cachePath, JSON.stringify(points))

    res.json({ success: true, data: points })
  } catch (err) {
    console.error('Horizons API 请求失败:', err.message)
    res.json({
      success: false,
      error: err.message,
      data: [] // 前端使用本地模拟数据
    })
  }
})

/**
 * 构建 JPL Horizons Web API URL
 */
function buildHorizonsUrl(target, startTime, stopTime, stepSize) {
  // 必须手动拼接参数，URLSearchParams 会将 COMMAND / START_TIME 等参数中的单引号编码为 %27，
  // 导致 JPL Horizons API 返回错误。
  const params = [
    'format=json',
    `COMMAND='${target}'`,
    'OBJ_DATA=NO',
    'MAKE_EPHEM=YES',
    'EPHEM_TYPE=VECTORS',
    'CENTER=500@10',           // 太阳系质心
    `START_TIME='${startTime}'`,
    `STOP_TIME='${stopTime}'`,
    `STEP_SIZE='${stepSize}'`,
    'VEC_TABLE=2',             // 输出 X,Y,Z 位置
    'REF_PLANE=ECLIPTIC',      // 黄道坐标
    'REF_SYSTEM=J2000',
    'VEC_LABELS=YES',
    'OUT_UNITS=AU-D'           // 天文单位-天
  ].join('&')
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`
}

/**
 * 解析 Horizons API 返回的文本数据，提取坐标点
 */
function parseHorizonsData(rawText) {
  const points = []

  // 查找数据块边界（$$SOE 和 $$EOE 之间）
  const soeIdx = rawText.indexOf('$$SOE')
  const eoeIdx = rawText.indexOf('$$EOE')

  if (soeIdx === -1 || eoeIdx === -1) {
    console.warn('Horizons 返回数据格式异常，未找到 $$SOE/$$EOE 标记')
    return points
  }

  const dataBlock = rawText.slice(soeIdx + 5, eoeIdx).trim()
  const lines = dataBlock.split('\n').map(l => l.trim()).filter(Boolean)

  // 向量表格式：每4行为一组（日期行、X/Y/Z行、VX/VY/VZ行、空行）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 含 "X =" 的行就是坐标行
    if (line.includes('X =') && line.includes('Y =') && line.includes('Z =')) {
      const xMatch = line.match(/X\s*=\s*([-\d.E+]+)/)
      const yMatch = line.match(/Y\s*=\s*([-\d.E+]+)/)
      const zMatch = line.match(/Z\s*=\s*([-\d.E+]+)/)

      // 向前找时间行（一般是上一行或上两行）
      let timeStr = ''
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (lines[j].match(/^\d{4}-\w{3}-\d{2}/)) {
          timeStr = lines[j].split(' ')[0]
          break
        }
      }

      if (xMatch && yMatch && zMatch) {
        points.push({
          time: timeStr,
          x: parseFloat(xMatch[1]),
          y: parseFloat(yMatch[1]),
          z: parseFloat(zMatch[1])
        })
      }
    }
  }

  return points
}

/**
 * 八大行星 Horizons NAIF ID 映射
 */
const PLANET_IDS = {
  mercury: '199', venus: '299', earth:  '399', mars:    '499',
  jupiter: '599', saturn: '699', uranus: '799', neptune: '899'
}

/**
 * 各行星公转周期（天）
 */
const PLANET_PERIODS_DAYS = {
  mercury:  87.97,   venus:    224.70,  earth:   365.25,  mars:     686.97,
  jupiter:  4332.59, saturn:  10759.22, uranus: 30688.5,  neptune: 60182.0
}

/**
 * GET /api/horizons/planet-orbit
 * 获取指定行星完整轨道路径（一个公转周期，自动计算时间范围和步长）
 * 参数：
 *   planet     - 行星键名（mercury/venus/earth/mars/jupiter/saturn/uranus/neptune）
 *   centerDate - 中心日期 'YYYY-MM-DD'（轨道根数以此日期为基准）
 *   steps      - 采样点数（默认 180，最多 360）
 *
 * 典型用途：前端初始化时一次性拉取 8 条行星轨道路径用于渲染轨道线。
 * 与本地开普勒计算的关系：
 *   - 本地计算使用 1800-2050 年线性化轨道根数，误差约 1 角分（可视化足够）
 *   - Horizons 使用 JPL DE441 数值积分，精度 < 0.1 角秒，适合科学级精确位置
 *   - 两者均作日心黄道 J2000 坐标系（坐标系相同，可直接替换）
 *
 * ⚠️ 网络限制说明：ssd.jpl.nasa.gov 在中国大陆网络环境下可能无法访问（连接超时）。
 *    后端请求失败时返回 { success: false, data: [] }，前端应回退到本地开普勒计算。
 *    建议通过代理/VPN 环境下提前预下载并缓存数据（server/cache/ 目录），
 *    或在后端配置 HTTP_PROXY 环境变量使 Node.js https 模块走代理。
 */
router.get('/planet-orbit', async (req, res) => {
  const { planet, centerDate } = req.query
  const steps = Math.min(360, Math.max(30, parseInt(req.query.steps, 10) || 180))

  if (!planet || !centerDate) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: planet, centerDate'
    })
  }

  const target = PLANET_IDS[planet]
  const period = PLANET_PERIODS_DAYS[planet]

  if (!target) {
    return res.status(400).json({
      success: false,
      error: `未知行星: ${planet}，支持: ${Object.keys(PLANET_IDS).join(', ')}`
    })
  }

  // 以 centerDate 为起点，覆盖一个完整公转周期
  const startDate = new Date(centerDate)
  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ success: false, error: 'centerDate 格式无效，需 YYYY-MM-DD' })
  }
  const stopDate  = new Date(startDate.getTime() + period * 86400 * 1000)
  const startTime = startDate.toISOString().slice(0, 10)
  const stopTime  = stopDate.toISOString().slice(0, 10)
  const stepDays  = Math.max(1, Math.round(period / steps))
  const stepSize  = `${stepDays}d`

  // 缓存 key（包含 steps 使不同分辨率分开缓存）
  const cacheKey = `planet_${planet}_${startTime}_${steps}`.replace(/[^a-z0-9_-]/gi, '_')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`)

  if (fs.existsSync(cachePath)) {
    const stat    = fs.statSync(cachePath)
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 86400)
    if (ageDays < 30) { // 行星轨道 30 天内缓存有效（轨道变化极慢）
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      return res.json({ success: true, cached: true, planet, data: cached })
    }
  }

  try {
    const horizonsUrl = buildHorizonsUrl(target, startTime, stopTime, stepSize)
    const https = require('https')
    const rawData = await new Promise((resolve, reject) => {
      const req = https.get(horizonsUrl, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('请求超时（20s）')) })
    })

    const points = parseHorizonsData(rawData)
    if (points.length === 0) {
      throw new Error('Horizons 返回的数据中未找到坐标点（$$SOE/$$EOE 标记缺失）')
    }

    fs.writeFileSync(cachePath, JSON.stringify(points))
    console.log(`[Horizons] planet-orbit ${planet}: ${points.length} 点已缓存`)
    res.json({ success: true, planet, steps: points.length, data: points })
  } catch (err) {
    console.error(`[Horizons] planet-orbit ${planet} 失败:`, err.message)
    res.json({
      success: false,
      planet,
      error: err.message,
      hint: 'ssd.jpl.nasa.gov 在中国大陆可能被封锁，请检查网络或配置 HTTP_PROXY',
      data: []
    })
  }
})

/**
 * POST /api/horizons/ephemeris/batch
 * 批量获取多个探测器的星历数据，减少客户端并发请求数量
 * 请求体：{ items: [{ key, target, startTime, stopTime, stepSize }] }
 * 响应体：{ success: true, data: { key: [...points] } }
 */
router.post('/ephemeris/batch', async (req, res) => {
  const { items } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '请求体需包含 items 数组' })
  }

  if (items.length > 20) {
    return res.status(400).json({ success: false, error: 'items 最多 20 条' })
  }

  const result = {}

  // 串行执行避免对 JPL Horizons 发起大量并发
  for (const item of items) {
    const { key, target, startTime, stopTime, stepSize = '30d' } = item

    if (!key || !target || !startTime || !stopTime) {
      result[key || '__unknown__'] = { error: '缺少必要参数: key, target, startTime, stopTime', data: [] }
      continue
    }

    // 缓存命中检查
    const cacheKey = `${target}_${startTime}_${stopTime}_${stepSize}`.replace(/[^a-z0-9_-]/gi, '_')
    const cachePath = require('path').join(CACHE_DIR, `${cacheKey}.json`)

    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath)
      const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 86400)
      if (ageDays < 7) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        result[key] = { cached: true, data: cached }
        continue
      }
    }

    try {
      const horizonsUrl = buildHorizonsUrl(target, startTime, stopTime, stepSize)
      const https = require('https')
      const rawData = await new Promise((resolve, reject) => {
        const req = https.get(horizonsUrl, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => resolve(data))
        })
        req.on('error', reject)
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')) })
      })

      const points = parseHorizonsData(rawData)
      fs.writeFileSync(cachePath, JSON.stringify(points))
      result[key] = { data: points }
    } catch (err) {
      console.error(`Horizons 批量请求 ${key} 失败:`, err.message)
      result[key] = { error: err.message, data: [] }
    }
  }

  res.json({ success: true, data: result })
})

module.exports = router
