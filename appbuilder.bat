@echo off
chcp 65001 >nul
title Global Market POS - Windows Build
echo ============================================
echo   Global Market POS - Windows App Builder
echo ============================================
echo.

:: Clean previous build artifacts
echo [1/5] Cleaning previous build artifacts...
if exist dist rmdir /s /q dist
if exist release rmdir /s /q release
echo       Done.
echo.

:: Ensure dependencies are installed
echo [2/5] Checking node_modules...
if not exist node_modules (
    echo       node_modules not found. Running npm install...
    call npm install
    if errorlevel 1 (
        echo       ERROR: npm install failed.
        pause
        exit /b 1
    )
) else (
    echo       node_modules found.
)
echo.

:: Set Electron build target
echo [3/5] Setting build environment...
set BUILD_TARGET=electron
echo       BUILD_TARGET=electron
echo.

:: TypeScript compile
echo [4/5] Compiling TypeScript...
call npx tsc --noEmit
if errorlevel 1 (
    echo       ERROR: TypeScript compilation failed.
    pause
    exit /b 1
)
echo       TypeScript OK.
echo.

:: Vite build for Electron
echo [5/5] Building frontend + packaging Windows app...
call npx vite build
if errorlevel 1 (
    echo       ERROR: Vite build failed.
    pause
    exit /b 1
)

:: Run electron-builder for Windows only
call npx electron-builder --win
if errorlevel 1 (
    echo       ERROR: Electron builder failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.
echo Output location:  release\
echo.
if exist release (
    dir /b release
) else (
    echo No release folder found.
)
echo.
pause
