@echo off
title Sistema Gym UES
cd /d "%~dp0"
echo ============================================================
echo   Iniciando el Sistema Gym UES (servidor + checador)
echo ============================================================
echo.
echo Asegurate de que XAMPP / MySQL este encendido.
echo.
call npm run start:all
pause
