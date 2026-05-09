@echo off
cd /d "%~dp0"
echo [FaceAttend] Starting backend on http://localhost:5000 ...
echo [FaceAttend] Press Ctrl+C to stop.
venv\Scripts\python.exe app.py
pause
