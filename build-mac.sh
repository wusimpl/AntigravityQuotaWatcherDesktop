#!/bin/bash
# AG Quota Watcher Desktop Build Script for macOS
# Usage: ./build.sh [--clean] [--skip-install] [--platform <win|mac|all>]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
CLEAN=false
SKIP_INSTALL=false
PLATFORM="mac"

# Parse arguments
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
        --platform|-p)
            PLATFORM="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: ./build.sh [options]"
            echo ""
            echo "Options:"
            echo "  --clean, -c          Clean build directories before building"
            echo "  --skip-install, -s   Skip npm install"
            echo "  --platform, -p       Target platform: win, mac, or all (default: mac)"
            echo "  --help, -h           Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}=== AG Quota Watcher Desktop Build Script ===${NC}"

# Step 1: Clean
if [ "$CLEAN" = true ]; then
    echo -e "\n${YELLOW}[1/4] Cleaning build directories...${NC}"
    rm -rf dist
    rm -rf dist-electron/mac
    echo -e "${GREEN}Clean complete${NC}"
else
    echo -e "\n${CYAN}[1/4] Skipping clean (use --clean flag to enable)${NC}"
fi

# Step 2: Install dependencies
if [ "$SKIP_INSTALL" = false ]; then
    echo -e "\n${YELLOW}[2/4] Installing dependencies...${NC}"
    npm install
else
    echo -e "\n${CYAN}[2/4] Skipping dependency installation${NC}"
fi

# Step 3: Build project
echo -e "\n${YELLOW}[3/4] Building project...${NC}"
npm run build

# Step 4: Package
echo -e "\n${YELLOW}[4/4] Packaging application...${NC}"

case $PLATFORM in
    mac)
        echo "Building for macOS..."
        npx electron-builder --mac --config.directories.output=dist-electron/mac
        ;;
    win)
        echo "Building for Windows..."
        npx electron-builder --win --config.directories.output=dist-electron/windows
        ;;
    all)
        echo "Building for all platforms..."
        npx electron-builder --mac --win --config.directories.output=dist-electron
        ;;
    *)
        echo -e "${RED}Unknown platform: $PLATFORM${NC}"
        exit 1
        ;;
esac

# Done
echo -e "\n${GREEN}=== Build Complete! ===${NC}"
echo -e "${CYAN}Output directory: dist-electron/$PLATFORM${NC}"

# List output files
if [ -d "dist-electron/$PLATFORM" ]; then
    echo -e "\n${CYAN}Generated files:${NC}"
    ls -la dist-electron/$PLATFORM/*.dmg dist-electron/$PLATFORM/*.exe 2>/dev/null || true
fi
