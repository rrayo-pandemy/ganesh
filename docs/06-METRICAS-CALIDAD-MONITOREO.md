# 📊 Métricas de Calidad y Monitoreo - Guía de Implementación

**Versión:** 2.0  
**Fecha:** Marzo 29, 2026

---

## 1. Introducción

Las métricas de calidad permiten **medir, monitorear y mejorar** el rendimiento, confiabilidad y seguridad de Ganesh.

```
SIN MÉTRICAS:           CON MÉTRICAS:
┌──────────────┐        ┌──────────────────┐
│    ¿Qué      │        │   ✓ Uptime       │ 99.95%
│   pasó?      │        │   ✓ Latencia     │ <200ms
│              │        │   ✓ Errores      │ <0.1%
│   ¿Por       │        │   ✓ Conversión   │ 3.2%
│   qué?       │        │   ✓ Seguridad    │ 0 breaches
│              │        │   ✓ Usuarios     │ 50K DAU
└──────────────┘        └──────────────────┘

La diferencia: datos vs intuición
```

---

## 2. Pilares de Monitoreo

### Pilar 1: CONFIABILIDAD (Availability)

**¿Qué medir?**
- Uptime: % de tiempo que el servicio está disponible
- Mean Time To Recovery (MTTR): Tiempo promedio para recuperarse de una caída
- Mean Time Between Failures (MTBF): Tiempo entre caídas

**SLA (Service Level Agreement):**

```
Tier            Uptime    Downtime/mes
──────────────────────────────────────
Básico          99.0%     ~7 horas
Profesional     99.5%     ~3.5 horas
Enterprise      99.95%    ~22 minutos
Ganesh      99.95%    <22 min/mes
```

**Implementar:**

```javascript
// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
    const checks = {
        status: 'healthy',
        timestamp: new Date(),
        checks: {
            api: 'ok',
            database: 'checking...',
            cache: 'checking...',
            externalServices: 'checking...'
        },
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    };
    
    // Verificar DB
    try {
        await database.ping();
        checks.checks.database = 'ok';
    } catch (e) {
        checks.checks.database = 'fail';
        checks.status = 'degraded';
    }
    
    // Verificar Cache
    try {
        await redis.ping();
        checks.checks.cache = 'ok';
    } catch (e) {
        checks.checks.cache = 'fail';
        checks.status = 'degraded';
    }
    
    // Response time
    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    
    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);
});

// Monitorear desde Datadog/New Relic cada 1 minuto
// Alert si falla 2+ veces consecutivas
```

### Pilar 2: RENDIMIENTO (Performance)

**Métricas Clave:**

```javascript
class PerformanceMetrics {
    
    // Latencia
    static recordLatency(endpoint, duration) {
        // Grabar en tiempo real
        metrics.histogram('endpoint.latency', duration, {
            endpoint: endpoint,
            unit: 'ms'
        });
        
        // Percentiles
        // P50 (mediana): 50% de requests más rápidos
        // P95: 95% de requests más rápidos
        // P99: 99% de requests más rápidos
    }
    
    // Throughput (requests por segundo)
    static recordRequest(endpoint) {
        metrics.increment('endpoint.requests', {
            endpoint: endpoint
        });
    }
    
    // Error Rate
    static recordError(endpoint, statusCode, error) {
        metrics.increment('endpoint.errors', {
            endpoint: endpoint,
            statusCode: statusCode
        });
    }
    
    // Database Query Performance
    static recordQueryTime(query, duration) {
        metrics.histogram('db.query_time', duration, {
            query: query
        });
    }
    
    // Cache Hit Rate
    static recordCacheHit(key, hit = true) {
        const type = hit ? 'hit' : 'miss';
        metrics.increment(`cache.${type}`);
    }
}

// Middleware para medir latencia
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        PerformanceMetrics.recordLatency(req.route?.path || req.path, duration);
        PerformanceMetrics.recordRequest(req.path);
        
        if (res.statusCode >= 400) {
            PerformanceMetrics.recordError(req.path, res.statusCode);
        }
    });
    
    next();
});
```

**SLA de Rendimiento - ElRinconAzul:**

```
Endpoint                    P50         P95         P99
────────────────────────────────────────────────────────
GET /products             <50ms       <100ms      <200ms
GET /product/:id          <80ms       <150ms      <300ms
POST /cart/add            <100ms      <200ms      <400ms
POST /checkout            <500ms      <1000ms     <2000ms
GET /search              <200ms      <400ms      <800ms
────────────────────────────────────────────────────────
Error Rate                <0.1%       <0.5%       <1%
Cache Hit Rate            >95%        >90%        >85%
DB Query Time             <50ms       <100ms      <200ms
```

