@echo off
echo ========================================
echo   深空探测可视化展示平台 - 启动脚本
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] Node.js版本:
node --version
echo.

REM 检查npm是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到npm
    pause
    exit /b 1
)

echo [信息] npm版本:
npm --version
echo.

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo [提示] 检测到node_modules目录不存在，正在安装依赖...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成
    echo.
)

REM 选择运行模式
echo 请选择运行模式:
echo.
echo 1. 开发模式 (Development Mode) - http://localhost:3000
echo 2. 生产服务器 (Production Server) - http://localhost:8080
echo 3. 仅构建 (Build Only)
echo 4. 退出
echo.
set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto build
if "%choice%"=="4" goto end
goto invalid

:dev
echo.
echo ========================================
echo   启动开发服务器...
echo   访问地址: http://localhost:3000
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.
call npm run dev
goto end

:prod
echo.
echo ========================================
echo   构建生产版本...
echo ========================================
echo.
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo.
echo ========================================
echo   启动生产服务器...
echo   访问地址: http://localhost:8080
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.
call npm run server
goto end

:build
echo.
echo ========================================
echo   开始构建...
echo ========================================
echo.
call npm run build
if %errorlevel% equ 0 (
    echo.
    echo [成功] 构建完成！
    echo 输出目录: dist/
) else (
    echo.
    echo [错误] 构建失败
)
goto end

:invalid
echo.
echo [错误] 无效的选项，请重新运行脚本
echo.

:end
echo.
pause
