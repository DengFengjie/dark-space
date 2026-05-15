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
 * 根据儒略日索引计算探针在轨迹上的位置（插值）
 * 轨迹由带时间戳的采样点构成，通过二分查找定位区间并线性插值
 * @param {Array<{jd:number,x:number,y:number,z:number}>} samples - 按jd升序排列的轨迹采样点
 * @param {number} jd - 目标儒略日
 * @returns {{x:number,y:number,z:number}|null}
 */
export function sampleTrajectoryAt(samples, jd) {
  if (!samples || samples.length < 2) return null
  if (jd <= samples[0].jd) return { x: samples[0].x, y: samples[0].y, z: samples[0].z }
  if (jd >= samples[samples.length - 1].jd) return { x: samples[samples.length - 1].x, y: samples[samples.length - 1].y, z: samples[samples.length - 1].z }

  // 二分查找
  let lo = 0, hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].jd <= jd) lo = mid
    else hi = mid
  }

  const t = (jd - samples[lo].jd) / (samples[hi].jd - samples[lo].jd)
  return {
    x: samples[lo].x + (samples[hi].x - samples[lo].x) * t,
    y: samples[lo].y + (samples[hi].y - samples[lo].y) * t,
    z: samples[lo].z + (samples[hi].z - samples[lo].z) * t
  }
}

/**
 * 生成Voyager 1号轨迹（带时间戳的采样点，用于时间联动插值）
 * 真实数据尽量从JPL Horizons获取，此处提供基于已知位置拟合的近似模型
 */
export function generateVoyager1Trajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1977-09-05').getTime())
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 49 // 49年轨迹（1977~2026）
    const dist = 0.5 + t * 155
    const angle = -0.5 + t * 0.35
    const elev = t * 0.62
    points.push({
      jd,
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

/**
 * 生成Voyager 2号轨迹（带时间戳）
 */
export function generateVoyager2Trajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1977-08-20').getTime())
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 49
    const dist = 0.5 + t * 135
    const angle = 1.2 - t * 0.45
    const elev = -t * 0.38
    points.push({
      jd,
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

/**
 * 生成新视野号（New Horizons）轨迹（带时间戳）
 * 2006年发射，2015年飞越冥王星，继续向柯伊伯带前进
 */
export function generateNewHorizonsTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2006-01-19').getTime())
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 20
    // 朝人马座方向（银河中心），相对黄道面偏低角度
    const dist = 0.5 + t * 67
    const angle = -1.8 + t * 0.15
    const elev = -0.15 + t * 0.08
    points.push({
      jd,
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

/**
 * 生成朱诺号（Juno）近似轨迹（带时间戳）
 * 2011年发射，2016年进入木星极轨道——简化显示为绕木星的螺旋轨道
 */
export function generateJunoTrajectory(jdNow) {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2011-08-05').getTime())
  const steps = 160
  // 木星轨道半径约 5.2 AU
  const jupiterOrbitBase = 5.2
  const jupiterPeriod = 4332.59 // 天
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 15
    // 木星在轨道上的位置
    const jupiterAngle = ((jd - 2451545.0) / jupiterPeriod) * Math.PI * 2
    const jx = Math.cos(jupiterAngle) * jupiterOrbitBase
    const jy = Math.sin(jupiterAngle) * jupiterOrbitBase
    // 探测器围绕木星的微小偏移（<0.05 AU）
    const offset = (i > steps * 0.35) ? 0.03 * Math.cos(t * 40) : 0
    points.push({
      jd,
      x: jx + offset * Math.cos(jupiterAngle + 0.5),
      y: jy + offset * Math.sin(jupiterAngle + 0.5),
      z: 0.02 * Math.sin(t * 30)
    })
  }
  return points
}

/**
 * 生成帕克太阳探测器（Parker Solar Probe）轨迹（带时间戳）
 * 2018年发射，多次金星飞越以逐步接近太阳
 */
export function generateParkerTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2018-08-12').getTime())
  const steps = 160
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 8
    // 近日点逐步降低：0.25→0.046 AU
    const periDist = 0.25 - t * 0.2
    const angle = t * Math.PI * 2 * 6 // 约6圈完整轨道
    // 高度椭圆轨道
    const dist = periDist + t * 0.15 * (1 - Math.cos(angle * 0.5)) * 0.5
    const elev = t * 0.08 * Math.sin(angle)
    points.push({
      jd,
      x: Math.cos(angle) * (periDist + 0.15),
      y: Math.sin(angle) * (periDist + 0.15) * 0.7,
      z: Math.sin(elev) * 0.2
    })
  }
  return points
}

/**
 * 生成伽利略号（Galileo）近似轨迹（带时间戳）
 * 1989年发射，1995年抵达木星，在木星系统中执行多年探测
 */
export function generateGalileoTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1989-10-18').getTime())
  const steps = 160
  const jupiterOrbitBase = 5.2
  const jupiterPeriod = 4332.59
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 14
    const jupiterAngle = ((jd - 2451545.0) / jupiterPeriod) * Math.PI * 2
    const jx = Math.cos(jupiterAngle) * jupiterOrbitBase
    const jy = Math.sin(jupiterAngle) * jupiterOrbitBase
    // 巡航段：0-0.35 为飞往木星；之后为绕木星
    const cruiseDist = Math.min(t * 18, jupiterOrbitBase)
    const cruiseAngle = -0.8 + t * 0.6
    const offset = (t > 0.35) ? 0.04 * Math.cos(t * 30 + 0.8) : 0
    points.push({
      jd,
      x: t < 0.35 ? Math.cos(cruiseAngle) * cruiseDist : jx + offset,
      y: t < 0.35 ? Math.sin(cruiseAngle) * cruiseDist * 0.6 : jy + offset * 0.7,
      z: 0.03 * Math.sin(t * 25)
    })
  }
  return points
}

/**
 * 生成卡西尼号（Cassini）近似轨迹（带时间戳）
 * 1997年发射，2004年抵达土星，2017年结束使命坠入土星
 */
export function generateCassiniTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1997-10-15').getTime())
  const steps = 200
  const saturnOrbitBase = 9.54
  const saturnPeriod = 10759.22
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 20
    const saturnAngle = ((jd - 2451545.0) / saturnPeriod) * Math.PI * 2
    const sx = Math.cos(saturnAngle) * saturnOrbitBase
    const sy = Math.sin(saturnAngle) * saturnOrbitBase
    const cruiseDist = Math.min(t * 12, saturnOrbitBase)
    const cruiseAngle = -0.3 + t * 0.5
    const offset = (t > 0.33) ? 0.05 * Math.cos(t * 35 + 1.2) : 0
    points.push({
      jd,
      x: t < 0.33 ? Math.cos(cruiseAngle) * cruiseDist : sx + offset,
      y: t < 0.33 ? Math.sin(cruiseAngle) * cruiseDist * 0.5 : sy + offset * 0.6,
      z: 0.04 * Math.sin(t * 28 + 0.5)
    })
  }
  return points
}

