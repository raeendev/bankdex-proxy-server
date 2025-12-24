# PowerShell Script to Unlock IIS Server Variables
# Run this as Administrator if you need to use allowedServerVariables in web.config

Write-Host "=== Unlocking IIS Configuration Sections ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Unlock allowedServerVariables section
Write-Host "Unlocking allowedServerVariables section..." -ForegroundColor Yellow

try {
    & "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/rewrite/allowedServerVariables
    Write-Host "✓ Successfully unlocked allowedServerVariables" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to unlock: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Use web.config.websocket-fixed-v2 (without locked sections)" -ForegroundColor Yellow
}

Write-Host ""

# Verify the unlock
Write-Host "Verifying configuration..." -ForegroundColor Yellow
try {
    $config = & "$env:windir\system32\inetsrv\appcmd.exe" list config -section:system.webServer/rewrite/allowedServerVariables
    Write-Host $config -ForegroundColor White
} catch {
    Write-Host "Could not verify: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Apply your web.config file" -ForegroundColor White
Write-Host "2. Run: iisreset /restart" -ForegroundColor White
Write-Host ""
