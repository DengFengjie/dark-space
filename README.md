# 深空探测可视化展示平台（dark-space）

一个基于 **Vue 3 + Vite + Three.js + Express** 的深空探测可视化项目，提供前端 3D 可视化展示与后端 API 代理能力。

## 1. 项目简介

- 前端：Vue 3 + Vite，负责页面展示与交互
- 后端：Express，负责代理外部数据源（如 Mars Vista / Nebulum / JPL Horizons）并提供统一接口
- 运行方式：支持前后端联调开发、生产构建与服务启动

## 2. 环境要求

- Node.js 18+（推荐 LTS）
- npm 9+

可通过以下命令检查：

```bash
node -v
npm -v
```

## 3. 安装依赖

```bash
npm install
```

## 4. 环境变量

项目根目录下需要 `.env` 文件（可基于 `.env.example` 复制）：

```bash
cp .env.example .env
```

关键变量：

- `MARS_VISTA_API_KEY`：Mars Vista API Key（未配置时后端会自动回退到 Nebulum 数据源）

## 5. 启动方式

### 5.1 快速启动脚本（推荐）

#### Windows

双击 `start.bat`，或命令行执行：

```bat
start.bat
```

#### Linux / macOS

```bash
chmod +x start.sh
./start.sh
```

脚本会提供菜单：

1. **开发模式（前后端联调）**
2. **生产模式（先构建再启动服务）**
3. **仅构建**
4. 退出

### 5.2 npm 脚本

```bash
# 前端开发（仅 Vite）
npm run dev

# 前后端同时开发
npm run dev:all

# 构建前端产物
npm run build

# 启动后端服务（会托管 dist）
npm run server
```

## 6. 默认地址

- 前端开发服务器：`http://localhost:3000`
- 后端服务地址：`http://localhost:8080`

> 说明：`vite.config.js` 中已配置开发端口；生产模式下由 Express 托管 `dist/`。

## 7. 主要目录结构

```text
dark-space/
├─ src/                # 前端源码（Vue + Three.js）
├─ server/             # 后端服务与路由
│  ├─ index.js
│  └─ routes/
├─ tools/              # 数据处理或辅助工具脚本
├─ start.bat           # Windows 启动脚本
├─ start.sh            # Linux/macOS 启动脚本
└─ package.json
```

## 8. 常见问题

### Q1：启动时报端口占用？

请释放占用端口（默认 3000 / 8080），或修改对应配置后重启。

### Q2：未配置 `MARS_VISTA_API_KEY` 会怎样？

后端访问 Mars Vista 失败时会自动回退到 Nebulum 数据源，核心功能可继续使用。

### Q3：生产模式页面空白？

请先确认构建成功并存在 `dist/` 目录，然后再执行 `npm run server`。

## 9. 许可证

当前仓库未显式声明许可证，如需开源发布请补充 `LICENSE` 文件。