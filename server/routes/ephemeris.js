/**
 * JPL Horizons 星历数据代理路由
 * 功能：代理前端请求，调用 JPL Horizons Web API，解析并缓存结果
 * 文档：https://ssd-api.jpl.nasa.gov/doc/horizons.html
 *
 * API 要点（官方文档确认）：
 *   - Endpoint:  https://ssd.jpl.nasa.gov/api/horizons.api
 *   - format=json 时，响应为 { signature: {...}, result: "...原始文本..." }
 *   - 错误时响应为 { signature: {...}, error: "..." }（HTTP 400/500）
 *   - COMMAND / START_TIME / STOP_TIME / STEP_SIZE 等参数值须用单引号括起；
 *     单引号经 URL 编码为 %27 后 JPL 服务器可正常识别，无需手动避免编码。
 *   - STEP_SIZE 官方格式为 "N d"（含空格），如 "1 d"、"30 d"。
 */
const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const https   = require('https')

// ── 缓存目录 ──
const CACHE_DIR = path.join(__dirname, '../cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

// ── 八大行星 NAIF ID 映射 ──
const PLANET_IDS = {
  mercury: '199', venus:   '299', earth:   '399', mars:    '499',
  jupiter: '599', saturn:  '699', uranus:  '799', neptune: '899',
}

// ── 各行星公转周期（天）──
const PLANET_PERIODS_DAYS = {
  mercury:   87.97,  venus:    224.70,  earth:   365.25,  mars:     686.97,
  jupiter: 4332.59,  saturn: 10759.22,  uranus: 30688.5,  neptune: 60182.0,
}

// ────────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────────

/**
 * 将前端传入的简写步长（如 '30d'、'1m'）规范化为 Horizons 标准格式（'30 d'、'1 mo'）。
 * Horizons STEP_SIZE 合法格式：
 *   "N unit"，unit 可为 h(小时) / d(天) / mo(月) / y(年) / 整数(总步数)
 * 注意：'m' 在 Horizons 中表示 minute，月份须用 'mo'。
 */
function normalizeStepSize(raw) {
  const s = String(raw).trim()
  // 已包含空格（如 "30 d"）→ 原样返回
  if (/\s/.test(s)) return s
  // 解析紧凑格式，如 "30d", "1mo", "2y", "6h", "180"
  const m = s.match(/^(\d+)(d|h|mo|y|m)?$/i)
  if (!m) return s                          // 无法解析，原样传给 JPL
  const n    = m[1]
  const unit = (m[2] || '').toLowerCase()
  const map  = { d: 'd', h: 'h', mo: 'mo', y: 'y', m: 'h', '': '' }
  const u    = map[unit] ?? unit
  return u ? `${n} ${u}` : n               // 纯数字表示步数，不加单位
}

/**
 * 构建 JPL Horizons Web API URL。
 * 使用标准 URLSearchParams 编码（单引号→%27 是 HTTP 规范编码，JPL 正常识别）。
 */
function buildHorizonsUrl(target, startTime, stopTime, stepSize) {
  const step = normalizeStepSize(stepSize)
  const base = new URL('https://ssd.jpl.nasa.gov/api/horizons.api')
  const p    = base.searchParams

  // format=json 必须最先，方便调试时肉眼区分格式
  p.set('format',      'json')
  p.set('COMMAND',     `'${target}'`)
  p.set('OBJ_DATA',    'NO')
  p.set('MAKE_EPHEM',  'YES')
  p.set('EPHEM_TYPE',  'VECTORS')
  p.set('CENTER',      '500@10')      // 以太阳为参考中心（日心坐标）
  p.set('START_TIME',  `'${startTime}'`)
  p.set('STOP_TIME',   `'${stopTime}'`)
  p.set('STEP_SIZE',   `'${step}'`)
  p.set('VEC_TABLE',   '2')           // 输出 X, Y, Z 位置（不含速度列头）
  p.set('REF_PLANE',   'ECLIPTIC')    // 黄道坐标平面
  p.set('REF_SYSTEM',  'J2000')
  p.set('VEC_LABELS',  'YES')
  p.set('OUT_UNITS',   'AU-D')        // 天文单位 / 天

  return base.toString()
}

/**
 * 解析 HTTP 代理 URL，返回 { host, port }。
 * @param {string} proxyStr  如 "http://127.0.0.1:7897"
 */
function parseProxy(proxyStr) {
  try {
    const u = new URL(proxyStr)
    return { host: u.hostname, port: parseInt(u.port, 10) || 8080 }
  } catch (_) {
    return null
  }
}

/**
 * 解码 HTTP chunked transfer encoding 响应体。
 * 格式：<hex-size>\r\n<data>\r\n ... 0\r\n\r\n
 */
function decodeChunked(body) {
  let result = ''
  let pos = 0
  while (pos < body.length) {
    const crlfPos = body.indexOf('\r\n', pos)
    if (crlfPos === -1) break
    // 忽略 chunk extension（分号后内容）
    const sizeHex   = body.slice(pos, crlfPos).split(';')[0].trim()
    const chunkSize = parseInt(sizeHex, 16)
    if (isNaN(chunkSize) || chunkSize === 0) break
    result += body.slice(crlfPos + 2, crlfPos + 2 + chunkSize)
    pos = crlfPos + 2 + chunkSize + 2 // 跳过 chunk 数据 + 尾随 CRLF
  }
  return result
}

/**
 * 通过 HTTP CONNECT 隧道请求 HTTPS URL（仅使用 Node.js 内置模块）。
 * 流程：
 *   1. 向代理发 CONNECT <host>:443 HTTP/1.1
 *   2. 代理返回 200 后，在隧道 socket 上建立 TLS
 *   3. 通过 TLS socket 发送标准 HTTP/1.1 GET 请求
 *   4. 解析响应：自动处理 chunked 编码
 * @param {string} targetUrl   完整 HTTPS URL
 * @param {{host,port}} proxy  代理地址
 * @param {number} timeoutMs
 * @returns {Promise<string>}  响应体文本
 */
function fetchViaProxy(targetUrl, proxy, timeoutMs) {
  const tls  = require('tls')
  const http = require('http')
  const u    = new URL(targetUrl)
  const targetHost = u.hostname
  const targetPort = parseInt(u.port, 10) || 443

  return new Promise((resolve, reject) => {
    let done = false
    const fail = (err) => { if (!done) { done = true; reject(err) } }

    // Step 1: 向代理发 CONNECT 建立隧道
    const connectReq = http.request({
      host:    proxy.host,
      port:    proxy.port,
      method:  'CONNECT',
      path:    `${targetHost}:${targetPort}`,
      headers: { Host: `${targetHost}:${targetPort}` },
    })

    connectReq.setTimeout(timeoutMs, () => {
      connectReq.destroy()
      fail(new Error(`代理 CONNECT 超时（${timeoutMs / 1000}s）`))
    })
    connectReq.on('error', fail)

    connectReq.on('connect', (proxyRes, socket) => {
      if (proxyRes.statusCode !== 200) {
        socket.destroy()
        return fail(new Error(`代理 CONNECT 失败: HTTP ${proxyRes.statusCode}`))
      }

      // Step 2: 在隧道 socket 上建立 TLS
      const tlsSocket = tls.connect(
        { host: targetHost, port: targetPort, socket, servername: targetHost },
        () => {
          // Step 3: 发送标准 HTTP/1.1 GET 请求
          // Accept-Encoding: identity 禁用压缩，避免 gzip/br 解码复杂度
          const reqStr = [
            `GET ${u.pathname}${u.search} HTTP/1.1`,
            `Host: ${targetHost}`,
            'Connection: close',
            'Accept-Encoding: identity',
            '', '',
          ].join('\r\n')
          tlsSocket.write(reqStr)

          const chunks = []
          tlsSocket.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          tlsSocket.on('end', () => {
            if (done) return
            done = true
            const raw = Buffer.concat(chunks).toString('utf8')

            // 分离 HTTP 响应头和响应体
            const sepIdx = raw.indexOf('\r\n\r\n')
            if (sepIdx === -1) return resolve(raw)

            const headerStr = raw.slice(0, sepIdx)
            const body      = raw.slice(sepIdx + 4)
            const isChunked = /transfer-encoding:\s*chunked/i.test(headerStr)

            resolve(isChunked ? decodeChunked(body) : body)
          })
          tlsSocket.on('error', fail)
        }
      )

      tlsSocket.setTimeout(timeoutMs, () => {
        tlsSocket.destroy()
        fail(new Error(`TLS 通信超时（${timeoutMs / 1000}s）`))
      })
      tlsSocket.on('error', fail)
    })

    connectReq.end()
  })
}

/**
 * 直连 HTTPS（无代理），返回响应体原始文本。
 */
function fetchDirect(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume()
        return reject(new Error(`JPL HTTP ${res.statusCode}`))
      }
      let raw = ''
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => resolve(raw))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error(`直连超时（${timeoutMs / 1000}s）`))
    })
  })
}

