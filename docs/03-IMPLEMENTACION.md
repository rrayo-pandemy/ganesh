# 📚 Guía de Implementación Completa - Ganesh 2026

## 🎯 Estructura del Proyecto

```
tienda_virtual/
├── frontend/
│   ├── index.html                 # Página principal (HTML5 semántico)
│   ├── css/
│   │   ├── styles.css             # Estilos globales + glassmorphism
│   │   └── accessibility.css      # WCAG 2.1 AA compliance
│   └── js/
│       ├── main.js                # Lógica principal + ProductManager
│       ├── cart.js                # Gestión del carrito
│       └── animations.js          # Scroll-reveal animations
│
├── backend/
│   ├── server.js                  # Express configurado con seguridad
│   ├── package.json               # Dependencias
│   ├── .env.example               # Variables de entorno
│   ├── middleware/
│   │   ├── auth.js                # JWT + autenticación
│   │   ├── validation.js          # Input validation + sanitization
│   │   └── errorHandler.js        # Manejo centralizado de errores
│   ├── models/
│   │   ├── User.js                # Esquema de usuario
│   │   ├── Product.js             # Esquema de producto
│   │   └── Order.js               # Esquema de pedido
│   └── routes/
│       ├── orders.secure.example.js  # Endpoint seguro (referencia)
│       └── README.md              # Cómo implementar rutas
│
└── docs/
    ├── 01-ARQUITECTURA.md         # Diagramas y flujos
    ├── 02-SEGURIDAD-ISO9001.md    # Protocolos de seguridad
    ├── 03-IMPLEMENTACION.md       # Esta guía
    └── 04-DEPLOYMENT.md           # Cómo deployar a producción

```

## 🚀 Cómo Iniciar el Proyecto

### Requisitos Previos

- **Node.js** >= 18.0.0
- **NPM** >= 9.0.0
- **MongoDB** 5.0+ (o PostgreSQL como alternativa)
- **Git**

### Pasos de Instalación

#### 1️⃣ Clonar repositorio

```bash
cd d:\tienda_virtual
git init
git add .
git commit -m "Initial commit: Ganesh 2026"
```

#### 2️⃣ Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Editar .env con tus valores:
# NODE_ENV=development
# PORT=5000
# JWT_SECRET=tu-clave-secreta-super-larga
# MONGODB_URI=mongodb://localhost:27017/ElRinconAzul
```

#### 3️⃣ Iniciar MongoDB

```bash
# Windows - si MongoDB está instalado local:
mongod

# Alternativa: Usar MongoDB Atlas (cloud)
# 1. Crear cuenta en https://www.mongodb.com/cloud/atlas
# 2. Crear cluster gratuito
# 3. Obtener connection string
# 4. Guardar en .env: MONGODB_URI=mongodb+srv://...
```

#### 4️⃣ Iniciar Servidor Backend

```bash
cd backend

# Modo desarrollo (con nodemon para auto-reload)
npm run dev

# Output esperado:
# ╔════════════════════════════════════════╗
# ║     🌟 Ganesh Backend 2026 🌟      ║
# ╠════════════════════════════════════════╣
# ║ Status: ✅ Running                     ║
# ║ Server: localhost:5000                 ║
# ║ Environment: development               ║
# ╚════════════════════════════════════════╝
```

#### 5️⃣ Servir Frontend

```bash
# Opción A: Usando Python (si está instalado)
cd frontend
python -m http.server 8000

# Opción B: Usando Node.js
npx http-server frontend -p 8000

# Opción C: Usando VS Code Live Server
# Instalar extensión: "Live Server"
# Click derecho en index.html > "Open with Live Server"
```

#### 6️⃣ Acceder a la aplicación

```
🌐 Frontend: http://localhost:8000
🔧 Backend API: http://localhost:5000
📊 Health Check: http://localhost:5000/api/health
```

## 🧪 Testing de Funcionalidades

### Test 1: Acuérdate Frontend

```bash
# Abrir en navegador: http://localhost:8000

