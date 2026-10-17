#!/bin/sh
# Punto de entrada del contenedor de SINERGIA. Ajusta la conexion a la base y
# luego ejecuta el comando pedido (por omision: migraciones + arrancar).
#
# Por que: backend/.env del servidor dice DATABASE_URL=...@127.0.0.1:3307/...
# (asi funciona fuera de Docker). Dentro de Docker la base es el servicio
# "mysql" en el puerto 3306. Aqui se cambia SOLO el servidor y el puerto; el
# usuario, la contrasena y la base quedan iguales, sin escribirlos en ningun
# archivo ni mostrarlos.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Falta DATABASE_URL: revise backend/.env (docs/GUIA_DESARROLLO.md, seccion 11)." >&2
  exit 1
fi

if [ -n "$BD_SERVIDOR_CONTENEDOR" ]; then
  DATABASE_URL=$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    const [servidor, puerto] = process.env.BD_SERVIDOR_CONTENEDOR.split(":");
    u.hostname = servidor;
    u.port = puerto || "3306";
    // Con TLS, los comandos de Prisma (migrate, seed) tambien verifican el
    // certificado de la base con la misma autoridad que usa SINERGIA.
    // SINERGIA lee la conexion en codigo y no usa estos parametros.
    if (process.env.BD_TLS === "true" && process.env.BD_TLS_CA) {
      u.searchParams.set("sslcert", process.env.BD_TLS_CA);
      u.searchParams.set("sslaccept", "strict");
    }
    process.stdout.write(u.toString());
  ')
  export DATABASE_URL
fi

exec "$@"