/**
 * 向 JPL Horizons 发送 GET 请求，返回原始 Horizons 文本（result 字段）。
 * - 自动检测 HTTP_PROXY / HTTPS_PROXY 环境变量，通过 CONNECT 隧道代理请求；
 * - format=json 时，JPL 把文本包在 { result: "..." } 中；
 * - 若 JPL 返回 { error: "..." }，抛出含提示的 Error；
 * - 若 HTTP 状态码非 2xx，同样抛出 Error。
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<string>} Horizons 原始文本
 */
async function fetchHorizons(url, timeoutMs = 20000) {
  const proxyEnv  = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  const proxy     = proxyEnv ? parseProxy(proxyEnv) : null

  let raw
  if (proxy) {
    console.log(`[Horizons] 使用代理 ${proxyEnv} 请求`)
    raw = await fetchViaProxy(url, proxy, timeoutMs)
  } else {
    raw = await fetchDirect(url, timeoutMs)
  }

  try {
    const json = JSON.parse(raw)
    if (json.error) {
      throw new Error(`JPL API error: ${json.error}`)
    }
    if (typeof json.result === 'string') {
      return json.result
    }
    // 意外格式，返回原文让后续解析尝试
    return raw
  } catch (e) {
    if (e.message.startsWith('JPL API error')) throw e
    // 非 JSON（直连时有时会收到纯文本），直接返回原文
    return raw
  }
}