# ✅ Verificar:
# 1. Página carga sin errores
# 2. Menú es interactivo (hover effects)
# 3. Hero section anima al cargar
# 4. Scroll reveal - productos aparecen progresivamente
# 5. Carrito abre/cierra
# 6. Añadir producto al carrito actualiza badge
# 7. Botones contacto (WhatsApp, Email, Tel) funcionan
# 8. Responsive en móvil (F12 → Toggle device toolbar)
```

### Test 2: API Backend

```bash
# Health check
curl http://localhost:5000/api/health

# Respuesta esperada:
# {
#   "status": "healthy",
#   "timestamp": "2026-03-28T12:34:56.789Z",
#   "uptime": 234.567,
#   "environment": "development"
# }

# Obtener productos
curl http://localhost:5000/api/v1/products

# Crear usuario (Registro)
curl -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"usuario@test.com",
    "password":"SecurePass123",
    "firstName":"Juan",
    "lastName":"Perez"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"usuario@test.com",
    "password":"SecurePass123"
  }'
```

### Test 3: Carrito de Compras

```javascript
// En consola del navegador (F12):

// Ver carrito actual
console.log(cartManager.getCart());

// Añadir producto (ID 1)
cartManager.addToCart(1);

// Ver carrito actualizado
console.log(cartManager.getCart());

// Calcular total
console.log(cartManager.calculateTotal());

// Limpiar carrito
cartManager.clearCart();
```

### Test 4: Scroll Reveal Animations

```javascript
// En consola:

// Ver qué elementos tienen scroll-reveal
document.querySelectorAll('.scroll-reveal').length
// Output: 20 (aproximadamente)

// Forzar animación
document.querySelectorAll('.scroll-reveal').forEach(el => {
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
});
```

### Test 5: Accesibilidad (A11y)

```bash
# Usar herramientas automáticas:

# 1. Lighthouse (en Chrome DevTools)
# F12 → Lighthouse → Generate report

# 2. axe DevTools (extensión)
# chrome.google.com/webstore
# Buscar: "axe DevTools"

# 3. WAVE (herramienta web)
# wave.webaim.org
# Ingresar: http://localhost:8000

# Verificar manualmente:
# - Tab key navega por todos los interactivos
# - Botones tienen outline visible
# - Contraste es suficiente
# - Imágenes tienen alt text
# - Links son claramente identificables
```

## 🔐 Testing de Seguridad

### Test XSS Prevention

```bash
# Intentar inyectar JavaScript en formulario
curl -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"<script>alert(1)</script>@test.com",
    "password":"Test123456",
    "firstName":"<img src=x onerror=alert(1)>",
    "lastName":"Hacker"
  }'

# Esperado: 400 Bad Request
# El input será validado/escapado
```

### Test SQL Injection Prevention

```bash
# Intentar SQL injection
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin\" OR \"1\"=\"1",
    "password":"anything"
  }'

# Esperado: 400 Bad Request o 401 Invalid credentials
# MongoDB/PostgreSQL usan parameterized queries
```

### Test Rate Limiting

```bash
# Hacer 101+ requests rápidamente
for i in {1..101}; do
  curl http://localhost:5000/api/v1/products &
done

# Esperado: 429 Too Many Requests a partir del request 101
```

### Test JWT Security

```bash
# Token con expiración
curl -H "Authorization: Bearer invalid-token-here" \
  http://localhost:5000/api/v1/orders

# Esperado: 403 Forbidden - Invalid token
```

## 📊 Monitoreo y Logs

### Ver logs en tiempo real

```bash
# Backend
npm run dev
# Los logs aparecen en consola

# Buscar errores específicos
npm run dev 2>&1 | grep ERROR
```

### Verificar base de datos

```bash
# Conectar a MongoDB
mongosh

