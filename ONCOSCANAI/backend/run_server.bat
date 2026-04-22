@echo off
REM Activate venv and run the FastAPI server
cd /d "%~dp0"
call venv\Scripts\activate.bat
python main.py
pause
