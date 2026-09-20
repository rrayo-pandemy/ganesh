# Guía para Acceder a Ganesh desde tu Red Local (LAN)

Para que puedas ver y probar la tienda desde otros dispositivos (celulares, tablets u otras PCs) conectados a tu mismo Wi-Fi, sigue estos pasos:

### 1. Obtener tu Dirección IP Local
Necesitas saber cuál es la IP de tu computadora principal en la red:
1. Abre una terminal (PowerShell o CMD).
2. Escribe `ipconfig` y presiona Enter.
3. Busca la sección "Adaptador de Ethernet" o "Adaptador de LAN inalámbrica Wi-Fi".
4. Anota el número que aparece en **Dirección IPv4** (ejemplo: `192.168.1.15`).

### 2. Configuración de los Servidores
Asegúrate de que ambos servidores estén corriendo:
- **Backend (API):** En la carpeta `backend`, ejecuta `npm run dev`. (Escucha en el puerto 5000 por defecto).
- **Frontend:** En la carpeta `frontend`, ejecuta el servidor de Python:
  ```bash
  python -m http.server 8000
  ```
  *Nota: El servidor de Python permite conexiones externas por defecto.*

### 3. Verificar el Firewall de Windows
Para que otros dispositivos puedan entrar, el Firewall debe permitir el tráfico en los puertos 5000 y 8000:
1. Ve a **Panel de Control** > **Sistema y Seguridad** > **Windows Defender Firewall**.
2. Selecciona "Permitir que una aplicación o una característica a través de Windows Defender Firewall".
3. Asegúrate de que "Python" y "Node.js" tengan permiso en redes **Privadas**.

### 4. Acceder desde otro Dispositivo
Desde tu celular o tablet conectada al mismo Wi-Fi:
1. Abre el navegador.
2. Ingresa la IP que anotaste en el paso 1 seguida del puerto 8000.
   - Ejemplo: `http://192.168.1.15:8000`

### ¿Cómo funciona la conexión a la API?
El código de la tienda detecta automáticamente si estás accediendo por red local. En `index.html` tenemos esta lógica:
```javascript
if (window.location.port === '8000') {
    window.API_BASE = window.location.protocol + '//' + window.location.hostname + ':5000';
}
```
Esto hace que si entras por `http://192.168.1.15:8000`, la web intente comunicarse con la API en `http://192.168.1.15:5000` automáticamente.

---
**Tip:** Si el celular no carga la página, lo más probable es que el Firewall de tu PC esté bloqueando la conexión. Prueba desactivándolo momentáneamente para confirmar.
