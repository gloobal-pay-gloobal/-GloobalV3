@echo off
REM Double-click to send report.md, or: send.bat recipient@example.com [file.md]
py "%~dp0mailer.py" %*
echo.
pause
