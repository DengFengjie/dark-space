/**
 * 行星轨道位置计算
 * 基于NASA行星事实表的轨道根数，使用开普勒方程精确计算日心黄道坐标
 * 参考：https://ssd.jpl.nasa.gov/planets/approx_pos.html
 */
import { julianCenturies } from './timeUtils.js'

// ── 角度/弧度转换 ──
const toRad = (deg) => (deg * Math.PI) / 180
const toDeg = (rad) => (rad * 180) / Math.PI

/**
 * J2000.0时刻轨道根数及其变化率（per Julian century）
 * [a, adot, e, edot, I, Idot, L, Ldot, W(=w̃), Wdot, O(=Ω), Odot]
 * a: 半长轴(AU), e: 离心率, I: 轨道倾角(deg)
 * L: 平黄经(deg), W: 近日点黄经(deg), O: 升交点黄经(deg)
 */
export const ORBITAL_ELEMENTS = {
  mercury: {
    a: 0.38709927,   adot: 0.00000037,
    e: 0.20563593,   edot: 0.00001906,
    I: 7.00497902,   Idot: -0.00594749,
    L: 252.25032350, Ldot: 149472.67411175,
    W: 77.45779628,  Wdot: 0.16047689,
    O: 48.33076593,  Odot: -0.12534081
  },
  venus: {
    a: 0.72333566,   adot: 0.00000390,
    e: 0.00677672,   edot: -0.00004107,
    I: 3.39467605,   Idot: -0.00078890,
    L: 181.97909950, Ldot: 58517.81538729,
    W: 131.60246718, Wdot: 0.00268329,
    O: 76.67984255,  Odot: -0.27769418
  },
  earth: {
    a: 1.00000011,   adot: -0.00000005,
    e: 0.01671022,   edot: -0.00003804,
    I: 0.00005,      Idot: -0.01294668,
    L: 100.46457166, Ldot: 35999.37244981,
    W: 102.93768193, Wdot: 0.32327364,
    O: 0.0,          Odot: 0.0
  },
  mars: {
    a: 1.52371034,   adot: 0.00001847,
    e: 0.09339410,   edot: 0.00007882,
    I: 1.84969142,   Idot: -0.00813131,
    L: -4.55343205,  Ldot: 19140.30268499,
    W: -23.94362959, Wdot: 0.44441088,
    O: 49.55953891,  Odot: -0.29257343
  },
  jupiter: {
    a: 5.20288700,   adot: -0.00011607,
    e: 0.04838624,   edot: -0.00013253,
    I: 1.30439695,   Idot: -0.00183714,
    L: 34.39644051,  Ldot: 3034.74612775,
    W: 14.72847983,  Wdot: 0.21252668,
    O: 100.47390909, Odot: 0.20469106
  },
  saturn: {
    a: 9.53667594,   adot: -0.00125060,
    e: 0.05386179,   edot: -0.00050991,
    I: 2.48599187,   Idot: 0.00193609,
    L: 49.95424423,  Ldot: 1222.49362201,
    W: 92.59887831,  Wdot: -0.41897216,
    O: 113.66242448, Odot: -0.28867794
  },
  uranus: {
    a: 19.18916464,  adot: -0.00196176,
    e: 0.04725744,   edot: -0.00004397,
    I: 0.77263783,   Idot: -0.00242939,
    L: 313.23810451, Ldot: 428.48202785,
    W: 170.95427630, Wdot: 0.40805281,
    O: 74.01692503,  Odot: 0.04240589
  },
  neptune: {
    a: 30.06992276,  adot: 0.00026291,
    e: 0.00859048,   edot: 0.00005105,
    I: 1.77004347,   Idot: 0.00035372,
    L: -55.12002969, Ldot: 218.45945325,
    W: 44.96476227,  Wdot: -0.32241464,
    O: 131.78422574, Odot: -0.00508664
  }
}

/**
 * 各行星公转周期（天）
 */
export const PLANET_PERIODS = {
  mercury: 87.97,
  venus: 224.70,
  earth: 365.25,
  mars: 686.97,
  jupiter: 4332.59,
  saturn: 10759.22,
  uranus: 30688.5,
  neptune: 60182.0
}

/**
 * 解开普勒方程 M = E - e·sin(E)，求偏近点角E
 * 使用牛顿-拉弗森迭代法，精度1e-10
 * @param {number} M - 平近点角（弧度）
 * @param {number} e - 离心率
 * @returns {number} 偏近点角 E（弧度）
 */
function solveKepler(M, e) {
  // 初始猜测
  let E = e < 0.8 ? M : Math.PI
  for (let i = 0; i < 100; i++) {
    const sinE = Math.sin(E)
    const cosE = Math.cos(E)
    const dE = (M - E + e * sinE) / (1.0 - e * cosE)
    E += dE
    if (Math.abs(dE) < 1e-10) break
  }
  return E
}

/**
 * 将平近点角规范化到 [-180, 180] 度
 */
