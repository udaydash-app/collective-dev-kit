# PowerShell script to release a new version with auto-update
# Usage: .\release.ps1 -Version "1.0.17"

param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.17"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Global Market POS - Version Release" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest changes
Write-Host "Step 1: Pulling latest changes from GitHub..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull from GitHub!" -ForegroundColor Red
    exit 1
}
Write-Host "Successfully pulled latest changes" -ForegroundColor Green
Write-Host ""

# Step 2: Update version in package.json
Write-Host "Step 2: Updating version to $Version..." -ForegroundColor Yellow
npm version $Version --no-git-tag-version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to update version!" -ForegroundColor Red
    exit 1
}
Write-Host "Version updated to $Version" -ForegroundColor Green
Write-Host ""

# Step 3: Install dependencies
Write-Host "Step 3: Installing dependencies..." -ForegroundColor Yellow
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 4: Build web application
Write-Host "Step 4: Building web application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build web application!" -ForegroundColor Red
    exit 1
}
Write-Host "Web application built successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Build Electron installer
Write-Host "Step 5: Building Electron installer..." -ForegroundColor Yellow
npm run electron:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build Electron installer!" -ForegroundColor Red
    exit 1
}
Write-Host "Electron installer built successfully" -ForegroundColor Green
Write-Host ""

# Step 6: Commit changes
Write-Host "Step 6: Committing changes..." -ForegroundColor Yellow
git add .
git commit -m "Release version $Version with auto-update fixes"
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: No changes to commit or commit failed" -ForegroundColor Yellow
}
Write-Host "Changes committed" -ForegroundColor Green
Write-Host ""

# Step 7: Create and push tag
Write-Host "Step 7: Creating and pushing tag v$Version..." -ForegroundColor Yellow
git tag -a "v$Version" -m "Release version $Version"
git push origin main
git push origin "v$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to push tag to GitHub!" -ForegroundColor Red
    exit 1
}
Write-Host "Tag v$Version created and pushed" -ForegroundColor Green
Write-Host ""

# Success message
Write-Host "========================================" -ForegroundColor Green
Write-Host "  RELEASE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. GitHub Actions will automatically build the release" -ForegroundColor White
Write-Host "2. Go to: https://github.com/udaydash-app/collective-dev-kit/releases" -ForegroundColor White
Write-Host "3. Wait for the build to complete (5-10 minutes)" -ForegroundColor White
Write-Host "4. The release will include:" -ForegroundColor White
Write-Host "   - Global Market POS-$Version-x64.exe" -ForegroundColor Gray
Write-Host "   - Global Market POS-$Version-ia32.exe" -ForegroundColor Gray
Write-Host "   - Global Market POS-$Version-Portable.exe" -ForegroundColor Gray
Write-Host "   - latest.yml (for auto-update)" -ForegroundColor Gray
Write-Host ""
Write-Host "Build artifacts are also available in release folder" -ForegroundColor Cyan
Write-Host ""
Write-Host "Auto-update will work for users on version 1.0.0 or higher" -ForegroundColor Green