/**
 * 解析 Horizons 原始文本，提取 $$SOE…$$EOE 间的位置坐标点。
 * VECTORS 表（VEC_TABLE=2）格式：
 *   JDTDB, CalDate, X, Y, Z         ← 每组首行：儒略日 + 日历日期 + X Y Z
 *   VX, VY, VZ                      ← 速度行（VEC_TABLE=2 时不含）
 *
 * 实际每组两行（VEC_TABLE=2, VEC_LABELS=YES）:
 *   2460311.500000000 = A.D. 2024-Jan-01 00:00:00.0000 TDB
 *    X = 1.234567E+00  Y =-5.678901E-02  Z = 3.210987E-04
 *
 * 如果 rawText 格式异常，返回空数组，并在 console 中输出诊断片段。
 */
function parseHorizonsData(rawText) {
  const points = []

  const soeIdx = rawText.indexOf('$$SOE')
  const eoeIdx = rawText.indexOf('$$EOE')

  if (soeIdx === -1 || eoeIdx === -1) {
    // 打印前 600 字符用于诊断
    const preview = rawText.slice(0, 600).replace(/\r?\n/g, ' | ')
    console.warn('[Horizons] 未找到 $$SOE/$$EOE 标记，响应预览:', preview)
    return points
  }

  const dataBlock = rawText.slice(soeIdx + 5, eoeIdx).trim()
  const lines     = dataBlock.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 含 "X =" 的行就是坐标行（同时含 Y = 和 Z = 确保精准匹配）
    if (line.includes('X =') && line.includes('Y =') && line.includes('Z =')) {
      // 数字部分允许负号、小数点、科学计数法（含 E- / E+）
      const xMatch = line.match(/X\s*=\s*([-+]?\d[\d.]*(?:[Ee][+-]?\d+)?)/)
      const yMatch = line.match(/Y\s*=\s*([-+]?\d[\d.]*(?:[Ee][+-]?\d+)?)/)
      const zMatch = line.match(/Z\s*=\s*([-+]?\d[\d.]*(?:[Ee][+-]?\d+)?)/)

      // 日期行（yyyy-Mmm-dd 格式，一般是上一行）
      let timeStr = ''
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        // Horizons 日历日期格式示例: "A.D. 2024-Jan-01 00:00:00.0000 TDB"
        const tm = lines[j].match(/(\d{4}-\w{3}-\d{2})/)
        if (tm) {
          timeStr = tm[1]
          break
        }
      }

      if (xMatch && yMatch && zMatch) {
        points.push({
          time: timeStr,
          x:    parseFloat(xMatch[1]),
          y:    parseFloat(yMatch[1]),
          z:    parseFloat(zMatch[1]),
        })
      }
    }
  }

  return points
}

