# Guía de desarrollo de SIGEL

Esta guía explica cómo dejar el proyecto corriendo en su máquina y qué hace cada
comando. Está escrita para quien nunca ha usado Docker.

**Última actualización:** 17 de setiembre de 2026 · Sprint 1 en curso

---

## 1. La idea general

SIGEL tiene tres piezas:

| Pieza | Qué es | Dónde corre |
|---|---|---|
| **MySQL 8.4** | La base de datos | Dentro de Docker, siempre |
| **Backend** | La API en NestJS | En su máquina, con `npm`, mientras se programa |
| **Frontend** | La interfaz en React + Vite | En su máquina, con `npm`, mientras se programa |

Docker es un programa que corre otros programas dentro de "cajas" aisladas, llamadas
**contenedores**. La ventaja es que no hay que instalar MySQL en Windows ni pelear con
su configuración: el contenedor ya trae MySQL 8.4 listo, con la versión exacta que usa
el proyecto. Si algo se daña, se borra el contenedor y se levanta otro.

Durante el desarrollo, el backend y el frontend corren fuera de Docker porque así
recargan al instante cada vez que se guarda un archivo. **Antes de las pruebas finales
y del despliegue** se dockerizan también, para que toda la Municipalidad pueda levantar
SIGEL con un solo comando.

Estos son los archivos que hacen el trabajo:

- **`docker-compose.yml`**: la receta. Dice qué contenedores existen (por ahora uno,
  `sigel-mysql`), qué imagen usan, en qué puerto responden y dónde guardan los datos.
- **`.env`** (en la raíz): las credenciales de MySQL que lee esa receta. No se sube al
  repositorio.

---

## 2. Qué necesita instalado

| Herramienta | Versión | Cómo verificar |
|---|---|---|
| Docker Desktop | Cualquiera reciente | `docker --version` |
| Node.js | 22.22.3 o superior (o 24 LTS) | `node -v` |
| Git | Cualquiera reciente | `git --version` |

Si `node -v` muestra algo menor a 22.22.3, descargue la versión LTS desde nodejs.org
antes de seguir. Algunas herramientas de NestJS 12 la exigen.

---

## 3. Levantar la base de datos

Abra una terminal (PowerShell) en la carpeta del proyecto: `Documents\Proyectos\SIGEL`.

```powershell
docker compose up -d
```

`up` crea y arranca los contenedores de la receta; `-d` los deja corriendo en segundo
plano. La primera vez descarga la imagen de MySQL, así que tarda unos minutos.

Para confirmar que quedó arriba:

```powershell
docker compose ps
```

Debe aparecer `sigel-mysql` con estado `running` o `Up`.

### Comandos de Docker que va a usar seguido

| Comando | Qué hace |
|---|---|
| `docker compose up -d` | Levanta la base de datos |
| `docker compose ps` | Muestra qué contenedores están corriendo |
| `docker compose logs -f mysql` | Muestra lo que está haciendo MySQL (Ctrl+C para salir) |
| `docker compose stop` | Apaga los contenedores sin borrar nada |
| `docker compose start` | Los vuelve a encender |
| `docker compose down` | Apaga y elimina los contenedores. **Los datos se conservan** |

Un comando que conviene conocer y no usar por accidente:

```powershell
docker compose down -v
```

La `-v` borra también el volumen, es decir, **todos los datos de la base**. Solo se usa
cuando se quiere empezar de cero a propósito.

---

## 4. Preparar el backend (solo la primera vez)

### 4.1 Variables de entorno

```powershell
cd backend
copy .env.example .env
```

Abra `backend\.env` y complete:

- **`DATABASE_URL`**: sustituya `CONTRASENA_DEL_ENV_RAIZ` por la contraseña que tiene
  `MYSQL_PASSWORD` en el `.env` de la raíz. El puerto es **3307**, no 3306, porque así
  se publicó el contenedor.
- **`JWT_SECRETO`**: genere una cadena larga y péguela ahí:

  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- **`SEED_ADMIN_CONTRASENA`**: la contraseña temporal del Súper Administrador. Si la
  deja vacía, el sistema genera una al azar y la imprime una sola vez.

### 4.2 Instalar y preparar la base

