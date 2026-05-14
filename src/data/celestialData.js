// 天体数据配置
export const celestialData = {
  // 太阳系行星数据
  solarSystem: {
    sun: {
      name: '太阳',
      radius: 15,
      color: 0xFFD700,
      emissive: 0xFF6600,
      description: '太阳是太阳系的中心恒星，占太阳系总体积的99.86%',
      stats: {
        '类型': 'G型主序星',
        '直径': '139.2万公里',
        '表面温度': '5,778K',
        '年龄': '约46亿年'
      }
    },
    planets: [
      { 
        name: '水星', 
        radius: 1.5, 
        distance: 30, 
        color: 0x8C7853, 
        speed: 0.02,
        description: '距离太阳最近的行星',
        stats: {
          '直径': '4,879公里',
          '距太阳': '5,790万公里',
          '公转周期': '88地球日',
          '卫星数': '0'
        }
      },
      { 
        name: '金星', 
        radius: 2.5, 
        distance: 45, 
        color: 0xFFC649, 
        speed: 0.015,
        description: '太阳系中最热的行星',
        stats: {
          '直径': '12,104公里',
          '距太阳': '1.08亿公里',
          '公转周期': '225地球日',
          '卫星数': '0'
        }
      },
      { 
        name: '地球', 
        radius: 2.6, 
        distance: 60, 
        color: 0x6B93D6, 
        speed: 0.01,
        description: '我们居住的蓝色星球',
        stats: {
          '直径': '12,742公里',
          '距太阳': '1.496亿公里',
          '公转周期': '365.25地球日',
          '卫星数': '1'
        }
      },
      { 
        name: '火星', 
        radius: 2, 
        distance: 75, 
        color: 0xC1440E, 
        speed: 0.008,
        description: '被称为红色星球',
        stats: {
          '直径': '6,779公里',
          '距太阳': '2.28亿公里',
          '公转周期': '687地球日',
          '卫星数': '2'
        }
      },
      { 
        name: '木星', 
        radius: 8, 
        distance: 100, 
        color: 0xD8CA9D, 
        speed: 0.005,
        description: '太阳系中最大的行星',
        stats: {
          '直径': '139,820公里',
          '距太阳': '7.78亿公里',
          '公转周期': '11.86地球年',
          '卫星数': '79'
        }
      },
      { 
        name: '土星', 
        radius: 7, 
        distance: 125, 
        color: 0xFAD5A5, 
        speed: 0.004,
        hasRing: true,
        description: '以其壮观的环系统闻名',
        stats: {
          '直径': '116,460公里',
          '距太阳': '14.3亿公里',
          '公转周期': '29.42地球年',
          '卫星数': '82'
        }
      },
      { 
        name: '天王星', 
        radius: 5, 
        distance: 150, 
        color: 0x4FD0E7, 
        speed: 0.003,
        description: '侧向自转的冰巨星',
        stats: {
          '直径': '50,724公里',
          '距太阳': '28.7亿公里',
          '公转周期': '84地球年',
          '卫星数': '27'
        }
      },
      { 
        name: '海王星', 
        radius: 5, 
        distance: 170, 
        color: 0x4B70DD, 
        speed: 0.002,
        description: '太阳系最外层的行星',
        stats: {
          '直径': '49,244公里',
          '距太阳': '45亿公里',
          '公转周期': '164.8地球年',
          '卫星数': '14'
        }
      }
    ]
  },
  
  // 火星系统数据
  mars: {
    name: '火星',
    radius: 5,
    color: 0xC1440E,
    description: '火星是太阳系第四颗行星，被称为红色星球，表面富含氧化铁。',
    stats: {
      '直径': '6,779公里',
      '距太阳': '2.28亿公里',
      '公转周期': '687地球日',
      '自转周期': '24.6小时',
      '表面温度': '-87°C ~ -5°C',
      '卫星数量': '2颗'
    },
    moons: [
      {
        name: '火卫一',
        radius: 0.8,
        distance: 8,
        color: 0x8B7355,
        speed: 0.03,
        description: '火卫一（Phobos）是火星较大的卫星',
        stats: {
          '直径': '22.2公里',
          '轨道周期': '7.66小时',
          '距火星': '9,376公里'
        }
      },
      {
        name: '火卫二',
        radius: 0.6,
        distance: 12,
        color: 0x9C8B7A,
        speed: 0.02,
        description: '火卫二（Deimos）是火星较小的卫星',
        stats: {
          '直径': '12.6公里',
          '轨道周期': '30.35小时',
          '距火星': '23,463公里'
        }
      }
    ]
  },
  
  // 地月系统数据
  moon: {
    earth: {
      name: '地球',
      radius: 4,
      color: 0x6B93D6,
      atmosphereColor: 0x87CEEB,
      description: '地球是太阳系第三颗行星，目前已知唯一孕育生命的星球',
      stats: {
        '直径': '12,742公里',
        '距太阳': '1.496亿公里',
        '公转周期': '365.25天',
        '自转周期': '24小时',
        '表面温度': '-89°C ~ 58°C',
        '大气成分': '氮气78%，氧气21%'
      }
    },
    moon: {
      name: '月球',
      radius: 1.5,
      distance: 16,
      color: 0xC0C0C0,
      speed: 0.02,
      description: '月球是地球唯一的天然卫星，对地球的潮汐和气候有重要影响',
      stats: {
        '直径': '3,474公里',
        '距地球': '38.4万公里',
        '公转周期': '27.3地球日',
        '自转周期': '27.3地球日',
        '表面温度': '-173°C ~ 127°C',
        '重力': '地球的1/6'
      }
    }
  }
}

// 页面导航配置
export const navigationConfig = {
  routes: [
    { path: '/', name: '首页', icon: '🏠' },
    { path: '/solar-system', name: '太阳系', icon: '☀️' },
    { path: '/mars', name: '火星', icon: '🔴' },
    { path: '/moon', name: '月球', icon: '🌙' }
  ]
}

// 平台特性数据
export const platformFeatures = [
  {
    icon: '🌌',
    title: '太阳系全景',
    description: '完整展示八大行星及其轨道，呈现太阳系的宏伟结构'
  },
  {
    icon: '🔴',
    title: '火星探测',
    description: '详细展示火星表面特征及其卫星系统'
  },
  {
    icon: '🌙',
    title: '地月系统',
    description: '展现地球与月球的引力互动和轨道关系'
  },
  {
    icon: '🎮',
    title: '交互控制',
    description: '支持旋转、缩放、平移等多维度视角控制'
  },
  {
    icon: '📊',
    title: '数据可视化',
    description: '实时显示天体参数和轨道信息'
  },
  {
    icon: '✨',
    title: '视觉效果',
    description: '基于物理的光照渲染，打造逼真视觉体验'
  }
]
