# Windows Charmap Encoding Fix

## Problem
When running the backend on Windows, you may see this error:
```
[ERROR] 'charmap' codec can't encode character '\u26a0' in position 0: character maps to <undefined>
```

This occurs because:
- Windows console uses **cp1252** (charmap) encoding by default
- Python libraries (especially ML/NLP libraries) print Unicode characters like ⚠ (U+26A0 WARNING SIGN)
- cp1252 cannot encode these characters, causing a `UnicodeEncodeError`

## Solutions

### ✅ Recommended: Use Provided Scripts

#### Option A: Windows Batch Script
```bash
cd backend
run_dev.bat
```

#### Option B: PowerShell Script  
```powershell
cd backend
.\run_dev.ps1
```

### ✅ Alternative: Manual Setup

If you're using your own terminal or VS Code, set the environment variable BEFORE starting:

#### Command Prompt (cmd.exe)
```cmd
set PYTHONIOENCODING=utf-8
set PYTHONWARNINGS=ignore
cd backend
uvicorn src.main:app --reload --port 8000
```

#### PowerShell
```powershell
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONWARNINGS = "ignore"
cd backend
uvicorn src.main:app --reload --port 8000
```

#### Bash (Git Bash, WSL, or MSYS2)
```bash
export PYTHONIOENCODING=utf-8
export PYTHONWARNINGS=ignore
cd backend
uvicorn src.main:app --reload --port 8000
```

### ✅ Quick Fix: Set System Environment Variable (Permanent)

If you want UTF-8 to be the default for all Python processes on your Windows machine:

1. Open **Edit the system environment variables**
   - Press `Win+R`, type `sysdm.cpl`, press Enter
   - Or search for "Environment Variables" in Windows Search

2. Click **Environment Variables** button

3. Under "System variables", click **New**
   - Variable name: `PYTHONIOENCODING`
   - Variable value: `utf-8`

4. Click OK and restart your terminal/IDE

5. Now you can run without setting the variable:
   ```cmd
   cd backend
   uvicorn src.main:app --reload --port 8000
   ```

## What We Fixed

### Code Changes
- **main.py**: Set `PYTHONIOENCODING=utf-8` at the very start, before any imports
- **stdio_utf8.py**: Enhanced to ensure UTF-8 wrapping on all streams
- **admin.py**: Added UTF-8 safeguard imports
- **Startup scripts**: Explicitly set `PYTHONIOENCODING=utf-8` before Python starts

### Frontend
- Replaced ⚠ warning character with `[ERROR]` text in admin page

## Verification

To verify UTF-8 is properly configured:

```bash
cd backend
python -c "import sys; print(f'Encoding: {sys.stdout.encoding}')"
```

Should output: `Encoding: utf-8`

## Troubleshooting

### Still getting the error?
1. ✅ Make sure you set `PYTHONIOENCODING=utf-8` **BEFORE** starting the backend
2. ✅ Restart your terminal to ensure the environment variable is picked up
3. ✅ If using VS Code, restart VS Code after setting system environment variables
4. ✅ Use one of the provided scripts (run_dev.bat or run_dev.ps1)

### Using VS Code?
Create a `.env.local` file in the `backend/` directory:
```
PYTHONIOENCODING=utf-8
PYTHONWARNINGS=ignore
```

Then launch the backend with Python directly:
```bash
cd backend
python -m uvicorn src.main:app --reload --port 8000
```

## References
- [Python UTF-8 Mode Documentation](https://docs.python.org/3/library/os.html#utf8-mode)
- [Windows Encoding Issues](https://stackoverflow.com/questions/14109024/avoid-displaying-error-unicode-encoding-error-in-python)