### Pilar 3: CONFIABILIDAD DEL NEGOCIO (Business Metrics)

**Métricas Clave:**

```javascript
class BusinessMetrics {
    
    // Conversión
    static trackConversion(conversionType) {
        // Visitantes → Compradores
        const conversionRate = totalPurchases / totalVisitors;
        metrics.gauge('business.conversion_rate', conversionRate * 100); // %
    }
    
    // Revenue
    static trackRevenue(amount, currency = 'USD') {
        metrics.increment('business.revenue', amount, {
            currency: currency
        });
    }
    
    // AOV (Average Order Value)
    static trackOrderValue(orderId, totalAmount) {
        metrics.histogram('business.order_value', totalAmount, {
            orderId: orderId
        });
        
        // Calcular AOV
        // AOV = Total Revenue / Total Orders
    }
    
    // Cart Abandonment Rate
    static trackAbandonedCart(cartId, itemCount, totalValue) {
        metrics.increment('business.abandoned_carts', {
            itemCount: itemCount,
            valueRange: totalValue > 100 ? 'high' : 'low'
        });
    }
    
    // Customer Lifetime Value
    static trackCustomerValue(customerId, totalSpent) {
        metrics.gauge('business.customer_ltv', totalSpent, {
            customerId: customerId
        });
    }
}

// Ejemplos
app.post('/api/v1/checkout/complete', async (req, res) => {
    const order = await createOrder(req.body);
    
    // Tracking
    BusinessMetrics.trackRevenue(order.total, order.currency);
    BusinessMetrics.trackOrderValue(order.id, order.total);
    BusinessMetrics.trackConversion('purchase');
    
    res.json({ orderId: order.id });
});

app.post('/api/v1/cart/abandon', async (req, res) => {
    const cart = await getCart(req.user.id);
    
    BusinessMetrics.trackAbandonedCart(
        cart.id,
        cart.items.length,
        cart.total
    );
    
    res.json({ message: 'Cart saved' });
});
```

**Benchmarks - ElRinconAzul:**

```
Métrica                     Actual      Target      Tendencia
───────────────────────────────────────────────────────────────
Conversion Rate             2.8%        3.5%        ↑ +0.1% MoM
Avg Order Value             $45         $55         ↑ +5% MoM
Cart Abandonment            68%         <60%        ↓ -2% MoM
Customer LTV                $180        $250        ↑ +10% QoQ
Daily Active Users          15K         25K         ↑ +8% WoW
Monthly Recurring Revenue   $675K       $1M         ↑ +15% YoY
Churn Rate                  5%          <3%         ↓ -0.5% MoM
───────────────────────────────────────────────────────────────
```

### Pilar 4: SEGURIDAD (Security Metrics)

**Métricas Clave:**

```javascript
class SecurityMetrics {
    
    // Intentos de ataque bloqueados
    static recordAttackBlocked(attackType, source) {
        metrics.increment('security.attacks_blocked', {
            type: attackType,
            source: source
        });
    }
    
    // Intentos fallidos de login
    static recordFailedLogin(email, reason) {
        metrics.increment('security.login_attempts_failed', {
            email: email,
            reason: reason  // 'invalid_password', 'account_locked', etc.
        });
    }
    
    // Cambios de datos sensibles
    static recordSensitiveChange(userId, changeType) {
        metrics.increment('security.sensitive_changes', {
            userId: userId,
            type: changeType  // 'password_change', 'email_change', etc.
        });
    }
    
    // Vulnerabilidades detectadas
    static recordVulnerability(severity, component) {
        metrics.increment('security.vulnerabilities_found', {
            severity: severity,  // 'critical', 'high', 'medium', 'low'
            component: component
        });
    }
    
    // MFA verificaciones
    static recordMFAVerification(userId, result) {
        metrics.increment('security.mfa_verification', {
            userId: userId,
            result: result  // 'success', 'failed', 'backup_code'
        });
    }
    
    // Tiempo de respuesta ante incident
    static recordIncidentResponse(incidentId, responseTime) {
        metrics.histogram('security.incident_response_time', responseTime, {
            incidentId: incidentId,
            unit: 'minutes'
        });
    }
}

// Ejemplos
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        SecurityMetrics.recordFailedLogin(email, 'invalid_password');
        
        // Rate limiting
        const attempts = await incrementFailedAttempts(email);
        if (attempts > 5) {
            SecurityMetrics.recordAttackBlocked('brute_force', email);
            user.locked = true;
            await user.save();
        }
        
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateJWT(user);
    res.json({ token });
});

app.post('/api/v1/user/change-password', authenticateJWT, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;
    
    if (!await bcrypt.compare(oldPassword, user.passwordHash)) {
        return res.status(401).json({ error: 'Current password incorrect' });
    }
    
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    SecurityMetrics.recordSensitiveChange(user.id, 'password_change');
    logger.audit('PASSWORD_CHANGED', user.id);
    
    res.json({ message: 'Password changed' });
});
```

