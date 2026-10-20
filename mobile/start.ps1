# FairShare Frontend Launcher (Web & Mobile)
# Usage:
#   .\start.ps1           (Interactive menu)
#   .\start.ps1 -web      (Directly open Web in browser)
#   .\start.ps1 -mobile   (Directly start Expo Go for Phone)
#   .\start.ps1 -build    (Build/Export web to dist/)
#   .\start.ps1 -deploy   (Build and Deploy web to https://fairshare-url.expo.app)

param(
    [switch]$web,
    [switch]$mobile,
    [switch]$build,
    [switch]$deploy
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    FairShare Mobile & Web Launcher     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if node_modules exists
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "[WARNING] node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

if ($web) {
    $choice = "1"
} elseif ($mobile) {
    $choice = "2"
} elseif ($build) {
    $choice = "3"
} elseif ($deploy) {
    $choice = "4"
} else {
    Write-Host "`nWhat would you like to run?" -ForegroundColor Yellow
    Write-Host "  [1] Web Page      (Opens automatically in your browser at http://localhost:8081)" -ForegroundColor White
    Write-Host "  [2] Expo Go       (Displays QR code in terminal to scan with your phone)" -ForegroundColor White
    Write-Host "  [3] Build Web     (Exports production web files locally into mobile/dist/)" -ForegroundColor White
    Write-Host "  [4] Deploy to Web (Uploads web build to https://fairshare-url.expo.app)" -ForegroundColor Cyan
    Write-Host "  [q] Quit" -ForegroundColor DarkGray

    $choice = Read-Host "`nEnter option (1, 2, 3, or 4)"
}

switch ($choice) {
    "1" {
        Write-Host "`n[STARTING WEB] Opening FairShare in your default web browser..." -ForegroundColor Green
        Write-Host "Local URL: http://localhost:8081`n" -ForegroundColor DarkGray
        npx expo start --web
    }
    "2" {
        Write-Host "`n[STARTING EXPO GO] Starting Metro bundler..." -ForegroundColor Green
        Write-Host "Open the 'Expo Go' app on your phone and scan the QR code below:`n" -ForegroundColor DarkGray
        npx expo start -c
    }
    "3" {
        Write-Host "`n[BUILDING WEB] Exporting production bundle to mobile/dist/..." -ForegroundColor Green
        npx expo export --platform web --clear
        Write-Host "`n[OK] Web bundle successfully exported to mobile/dist/." -ForegroundColor Green
        Write-Host "NOTE: This builds files on your PC. To publish to https://fairshare-url.expo.app, run option 4 (Deploy to Web)." -ForegroundColor Yellow
    }
    "4" {
        Write-Host "`n[BUILDING & DEPLOYING] Exporting web bundle..." -ForegroundColor Green
        npx expo export --platform web --clear
        Write-Host "`n[UPLOADING] Deploying bundle to https://fairshare-url.expo.app..." -ForegroundColor Cyan
        npx eas deploy --prod
        Write-Host "`n[SUCCESS] Deployed successfully to https://fairshare-url.expo.app!" -ForegroundColor Green
    }
    "q" {
        Write-Host "Exited." -ForegroundColor DarkGray
    }
    default {
        Write-Host "Invalid option selected." -ForegroundColor Red
    }
}
