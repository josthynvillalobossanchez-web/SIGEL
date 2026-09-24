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

> **Si `npm install` avisa que bloqueó scripts de instalación.** npm ya no ejecuta los
> scripts de los paquetes sin permiso, y `argon2`, `prisma`, `@prisma/engines` y `esbuild`
> los necesitan. Apruébelos y vuelva a instalar:
>
> ```powershell
> npm install-scripts approve argon2
> npm install-scripts approve prisma
> npm install-scripts approve @prisma/engines
> npm install-scripts approve esbuild
> npm install
> ```
>
> No corra `npm audit fix --force`: cambia versiones mayores y rompe el proyecto.

> **Si `prisma:migrate` falla con el error P3014.** Para comparar el esquema, Prisma crea una
> base temporal aparte, la *shadow database*, y el usuario `sigel` necesita permiso para
> crearla. Entre al contenedor como root y otórguelo solo sobre esas bases temporales:
>
> ```powershell
> docker exec -it sigel-mysql mysql -u root -p
> ```
> ```sql
> GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db%`.* TO 'sigel'@'%';
> FLUSH PRIVILEGES;
> ```

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

### Datos de prueba

```powershell
npm run db:datos-de-prueba
```

Crea seis funcionarios ficticios (Ana, Bruno, Carla, Diego, Elena y Fabián Prueba, con
cédulas que empiezan en 9) y al final imprime sus identificadores y los de los roles, listos para copiar en
Postman. Se puede correr las veces que se quiera sin duplicar nada. **Se niega a correr
si la base no es local**, para que estos datos nunca lleguen a la de la Municipalidad.

Úselo en lugar de cargar filas a mano en Prisma Studio: Studio no genera los UUID
solo, y un funcionario con `id` inventado (por ejemplo `1`) no sirve, porque la API
rechaza cualquier identificador que no sea UUID.

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
│   └── src\
│       ├── main.ts         arranque de la API
│       ├── app.module.ts   módulo raíz
│       ├── autenticacion\  login, sesión, permisos y contraseñas
│       ├── bitacora\       registro de auditoría
│       ├── comun\          piezas compartidas: paginación, errores, IP, validación de ids
│       ├── correo\         salida de correo del sistema
│       ├── permisos\       catálogo de permisos
│       ├── prisma\         conexión a la base
│       ├── salud\          endpoint de comprobación
│       ├── usuarios\       cuentas de usuario y su estado
│       └── generated\      cliente de Prisma (se genera, no se sube)
├── frontend\               React + Vite (todavía no existe; se crea más adelante)
└── docs\                   documentación del proyecto
    └── _trabajo\           respaldos y borradores, fuera de Git
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
- Los **imports relativos llevan extensión `.js`**, aunque el archivo sea `.ts`. NestJS 12
  se distribuye como ESM y sin eso la compilación falla.
- El **controlador no contiene reglas de negocio**: recibe, deja que el DTO valide y llama
  al servicio. Toda la lógica vive en el servicio.
- Toda consulta de Prisma usa **`select` explícito**. Nunca se devuelve la entidad completa,
  para que datos como `contrasenaHash` no puedan escaparse por descuido.
- Toda lista que pueda crecer se **pagina** con `PaginacionDto`, con un tope de 100 registros
  por página que el cliente no puede aumentar.
- Los errores se lanzan con **código propio**:
  `throw new ForbiddenException({ codigo: 'SIN_PERMISO', message: '...' })`. El filtro global
  se encarga del formato; el frontend se guía por `codigo`, nunca por el texto del mensaje.
- Las operaciones importantes anotan en la **bitácora dentro de la misma transacción** que
  hace el cambio, para que no pueda quedar el cambio sin su rastro.
- Todo decorador de validación de un DTO lleva **su mensaje en español**
  (`@MaxLength(150, { message: '...' })`). Sin él, la librería responde en inglés.
- Los identificadores que vienen en la ruta se validan con **`uuidValido('cosa')`** de
  `comun/pipes/uuid.pipe.ts`, no con el `ParseUUIDPipe` de Nest a secas.
- **Ningún nombre de rol se escribe en el código.** La autorización compara permisos, nunca
  pregunta "¿es Súper Administrador?". Así, si se crea un rol nuevo desde el sistema, todo
  sigue funcionando sin tocar código (ver sección 7c).
- Las consultas que calculan acceso filtran las asignaciones vencidas con `soloVigentes()` y
  combinan roles y permisos con `resolverAcceso()`, ambos en
  `autenticacion/permisos-efectivos.ts`. No reescribir ese cálculo en otro lado.

---

## 7b. Endpoints disponibles

Todos cuelgan de `/api`. La API está **cerrada por omisión**: si un endpoint no
aparece marcado como público, exige sesión.

| Método y ruta | Acceso | Para qué |
|---|---|---|
| `POST /autenticacion/iniciar-sesion` | público | Inicia sesión y deja la cookie de sesión |
| `POST /autenticacion/cerrar-sesion` | público | Borra la cookie |
| `GET /autenticacion/mi-sesion` | con sesión | Datos de la cuenta, roles y permisos efectivos |
| `POST /autenticacion/cambiar-contrasena` | con sesión | Cambio propio y del primer ingreso |
| `POST /autenticacion/solicitar-recuperacion` | público | Envía un código de 6 dígitos al correo |
| `POST /autenticacion/restablecer-contrasena` | público | Cambia la contraseña con ese código |
| `GET /permisos` | `permisos.editar` | Catálogo de permisos agrupado por módulo |
| `GET /bitacora` | `bitacora.ver` | Auditoría, paginada y con filtros |
| `GET /usuarios` | `usuarios.ver` | Lista de cuentas, con búsqueda y filtros por estado y rol |
| `GET /usuarios/:id` | `usuarios.ver` | Detalle de una cuenta con sus roles y permisos |
| `POST /usuarios` | `usuarios.crear` | Crea la cuenta de un funcionario |
| `PATCH /usuarios/:id/estado` | `usuarios.cambiarEstado` | Activa, inactiva o bloquea una cuenta |
| `GET /salud` | público | Comprobación del servicio y de la base |

Ojo con `/usuarios/:id`: el `id` es el de la **cuenta**, no el del funcionario. Son dos
registros distintos: el funcionario es la persona, la cuenta es su acceso al sistema.

La sesión viaja en una cookie que el JavaScript de la página no puede leer, así que
Postman y el navegador la manejan solos: basta con iniciar sesión una vez.

Códigos de error más frecuentes:

| Código | Qué significa |
|---|---|
| `CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos (no distingue cuál, a propósito) |
| `CUENTA_BLOQUEADA_TEMPORALMENTE` | Tres intentos fallidos; trae `segundosRestantes` |
| `CUENTA_INACTIVA` | RRHH inactivó la cuenta |
| `CONTRASENA_TEMPORAL` | Debe cambiar la contraseña del primer ingreso antes de seguir |
| `SIN_SESION` | No hay sesión o expiró |
| `SIN_PERMISO` | Tiene sesión, pero no el permiso que exige el endpoint |
| `DATOS_INVALIDOS` | Falló la validación; el detalle por campo viene en `detalles` |
| `JSON_INVALIDO` | El cuerpo de la petición está mal escrito |
| `IDENTIFICADOR_INVALIDO` | El id de la ruta no tiene forma de UUID |
| `DEMASIADAS_PETICIONES` | Se pasó del límite de peticiones por IP |
| `ROL_NO_ASIGNABLE` | Quiso asignar un rol con permisos que él no tiene |
| `CUENTA_CON_MAYOR_ACCESO` | Quiso modificar una cuenta con más permisos que la suya |
| `NO_PUEDE_MODIFICAR_SU_PROPIA_CUENTA` | Quiso cambiar su propio acceso |
| `FUNCIONARIO_YA_TIENE_CUENTA` / `CORREO_EN_USO` | Duplicados al crear una cuenta |

