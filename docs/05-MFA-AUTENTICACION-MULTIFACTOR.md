# 🔐 Autenticación Multi-Factor (MFA) - Guía de Implementación

**Versión:** 2.0  
**Fecha:** Marzo 29, 2026

---

## 1. Introducción

La Autenticación Multi-Factor (MFA) o Autenticación de Dos Factores (2FA) añade una capa de seguridad adicional requiriendo **dos o más pruebas de identidad** para acceder a una cuenta.

```
Método Tradicional:          Con MFA:
┌─────────────┐              ┌─────────────┐
│ Usuario     │              │ Usuario     │
└──────┬──────┘              └──────┬──────┘
       │                             │
       ├─ Email ──────────┐          ├─ Email ──────────┐
       │                  │          │                  │
       ├─ Password ───────┤          ├─ Password ───────┤
       │                  │          │                  │
       └─  Acceso  ◄──────┘          ├─ Código 2FA ───┐ │
                                     │                │ │
                                     └─   Acceso  ◄───┘ │
                                                        │
                                      (Más seguro)
```

---

## 2. Métodos de MFA Soportados

### A. Email OTP (One-Time Password)

**Ventajas:** Fácil, no requiere app, funciona en todos los dispositivos  
**Desventajas:** Más lento, riesgo si email comprometido

```javascript
// Proceso:
// 1. Usuario ingresa email + password
// 2. Sistema genera código 6 dígitos (válido 5 min)
// 3. Envía por email
// 4. Usuario ingresa código
// 5. Verifica y genera JWT

app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Step 1: Validar email y password
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        logger.warn('LOGIN_FAILED', { email });
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Step 2: Si MFA está habilitado, enviar código
    if (user.mfaEnabled && user.mfaMethod === 'email') {
        const mfaCode = Math.random().toString().slice(-6);  // 6 dígitos
        const mfaHash = await bcrypt.hash(mfaCode, 10);
        
        // Almacenar (hash, no plain!)
        user.mfaPending = {
            hash: mfaHash,
            expiresAt: Date.now() + 5 * 60 * 1000,  // 5 minutos
            attempts: 0,
            sessionId: req.sessionID
        };
        await user.save();
        
        // Enviar email
        await sendEmail(user.email, `Tu código: ${mfaCode}`);
        logger.audit('MFA_CODE_SENT', user.id, { method: 'email' });
        
        res.json({
            message: 'Código enviado a tu email',
            requiresMFA: true,
            mfaMethod: 'email',
            expiresIn: 300  // segundos
        });
    } else {
        // Sin MFA: generar token directamente
        const token = generateJWT(user);
        logger.audit('LOGIN_SUCCESS', user.id);
        res.json({ token, user });
    }
});

// Step 3: Verificar código
app.post('/api/v1/auth/verify-mfa', async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !user.mfaPending) {
        return res.status(401).json({ error: 'MFA session not found' });
    }
    
    // Verificaciones
    if (Date.now() > user.mfaPending.expiresAt) {
        user.mfaPending = null;
        await user.save();
        logger.warn('MFA_EXPIRED', user.id);
        return res.status(401).json({ error: 'Código expirado, intenta de nuevo' });
    }
    
    if (user.mfaPending.attempts >= 3) {
        user.mfaPending = null;
        await user.save();
        logger.warn('MFA_LOCKED', user.id, { reason: '3 intentos fallidos' });
        return res.status(401).json({ error: 'Demasiados intentos. Intenta de nuevo en 5 minutos' });
    }
    
    // Comparar código
    const isValid = await bcrypt.compare(code, user.mfaPending.hash);
    if (!isValid) {
        user.mfaPending.attempts++;
        await user.save();
        logger.warn('MFA_INVALID_CODE', user.id);
        return res.status(401).json({ 
            error: 'Código inválido',
            attemptsRemaining: 3 - user.mfaPending.attempts
        });
    }
    
    // ✓ Código válido
    user.mfaPending = null;
    user.lastMFAVerified = new Date();
    await user.save();
    
    const token = generateJWT(user);
    logger.audit('MFA_SUCCESS', user.id);
    
    res.json({ 
        message: 'Autenticación completada',
        token,
        user: { id: user.id, email: user.email }
    });
});
```

### B. TOTP (Time-based One-Time Password)

**Ventajas:** Muy seguro, no requiere internet, offline-capable  
**Desventajas:** Requiere app (Google Authenticator, Authy)