// ────────────────────────────────────────────────────────────
// 路由：GET /api/horizons/ephemeris
// ────────────────────────────────────────────────────────────

/**
 * 获取任意天体星历数据
 * 参数：target, startTime, stopTime, stepSize
 */
router.get('/ephemeris', async (req, res) => {
  const { target, startTime, stopTime, stepSize = '1 d' } = req.query

  if (!target || !startTime || !stopTime) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: target, startTime, stopTime',
    })
  }

  const cacheKey  = `${target}_${startTime}_${stopTime}_${stepSize}`.replace(/[^a-z0-9_-]/gi, '_')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`)

  if (fs.existsSync(cachePath)) {
    const ageDays = (Date.now() - fs.statSync(cachePath).mtimeMs) / (1000 * 86400)
    if (ageDays < 7) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      return res.json({ success: true, cached: true, data: cached })
    }
  }

  try {
    const url    = buildHorizonsUrl(target, startTime, stopTime, stepSize)
    console.log('[Horizons] 请求 URL:', url)

    const text   = await fetchHorizons(url, 10000)
    const points = parseHorizonsData(text)

    fs.writeFileSync(cachePath, JSON.stringify(points))
    res.json({ success: true, data: points })
  } catch (err) {
    console.error('[Horizons] /ephemeris 请求失败:', err.message)
    res.json({ success: false, error: err.message, data: [] })
  }
})

// ────────────────────────────────────────────────────────────
// 路由：GET /api/horizons/planet-orbit
// ────────────────────────────────────────────────────────────

/**
 * 获取指定行星完整轨道路径（一个公转周期，自动计算时间范围和步长）
 * 参数：
 *   planet     - 行星键名（mercury/venus/earth/mars/jupiter/saturn/uranus/neptune）
 *   centerDate - 中心日期 'YYYY-MM-DD'
 *   steps      - 采样点数（默认 180，最多 360）
 *
 * 典型用途：前端初始化时一次性拉取 8 条行星轨道路径用于渲染轨道线。
 * 与本地开普勒计算的关系：
 *   - 本地计算使用 1800-2050 年线性化轨道根数，误差约 1 角分（可视化足够）
 *   - Horizons 使用 JPL DE441 数值积分，精度 < 0.1 角秒，适合科学级精确位置
 *   - 两者均为日心黄道 J2000 坐标系，坐标系兼容，可直接替换
 *
 * ⚠️ 网络限制说明：ssd.jpl.nasa.gov 在中国大陆网络环境下可能无法访问（连接超时）。
 *    后端请求失败时返回 { success: false, data: [] }，前端应回退到本地开普勒计算。
 *    建议通过代理/VPN 环境预先缓存数据（server/cache/ 目录），
 *    或在后端配置 HTTP_PROXY 环境变量使 Node.js https 模块走代理。
 */
router.get('/planet-orbit', async (req, res) => {
  const { planet, centerDate } = req.query
  const steps = Math.min(360, Math.max(30, parseInt(req.query.steps, 10) || 180))

  if (!planet || !centerDate) {
    return res.status(400).json({ success: false, error: '缺少必要参数: planet, centerDate' })
  }

  const target = PLANET_IDS[planet]
  const period = PLANET_PERIODS_DAYS[planet]

  if (!target) {
    return res.status(400).json({
      success: false,
      error: `未知行星: ${planet}，支持: ${Object.keys(PLANET_IDS).join(', ')}`,
    })
  }

  const startDate = new Date(centerDate)
  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ success: false, error: 'centerDate 格式无效，需 YYYY-MM-DD' })
  }

  const stopDate  = new Date(startDate.getTime() + period * 86400 * 1000)
  const startTime = startDate.toISOString().slice(0, 10)
  const stopTime  = stopDate.toISOString().slice(0, 10)
  const stepDays  = Math.max(1, Math.round(period / steps))
  const stepSize  = `${stepDays} d`

  const cacheKey  = `planet_${planet}_${startTime}_${steps}`.replace(/[^a-z0-9_-]/gi, '_')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`)

  if (fs.existsSync(cachePath)) {
    const ageDays = (Date.now() - fs.statSync(cachePath).mtimeMs) / (1000 * 86400)
    if (ageDays < 30) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      return res.json({ success: true, cached: true, planet, data: cached })
    }
  }

  try {
    const url    = buildHorizonsUrl(target, startTime, stopTime, stepSize)
    console.log(`[Horizons] planet-orbit ${planet} 请求 URL:`, url)

    const text   = await fetchHorizons(url, 10000)
    const points = parseHorizonsData(text)

    if (points.length === 0) {
      throw new Error('Horizons 返回数据中未找到坐标点（$$SOE/$$EOE 标记缺失或解析失败）')
    }

    fs.writeFileSync(cachePath, JSON.stringify(points))
    console.log(`[Horizons] planet-orbit ${planet}: ${points.length} 点已缓存`)
    res.json({ success: true, planet, steps: points.length, data: points })
  } catch (err) {
    console.error(`[Horizons] planet-orbit ${planet} 失败:`, err.message)
    res.json({
      success: false,
      planet,
      error:   err.message,
      hint:    'ssd.jpl.nasa.gov 在中国大陆可能被封锁，请检查网络或配置 HTTP_PROXY',
      data:    [],
    })
  }
})

