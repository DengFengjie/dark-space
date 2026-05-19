#!/usr/bin/env bash

set -e

echo "========================================"
echo "  深空探测可视化展示平台 - 启动脚本"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到Node.js，请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js版本:"
node --version
echo ""

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "[错误] 未检测到npm"
    exit 1
fi

echo "[信息] npm版本:"
npm --version
echo ""

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "[提示] 检测到node_modules目录不存在，正在安装依赖..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
    echo ""
    echo "[成功] 依赖安装完成"
    echo ""
fi

# 选择运行模式
echo "请选择运行模式:"
echo ""
echo "1. 开发模式 (Development Mode) - http://localhost:3000"
echo "2. 生产服务器 (Production Server) - http://localhost:8080"
echo "3. 仅构建 (Build Only)"
echo "4. 退出"
echo ""
read -r -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "========================================"
        echo "  启动开发服务器..."
        echo "  前端地址: http://localhost:3000"
        echo "  后端地址: http://localhost:8080"
        echo "  按 Ctrl+C 停止服务器"
        echo "  注意: 需要根目录有 .env 文件并配置 MARS_VISTA_API_KEY"
        echo "========================================"
        echo ""
        npm run dev:all
        ;;
    2)
        echo ""
        echo "========================================"
        echo "  构建生产版本..."
        echo "========================================"
        echo ""
        npm run build
        if [ $? -ne 0 ]; then
            echo "[错误] 构建失败"
            exit 1
        fi
        echo ""
        echo "========================================"
        echo "  启动生产服务器..."
        echo "  访问地址: http://localhost:8080"
        echo "  按 Ctrl+C 停止服务器"
        echo "========================================"
        echo ""
        npm run server
        ;;
    3)
        echo ""
        echo "========================================"
        echo "  开始构建..."
        echo "========================================"
        echo ""
        npm run build
        if [ $? -eq 0 ]; then
            echo ""
            echo "[成功] 构建完成！"
            echo "输出目录: dist/"
        else
            echo ""
            echo "[错误] 构建失败"
        fi
        ;;
    4)
        echo "再见！"
        exit 0
        ;;
    *)
        echo ""
        echo "[错误] 无效的选项"
        exit 1
        ;;
esac

echo ""
echo "脚本执行完毕"
