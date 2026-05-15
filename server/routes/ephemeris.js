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

module.exports = router