// ────────────────────────────────────────────────────────────
// 路由：POST /api/horizons/ephemeris/batch
// ────────────────────────────────────────────────────────────

/**
 * 批量获取多个探测器/天体的星历数据，减少客户端并发请求数量
 * 请求体：{ items: [{ key, target, startTime, stopTime, stepSize }] }
 * 响应体：{ success: true, data: { key: { data: [...points] } } }
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

  // 串行执行，避免对 JPL Horizons 发起大量并发
  for (const item of items) {
    const { key, target, startTime, stopTime, stepSize = '1 d' } = item

    if (!key || !target || !startTime || !stopTime) {
      result[key || '__unknown__'] = { error: '缺少必要参数: key, target, startTime, stopTime', data: [] }
      continue
    }

    const cacheKey  = `${target}_${startTime}_${stopTime}_${stepSize}`.replace(/[^a-z0-9_-]/gi, '_')
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`)

    if (fs.existsSync(cachePath)) {
      const ageDays = (Date.now() - fs.statSync(cachePath).mtimeMs) / (1000 * 86400)
      if (ageDays < 7) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        result[key] = { cached: true, data: cached }
        continue
      }
    }

    try {
      const url    = buildHorizonsUrl(target, startTime, stopTime, stepSize)
      const text   = await fetchHorizons(url, 10000)
      const points = parseHorizonsData(text)

      fs.writeFileSync(cachePath, JSON.stringify(points))
      result[key] = { data: points }
    } catch (err) {
      console.error(`[Horizons] batch ${key} 失败:`, err.message)
      result[key] = { error: err.message, data: [] }
    }
  }

  res.json({ success: true, data: result })
})

module.exports = router
