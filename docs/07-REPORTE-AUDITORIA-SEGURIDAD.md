# Reporte de auditoria de seguridad - Ganesh

Fecha: 2026-05-14  
Alcance: backend Express/Node, frontend estatico, configuracion Docker/Nginx, scripts de despliegue local/WAN y dependencias npm del backend.  
Tipo de revision: analisis estatico, busqueda de sinks peligrosos, revision de rutas/autorizacion, revision de configuracion y `npm audit`.

## Resumen ejecutivo

Se identificaron riesgos altos en logica de negocio y configuracion de frontend/WAN. No se encontro SQL injection directa ni ejecucion remota de comandos en el codigo runtime revisado: el acceso SQL usa Prisma con metodos estructurados y no hay uso de `child_process`, `eval` ni `Function`.

Los hallazgos mas importantes son:

| ID | Severidad | Hallazgo |
| --- | --- | --- |
| F-01 | Alta | El frontend acepta y persiste un `API_BASE` arbitrario desde la URL, permitiendo robo de credenciales por API poisoning. |
| F-02 | Alta | La restriccion de productos premium y stock se valida en cliente, pero no en backend. |
| F-03 | Alta | `/api/v1/me/orders` acepta `items` y `total` controlados por el cliente. |
| F-04 | Alta | Rutas de simulacion de pagos y reembolsos estan montadas siempre y no requieren autenticacion. |
| F-05 | Alta | Cuentas demo con credenciales conocidas pueden quedar expuestas en entorno dev/WAN. |
| F-06 | Media-Alta | CORS/rate limit de desarrollo son demasiado permisivos para un tunel publico. |
| F-07 | Media | Cabeceras de seguridad del frontend no se aplican realmente en varias ubicaciones Nginx y no hay CSP de frontend. |
| F-08 | Media | Persistencia de hashes/datos de usuarios en `src/data` y credenciales MinIO por defecto. |
| F-09 | Media | Endpoint `/api/v1/me` esperado por frontend no existe, degradando la hidratacion de sesion/admin. |
| F-10 | Baja-Media | Validaciones incompletas en actualizaciones admin y proteccion anti brute-force solo en memoria. |

Resultado SCA: `npm audit --json` en `backend` reporto 0 vulnerabilidades conocidas en dependencias al momento de la revision.

## Metodologia

- Enumeracion de archivos con `rg --files`.
- Revision manual de rutas Express, middlewares de auth, CORS, origin check, almacenamiento y Prisma.
- Busqueda de patrones de riesgo: `innerHTML`, `onclick`, `localStorage`, `fetch`, `eval`, `child_process`, SQL raw y operaciones de filesystem.
- Ejecucion de `npm audit --json` en `backend`.
- Validacion local controlada de `/api/v1/me`: login correcto y luego `GET /api/v1/me` devuelve 404.

No se realizaron pruebas destructivas ni fuzzing agresivo.

## Hallazgos

### F-01 - API poisoning persistente por parametro `api`

Severidad: Alta  
Categoria: phishing tecnico, exfiltracion de credenciales, configuracion insegura de frontend

Evidencia:

- `frontend/index.html:45-55`
- `frontend/admin.html:33-43`
- `frontend/product-detail.html:40-48`
- `frontend/profile.html:303-311`

El frontend toma `?api=https://...`, normaliza solo protocolo/origen, lo guarda en `localStorage` como `wan_api_base` y despues asigna `window.API_BASE` a ese origen. Esto afecta login, registro, panel admin, perfil, favoritos y otras llamadas `fetch`.

Impacto:

Un atacante puede enviar un enlace a la tienda real con `?api=https://api-atacante.example`. Si el usuario ingresa credenciales, el frontend enviara email/password al servidor del atacante. El valor queda persistido en `localStorage`, por lo que el desvio puede continuar en visitas futuras.

Mitigacion recomendada:

- Deshabilitar este override en produccion.
- Permitir solo origenes de una allowlist cerrada: dominio oficial, API oficial, LAN local en modo dev.
- No persistir un override recibido por URL sin confirmacion explicita de desarrollador.
- Separar build dev/WAN de build productivo.

### F-02 - Bypass de productos premium y stock desde API