**Benchmarks - ElRinconAzul:**

```
Métrica                              Target
───────────────────────────────────────────────────────
Intentos de acceso no autorizado     <5 por/día
Vulnerabilidades encontradas        <1 por trimestre
Tiempo respuesta incidentes críticos <15 minutos
MFA success rate                     >99.9%
Failed login rate                    <1% de intentos
Datos breachados                     0
Certificados SSL válidos             100%
```

---

## 3. Stack de Monitoreo Recomendado

### Opción 1: Datadog (RECOMENDADO - Empresarial)

```javascript
// npm install datadog-browser-rum datadog-browser-logs

// app.js
const { datadogRum } = require('@datadog/browser-rum');

datadogRum.init({
    applicationId: process.env.DATADOG_APP_ID,
    clientToken: process.env.DATADOG_CLIENT_TOKEN,
    site: 'datadoghq.com',
    service: 'ElRinconAzul-frontend',
    env: process.env.NODE_ENV,
    version: '2.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input'
});

datadogRum.startSessionReplayRecording();
```

**Dashboard Datadog:**
- Uptime monitoring
- Error tracking
- Performance analytics
- User session replay
- Custom metrics
- Alertas automáticas

### Opción 2: New Relic

```javascript
require('newrelic');  // Debe ser lo primero

// Instrumentación automática de Node.js
```

### Opción 3: Prometheus + Grafana (Open Source)

```javascript
// npm install prom-client express-prometheus-middleware

const promClient = require('prom-client');
const express = require('express');

// Métricas por defecto
promClient.collectDefaultMetrics({ timeout: 5000 });

// Métrica custom
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
});

// Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration
            .labels(req.method, req.route?.path || 'unknown', res.statusCode)
            .observe(duration);
    });
    next();
});

// Endpoint para Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});
```

---

## 4. Alertas Recomendadas

```javascript
class AlertManager {
    
    static getAlertRules() {
        return [
            // CONFIABILIDAD
            {
                name: 'APIDown',
                condition: 'uptime < 99%',
                severity: 'critical',
                notification: ['email', 'slack', 'pagerduty']
            },
            
            // RENDIMIENTO
            {
                name: 'HighLatency',
                condition: 'p95_latency > 500ms',
                severity: 'high',
                notification: ['slack']
            },
            {
                name: 'ErrorRateHigh',
                condition: 'error_rate > 1%',
                severity: 'high',
                notification: ['slack', 'email']
            },
            
            // SEGURIDAD
            {
                name: 'BruteForceDetected',
                condition: 'failed_logins > 5 in 10min',
                severity: 'critical',
                notification: ['email', 'pagerduty', 'sms']
            },
            {
                name: 'UnusualTraffic',
                condition: 'requests > 150% of baseline',
                severity: 'medium',
                notification: ['slack']
            },
            {
                name: 'SQLInjectionAttempt',
                condition: 'sql_injection_detected = true',
                severity: 'critical',
                notification: ['email', 'pagerduty']
            },
            
            // NEGOCIO
            {
                name: 'PaymentProcessingDown',
                condition: 'payment_success_rate < 90%',
                severity: 'critical',
                notification: ['email', 'pagerduty']
            },
            {
                name: 'LowConversion',
                condition: 'conversion_rate < 2%',
                severity: 'low',
                notification: ['email']
            }
        ];
    }
    
    static async checkAndAlert() {
        for (const alert of this.getAlertRules()) {
            const triggered = await this.evaluateCondition(alert.condition);
            if (triggered) {
                await this.sendNotifications(alert);
            }
        }
    }
}

// Ejecutar cada 1 minuto
setInterval(() => AlertManager.checkAndAlert(), 60000);
```

---

## 5. Dashboards Recomendados

### Dashboard 1: Executive Overview

```
┌─────────────────────────────────────────┐
│  🟢 STATUS: HEALTHY
├─────────────────────────────────────────┤
│ Uptime: 99.98%       │  Error Rate: 0.08% │
│ Daily Users: 18.5K   │  Conversion: 3.2%  │
│ Revenue Today: $12.4K │  Orders: 276      │
├─────────────────────────────────────────┤
│ Last 24h Latency          │ Last 24h Errors   │
│ ─────────────    ┐        │ ─────────    ┐   │
│ P95:  128ms     │ │       │ 404: 8      │ │   │
│ P99:  312ms     │ │       │ 500: 2      │ │   │
│           ┌─────┘         │           ┌─┘   │
└─────────────────────────────────────────┘
```

