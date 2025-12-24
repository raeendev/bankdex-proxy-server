# PowerShell Script to Unlock WebSocket Configuration at Server Level
# Run this as Administrator

Write-Host "=== Unlocking IIS WebSocket Configuration ===" -ForegroundColor Cyan
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

# Step 1: Unlock webSocket section
Write-Host "Step 1: Unlocking webSocket configuration section..." -ForegroundColor Yellow

try {
    & "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/webSocket
    Write-Host "✓ Successfully unlocked webSocket section" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to unlock webSocket: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "This might already be unlocked, or WebSocket feature is not installed." -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Verify WebSocket feature is installed
Write-Host "Step 2: Checking if WebSocket feature is installed..." -ForegroundColor Yellow

try {
    $wsFeature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebSockets -ErrorAction Stop
    
    if ($wsFeature.State -eq "Enabled") {
        Write-Host "✓ WebSocket feature is installed and enabled" -ForegroundColor Green
    } else {
        Write-Host "✗ WebSocket feature is NOT enabled" -ForegroundColor Red
        Write-Host ""
        Write-Host "Installing WebSocket feature..." -ForegroundColor Yellow
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebSockets -NoRestart
        Write-Host "✓ WebSocket feature installed (may require restart)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Could not check WebSocket feature: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Unlock allowedServerVariables (bonus)
Write-Host "Step 3: Unlocking allowedServerVariables (optional)..." -ForegroundColor Yellow

try {
    & "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/rewrite/allowedServerVariables
    Write-Host "✓ Successfully unlocked allowedServerVariables" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not unlock allowedServerVariables: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Restart IIS
Write-Host "Step 4: Restarting IIS..." -ForegroundColor Yellow

try {
    iisreset /restart
    Write-Host "✓ IIS restarted successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to restart IIS: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Configuration Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Apply your web.config file" -ForegroundColor White
Write-Host "   Copy-Item 'web.config.websocket-fixed-v2' -Destination 'C:\inetpub\wwwroot\app.bankdex.io\web.config' -Force" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the site:" -ForegroundColor White
Write-Host "   Invoke-WebRequest -Uri 'https://app.bankdex.io/health' -UseBasicParsing" -ForegroundColor Gray
Write-Host ""