---

## 7c. Cómo se reparte el acceso

Esta es la parte del sistema que más conviene entender antes de tocar código.

**Roles y permisos.** Cada operación del sistema exige un permiso con forma
`modulo.accion` (`usuarios.crear`, `bitacora.ver`...). Los permisos se agrupan en
**roles**, y cada cuenta tiene uno o varios roles. Además, a una cuenta se le pueden
dar **permisos individuales** que conceden algo que su rol no da, o quitan algo que
su rol sí da. El permiso individual siempre manda sobre el del rol.

**Quién puede repartir acceso.** Solo quien tiene `usuarios.editar`, que son el rol
Administrador (Recursos Humanos) y el Súper Administrador. Y aun así, bajo cinco reglas:

1. **Solo se da lo que se tiene.** Para asignar un rol hay que tener todos sus
   permisos; para conceder un permiso individual, hay que tenerlo.
2. **Solo se quita lo que se tiene**, con el mismo criterio.
3. **No se toca a quien tiene más acceso que uno.** Si la cuenta destino tiene algún
   permiso que quien actúa no tiene, no se le puede cambiar nada.
4. **Nadie cambia su propio acceso**: ni roles, ni permisos, ni estado.
5. **Al editar un rol, solo se le agregan permisos que uno tenga.**

