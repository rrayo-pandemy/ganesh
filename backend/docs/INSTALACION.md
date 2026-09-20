=============================================
INSTALACION DEL BACKEND - GUIA ACTUALIZADA
Proyecto: Ganesh
Actualizado: 2026-04-06
=============================================

Esta guia fue validada en este entorno local con:
- Node.js: v24.14.1
- npm: 11.11.0
- Backend OK: http://localhost:5000/api/health (200)
- Productos OK: http://localhost:5000/api/v1/products (200)
- Frontend OK: http://localhost:8000/index.html (200)

REQUISITOS
1. Node.js 18 o superior
2. npm 9 o superior
3. Python 3 (solo para servir frontend estatico en puerto 8000)

PASO 1 - VERIFICAR VERSIONES
Abre PowerShell y ejecuta:

node --version
npm --version

PASO 2 - INSTALAR DEPENDENCIAS DEL BACKEND

cd d:\tienda_virtual\backend
npm install

PASO 3 - CONFIGURAR VARIABLES DE ENTORNO
En este proyecto ya existe backend\.env.
Si no existiera, crearlo desde la plantilla:

cd d:\tienda_virtual\backend
Copy-Item .env.example .env

Configuracion actual usada por el backend:
- NODE_ENV=development
- PORT=5000

PASO 4 - INICIAR BACKEND

cd d:\tienda_virtual\backend
npm run dev

Endpoint principal de salud:
http://localhost:5000/api/health

PASO 5 - VALIDAR BACKEND
En otra terminal PowerShell:

Invoke-WebRequest http://localhost:5000/api/health
Invoke-WebRequest http://localhost:5000/api/v1/products

Si todo esta bien, ambos deben devolver StatusCode 200.

PASO 6 - INICIAR FRONTEND

cd d:\tienda_virtual\frontend
python -m http.server 8000

Si python no existe en PATH, prueba:
py -m http.server 8000

PASO 7 - ABRIR LA APLICACION
- Tienda: http://localhost:8000
- Admin: http://localhost:8000/admin.html
- API: http://localhost:5000

NOTA DE LOGIN ADMIN
Usuario admin inicial (si no fue modificado):
- Email: admin@elrinconazul.com
- Password: Admin1234

COMANDOS RAPIDOS (RESUMEN)
Terminal 1:
cd d:\tienda_virtual\backend
npm install
npm run dev

Terminal 2:
cd d:\tienda_virtual\frontend
python -m http.server 8000

DETENER SERVICIOS
Si los procesos corren en primer plano:
- Presiona Ctrl + C en cada terminal.

Si los lanzaste en segundo plano con PID:
- Stop-Process -Id <PID>

TROUBLESHOOTING
1. Error EADDRINUSE en 5000 o 8000:
   El puerto ya esta en uso. Cierra el proceso anterior o cambia puerto.

2. "npm no se reconoce":
   Reinstala Node.js y reinicia PowerShell.

3. "Cannot find module ...":
   Ejecuta npm install dentro de d:\tienda_virtual\backend.

4. Frontend carga pero no responde API:
   Verifica que backend este corriendo en puerto 5000.

=============================================
FIN
=============================================