Severidad: Alta  
Categoria: broken access control, business logic abuse

Evidencia:

- El bloqueo premium existe en cliente: `frontend/js/cart.js:171-174`.
- El backend de carrito solo valida `productId` y `quantity`: `backend/src/routes/cart.js:21-49`.
- La orden se calcula desde `cart.items`, pero no valida `isPremium`, membresia ni stock: `backend/src/routes/orders.js:36-49`.

Impacto:

Un usuario autenticado no premium puede llamar directamente:

```http
POST /api/v1/cart/items
Content-Type: application/json

{"productId":3,"quantity":1}
```

Si el producto 3 es premium, el backend lo acepta porque no valida permisos. Tambien puede pedir cantidades mayores al stock. La UI no es una barrera de seguridad.

Mitigacion recomendada:

- En `POST /api/v1/cart/items`, validar en servidor si el producto es premium y si `req.user` tiene permiso.
- Validar stock disponible y limite maximo por producto.
- Revalidar permisos, precio y stock al crear orden.
- Reducir stock dentro de una transaccion o mecanismo equivalente.

### F-03 - Ordenes controladas por cliente en `/api/v1/me/orders`

Severidad: Alta  
Categoria: price tampering, order tampering

Evidencia:

- `backend/src/routes/profile.js:363-378`

El endpoint acepta `items` y `total` enviados por el cliente, solo verifica que `items` sea arreglo no vacio y `total > 0`, y persiste la orden con esos datos.

Impacto:

Un usuario autenticado puede registrar pedidos con productos arbitrarios, cantidades arbitrarias y total artificial. Esto permite pedidos falsos, manipulacion de historial y posibles inconsistencias operativas.

Mitigacion recomendada:

- Eliminar este endpoint o redirigirlo a la logica segura de `/api/v1/orders`.
- Calcular siempre items, precios, envio, descuentos y total desde catalogo/carrito del servidor.
- Validar stock y propiedad de carrito.

### F-04 - Rutas de pago y reembolso sin autenticacion

Severidad: Alta  
Categoria: broken access control, exposure of test/payment surface

Evidencia:

- Montaje incondicional: `backend/src/app.js:124`.
- Simulacion: `backend/src/routes/payments.js:357`.
- Consulta de transaccion: `backend/src/routes/payments.js:390`.
- Reembolso: `backend/src/routes/payments.js:407`.
- Tarjetas de prueba solo bloqueadas parcialmente en produccion: `backend/src/routes/payments.js:424-425`.

Impacto:

Las rutas de pago/reembolso no requieren `authRequired` ni `adminRequired`. Aunque sean simuladas, si quedan disponibles en despliegue real pueden contaminar procesos, logs, integraciones futuras o dar una falsa confirmacion de pagos y reembolsos.

Mitigacion recomendada:

- Montar estas rutas solo si `NODE_ENV !== 'production'` y con bandera explicita, por ejemplo `ENABLE_PAYMENT_SIMULATOR=true`.
- Proteger reembolsos con `authRequired` y `adminRequired`.
- Asociar transacciones a ordenes reales y al usuario propietario.
- Separar completamente simulador de pago del backend productivo.

### F-05 - Cuentas demo conocidas y riesgo WAN/Cloudflare

Severidad: Alta en dev expuesto por tunel; Media en local cerrado  
Categoria: default credentials

Evidencia:

- Seeding demo: `backend/src/services/store.js:28-35`.
- Credenciales conocidas: `backend/src/services/store.js:34-35`.
- Credencial documentada: `backend/docs/INSTALACION.md:73`.
- Script de exposicion WAN temporal: `start_cloudflare.bat`.

El backend crea cuentas demo cuando `NODE_ENV !== 'production'`. La cuenta admin usa una clave conocida (`Admin1234`). En un entorno local cerrado es tolerable para pruebas, pero el proyecto incluye flujo de tunel publico con Cloudflare.

Impacto:

Si se expone el entorno dev por WAN y el origen queda permitido para login, cualquiera con la URL y las credenciales demo puede acceder como admin.

Mitigacion recomendada:

- No crear admin demo automaticamente cuando exista cualquier tunel o binding publico.
- Crear admin inicial mediante comando one-shot con password aleatoria.
- Forzar cambio de password antes de habilitar funciones admin.
- Bloquear `ALLOW_DEMO_USERS=true` en produccion y en WAN.

### F-06 - CORS y rate limit de desarrollo son peligrosos en tuneles publicos

Severidad: Media-Alta  
Categoria: CORS misconfiguration, brute-force hardening

Evidencia:

- CORS dev permite origenes por substring: `backend/src/app.js:24-29`.
- TryCloudflare se considera confiable en dev: `backend/src/app.js:16`.
- Rate limit se salta para IPs privadas/locales en dev: `backend/src/app.js:103-106`.
- Origin check solo usa `allowedOrigins`, no la logica flexible de CORS: `backend/src/middleware/originCheck.js:31-36`.

Impacto:

Cuando se usa un tunel, las peticiones pueden llegar como locales o privadas. Esto puede desactivar rate limiting justo cuando el servicio esta expuesto a Internet. Ademas, los checks por `origin.includes('10.')`, `172.` o `192.168.` son demasiado amplios para tratar origenes como confiables.

Mitigacion recomendada:

- Parsear `Origin` con `new URL()` y validar hostname/IP exactos.
- No saltar rate limit por IP si hay `CF-Connecting-IP`, `X-Forwarded-For` o si se usa tunel.
- Usar allowlist explicita para URLs de Cloudflare temporales.
- Ejecutar demos publicas con `NODE_ENV=production` y variables seguras.

### F-07 - Cabeceras frontend y CSP insuficientes

Severidad: Media  
Categoria: browser hardening

Evidencia:

- Cabeceras declaradas a nivel server: `frontend/nginx.conf:23-27`.
- `location` de assets define su propio `add_header`: `frontend/nginx.conf:30-32`.
- `location` de HTML define su propio `add_header`: `frontend/nginx.conf:37-38`.
- No hay `Content-Security-Policy` para el frontend.

En Nginx, cuando un `location` define `add_header`, puede dejar de heredar los `add_header` del nivel superior. Como los bloques de assets y HTML agregan `Cache-Control`, las cabeceras de seguridad pueden no aplicarse donde mas importan.

Impacto:

Menor proteccion contra clickjacking, MIME sniffing y abuso de inyecciones futuras. La ausencia de CSP es especialmente relevante porque el frontend tiene scripts inline y varios `innerHTML` controlados manualmente.

Mitigacion recomendada:

- Repetir cabeceras de seguridad dentro de cada `location` o usar una configuracion comun incluida.
- Agregar CSP de frontend. Ideal: mover scripts inline a archivos JS y usar `script-src 'self'`.
- Agregar `frame-ancestors 'none'` y revisar HSTS si se sirve por HTTPS.

### F-08 - Datos sensibles y credenciales por defecto en repositorio/config

Severidad: Media  
Categoria: secret/data exposure

Evidencia:

- Hashes y datos de usuarios en `backend/src/data/users.json:5-18`.
- Credenciales MinIO por defecto: `docker-compose.minio.yml:10-11`.
- Fallback MinIO por defecto: `backend/scripts/minio_setup.js:4-5`.
- Script local con credenciales por defecto: `start_minio.bat:4`.

Impacto:

Aunque los passwords esten hasheados, versionar hashes y datos de usuarios aumenta el riesgo si el repositorio se comparte. MinIO con `minioadmin/minioadmin` es seguro solo para pruebas locales aisladas.

Mitigacion recomendada:

- No versionar `backend/src/data/*.json` con usuarios reales o hashes.
- Mantener datos demo en fixtures sin informacion sensible.
- Cambiar credenciales MinIO, cargar desde `.env` y bindear puertos solo a localhost si es dev.

### F-09 - Ruta `/api/v1/me` faltante rompe hidratacion de sesion

Severidad: Media  
Categoria: auth/session reliability

Evidencia:

- Backend monta rutas bajo `/api/v1/me`: `backend/src/app.js:120`.
- La ruta real de perfil es `/api/v1/me/profile`: `backend/src/routes/profile.js:29`.
- Frontend espera `/api/v1/me`: `frontend/js/session.js:95`, `frontend/js/admin.js:197`, `frontend/js/product-detail.js:153`.
- Validacion local: despues de login correcto, `GET /api/v1/me` devuelve 404.