En la práctica: RRHH puede dar los roles Administrador, Aprobador, Solicitante y
Consulta, pero no puede crear Súper Administradores ni tocar sus cuentas, porque ese
rol tiene permisos que RRHH no tiene (`bitacora.ver` y `permisos.editar`).

**Suplencias con fecha de vencimiento.** Toda asignación de rol o de permiso puede
llevar `fechaVencimiento`. Vacía, es permanente. Con fecha, **deja de contar sola**
ese día, sin que nadie tenga que acordarse de quitarla. Es lo que se usa cuando una
jefatura se incapacita y RRHH le da el rol Aprobador a otra persona hasta su regreso.
Las asignaciones vencidas no se borran: quedan como historia de quién tuvo qué acceso.

**Cuidado al agregar permisos nuevos.** Si en un sprint futuro se le agrega un permiso
al rol Aprobador (por ejemplo `vacaciones.aprobar`), **hay que agregárselo también al
rol Administrador** en el seed. Si no, por la regla 1, RRHH dejaría de poder asignar
el rol Aprobador, que es justo lo que necesita para cubrir una ausencia.

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
| `connect ECONNREFUSED ::1:3307` o la API tarda 10 s y devuelve 500 | En `DATABASE_URL` use `127.0.0.1` en lugar de `localhost`. Windows resuelve `localhost` como IPv6 y Docker publica el puerto solo en IPv4 |
| `RSA public key is not available client side` | Autenticación de MySQL 8. Lo resuelve `allowPublicKeyRetrieval` en `src/prisma/configuracion-conexion.ts`; si reaparece, revise que ese archivo exista y que el contenedor esté arriba |
| `Environment variable not found: DATABASE_URL` | Falta `backend\.env` o está incompleto |
| Error al generar el cliente de Prisma | Corra `npm run prisma:generate` de nuevo; si persiste, borre `backend\src\generated` y repita |
| `TS6059: File is not under rootDir` | El cliente de Prisma quedó fuera de `src`. El `output` del generador debe ser `../src/generated/prisma` |
| `P3014: could not create the shadow database` | Al usuario `sigel` le falta el permiso sobre `prisma_migrate_shadow_db%` (ver 4.2) |
| npm avisa que ignoró scripts de instalación | Apruebe `argon2`, `prisma`, `@prisma/engines` y `esbuild` (ver 4.2) |
| `ECONNRESET` o `EPERM` durante `npm install` | Cierre VS Code, pause OneDrive, borre `node_modules` y `package-lock.json`, corra `npm cache verify` y reinstale |
| `git push` responde `403 Permission denied` | Git se está autenticando con otra cuenta de GitHub. Esa cuenta debe ser colaboradora del repositorio |
| Se perdió la contraseña de una cuenta | `npm run contrasena:restablecer -- correo@munipalmares.go.cr`. Genera una nueva, la imprime una sola vez y obliga a cambiarla en el primer ingreso. **Nunca** comente validaciones del código para entrar |
