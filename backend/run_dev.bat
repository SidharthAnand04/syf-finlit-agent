@echo off
REM Start backend with UTF-8 encoding to prevent charmap errors on Windows
setlocal enabledelayedexpansion

REM CRITICAL: Set UTF-8 encoding BEFORE activating venv and starting Python
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set PYTHONWARNINGS=ignore

REM Activate venv if it exists
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else (
    echo Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
)

REM Start uvicorn with UTF-8 encoding
echo.
echo ========================================
echo Starting backend with UTF-8 encoding...
echo ========================================
echo.
uvicorn src.main:app --reload --port 8000

endlocal
pause
