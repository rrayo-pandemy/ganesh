# 🏗️ Ganesh - Arquitectura del Sistema 2026

## Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (Frontend)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  HTML5 + CSS3 (Glassmorphism)                          │ │
│  │  JavaScript ES6+ (IntersectionObserver, Cart API)      │ │
│  │  Mobile-First Responsive Design                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    HTTPS + TLS 1.3
                  (Cifrado End-to-End)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│            API GATEWAY + LOAD BALANCER                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Rate Limiting (100 req/15min por IP)                  │ │
│  │  CORS Validation + Helmet Security Headers             │ │
│  │  Request Logging & Audit Trail                         │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           BACKEND API (Node.js + Express)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Authentication Layer (JWT + HttpOnly Cookies)         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Routes:                                         │  │ │
│  │  │  ├─ /api/v1/auth      (Login, Register, MFA)     │  │ │
│  │  │  ├─ /api/v1/products  (CRUD con validación)      │  │ │
│  │  │  ├─ /api/v1/cart      (Carrito persistente)      │  │ │
│  │  │  ├─ /api/v1/orders    (Checkout seguro)          │  │ │
│  │  │  └─ /api/v1/users     (Perfil y datos)           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  Input Validation & Sanitization:                      │ │
│  │  ├─ express-validator (Frontend validation)            │ │
│  │  ├─ Escape HTML (XSS Prevention)                       │ │
│  │  ├─ Parameterized Queries (SQL Injection)              │ │
│  │  └─ Rate Limiting (DDoS/Brute Force)                   │ │
│  │                                                        │ │
│  │  Error Handling + Logging:                             │ │
│  │  ├─ Structured JSON Logging                            │ │
│  │  ├─ Error Codes Estándar (ISO 9001)                    │ │
│  │  └─ Audit Trail (Quién, Cuándo, Qué)                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                   Conexión Segura
                   (Connection Pool)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│         DATA PERSISTENCE LAYER                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MongoDB / PostgreSQL                                  │ │
│  │  ├─ Users (con passwords hasheadas - bcrypt)           │ │
│  │  ├─ Products (con timestamps y versionado)             │ │
│  │  ├─ Orders (trazabilidad completa)                     │ │
│  │  └─ Transactions Log (auditoría ISO 9001)              │ │
│  │                                                        │ │
│  │  Backups Diarios + Replicación                         │ │
│  │  Encriptación at Rest (AES-256)                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              SERVICIOS AUXILIARES                           │
│  ├─ Email Service (Confirmación de pedidos)                 │ 
│  ├─ Payment Gateway (Stripe/PayPal - PCI-DSS)               │ 
│  ├─ Logging Service (ELK Stack o Datadog)                   │
│  ├─ Monitoring (Alerts en caso de errores > 5%)             │
│  └─ CDN (Cloudflare/AWS CloudFront para assets)             │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Flujo de Seguridad Integral

### Autenticación (Registro/Login)

```
┌─────────────────────────────────┐
│ 1. Usuario ingresa credenciales │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 2. Validación Frontend (A11y):  │─────────────────┐
│    - Formato email              │                 │
│    - Contraseña 8+ chars        │                 │
│    - Sin caracteres peligrosos  │                 │
└────────────┬────────────────────┘                 │
             │                                      │
             ▼                                      │
     ┌──────────────────────┐                   REQUEST
     │   HTTPS POST         │                 BODY SANITIZED
     │   Body Encrypted     │                       │
     │   IP Rate Limited    │                       │
     └──────────┬───────────┘                       │
                │                                   │
                ▼                                   │
     ┌──────────────────────────────┐               │
     │ 3. Backend Input Validation  │◄──────────────┘
     │    - SQL Injection Check     │
     │    - XSS Escape              │
     │    - Tamaño límite verificado│
     └──────────┬───────────────────┘
                │
                ▼
     ┌──────────────────────────────┐
     │ 4. Contraseña Hasheada       │
     │    - Bcrypt ($2b$10...)      │
     │    - Salt único por usuario  │
     │    - Almacenada = Hash ONLY  │
     └──────────┬───────────────────┘
                │
                ▼
     ┌──────────────────────────────┐
     │ 5. JWT Generado Seguro       │
     │    - HS256 (HMAC-SHA256)     │
     │    - Expira en 7 días        │
     │    - HttpOnly Cookie (XSS)   │
     │    - Secure flag (HTTPS only)│
     │    - SameSite=Strict (CSRF)  │
     └──────────┬───────────────────┘
                │
                ▼
     ┌──────────────────────────────┐
     │ 6. Respuesta al Cliente      │
     │    - Token en HttpOnly       │
     │    - Datos usuario limitados │
     │    - Log de acceso guardado  │
     └──────────────────────────────┘
```

### Protección contra Ataques Comunes

| Ataque | Prevención | Implementado |
|--------|-----------|--------------|
| **SQL Injection** | Parameterized queries + ORM | ✅ Mongoose/TypeORM |
| **XSS (Cross-Site Scripting)** | Input escaping + CSP headers | ✅ express-validator + Helmet |
| **CSRF** | SameSite cookies + CSRF tokens | ✅ HttpOnly + SameSite=Strict |
| **Credential Stuffing** | Rate limiting + Account lockout | ✅ 5 intentos/hora |
| **Magecart** | CSP strict + No inline scripts | ✅ Sin eval() |
| **DDoS** | Rate limiting + WAF | ✅ 100 req/15min |
| **Session Hijacking** | HTTPS + HttpOnly + Secure flags | ✅ TLS 1.3 |
| **Man-in-the-Middle** | HSTS + Certificate Pinning | ✅ max-age=31536000 |

## 📊 ISO 9001 - Procesos Definidos

### Proceso: Gestión de Pedidos

```
Entrada              Proceso                  Salida            Auditoría
─────────            ────────                ──────            ─────────

Datos Cliente  →  1. Validación          Pedido Registrado  → Log: Usuario X
                  2. Sanitización                              compró 2 items
                  3. Cálculo Total                             en 14:32:45

Carrito       →  4. Verificación Stock   Confirmación Email  → Log: Confirmación
                  5. Reserva de Items    Enviada               enviada a email
                  6. Charge Payment                            
                                                              → Log: Payment
ID Transacción →  7. Registro Pedido     Rastreo del Pedido   procesado
                  8. Generación Tracking                      (Timestamp)
                  9. Envío Confirmación
                  10. Logging            Pedido Listo        → Métrica: 
                                         para Despacho         Tiempo Total
                                                              (SLA: <5min)
```

### Métricas de Calidad

```javascript
{
  "metrics": {
    "pedidos": {
      "tasa_exito": "98.5%",
      "tiempo_promedio_procesamiento": "2.3 min",
      "tasa_error": "1.5%",
      "sla_cumplimiento": "99.2%"
    },
    "seguridad": {
      "intentos_fallidos_bloqueados": "1,247",
      "intentos_xss_prevenidos": "89",
      "tokens_jwt_revocados": "12",
      "audit_log_completo": "100%"
    },
    "disponibilidad": {
      "uptime": "99.95%",
      "latencia_promedio": "145ms",
      "errores_500": "0.3%",
      "backup_status": "OK"
    }
  },
  "mejora_continua": {
    "revisiones": "Mensual",
    "plan_accion": "Identificar top 3 errores y corregir",
    "responsable": "DevOps Team",
    "proxima_revisión": "2026-04-28"
  }
}
```

