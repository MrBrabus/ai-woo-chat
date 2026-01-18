# Build and Package Script for Local Deployment (PowerShell)
# Creates deploy.zip files with all necessary files for upload to server
#
# Usage: .\build-and-package.ps1
# Output: deploy-standalone.zip, deploy-assets.zip

$ErrorActionPreference = "Stop"

Write-Host "🔨 Building Next.js application..." -ForegroundColor Yellow

# Build application locally
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Check if build was successful
if (-not (Test-Path ".next\standalone")) {
    Write-Host "❌ Error: Build failed - .next/standalone folder not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green

# Remove old deploy files
Write-Host "📦 Packaging files for deployment..." -ForegroundColor Yellow

$deployFiles = @("deploy.zip", "deploy-standalone.zip", "deploy-assets.zip")
foreach ($file in $deployFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
    }
}

# Create deploy-standalone.zip
Write-Host "Creating deploy-standalone.zip..." -ForegroundColor Yellow
Compress-Archive -Path ".next\standalone" -DestinationPath "deploy-standalone.zip" -Force

# Create deploy-assets.zip
Write-Host "Creating deploy-assets.zip..." -ForegroundColor Yellow
Compress-Archive -Path ".next\static", "public" -DestinationPath "deploy-assets.zip" -Force

# Optionally: Create single deploy.zip (larger, but easier)
Write-Host "Creating deploy.zip (single file - optional)..." -ForegroundColor Yellow
Compress-Archive -Path ".next\standalone", ".next\static", "public" -DestinationPath "deploy.zip" -Force

Write-Host "✅ Packaging complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📤 Next steps:" -ForegroundColor Yellow
Write-Host "1. Upload deploy-standalone.zip and deploy-assets.zip to server"
Write-Host "2. On server, run: ./unpack-and-deploy.sh"
Write-Host "3. Restart Node.js app in cPanel"
Write-Host ""
Write-Host "Files created:" -ForegroundColor Green
Get-Item deploy*.zip | ForEach-Object {
    $fileName = $_.Name
    Write-Host "  - $fileName" -ForegroundColor Cyan
}
