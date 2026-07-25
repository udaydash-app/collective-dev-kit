# PowerShell release runner for Windows.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\release.ps1
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Version "1.1.61"

param(
    [Parameter(Mandatory=$false)]
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Run-Step($Title, [scriptblock]$Command) {
    Write-Host ""
    Write-Host $Title -ForegroundColor Yellow
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Title"
    }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Global Market POS - Windows Release Builder" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Run-Step "[1/7] Pulling latest code from git..." {
    if (Test-Path ".git") {
        git fetch --all
        git pull --rebase
    } else {
        Write-Host "WARNING: not a git repo - skipping pull" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[2/7] Updating version in package.json..." -ForegroundColor Yellow
$CurrentVersion = node -p "require('./package.json').version"
Write-Host "Current version: $CurrentVersion"

if ([string]::IsNullOrWhiteSpace($Version)) {
    $parts = $CurrentVersion.Split('.')
    $parts[2] = ([int]$parts[2] + 1).ToString()
    $Version = $parts -join '.'
    Write-Host "Auto-bumped version: $Version"
} else {
    Write-Host "Using provided version: $Version"
}

npm version $Version --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw "Failed to update package.json version" }

Run-Step "[3/7] Cleaning previous build artifacts..." {
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "release") { Remove-Item -Recurse -Force "release" }
}

Run-Step "[4/7] Installing dependencies..." {
    npm install --no-audit --no-fund
}

Run-Step "[5/7] Building frontend for Electron..." {
    $env:BUILD_TARGET = "electron"
    npx vite build
}

Run-Step "[6/7] Packaging Windows app..." {
    node scripts/create-electron-builder-optional-stubs.mjs
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    npx electron-builder --win --x64
}

Write-Host ""
Write-Host "[7/7] Committing version bump and tagging release..." -ForegroundColor Yellow
if (Test-Path ".git") {
    git add package.json
    git commit -m "chore: release v$Version"
    if ($LASTEXITCODE -ne 0) { Write-Host "Nothing to commit" -ForegroundColor Yellow }
    git tag -a "v$Version" -m "Release v$Version"
    if ($LASTEXITCODE -ne 0) { Write-Host "Tag already exists" -ForegroundColor Yellow }
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { Write-Host "WARNING: git push failed" -ForegroundColor Yellow }
    git push origin "v$Version"
    if ($LASTEXITCODE -ne 0) { Write-Host "WARNING: tag push failed" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Release v$Version built successfully" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Output files in: .\release\" -ForegroundColor Cyan
Get-ChildItem -Path "release" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\.(exe|msi|zip|yml)$' } | Select-Object Name, Length
Write-Host ""
Write-Host "Note: macOS DMG builds must be created on a Mac with: bash release.command" -ForegroundColor Yellow
