# Script: deploy-windows.ps1
# Description: Auto deployment script for Windows Server
# Usage: .\deploy-windows.ps1
# Note: Must run as Administrator

$ErrorActionPreference = "Stop"

Write-Host "Starting deployment process on Windows Server..." -ForegroundColor Green

# Check Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please open PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Project path
$projectPath = $PSScriptRoot
if (-not $projectPath) {
    $projectPath = Get-Location
}

Write-Host "Project path: $projectPath" -ForegroundColor Cyan

# Check Node.js
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm is installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm not found!" -ForegroundColor Red
    exit 1
}

# Check PM2
Write-Host "`nChecking PM2..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "[OK] PM2 is installed: $pm2Version" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] PM2 is not installed. Installing..." -ForegroundColor Yellow
    npm install -g pm2
    npm install -g pm2-windows-startup
    Write-Host "[OK] PM2 installed" -ForegroundColor Green
}

# Install Dependencies
Write-Host "`nInstalling Dependencies..." -ForegroundColor Yellow
Set-Location $projectPath
npm install --production
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

# Create logs directory
Write-Host "`nCreating logs directory..." -ForegroundColor Yellow
$logsPath = Join-Path $projectPath "logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "[OK] Logs directory created" -ForegroundColor Green
} else {
    Write-Host "[OK] Logs directory exists" -ForegroundColor Green
}

# Check .env file
Write-Host "`nChecking .env file..." -ForegroundColor Yellow
$envPath = Join-Path $projectPath ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    $envLines = @(
        "PORT=3000",
        "ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io",
        "NODE_ENV=production"
    )
    $envLines | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "[OK] .env file created. Please review it." -ForegroundColor Green
} else {
    Write-Host "[OK] .env file exists" -ForegroundColor Green
}

# Check IIS (optional - for information only)
Write-Host "`nChecking IIS..." -ForegroundColor Yellow
try {
    $iisFeature = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
    if ($iisFeature -and $iisFeature.InstallState -eq "Installed") {
        Write-Host "[WARNING] IIS is installed. If you want to use Node.js directly, stop IIS:" -ForegroundColor Yellow
        Write-Host "   Stop-Service W3SVC" -ForegroundColor Gray
    } else {
        Write-Host "[OK] IIS is not installed - you can use Node.js directly" -ForegroundColor Green
    }
} catch {
    Write-Host "[INFO] Cannot check IIS (probably not Windows Server)" -ForegroundColor Cyan
}

# Start with PM2
Write-Host "`nStarting with PM2..." -ForegroundColor Yellow
Set-Location $projectPath

# Stop previous instance (if exists)
pm2 delete orderly-proxy 2>$null

# Start server
pm2 start ecosystem.config.js --env production
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start PM2!" -ForegroundColor Red
    exit 1
}

# Save configuration
pm2 save

Write-Host "`n[SUCCESS] Deployment completed successfully!" -ForegroundColor Green
Write-Host "`nPM2 Status:" -ForegroundColor Cyan
pm2 status

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Open Firewall:" -ForegroundColor White
Write-Host "   New-NetFirewallRule -DisplayName 'HTTP' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow" -ForegroundColor Gray
Write-Host "   New-NetFirewallRule -DisplayName 'HTTPS' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configure SSL (optional):" -ForegroundColor White
Write-Host "   - Recommended: Use Cloudflare (easiest method)" -ForegroundColor Gray
Write-Host "   - Or: Use win-acme for Let's Encrypt" -ForegroundColor Gray
Write-Host ""
Write-Host "3. If you want to run on port 80/443:" -ForegroundColor White
Write-Host "   - Edit .env file: PORT=80 or PORT=443" -ForegroundColor Gray
Write-Host "   - pm2 restart orderly-proxy" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Check logs:" -ForegroundColor White
Write-Host "   pm2 logs orderly-proxy" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test Health Check:" -ForegroundColor White
Write-Host "   Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: For complete guide, see DEPLOYMENT.md" -ForegroundColor Cyan
