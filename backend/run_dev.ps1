# Start backend with UTF-8 encoding to prevent charmap errors on Windows

# CRITICAL: Set UTF-8 encoding BEFORE activating venv and starting Python
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$env:PYTHONWARNINGS = "ignore"

# Activate venv if it exists
if (Test-Path ".venv\Scripts\Activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
} else {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
    & ".venv\Scripts\Activate.ps1"
    pip install -r requirements.txt
}

# Start uvicorn with UTF-8 encoding
Write-Host ""
Write-Host "========================================"
Write-Host "Starting backend with UTF-8 encoding..."
Write-Host "========================================"
Write-Host ""
uvicorn src.main:app --reload --port 8000