/**
 * 生成黎明号（Dawn）近似轨迹（带时间戳）
 * 2007年发射，2011-2012探测灶神星，2015抵达谷神星，位于小行星带
 */
export function generateDawnTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2007-09-27').getTime())
  const steps = 160
  const beltBase = 2.5
  const beltPeriod = 1681
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 11
    const beltAngle = ((jd - 2451545.0) / beltPeriod) * Math.PI * 2
    const bx = Math.cos(beltAngle) * beltBase
    const by = Math.sin(beltAngle) * beltBase
    const cruiseDist = Math.min(t * 7, beltBase * 0.9)
    const cruiseAngle = -1.2 + t * 0.4
    const offset = (t > 0.35) ? 0.06 * Math.cos(t * 25 + 1.5) : 0
    points.push({
      jd,
      x: t < 0.35 ? Math.cos(cruiseAngle) * cruiseDist : bx + offset,
      y: t < 0.35 ? Math.sin(cruiseAngle) * cruiseDist * 0.7 : by + offset * 0.5,
      z: 0.06 * Math.sin(t * 15 + 1.0)
    })
  }
  return points
}

/**
 * 生成罗塞塔号（Rosetta）近似轨迹（带时间戳）
 * 2004年发射，2014年抵达67P彗星，经历多次行星引力弹弓
 */