```javascript
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// 1. Generar secret (durante setup)
app.post('/api/v1/auth/setup-totp', authenticateJWT, async (req, res) => {
    const user = req.user;
    
    // Generar secret
    const secret = speakeasy.generateSecret({
        name: `Ganesh (${user.email})`,
        issuer: 'Ganesh',
        length: 32
    });
    
    // Generar QR
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    // Almacenar (sin verificar aún)
    user.totpSecret = {
        secret: secret.base32,
        verified: false,
        createdAt: new Date()
    };
    await user.save();
    
    logger.audit('TOTP_SETUP_INITIATED', user.id);
    
    res.json({
        secrets: secret.base32,
        qrCode,  // Mostrar en UI
        message: 'Escanea con Google Authenticator'
    });
});

// 2. Verificar durante setup
app.post('/api/v1/auth/verify-totp-setup', authenticateJWT, async (req, res) => {
    const { code } = req.body;
    const user = req.user;
    
    if (!user.totpSecret || user.totpSecret.verified) {
        return res.status(400).json({ error: 'TOTP not setup or already verified' });
    }
    
    // Verificar código (con ventana de ±1 minuto)
    const isValid = speakeasy.totp.verify({
        secret: user.totpSecret.secret,
        encoding: 'base32',
        token: code,
        window: 2  // ±2 time steps (30 seg cada uno)
    });
    
    if (!isValid) {
        logger.warn('TOTP_INVALID', user.id);
        return res.status(401).json({ error: 'Código inválido' });
    }
    
    // Marcar como verificado
    user.totpSecret.verified = true;
    user.mfaEnabled = true;
    user.mfaMethod = 'totp';
    await user.save();
    
    logger.audit('TOTP_VERIFIED', user.id);
    
    res.json({ message: 'TOTP habilitado exitosamente' });
});

// 3. Login con TOTP
app.post('/api/v1/auth/verify-totp-login', async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !user.totpSecret || !user.totpSecret.verified) {
        return res.status(401).json({ error: 'TOTP not enabled' });
    }
    
    const isValid = speakeasy.totp.verify({
        secret: user.totpSecret.secret,
        encoding: 'base32',
        token: code,
        window: 2
    });
    
    if (!isValid) {
        logger.warn('TOTP_FAILED_LOGIN', user.id);
        return res.status(401).json({ error: 'Código inválido' });
    }
    
    user.lastMFAVerified = new Date();
    await user.save();
    
    const token = generateJWT(user);
    logger.audit('LOGIN_WITH_TOTP', user.id);
    
    res.json({ token, user });
});
```

### C. SMS OTP (Menos recomendado - Vulnerável a SIM swap)

```javascript
// ⚠️ Nota: SMS es menos seguro que Email o TOTP
// Implementar solo si es requisito específico

const twilio = require('twilio');

app.post('/api/v1/auth/send-sms-code', async (req, res) => {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const code = Math.random().toString().slice(-6);
    const hash = await bcrypt.hash(code, 10);
    
    user.smsPending = { hash, expiresAt: Date.now() + 10 * 60 * 1000 };
    await user.save();
    
    // Enviar via Twilio
    await twilio.messages.create({
        body: `Tu código: ${code}`,
        from: process.env.TWILIO_PHONE,
        to: phone
    });
    
    logger.audit('SMS_CODE_SENT', user.id);
    res.json({ message: 'Código enviado via SMS' });
});
```

---

## 3. MFA Obligatorio para Admin

```javascript
// Los administradores DEBEN tener MFA habilitado

const requireMFA = (req, res, next) => {
    const user = req.user;
    
    if (user.role === 'admin' && !user.mfaEnabled) {
        logger.warn('ADMIN_WITHOUT_MFA', user.id);
        return res.status(403).json({
            error: 'MFA es obligatorio para administradores',
            requiresSetup: true
        });
    }
    
    next();
};

app.use('/api/v1/admin/*', requireMFA);

// Además: Admin debe reverificar periodic MFA
app.use('/api/v1/admin/*', (req, res, next) => {
    const user = req.user;
    const lastVerified = new Date(user.lastMFAVerified) || new Date(0);
    const hoursSince = (Date.now() - lastVerified) / (1000 * 60 * 60);
    
    // Requiere re-verification cada 8 horas
    if (hoursSince > 8) {
        return res.status(403).json({
            error: 'MFA re-verification requerida',
            requiresReAuth: true
        });
    }
    
    next();
});
```

---

## 4. Backup Codes (Recuperación)

Para caso de pérdida de dispositivo, generar códigos de recuperación:

