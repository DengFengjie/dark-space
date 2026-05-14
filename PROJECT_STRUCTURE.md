# 深空探测可视化展示平台 - 项目结构说明

## 📁 目录结构

```
dark-space/
│
├── public/                      # 静态资源目录（可选）
│   └── favicon.ico
│
├── src/                         # 源代码目录
│   ├── assets/                  # 资源文件（图片、字体等）
│   │   └── textures/            # 天体纹理贴图
│   │
│   ├── components/              # 可复用组件
│   │   ├── CelestialBody.vue    # 天体组件
│   │   ├── OrbitLine.vue        # 轨道组件
│   │   └── InfoPanel.vue        # 信息面板组件
│   │
│   ├── data/                    # 数据配置
│   │   └── celestialData.js     # 天体数据配置
│   │
│   ├── styles/                  # 样式文件
│   │   └── global.css           # 全局样式
│   │
│   ├── utils/                   # 工具函数
│   │   └── threeUtils.js        # Three.js工具类
│   │
│   ├── views/                   # 页面视图
│   │   ├── Home.vue             # 首页
│   │   ├── SolarSystem.vue      # 太阳系页面
│   │   ├── MarsView.vue         # 火星页面
│   │   └── MoonView.vue         # 月球页面
│   │
│   ├── App.vue                  # 根组件
│   └── main.js                  # 入口文件
│
├── server/                      # 后端服务器
│   ├── index.js                 # Express服务器入口
│   ├── routes/                  # API路由
│   │   ├── planets.js           # 行星数据接口
│   │   └── info.js              # 信息查询接口
│   └── data/                    # 服务端数据
│       └── celestial.json       # 天体JSON数据
│
├── dist/                        # 构建输出目录
├── node_modules/                # 依赖包
│
├── index.html                   # HTML模板
├── package.json                 # 项目配置
├── vite.config.js               # Vite配置
├── .gitignore                   # Git忽略文件
└── README.md                    # 项目说明

```

## 📋 文件说明

### 核心文件

#### `src/main.js`
- 应用入口文件
- Vue Router路由配置
- 全局样式引入

#### `src/App.vue`
- 根组件
- 路由视图容器
- 页面过渡动画

#### `index.html`
- HTML模板
- 页面元信息

### 视图页面

#### `src/views/Home.vue`
- 精美首页介绍
- 功能特性展示
- 导航入口

#### `src/views/SolarSystem.vue`
- 太阳系三维场景
- 八大行星展示
- 轨道动画

#### `src/views/MarsView.vue`
- 火星专属场景
- 火卫系统展示

#### `src/views/MoonView.vue`
- 地月系统场景
- 地球和月球关系展示

### 工具和配置

#### `src/utils/threeUtils.js`
- Three.js工具类
- 通用3D操作封装
- 场景管理器
- 动画管理器

#### `src/data/celestialData.js`
- 天体数据配置
- 导航配置
- 平台特性数据

#### `vite.config.js`
- Vite构建配置
- 开发服务器设置
- 代理配置

#### `server/index.js`
- Express后端服务器
- API接口
- 静态资源服务

## 🎨 技术架构

### 前端架构
```
用户界面 (Vue 3)
    ↓
路由管理 (Vue Router)
    ↓
三维渲染 (Three.js)
    ↓
工具封装 (ThreeUtils)
    ↓
数据配置 (celestialData)
```

### 后端架构
```
HTTP服务器 (Express)
    ↓
路由处理
    ↓
数据接口
    ↓
静态资源
```

## 🚀 开发流程

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 开发新功能
- 在 `src/views/` 创建新页面
- 在 `src/components/` 创建可复用组件
- 在 `src/data/` 添加数据配置
- 在 `src/utils/` 添加工具函数

### 4. 构建生产版本
```bash
npm run build
```

### 5. 部署
```bash
npm run server
```

## 📦 依赖说明

### 生产依赖
- `vue`: Vue 3框架核心
- `vue-router`: 路由管理
- `three`: 3D图形引擎
- `express`: Node.js Web框架

### 开发依赖
- `vite`: 构建工具
- `@vitejs/plugin-vue`: Vue插件

## 🔧 配置项

### Vite配置 (vite.config.js)
- 端口: 3000
- 代理: /api → localhost:8080
- 输出目录: dist

### 服务器配置 (server/index.js)
- 端口: 8080
- 静态文件: dist目录
- API前缀: /api

## 📝 开发规范

### 命名规范
- 文件名: PascalCase (组件), camelCase (工具)
- 组件名: PascalCase
- 变量名: camelCase
- 常量名: UPPER_SNAKE_CASE

### 代码组织
- 每个页面独立成文件
- 通用逻辑抽取到utils
- 数据配置统一管理
- 样式使用scoped或全局样式

## 🎯 优化建议

### 性能优化
1. 使用BufferGeometry替代普通Geometry
2. 纹理图片压缩和懒加载
3. 控制场景中的多边形数量
4. 使用LOD (Level of Detail)

### 代码优化
1. 组件懒加载
2. 路由级别代码分割
3. 合理使用computed和watch
4. 避免内存泄漏

### 用户体验
1. 添加加载状态
2. 提供操作提示
3. 流畅的动画效果
4. 响应式设计

## 🌟 扩展方向

### 功能扩展
- 更多天体数据
- 小行星带展示
- 彗星轨道模拟
- 探测器轨迹模拟

### 技术升级
- 添加物理引擎
- VR/AR支持
- WebGL2特性
- GPU加速计算

### 数据增强
- 实时天文数据
- 历史观测数据
- 科学文献链接
- 教育内容集成

---

**版本**: 1.0.0  
**更新日期**: 2024  
**维护者**: 深空探测团队