### Dashboard 2: Performance Monitoring

```
Latencia por Endpoint (P95):
    GET /products       : 94ms    ✓
    GET /product/:id    : 127ms   ✓
    POST /cart/add      : 185ms   ✓
    POST /checkout      : 782ms   ⚠ (Target: <500ms)
    GET /search         : 324ms   ✓

Cache Hit Rate: 96.2% ✓
    Last 1h: 4,821 hits / 5,102 total

Database Query Times:
    SELECT products: 28ms ✓
    SELECT orders:   45ms ✓
    UPDATE inventory: 92ms ✓
```

### Dashboard 3: Security Center

```
┌──────────────────────────────────────┐
│  🟢 NO INCIDENTS (Last 30 days)
├──────────────────────────────────────┤
│
│ Last 24h Security Events:
│ ├─ Failed logins: 23 (rate-limited: 2)
│ ├─ SQL injection attempts: 0
│ ├─ XSS attempts blocked: 0
│ ├─ DDoS mitigation events: 0
│ └─ MFA verification success: 99.8%
│
│ Vulnerability Scan (Daily):
│ ├─ Critical:  0
│ ├─ High:      1 (known, remediation: Apr 5)
│ ├─ Medium:    3
│ └─ Low:       8
│
└──────────────────────────────────────┘
```

---

## 6. Runbook - Respuesta a Problemas

```markdown
# INCIDENT RESPONSE RUNBOOK

## Escenario 1: API Down (Uptime < 99%)

**Detección:** Alert crítico en Datadog

**Pasos inmediatos (0-5 min):**
1. Confirmar: `curl https://api.ElRinconAzul.com/health`
2. Slack: Notificar #incidents
3. Check: Status de servidores en AWS

**Diagnosticar (5-15 min):**
1. Revisar logs: `tail -f /var/log/ElRinconAzul/error.log`
2. Métricas de servidor: CPU, memoria, disco
3. Conexión DB: ¿Está respondiendo?
4. Errores recientes en Datadog

**Remediar (según causa):**
- Si CPU alta: Reiniciar procesos Node.js
- Si DB down: Failover a replica
- Si memoria: Aumentar capacidad y reiniciar
- Si conectividad: Verificar firewall/DNS

**Comunicar:**
- Actualizar status.elrinconazul.com
- Email a customers
- Tweet en @elrinconazulapp

**Post-mortem:** Crear ticket JIRA


## Escenario 2: High Error Rate (>1%)

1. Identificar endpoint afectado
2. ¿Despliegue reciente? Rollback si es necesario
3. Revisar logs de ese endpoint
4. Contactar al equipo de ese servicio
5. Implementar fix, test, deploy
6. Monitor por 30 minutos


## Escenario 3: Ataque de Fuerza Bruta Detectado

1. Bloquear IP en firewall
2. Forzar reset de contraseña para usuarios afectados
3. Revisar logs: ¿Algún acceso exitoso?
4. Actualizar políticas de contraseña si es necesario
5. Comunicar a usuarios
6. Analizar patrón del ataque
```

---

## 7. Checklist de Implementación

```
MONITOREO BÁSICO:
☑ Health check endpoint
☑ Datadog o New Relic conectado
☑ Alertas básicas configuradas
☑ Dashboard ejecutivo
☑ Error tracking

MONITOREO INTERMEDIO:
☑ Métricas de negocio (conversión, AOV, etc.)
☑ Performance per endpoint
☑ Security metrics
☑ Database query monitoring
☑ Cache hit rate tracking

MONITOREO AVANZADO:
☑ Session replay (usuario experience)
☑ Real user monitoring (RUM)
☑ Synthetic monitoring (tests automatizados)
☑ ML-based anomaly detection
☑ Predictive alerting

DOCUMENTACIÓN:
☑ Runbooks de incidentes
☑ SLA definitions
☑ Alert escalation paths
☑ Procedures de post-mortem
☑ Disaster recovery plan
```

---

## 8. Conclusión

**Las métricas son la base de decisiones informadas.**

Sin datos, trabajas con suposiciones.  
Con datos, trabajas con evidencia.

Ganesh implementará:
- ✅ Monitoreo de confiabilidad (99.95% uptime)
- ✅ Métricas de rendimiento (P95 < 200ms)
- ✅ KPIs de negocio (conversión, AOV, LTV)
- ✅ Alertas de seguridad (response < 15 min)
- ✅ Dashboards para todas las audiencias

**Resultado: Mayor confiabilidad, mejor experiencia, menos emergencias.**