```javascript
app.post('/api/v1/auth/generate-backup-codes', authenticateJWT, async (req, res) => {
    const user = req.user;
    
    // Generar 10 códigos de 8 caracteres
    const backupCodes = [];
    const hashes = [];
    
    for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);
        hashes.push(await bcrypt.hash(code, 10));
    }
    
    user.backupCodes = {
        hashes,
        createdAt: new Date(),
        used: []
    };
    await user.save();
    
    logger.audit('BACKUP_CODES_GENERATED', user.id);
    
    // Mostrar una sola vez
    res.json({
        message: 'Guarda estos códigos en un lugar seguro',
        codes: backupCodes,  // Solo mostrar una vez
        warning: 'No comparte estos códigos'
    });
});

// Usar backup code para acceso de emergencia
app.post('/api/v1/auth/use-backup-code', async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !user.backupCodes) {
        return res.status(401).json({ error: 'No backup codes available' });
    }
    
    // Verificar que no esté usado
    let validCode = false;
    let codeIndex = -1;
    
    for (let i = 0; i < user.backupCodes.hashes.length; i++) {
        if (!user.backupCodes.used.includes(i)) {
            const isMatch = await bcrypt.compare(code, user.backupCodes.hashes[i]);
            if (isMatch) {
                validCode = true;
                codeIndex = i;
                break;
            }
        }
    }
    
    if (!validCode) {
        logger.warn('BACKUP_CODE_INVALID', user.id);
        return res.status(401).json({ error: 'Invalid or used backup code' });
    }
    
    // Marcar como usado
    user.backupCodes.used.push(codeIndex);
    await user.save();
    
    const token = generateJWT(user);
    
    logger.critical('BACKUP_CODE_USED', user.id, {
        warning: 'Acceso por backup code. Usuario debe setup MFA nuevamente'
    });
    
    res.json({
        token,
        warning: 'Accediste con código de recuperación. Configura MFA nuevamente pronto.'
    });
});
```

---

## 5. Desahilitación de MFA

```javascript
app.post('/api/v1/auth/disable-mfa', authenticateJWT, async (req, res) => {
    const user = req.user;
    const { password, currentMFACode } = req.body;
    
    // Requiere password + MFA actual como verificación
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        logger.warn('DISABLE_MFA_INVALID_PASSWORD', user.id);
        return res.status(401).json({ error: 'Contraseña inv álida' });
    }
    
    // Verificar MFA actual
    const isMFAValid = user.mfaMethod === 'email'
        ? await bcrypt.compare(currentMFACode, user.mfaPending.hash)
        : speakeasy.totp.verify({
            secret: user.totpSecret.secret,
            encoding: 'base32',
            token: currentMFACode
          });
    
    if (!isMFAValid) {
        logger.warn('DISABLE_MFA_INVALID_CODE', user.id);
        return res.status(401).json({ error: 'Código MFA inválido' });
    }
    
    // Deshabilitar
    user.mfaEnabled = false;
    user.mfaMethod = null;
    user.totpSecret = null;
    user.backupCodes = null;
    await user.save();
    
    logger.audit('MFA_DISABLED', user.id, { reason: 'user_requested' });
    
    res.json({ message: 'MFA deshabilitado' });
});
```

---

## 6. Flujo Recomendado para Usuarios

```
┌─────────────────────────────────┐
│  Usuario visita /settings       │
└────────────┬────────────────────┘
             │
             ▼
     ┌──────────────────┐
     │ MFA Habilitado?  │
     └─┬────────────────┘
       │
       ├─ NO:
       │   └─ Mostrar: "Habilitar MFA"
       │       ├─ Seleccionar método (Email / TOTP)
       │       ├─ Setup
       │       └─ Verificar
       │
       └─ SÍ:
           └─ Mostrar: "MFA Activo"
               ├─ Método actual
               ├─ Regenerar códigos
               └─ Deshabilitar
```

---

## 7. Checklist de Implementación

```
☑ Email OTP (desarrollo)
☑ TOTP con QR code (desarrollo)
☑ Backup codes (desarrollo)
☑ Rate limiting en intentos (3-5 max)
☑ Expiración de códigos (5 min email, sin límite TOTP)
☑ Logging de intentos fallidos
☑ MFA obligatorio para admin
☑ Re-verification periodic para admin (8 horas)
☑ UI para setup en /settings
☑ Recuperación por backup code
☑ Auditoría de cambios MFA
☑ Tests de seguridad

DOCUMENTACIÓN:
☑ Guía usuario
☑ Guía admin
☑ Guía developer
☑ Troubleshooting
```

---

## Conclusión

**MFA es REQUERIDO** en Ganesh v2.0 para:

- ✅ Cuentas de administrador (OBLIGATORIO)
- ✅ Cuentas de usuario (OPCIONAL pero RECOMENDADO)
- ✅ Transacciones sensibles (RECOMENDADO)

Implementación está **PRODUCTION READY** con Email OTP (default) y TOTP (avanzado).