Impacto:

La sesion se puede limpiar en el cliente aunque la cookie exista, el panel admin pierde estado y la deteccion de admin en detalle de producto falla. Esto puede llevar a controles inconsistentes y a futuros workarounds inseguros en frontend.

Mitigacion recomendada:

- Implementar `GET /api/v1/me` con `authRequired` y respuesta publica minima del usuario.
- O cambiar todos los clientes para usar `/api/v1/me/profile`.
- Agregar prueba de integracion para login + hydrate.

### F-10 - Validaciones incompletas y protecciones anti brute-force no persistentes

Severidad: Baja-Media  
Categoria: input validation, auth hardening

Evidencia:

- `PUT /api/v1/users/:id` permite cambiar password sin repetir la politica fuerte usada en create: `backend/src/routes/users.js:124-125`.
- `PUT /api/v1/products/:id` acepta payload libre y mezcla en producto: `backend/src/routes/products.js:83-104`.
- Lockout de cuentas en memoria: `backend/src/middleware/accountLockout.js`.

Impacto:

Un admin puede dejar passwords debiles o datos corruptos. En despliegues con multiples procesos, reinicios o contenedores, el lockout se pierde o queda inconsistente. Ademas, un atacante puede bloquear cuentas conocidas con intentos fallidos.

Mitigacion recomendada:

- Reutilizar validadores de password en create y update.
- Validar update de productos y categorias con `express-validator`.
- Mover lockout/rate limit a Redis o almacenamiento centralizado.
- Considerar protecciones anti enumeracion y alertas por lockout.

## SQL injection, XSS y RCE

### SQL injection

No se encontro SQL injection directa. La busqueda no encontro `queryRaw`, `executeRaw` ni SQL concatenado en runtime. El adapter usa Prisma con `findMany`, `upsert`, `deleteMany` y `create` estructurados.

Riesgo residual: si en el futuro se agregan filtros dinamicos, mantener Prisma estructurado o usar parametros enlazados.

### XSS

No se confirmo un XSS almacenado directo en las vistas principales. Hay buenas practicas en varias zonas: `textContent`, `escapeHtml` y construccion DOM segura. Sin embargo, el riesgo residual sube por:

- Falta de CSP frontend.
- Uso de `innerHTML` en varias vistas con responsabilidad manual de escape.
- URLs de imagen administrables que se renderizan en `img.src`, por ejemplo `frontend/js/product-detail.js:205-206`.
- API poisoning del hallazgo F-01, que permite controlar completamente el backend consultado por el frontend.

Mitigacion: CSP, validacion estricta de URL de imagen en backend y frontend, y evitar `innerHTML` para datos dinamicos.

### RCE, reverse shell y command injection

No se encontro ejecucion dinamica de comandos en el runtime del backend/frontend revisado. No hay `child_process`, `eval`, `new Function` ni `vm` en rutas productivas. El riesgo principal no esta en RCE, sino en logica de negocio, configuracion WAN y controles de autorizacion.

## Controles positivos observados

- JWT exige `JWT_SECRET` y falla al arrancar si falta.
- Cookies de auth son `HttpOnly`.
- Passwords se hashean con bcrypt.
- Helmet y rate limit existen en backend.
- Avatar upload valida magic bytes y limita tamanio.
- La mayoria de salidas de texto usan `textContent` o `escapeHtml`.
- `npm audit` no reporto vulnerabilidades conocidas.

## Prioridad de remediacion

1. Deshabilitar `?api=` en produccion y limpiar `wan_api_base` persistido salvo allowlist.
2. En backend, validar premium, stock, precios y totals al agregar carrito y crear orden.
3. Quitar o proteger rutas de simulacion de pagos/reembolsos.
4. Eliminar cuentas demo/credenciales conocidas en entornos expuestos.
5. Endurecer CORS y rate limit para Cloudflare/WAN.
6. Corregir Nginx para aplicar cabeceras y agregar CSP de frontend.
7. Implementar `GET /api/v1/me` y cubrirlo con prueba.
8. Sacar datos sensibles de `src/data` y rotar credenciales MinIO.