export function generateRosettaTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2004-03-02').getTime())
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 12
    const baseDist = 1.5 + Math.sin(t * Math.PI * 3) * 1.2
    const angle = t * Math.PI * 2 * 2.5
    const wobble = Math.sin(t * Math.PI * 5) * 0.8
    const elev = Math.cos(t * Math.PI * 3) * 0.5
    points.push({
      jd,
      x: Math.cos(angle + wobble * 0.3) * (baseDist + wobble * 0.6),
      y: Math.sin(angle + wobble * 0.3) * (baseDist * 0.85 + wobble * 0.4),
      z: elev * 1.2
    })
  }
  return points
}

/**
 * 生成先驱者10号（Pioneer 10）近似轨迹（带时间戳）
 * 1972年发射，1973年飞越木星，之后飞向金牛座方向进入星际空间
 */
export function generatePioneerTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1972-03-02').getTime())
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 54
    const dist = 0.5 + t * 140
    const angle = -2.2 + t * 0.22
    const elev = 0.08 + t * 0.03
    points.push({
      jd,
      x: Math.cos(angle) * dist * Math.cos(elev),
      y: Math.sin(angle) * dist * Math.cos(elev),
      z: Math.sin(elev) * dist
    })
  }
  return points
}

/**
 * 生成ACE（Advanced Composition Explorer）近似轨迹（带时间戳）
 * 1997年发射，位于日地L1拉格朗日点（距太阳约0.99 AU）附近的晕轨道
 */
export function generateACETrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1997-08-25').getTime())
  const steps = 160
  const l1Dist = 0.99
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 29
    const haloAngle = t * Math.PI * 2 * 50
    const haloR = 0.015
    const earthAngle = ((jd - 2451545.0) / 365.25) * Math.PI * 2
    const ex = Math.cos(earthAngle) * l1Dist
    const ey = Math.sin(earthAngle) * l1Dist
    const haloOffsetX = Math.cos(haloAngle) * haloR * Math.cos(earthAngle)
    const haloOffsetY = Math.sin(haloAngle) * haloR * Math.cos(earthAngle)
    const haloOffsetZ = Math.cos(haloAngle) * haloR * 0.6
    points.push({
      jd,
      x: ex + haloOffsetX,
      y: ey + haloOffsetY,
      z: haloOffsetZ
    })
  }
  return points
}

/**
 * 生成深度撞击号（Deep Impact）近似轨迹（带时间戳）
 * 2005年发射，2005年7月撞击坦普尔1号彗星，2010年飞越哈特利2号彗星
 */
export function generateDeepImpactTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('2005-01-12').getTime())
  const steps = 160
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 8
    const dist = 0.8 + t * 4.5
    const angle = -0.5 + t * 1.8
    const elev = Math.sin(t * Math.PI * 2.5) * 0.3
    const ripple = Math.sin(t * Math.PI * 6) * 0.4
    points.push({
      jd,
      x: Math.cos(angle + ripple * 0.2) * (dist + ripple * 0.5),
      y: Math.sin(angle + ripple * 0.2) * (dist * 0.8 + ripple * 0.3),
      z: elev * 0.8
    })
  }
  return points
}

/**
 * 生成火星全球勘测者（Mars Global Surveyor）近似轨迹（带时间戳）
 * 1996年发射，1997年抵达火星轨道，2006年结束任务
 */
export function generateMarsGlobalSurveyorTrajectory() {
  const points = []
  const launchJD = unixToJulianLocal(new Date('1996-11-07').getTime())
  const steps = 160
  const marsOrbitBase = 1.52
  const marsPeriod = 686.97
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const jd = launchJD + t * 365.25 * 10
    const marsAngle = ((jd - 2451545.0) / marsPeriod) * Math.PI * 2
    const mx = Math.cos(marsAngle) * marsOrbitBase
    const my = Math.sin(marsAngle) * marsOrbitBase
    const cruiseDist = Math.min(t * 4.5, marsOrbitBase)
    const cruiseAngle = -0.3 + t * 0.2
    const offset = (t > 0.3) ? 0.025 * Math.cos(t * 40 + 0.6) : 0
    points.push({
      jd,
      x: t < 0.3 ? Math.cos(cruiseAngle) * cruiseDist : mx + offset,
      y: t < 0.3 ? Math.sin(cruiseAngle) * cruiseDist * 0.7 : my + offset * 0.6,
      z: 0.015 * Math.sin(t * 30)
    })
  }
  return points
}

function unixToJulianLocal(unixMs) {
  return (unixMs / 86400000) + 2440587.5
}