Siempre dentro de `backend`:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate -- --name inicial
npm run db:seed
```

Qué hace cada uno:

1. **`npm install`** baja las librerías del proyecto.
2. **`prisma:generate`** lee `prisma/schema.prisma` y genera el cliente de Prisma, que
   es el código con el que el backend consulta la base. Se vuelve a correr cada vez que
   cambia el esquema.
3. **`prisma:migrate`** compara el esquema con la base de datos, escribe el SQL de los
   cambios en `prisma/migrations` y lo aplica. Ese historial de migraciones es lo que
   permite que cualquier persona levante la base idéntica.
4. **`db:seed`** carga los datos base: los 19 permisos, los cinco roles de sistema, los
   regímenes de vacaciones, los tipos de documento y la cuenta del Súper Administrador.

> El seed **no** carga funcionarios, departamentos ni puestos. Esa carga inicial la hace
> la Municipalidad desde el sistema.

### 4.3 Arrancar la API

```powershell
npm run dev
```

Abra `http://localhost:3000/api/salud` en el navegador. Debe responder algo así:

```json
{ "sistema": "SIGEL", "estado": "operativo", "baseDeDatos": "conectada" }
```

Si dice `no disponible`, la API está bien pero no alcanza la base: revise que el
contenedor esté arriba y que la contraseña y el puerto de `DATABASE_URL` sean correctos.

### 4.4 Ver los datos

```powershell
npm run prisma:studio
```

Abre una ventana en el navegador donde se pueden ver y editar las tablas. Es la forma
más cómoda de comprobar que el seed cargó bien.

---

## 5. El día a día

```powershell
docker compose up -d     # en la raíz, una vez al día
cd backend
npm run dev              # y a programar
```

Cuando cambie `prisma/schema.prisma`:

```powershell
npm run prisma:migrate -- --name lo_que_cambio
npm run prisma:generate
```

Si la base de desarrollo queda enredada y quiere empezar limpio:

```powershell
npm run db:reset
```

Borra los datos, vuelve a aplicar todas las migraciones y corre el seed. **Nunca** se
usa contra la base de la Municipalidad.

---

## 6. Estructura del repositorio

```
SIGEL\
├── docker-compose.yml      receta de los contenedores
├── .env                    credenciales de MySQL (no se sube)
├── backend\                API en NestJS
│   ├── prisma\
│   │   ├── schema.prisma   el modelo de datos
│   │   ├── migrations\     historial de cambios de la base
│   │   └── seed.ts         datos base
│   ├── src\
│   │   ├── main.ts         arranque de la API
│   │   ├── app.module.ts   módulo raíz
│   │   ├── prisma\         conexión a la base
│   │   └── salud\          endpoint de comprobación
│   └── generated\          cliente de Prisma (se genera, no se sube)
├── frontend\               React + Vite (siguiente paso)
└── docs\                   documentación del proyecto
```

---

## 7. Convenciones que no se rompen

- Nombres en **español y camelCase**: variables, funciones, clases, tablas, columnas y
  endpoints.
- **UUID** como identificador público en todas las tablas.
- **Baja lógica**, nunca borrado físico, en la información con historial.
- Los archivos del expediente **no** se guardan en MySQL: se copian al servidor de
  archivos y la base guarda la ruta.
- Cada funcionalidad se protege con un permiso `modulo.accion` verificado **en el
  backend**. La validación del frontend nunca es suficiente.
- Las contraseñas se guardan con **Argon2id** y jamás se registran en la bitácora ni en
  los logs.

---

## 8. Ramas del repositorio

| Rama | Para qué |
|---|---|
| `main` | SIGEL completo, para la Municipalidad de Palmares |
| `piscinas` | Se creará a partir de `main` cuando el expediente esté terminado, sin el módulo de Talent Pool, para adaptarlo al proyecto de las piscinas municipales |

La idea es terminar primero todo lo del expediente, sacar la rama `piscinas` desde ahí y
seguir con el Talent Pool en `main`.

---

## 9. Problemas comunes

| Síntoma | Qué revisar |
|---|---|
| `docker: command not found` | Docker Desktop no está abierto o no está instalado |
| `port is already allocated` | Algo más usa el puerto 3307. Cambie el puerto en `docker-compose.yml` y en `DATABASE_URL` |
| `Access denied for user 'sigel'` | La contraseña de `DATABASE_URL` no coincide con la del `.env` de la raíz |
| `Can't reach database server at localhost:3307` | El contenedor está apagado: `docker compose up -d` |
| `Environment variable not found: DATABASE_URL` | Falta `backend\.env` o está incompleto |
| Error al generar el cliente de Prisma | Corra `npm run prisma:generate` de nuevo; si persiste, borre `backend\generated` y repita |