# Ver bases de datos
show databases

# Usar ElRinconAzul
use ElRinconAzul

# Ver colecciones
show collections

# Ver usuarios
db.users.find().pretty()

# Ver órdenes
db.orders.find().pretty()
```

## 📦 Deployment a Producción

### Variables de Entorno para Producción

```bash
# .env.production
NODE_ENV=production
PORT=443
HOST=ElRinconAzul.com

# Seguridad estricta
JWT_SECRET=[generar-clave-larga-aleatoria]
BCRYPT_ROUNDS=12

# MongoDB Atlas (no localhost)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ElRinconAzul?retryWrites=true&w=majority

# CORS restringido
CORS_ORIGIN=https://ElRinconAzul.com

# Rate limiting más agresivo
RATE_LIMIT_MAX_REQUESTS=50

# Payment gateway
STRIPE_SECRET_KEY=sk_live_...

# Email service
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=[sendgrid-api-key]

# Logging y monitoreo
LOG_LEVEL=warn
SENTRY_DSN=https://...
```

### Opciones de Hosting

#### Opción 1: Vercel (Frontend + Serverless Functions)
- Ideal para: Frontend con Next.js
- Precio: Gratis para pequeños proyectos
- docs.vercel.com

#### Opción 2: Railway (Full Stack)
- Ideal para: Node.js + MongoDB
- Precio: ~$5/mes para starter
- railway.app

#### Opción 3: Heroku (Deprecated - buscar alternativa)
- Alternativas mejores: Railway, Render, Fly.io

#### Opción 4: AWS / DigitalOcean (VPS)
- Ideal para: Control total
- Precio: $4-20/mes
- Requiere: Conocimiento DevOps

### Checklist pre-deployment

```
☐ Todas las variables de entorno configuradas
☐ HTTPS/SSL certificate instalado
☐ Base de datos backup configurado
☐ Rate limiting vigente
☐ Helmet security headers activos
☐ CORS restringido a dominios permitidos
☐ JWT secrets regenerados (prod)
☐ Contraseñas de BD hasheadas (bcrypt 12+)
☐ Logs de auditoría habilitados
☐ Backup automático diario
☐ Monitoreo y alertas configuradas
☐ DNS actualizado
☐ SSL/TLS renovación automática (Let's Encrypt)
```

## 📞 Soporte y Troubleshooting

### Error: "Cannot find module 'express'"

```bash
cd backend
npm install
```

### Error: "MongoDB connection failed"

```bash
# Verificar que MongoDB está corriendo
# Windows:
services.msc # Buscar MongoDB

# Alternativa: Usar MongoDB Atlas
# No requiere instalación local
```

### Error: "Port 5000 already in use"

```bash
# Windows: Encontrar y matar proceso
netstat -ano | findstr :5000
taskkill /PID [PID] /F

# Linux/Mac:
lsof -i :5000
kill -9 [PID]
```

### Error: "CORS error"

```javascript
// Frontend recibe error CORS
// Solución: Configurar backend

// backend/server.js - añadir:
const corsOptions = {
    origin: 'http://localhost:8000',
    credentials: true
};
app.use(cors(corsOptions));
```

### Error: "Token expired"

```javascript
// Frontend: Token expiró
// Solución: Login de nuevo

// Implementar refresh token (próxima versión)
```

## 🎓 Próximos Pasos

1. **Implementar autenticación completa** (Registro/Login)
2. **Integrar payment gateway** (Stripe/PayPal)
3. **Crear dashboard de admin**
4. **Implementar búsqueda y filtros**
5. **Añadir sistema de reviews/ratings**
6. **Implementar wishlist**
7. **Integración con email marketing**
8. **Analytics y reportes**

---

**Documentación actualizada**: Marzo 2026
**Versión**: 1.0.0 - Production Ready
**Soporte**: Contactar a dev@elrinconazul.com
