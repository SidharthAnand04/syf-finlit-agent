#!/usr/bin/env python
"""
Wrapper to run uvicorn with proper UTF-8 encoding on Windows.
This ensures PYTHONIOENCODING is set and stays set throughout execution.
"""

import os
import sys
import subprocess

# Force UTF-8 for the entire Python process
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONWARNINGS"] = "ignore"

# Also set for any subprocess calls
env = os.environ.copy()
env["PYTHONIOENCODING"] = "utf-8"
env["PYTHONWARNINGS"] = "ignore"

# Import and run uvicorn
if __name__ == "__main__":
    try:
        from uvicorn.main import run
        
        # Run with UTF-8 explicitly configured
        run(
            "src.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
        )
    except ImportError:
        # Fallback: run via subprocess if uvicorn isn't importable
        sys.exit(subprocess.call([
            sys.executable, "-m", "uvicorn",
            "src.main:app",
            "--reload",
            "--port", "8000",
        ], env=env))
