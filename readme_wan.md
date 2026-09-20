# Guía para Publicar Ganesh a Internet (WAN) sin Dominio

Para llevar tu proyecto de una red local (LAN) a Internet (WAN) sin necesidad de comprar un dominio o configurar IPs estáticas complejas, la mejor opción es usar un **Túnel Seguro**.

Aquí tienes las 2 mejores opciones gratuitas y profesionales:

---

## Opción 1: Cloudflare Tunnel (Recomendada)
Es la más estable, segura y profesional. Permite crear una URL pública permanente (aunque sea un subdominio gratuito de Cloudflare).

### Pasos:
1. **Descargar Cloudflared**: Baja el ejecutable según tu sistema (Windows/Linux/Mac).
2. **Iniciar Sesión**:
   ```bash
   cloudflared tunnel login
   ```
3. **Crear Túnel**:
   ```bash
   cloudflared tunnel create elrinconazul
   ```
4. **Configurar Rutas**:
   Como tienes dos servidores (Frontend y Backend), necesitas redirigirlos. Cloudflare permite usar subdominios o rutas. 
   
   ```yaml
   # Ejemplo de config.yml
   tunnel: <ID-DEL-TUNNEL>
   credentials-file: C:\Users\Usuario\.cloudflared\<ID>.json

   ingress:
     - hostname: tienda.tu-subdominio.com  # Apunta al puerto 8000 (Frontend)
       service: http://localhost:8000
     - hostname: api.tu-subdominio.com     # Apunta al puerto 5000 (Backend)
       service: http://localhost:5000
     - service: http_status:404
   ```

---

## Opción 2: Ngrok (La más rápida para pruebas)
Ideal si solo quieres mostrarle el avance a alguien rápidamente.

### Pasos:
1. **Instalar Ngrok**: Descárgalo en [ngrok.com](https://ngrok.com/).
2. **Autenticar**:
   ```bash
   ngrok config add-authtoken TU_TOKEN_DE_DASHBOARD
   ```
3. **Lanzar Túneles**:
   Como necesitas dos puertos a la vez, lo mejor es usar un archivo de configuración de ngrok (`ngrok.yml`):
   ```yaml
   tunnels:
     frontend:
       proto: http
       addr: 8000
     backend:
       proto: http
       addr: 5000
   ```
   Luego ejecutas: `ngrok start --all`

---

## ¡IMPORTANTE! Ajuste de Código para WAN

Cuando pases a WAN, el código de detección automática de la API en `index.html` y `product-detail.html` podría no adivinar la URL de ngrok/cloudflare automáticamente si usas dominios diferentes.

**Debes actualizar el bloque de script en tus archivos HTML:**

```javascript
// En index.html y product-detail.html
window.API_BASE = "https://tu-api-publica.ngrok-free.app"; // Reemplaza con la URL que te dé Ngrok/Cloudflare
```

### Alternativa Dinámica (Si usas el mismo dominio con rutas):
Si logras que la API responda en `tu-tienda.com/api`, el código no necesitará cambios ya que `window.location.origin` funcionará solo.

---

## Resumen de Seguridad:
* **Firewall**: No necesitas abrir puertos en tu router, el túnel lo hace por ti de forma segura.
* **HTTPS**: Ambos servicios te regalan el certificado SSL (el candadito verde) automáticamente.
