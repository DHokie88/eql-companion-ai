@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Install dependencies first: npm ci then npm run deps:electron
  pause
  exit /b 1
)
if not exist "out\main\index.js" (
  echo Build the fork first: npm run build
  pause
  exit /b 1
)
if not exist "engine\target\release\zengine.exe" (
  echo Prepare the matching engine first. See SETUP.md.
  pause
  exit /b 1
)
rem The dot keeps a trailing backslash from escaping the closing quote in Electron's argv.
start "EQ Oracle (EQO) development fork" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
