@echo off
REM Batch script to release a new version with auto-update
REM Usage: release.bat 1.0.16

set VERSION=%1
if "%VERSION%"=="" set VERSION=1.0.16

echo ========================================
echo   Global Market POS - Version Release
echo ========================================
echo.

REM Step 1: Pull latest changes
echo Step 1: Pulling latest changes from GitHub...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to pull from GitHub!
    exit /b 1
)
echo Successfully pulled latest changes
echo.

REM Step 2: Update version in package.json
echo Step 2: Updating version to %VERSION%...
call npm version %VERSION% --no-git-tag-version
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to update version!
    exit /b 1
)
echo Version updated to %VERSION%
echo.

REM Step 3: Install dependencies
echo Step 3: Installing dependencies...
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies!
    exit /b 1
)
echo Dependencies installed
echo.

REM Step 4: Build web application
echo Step 4: Building web application...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build web application!
    exit /b 1
)
echo Web application built successfully
echo.

REM Step 5: Build Electron installer
echo Step 5: Building Electron installer...
call npm run electron:build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build Electron installer!
    exit /b 1
)
echo Electron installer built successfully
echo.

REM Step 6: Commit changes
echo Step 6: Committing changes...
git add .
git commit -m "Release version %VERSION% with auto-update fixes"
echo Changes committed
echo.

REM Step 7: Create and push tag
echo Step 7: Creating and pushing tag v%VERSION%...
git tag -a "v%VERSION%" -m "Release version %VERSION%"
git push origin main
git push origin "v%VERSION%"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to push tag to GitHub!
    exit /b 1
)
echo Tag v%VERSION% created and pushed
echo.

REM Success message
echo ========================================
echo   RELEASE COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Next Steps:
echo 1. GitHub Actions will automatically build the release
echo 2. Go to: https://github.com/udaydash-app/collective-dev-kit/releases
echo 3. Wait for the build to complete (5-10 minutes)
echo 4. The release will include:
echo    - Global Market POS-%VERSION%-x64.exe
echo    - Global Market POS-%VERSION%-ia32.exe
echo    - Global Market POS-%VERSION%-Portable.exe
echo    - latest.yml (for auto-update)
echo.
echo Build artifacts are also available in release folder
echo.
echo Auto-update will work for users on version 1.0.0 or higher!
