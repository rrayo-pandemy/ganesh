@echo off
title Lanzador de Tuneles Cloudflare - Ganesh
echo ======================================================
echo Lanzando Tunelesc Temporales (TryCloudflare)
echo ======================================================
echo.
echo Asegurate de tener el frontend corriendo con recarga automatica en el puerto 8000:
echo    start_frontend_dev.bat
echo.
echo [1/2] Iniciando tunel para BACKEND (Puerto 5000)...
start "Cloudflare Backend" cmd /k "cloudflared tunnel --url http://localhost:5000"
echo.
echo Espera a que el tunel de la API genere una URL (https://...trycloudflare.com)
echo.
echo [2/2] Iniciando tunel para FRONTEND (Puerto 8000)...
start "Cloudflare Frontend" cmd /k "cloudflared tunnel --url http://localhost:8000"
echo.
echo ======================================================
echo INSTRUCCIONES:
echo 1. Copia la URL de la ventana de BACKEND (ej: https://api-test.trycloudflare.com)
echo 2. Copia la URL de la ventana de FRONTEND (ej: https://shop-test.trycloudflare.com)
echo 3. Abre tu tienda usando la URL del FRONTEND agregando el parametro de la API:
echo    EJEMPLO: https://shop-test.trycloudflare.com/?api=https://api-test.trycloudflare.com
echo    Tambien se acepta: https://shop-test.trycloudflare.com/?https://api-test.trycloudflare.com
echo ======================================================
pause
