# 🚀 Deployment - Ganesh

Este documento completa la **FASE 4 (Testing y Deployment)** del checklist.

## Objetivo

- Ejecutar la app en contenedores (Docker).
- Tener CI básico para validar el backend (Jest + Supertest).
- Proveer un flujo simple para correr en local o desplegar en un VPS.

## 1) Docker Compose (recomendado)

Requisitos:

- Docker Desktop instalado (Windows/macOS) o Docker Engine (Linux).

Comandos:

```bash
docker compose up --build
```

Servicios:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000/api/health`

Notas:

- El frontend se sirve con Nginx (estático).
- El backend se ejecuta con Node 18 en modo `production`.

## 2) Variables de entorno (backend)

En Docker Compose se setean variables mínimas:

- `PORT=5000`
- `CORS_ORIGIN=http://localhost:8080`
- `JWT_SECRET=change_me_in_prod`

En producción:

- Cambiar `JWT_SECRET` por un secreto largo y rotarlo periódicamente.
- Usar reverse proxy (Nginx/Caddy) con TLS.

## 3) CI (GitHub Actions)

Pipeline recomendado:

- Instalar dependencias del backend (`npm ci`).
- Ejecutar `npm test`.

El workflow se ubica en `.github/workflows/ci.yml`.

## 4) Deploy en VPS (ejemplo)

1. Instalar Docker en el servidor.
2. Copiar el repositorio (o clonar).
3. Ejecutar:

```bash
docker compose up -d --build
```

4. Configurar un reverse proxy (Nginx/Caddy) para:

- `https://tu-dominio` → `localhost:8080`
- `https://api.tu-dominio` → `localhost:5000`

## 5) Checklist de salida

- [ ] `docker compose up --build` levanta frontend y backend.
- [ ] `GET /api/health` responde 200.
- [ ] Frontend carga productos (vía API si backend está disponible).
- [ ] `npm test` pasa en CI.

