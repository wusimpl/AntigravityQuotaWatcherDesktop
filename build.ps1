# AG Quota Watcher Desktop Build Script
# Usage: .\build.ps1 [-Clean]

param(
    [switch]$Clean      # Clean build directories
)

$ErrorActionPreference = "Stop"

Write-Host "=== AG Quota Watcher Desktop Build Script ===" -ForegroundColor Cyan

# Clean build directories
if ($Clean) {
    Write-Host "`n[1/3] Cleaning build directories..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "dist-electron\windows") { Remove-Item -Recurse -Force "dist-electron\windows" }
    Write-Host "Clean complete" -ForegroundColor Green
}
else {
    Write-Host "`n[1/3] Skipping clean (use -Clean flag to enable)" -ForegroundColor Gray
}

# Build project
Write-Host "`n[2/3] Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# Package (unpacked only, skip portable exe to save time)
Write-Host "`n[3/3] Packaging Windows (unpacked)..." -ForegroundColor Yellow
npx electron-builder --win dir --config.directories.output=dist-electron/windows
if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }

# Done
Write-Host "`n=== Build Complete! ===" -ForegroundColor Green
Write-Host "Output directory: dist-electron/windows" -ForegroundColor Cyan

# Open output directory
if (Test-Path "dist-electron\windows") {
    explorer "dist-electron\windows"
}
