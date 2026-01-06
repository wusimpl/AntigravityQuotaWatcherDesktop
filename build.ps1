# AG Quota Desktop Build Script
# Usage: .\build.ps1 [-Clean] [-SkipInstall]

param(
    [switch]$Clean,      # Clean build directories
    [switch]$SkipInstall # Skip npm install
)

$ErrorActionPreference = "Stop"

Write-Host "=== AG Quota Desktop Build Script ===" -ForegroundColor Cyan

# Clean build directories
if ($Clean) {
    Write-Host "`n[1/4] Cleaning build directories..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "dist-electron") { Remove-Item -Recurse -Force "dist-electron" }
    Write-Host "Clean complete" -ForegroundColor Green
} else {
    Write-Host "`n[1/4] Skipping clean (use -Clean flag to enable)" -ForegroundColor Gray
}

# Install dependencies
if (-not $SkipInstall) {
    Write-Host "`n[2/4] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else {
    Write-Host "`n[2/4] Skipping dependency installation" -ForegroundColor Gray
}

# Build project
Write-Host "`n[3/4] Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# Package
Write-Host "`n[4/4] Packaging Windows installer..." -ForegroundColor Yellow
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }

# Done
Write-Host "`n=== Build Complete! ===" -ForegroundColor Green
Write-Host "Output directory: dist-electron" -ForegroundColor Cyan

# Open output directory
if (Test-Path "dist-electron") {
    explorer "dist-electron"
}
