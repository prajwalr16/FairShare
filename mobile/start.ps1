# FairShare Frontend Launcher & Deployment Suite (Web & Mobile)
# Usage:
#   .\start.ps1           (Interactive menu)
#   .\start.ps1 -web      (Directly open Web in browser)
#   .\start.ps1 -mobile   (Directly start Expo Go for Phone)
#   .\start.ps1 -build    (Build/Export web to dist/)
#   .\start.ps1 -deploy   (Deploy Web to EAS Hosting: https://fairshare-url.expo.app)
#   .\start.ps1 -apk      (Trigger Android APK preview build on EAS)

param(
    [switch]$web,
    [switch]$mobile,
    [switch]$build,
    [switch]$deploy,
    [switch]$apk
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    FairShare Mobile & Web Suite        " -ForegroundColor Cyan
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
} elseif ($apk) {
    $choice = "5"
} else {
    Write-Host "`nWhat would you like to run?" -ForegroundColor Yellow
    Write-Host "  [1] Web Page          (Opens browser at http://localhost:8081)" -ForegroundColor White
    Write-Host "  [2] Expo Go           (Displays QR code in terminal for mobile)" -ForegroundColor White
    Write-Host "  [3] Build Web Local   (Exports static web bundle to mobile/dist/)" -ForegroundColor White
    Write-Host "  [4] Deploy Web (EAS)  (Publishes to https://fairshare-url.expo.app)" -ForegroundColor Cyan
    Write-Host "  [5] Build Android APK (Triggers EAS cloud build for Android APK)" -ForegroundColor Green
    Write-Host "  [6] Build iOS App     (Triggers EAS production build for iOS)" -ForegroundColor Magenta
    Write-Host "  [q] Quit" -ForegroundColor DarkGray

    $choice = Read-Host "`nEnter option (1, 2, 3, 4, 5, 6)"
}

switch ($choice) {
    "1" {
        Write-Host "`n[STARTING WEB] Opening FairShare in default browser..." -ForegroundColor Green
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
        npx expo export --platform web

        if (Test-Path dist/index.html) {
            $html = Get-Content dist/index.html -Raw
            if ($html -notmatch "Cache-Control") {
                $meta = '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" /><meta http-equiv="Pragma" content="no-cache" /><meta http-equiv="Expires" content="0" />'
                $html = $html.Replace("<head>", "<head>`n    $meta")
                Set-Content -Path dist/index.html -Value $html -NoNewline
            }
        }
        Write-Host "`n[OK] Web bundle successfully exported to mobile/dist/." -ForegroundColor Green
        Write-Host "NOTE: To publish to https://fairshare-url.expo.app, run option 4 (Deploy Web)." -ForegroundColor Yellow
    }
    "4" {
        Write-Host "`n--- Step 1/3: Pulling production environment from EAS ---" -ForegroundColor Cyan
        npx eas env:pull --environment production

        Write-Host "`n--- Step 2/3: Cleaning and exporting web bundle ---" -ForegroundColor Cyan
        Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
        npx expo export --platform web

        if (Test-Path dist/index.html) {
            $html = Get-Content dist/index.html -Raw
            if ($html -notmatch "Cache-Control") {
                $meta = '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" /><meta http-equiv="Pragma" content="no-cache" /><meta http-equiv="Expires" content="0" />'
                $html = $html.Replace("<head>", "<head>`n    $meta")
                Set-Content -Path dist/index.html -Value $html -NoNewline
            }
        }

        Write-Host "`n--- Step 3/3: Deploying to EAS Hosting ---" -ForegroundColor Cyan
        npx eas deploy --prod --environment production

        Write-Host "`n[SUCCESS] Web application successfully deployed to https://fairshare-url.expo.app!" -ForegroundColor Green
    }
    "5" {
        Write-Host "`n--- Checking EAS preview environment ---" -ForegroundColor Cyan
        npx eas env:list --environment preview

        Write-Host "`n--- Starting Android APK build on EAS ---" -ForegroundColor Green
        npx eas build --platform android --profile preview
    }
    "6" {
        Write-Host "`n--- Starting iOS production build on EAS ---" -ForegroundColor Magenta
        npx eas build --platform ios --profile production
    }
    "q" {
        Write-Host "Exited." -ForegroundColor DarkGray
    }
    default {
        Write-Host "Invalid option selected." -ForegroundColor Red
    }
}
