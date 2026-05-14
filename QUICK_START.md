# 快速开始指南 🚀

欢迎使用深空探测可视化展示平台！本指南将帮助您快速上手。

## 📋 前置要求

在开始之前，请确保您的系统已安装：

- **Node.js** (版本 16.0 或更高) - [下载地址](https://nodejs.org/)
- **npm** (随Node.js一起安装)
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+)

## 🔧 快速安装

### 方法一：使用启动脚本（推荐）

#### Windows用户
```bash
# 双击运行或在命令行执行
start.bat
```

#### Mac/Linux用户
```bash
# 添加执行权限
chmod +x start.sh

# 运行脚本
./start.sh
```

### 方法二：手动安装

#### 步骤1: 安装依赖
```bash
npm install
```

#### 步骤2: 启动开发服务器
```bash
npm run dev
```

#### 步骤3: 访问应用
打开浏览器，访问: http://localhost:3000

## 🎯 运行模式

### 开发模式
```bash
npm run dev
```
- 地址: http://localhost:3000
- 支持热重载
- 适合开发和调试

### 生产模式
```bash
# 构建
npm run build

# 启动服务器
npm run server
```
- 地址: http://localhost:8080
- 优化的生产性能
- 适合部署

## 🌌 功能导航

### 首页
- 平台介绍
- 功能特性展示
- 快速导航入口

### 太阳系视图
- 八大行星完整展示
- 真实轨道比例
- 土星环效果
- 点击顶部导航"太阳系"进入

### 火星视图
- 火星表面特征
- 火卫一和火卫二
- 详细数据面板
- 点击顶部导航"火星"进入

### 月球视图
- 地月系统展示
- 地球大气层效果
- 月球轨道模拟
- 点击顶部导航"月球"进入

## 🎮 操作说明

### 鼠标控制
- **左键拖拽**: 旋转视角
- **右键拖拽**: 平移视角
- **滚轮**: 缩放视图

### 控制面板
- **显示/隐藏轨道**: 切换轨道线显示
- **暂停/恢复旋转**: 控制动画播放
- **重置视角**: 回到初始视角

## ❓ 常见问题

### Q1: 页面空白或无法加载
**解决方案:**
1. 检查浏览器控制台是否有错误
2. 确认Node.js已正确安装
3. 删除node_modules重新安装依赖
```bash
rm -rf node_modules
npm install
```

### Q2: 3D场景渲染缓慢
**解决方案:**
1. 降低浏览器硬件加速设置
2. 关闭其他占用GPU的程序
3. 检查显卡驱动是否最新

### Q3: 端口被占用
**解决方案:**
修改 `vite.config.js` 中的端口配置
```javascript
server: {
  port: 3001, // 改为其他端口
}
```

### Q4: 浏览器兼容性
**支持的浏览器:**
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅
- IE不支持 ❌

## 🛠️ 开发指南

### 项目结构概览
```
dark-space/
├── src/
│   ├── views/          # 页面组件
│   ├── utils/          # 工具函数
│   ├── data/           # 数据配置
│   └── styles/         # 样式文件
├── server/             # 后端服务
└── dist/              # 构建输出
```

### 添加新页面
1. 在 `src/views/` 创建新组件
2. 在 `src/main.js` 添加路由
3. 在导航中添加入口

### 修改天体数据
编辑 `src/data/celestialData.js`

### 调整样式
- 全局样式: `src/styles/global.css`
- 组件样式: 在各组件的 `<style>` 标签中

## 📊 性能优化建议

### 开发时
- 使用开发模式，享受热重载
- 开启浏览器DevTools的Vue插件
- 使用Performance面板分析性能

### 生产环境
- 使用构建后的文件
- 启用Gzip压缩
- 使用CDN加速静态资源

## 🎓 学习资源

### Vue 3
- [Vue 3官方文档](https://cn.vuejs.org/)
- [Vue Router文档](https://router.vuejs.org/zh/)

### Three.js
- [Three.js官方文档](https://threejs.org/docs/)
- [Three.js示例](https://threejs.org/examples/)

### WebGL
- [WebGL教程](https://webglfundamentals.org/)

## 🤝 贡献代码

欢迎提交Issue和Pull Request！

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📞 联系我们

如有问题或建议，请通过以下方式联系：

- 提交Issue
- 发送邮件
- 加入讨论组

## 🌟 下一步

- 探索各个视图页面
- 了解天体数据结构
- 尝试自定义样式
- 添加新的天体
- 优化性能

---

**祝您探索愉快！** 🌌✨

---

*版本: 1.0.0*  
*更新日期: 2024*
