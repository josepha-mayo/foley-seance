@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 run-local.py
  goto done
)
where python >nul 2>nul
if not errorlevel 1 (
  python run-local.py
  goto done
)
echo Python 3.9 or newer is required. No installation was attempted.
echo See README-START-HERE.txt.
:done
pause