function normalizeDeg(deg) {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/**
 * 根据儒略日计算行星的日心黄道坐标（AU）
 * @param {string} planet - 行星键名（如 'earth', 'mars'）
 * @param {number} jd - 儒略日
 * @returns {{ x: number, y: number, z: number }} 日心黄道直角坐标（AU）
 */
export function calcPlanetPosition(planet, jd) {
  const elem = ORBITAL_ELEMENTS[planet]
  if (!elem) return { x: 0, y: 0, z: 0 }

  const T = julianCenturies(jd)

  // 当前轨道根数
  const a = elem.a + elem.adot * T
  const e = Math.max(0, elem.e + elem.edot * T)
  const I = toRad(elem.I + elem.Idot * T)
  const L = toRad(normalizeDeg(elem.L + elem.Ldot * T))
  const W = toRad(normalizeDeg(elem.W + elem.Wdot * T))  // 近日点黄经 w̃
  const O = toRad(normalizeDeg(elem.O + elem.Odot * T))  // 升交点黄经 Ω

  const w = W - O       // 近日点辐角（轨道坐标系内）
  const M = normalizeDeg(toDeg(L - W)) // 平近点角（度）→ 规范化

  // 解开普勒方程
  const E = solveKepler(toRad(M), e)

  // 轨道平面内坐标
  const xOrb = a * (Math.cos(E) - e)
  const yOrb = a * Math.sqrt(1.0 - e * e) * Math.sin(E)

  // 旋转矩阵：轨道平面 → 黄道坐标系
  const cosO = Math.cos(O), sinO = Math.sin(O)
  const cosI = Math.cos(I), sinI = Math.sin(I)
  const cosw = Math.cos(w), sinw = Math.sin(w)

  const x = (cosw * cosO - sinw * sinO * cosI) * xOrb
          + (-sinw * cosO - cosw * sinO * cosI) * yOrb
  const y = (cosw * sinO + sinw * cosO * cosI) * xOrb
          + (-sinw * sinO + cosw * cosO * cosI) * yOrb
  const z = (sinw * sinI) * xOrb + (cosw * sinI) * yOrb

  return { x, y, z }
}

/**
 * 生成行星轨道路径点（用于绘制轨道线）
 * @param {string} planet - 行星键名
 * @param {number} jd - 当前儒略日（用于计算当前轨道根数）
 * @param {number} steps - 采样步数（越多越平滑，越慢）
 * @returns {Array<{x,y,z}>} 轨道点数组（AU）
 */
export function generateOrbitPath(planet, jd, steps = 360) {
  const period = PLANET_PERIODS[planet] || 365.25
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = jd + (i / steps) * period
    points.push(calcPlanetPosition(planet, t))
  }
  return points
}

/**
 * 道格拉斯-普克算法：轨迹点抽稀
 * 在保证形状的前提下减少点数，提高渲染性能
 * @param {Array<{x,y,z}>} points - 原始轨迹点
 * @param {number} tolerance - 容差（AU）
 * @returns {Array<{x,y,z}>} 简化后的点
 */
export function douglasPeucker(points, tolerance = 0.05) {
  if (points.length <= 2) return points

  // 点 p 到线段 (a,b) 的距离
  const distToSegment = (p, a, b) => {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z
    const len2 = abx * abx + aby * aby + abz * abz
    if (len2 < 1e-20) {
      return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2 + (p.z - a.z) ** 2)
    }
    const t = Math.max(0, Math.min(1,
      ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2
    ))
    const dx = p.x - (a.x + t * abx)
    const dy = p.y - (a.y + t * aby)
    const dz = p.z - (a.z + t * abz)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  let maxDist = 0, maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], points[0], points[points.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}

/**
 * 生成Voyager 1号近似轨迹（示例数据，用于演示）
 * 真实数据应从JPL Horizons API获取
 * 这里使用简化的向外飞行轨迹模拟
 */
export function generateVoyager1Trajectory() {
  const points = []
  // 1977年发射，朝木星方向（后转向北黄极方向）
  const launchJD = unixToJulianLocal(new Date('1977-09-05').getTime())
  const steps = 100
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 45 // 45年轨迹
    // 简化模型：木星飞掠（1979）后折向北方
    const dist = 0.5 + t * 140 // 0.5 → 140 AU
    const angle = -0.5 + t * 0.3 // 黄道面内角度缓慢变化
    const elev = t * 0.6 // 逐渐偏离黄道面（北方向）
    points.push({
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

/**
 * 生成Voyager 2号近似轨迹
 */
export function generateVoyager2Trajectory() {
  const points = []
  const steps = 100
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const dist = 0.5 + t * 120 // 0.5 → 120 AU
    const angle = 1.2 - t * 0.4 // 偏向南方
    const elev = -t * 0.4 // 偏离黄道面（南方向）
    points.push({
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

function unixToJulianLocal(unixMs) {
  return (unixMs / 86400000) + 2440587.5
}
