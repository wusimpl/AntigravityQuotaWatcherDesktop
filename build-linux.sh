#!/bin/bash
# Float Build Script for Linux
# 构建目标: deb, AppImage
# 用法: ./build-linux.sh [--clean] [--skip-install]

set -e

# 终端颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 默认参数
CLEAN=false
SKIP_INSTALL=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean|-c)
            CLEAN=true
            shift
            ;;
        --skip-install|-s)
            SKIP_INSTALL=true
            shift
            ;;
        --help|-h)
            echo "用法: ./build-linux.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --clean, -c          构建前清理输出目录"
            echo "  --skip-install, -s   跳过 npm install 阶段"
            echo "  --help, -h           显示此帮助信息"
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}=== Float 构建脚本 (Linux) ===${NC}"

# 第一步：清理
if [ "$CLEAN" = true ]; then
    echo -e "\n${YELLOW}[1/4] 正在清理构建目录...${NC}"
    rm -rf dist
    rm -rf dist-electron/linux
    echo -e "${GREEN}清理完成${NC}"
else
    echo -e "\n${CYAN}[1/4] 跳过清理 (使用 --clean 开启)${NC}"
fi

# 第二步：安装依赖
if [ "$SKIP_INSTALL" = false ]; then
    echo -e "\n${YELLOW}[2/4] 正在安装项目依赖...${NC}"
    npm install
else
    echo -e "\n${CYAN}[2/4] 跳过依赖安装${NC}"
fi

# 第三步：构建前端和主进程
echo -e "\n${YELLOW}[3/4] 正在编译项目...${NC}"
npm run build

# 第四步：打包 Linux 版本
echo -e "\n${YELLOW}[4/4] 正在打包 Linux 应用 (deb & AppImage)...${NC}"
npx electron-builder --linux --config.directories.output=dist-electron/linux

# 完成构建
echo -e "\n${GREEN}=== 构建成功！ ===${NC}"
echo -e "${CYAN}输出目录: dist-electron/linux${NC}"

# 列出生成的文件
if [ -d "dist-electron/linux" ]; then
    echo -e "\n${CYAN}生成的文件列表:${NC}"
    ls -lh dist-electron/linux/*.deb dist-electron/linux/*.AppImage 2>/dev/null || echo "未找到对应的安装包文件"
    
    # 自动打开输出目录
    if command -v xdg-open > /dev/null; then
        echo -e "\n${YELLOW}正在打开输出目录...${NC}"
        xdg-open dist-electron/linux &
    else
        echo -e "\n${YELLOW}提示: 未找到 xdg-open，请手动打开 dist-electron/linux 目录${NC}"
    fi
fi
