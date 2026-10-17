# SINERGIA en un solo contenedor (decision del 30/09: sin proxy inverso).
# El mismo proceso de Node atiende HTTPS, la API (/api) y la interfaz compilada.
# La base de datos es el servicio "mysql" del docker-compose.yml (contenedor sigel-mysql).
#
# Se construye desde la raiz de SIGEL:  docker compose --profile servidor build
# Pasos completos: docs/GUIA_DESARROLLO.md, seccion 11.

# ---------- 1. Interfaz (React + Vite) ----------
FROM node:24-bookworm-slim AS interfaz
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. Backend (NestJS + Prisma) ----------
FROM node:24-bookworm-slim AS backend
# Prisma necesita openssl; ca-certificates para el correo (Gmail) y descargas de npm.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
# Si el repositorio se clono en Windows, los .sh pueden venir con CRLF y sh no los entiende.
RUN sed -i 's/\r$//' docker/*.sh
# "prisma generate" no se conecta a la base, pero prisma.config.ts exige que exista DATABASE_URL.
RUN DATABASE_URL="mysql://compilar:compilar@localhost:3306/compilar" npx prisma generate \
 && npm run build

# ---------- 3. Imagen final ----------
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    TZ=America/Costa_Rica \
    PUERTO=8443 \
    RUTA_FRONTEND=/app/frontend/dist \
    RUTA_ARCHIVOS=/app/backend/archivos \
    RUTA_REGISTROS=/app/backend/registros
WORKDIR /app/backend
# Se conservan las dependencias de desarrollo: hacen falta el CLI de Prisma
# (migrate deploy al arrancar) y tsx (semilla, perfil del Super Administrador, llaves).
COPY --from=backend --chown=node:node /app/backend ./
COPY --from=interfaz --chown=node:node /app/frontend/dist /app/frontend/dist
RUN mkdir -p archivos registros && chown node:node archivos registros
USER node
EXPOSE 8443
# Revisa que el puerto responda (sin HTTPS: el certificado es del subdominio, no de localhost).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('net').connect(Number(process.env.PUERTO),'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/backend/docker/ejecutar.sh"]
# Por omision: aplica las migraciones pendientes (no borra datos) y arranca SINERGIA.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
