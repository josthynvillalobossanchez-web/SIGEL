# Guía de desarrollo de SINERGIA

Esta guía explica cómo dejar el proyecto corriendo en su máquina y qué hace cada
comando. Está escrita para quien nunca ha usado Docker.

**Última actualización:** 17 de setiembre de 2026 · Sprint 1 en curso

---

## 1. La idea general

SINERGIA tiene tres piezas:

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
SINERGIA con un solo comando.

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
- **`ARCHIVOS_LLAVE`**: la llave que cifra los documentos y fotografías. **Sin ella el backend
  no arranca.** Se genera una vez con `npm run archivos:generar-llave` (imprime una línea
  lista para pegar en el `.env`). Léase la sección 10.6 antes de usarla en el servidor.

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
{ "sistema": "SINERGIA", "estado": "operativo", "baseDeDatos": "conectada" }
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
│       ├── almacenamiento\ cifrado AES-256-GCM, validación y guardado de archivos
│       ├── autenticacion\  login, sesión, permisos y contraseñas
│       ├── bitacora\       registro de auditoría
│       ├── comun\          piezas compartidas: paginación, errores, IP, validación de ids
│       ├── correo\         salida de correo del sistema
│       ├── documentos\     documentos del expediente y fotografía de perfil
│       ├── permisos\       catálogo de permisos
│       ├── prisma\         conexión a la base
│       ├── roles\          administración de roles
│       ├── salud\          endpoint de comprobación
│       ├── tipos-documento\ tipos de documento y sus formatos
│       ├── usuarios\       cuentas, su estado, sus roles y permisos individuales
│       └── generated\      cliente de Prisma (se genera, no se sube)
├── frontend\               React + Vite (ver §7d)
│   ├── index.html
│   ├── vite.config.ts      puerto 5173 y proxy de /api al backend
│   └── src\               api, sesion, diseno, paginas, componentes, estilos
└── docs\                   documentación del proyecto
    └── _trabajo\           respaldos y borradores, fuera de Git
```

---

## 7. Convenciones que no se rompen

- Nombres en **español y camelCase**: variables, funciones, clases, tablas, columnas y
  endpoints.
- **UUID** como identificador público en todas las tablas.
- **Nombres de persona y teléfonos** se validan con `backend/src/comun/validadores.ts`
  (`@NombreDePersona(campo, largo, palabras)` y `normalizarTelefono` + `TELEFONO_DE_COSTA_RICA`);
  en el frontend, lo mismo en `utilidades/texto.ts` (`problemaDeNombre`, `normalizarTelefono`).
  Todo campo de texto lleva `maxLength` igual al del backend.
- **Baja lógica**, nunca borrado físico, en la información con historial.
- Los archivos del expediente **no** se guardan en MySQL: se copian a
  `backend/archivos/` (`RUTA_ARCHIVOS`) y la base guarda la ruta.
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
| `POST /autenticacion/cerrar-sesion` | público | Revoca la sesión en el servidor y borra la cookie |
| `GET /autenticacion/mi-sesion` | con sesión | Datos de la cuenta, roles y permisos efectivos |
| `POST /autenticacion/cambiar-contrasena` | con sesión | Cambio propio y del primer ingreso |
| `POST /autenticacion/solicitar-recuperacion` | público | Envía un código de 6 dígitos al correo |
| `POST /autenticacion/restablecer-contrasena` | público | Cambia la contraseña con ese código |
| `GET /permisos` | `usuarios.ver` | Catálogo de permisos por módulo; cada uno trae `asignable` |
| `GET /bitacora` | `bitacora.ver` | Auditoría, paginada y con filtros |
| `GET /usuarios` | `usuarios.ver` | Lista de cuentas, con búsqueda y filtros por estado y rol |
| `GET /usuarios/:id` | `usuarios.ver` | Detalle de una cuenta con sus roles y permisos |
| `POST /usuarios` | `usuarios.crear` | Crea la cuenta de un funcionario |
| `PATCH /usuarios/:id/estado` | `usuarios.cambiarEstado` | Activa, inactiva o bloquea una cuenta |
| `PATCH /usuarios/:id` | `usuarios.editar` | Página "Editar usuario": `{ correo?, roles? }` (roles = lista completa). Todo junto o nada; avisa a los dos correos si cambia |
| `GET /mi-cuenta` | con sesión | Perfil propio: cuenta, ficha completa del funcionario (misma forma que `GET /funcionarios/:id`), profesiones, `puedeEditarDatos`, `puedeEditarLaborales` y `opcionesLaborales` (solo RRHH) |
| `PATCH /mi-cuenta/datos-personales` | `perfilPropio.editar` | Todo lo personal propio menos la cédula (nombre, apellidos, nacimiento, profesión, contacto) |
| `PATCH /mi-cuenta/datos-laborales` | `funcionarios.editar` | RRHH cambia SUS PROPIOS datos laborales (puesto, departamento, jefatura, nombramiento, régimen, ingreso, código) |
| `POST /usuarios/:id/roles` | `usuarios.editar` | Asigna un rol o cambia su vigencia. Cuerpo: `{ rolId, fechaVencimiento? }` |
| `DELETE /usuarios/:id/roles/:rolId` | `usuarios.editar` | Quita un rol (lo vence ahora; no borra la fila) |
| `PUT /usuarios/:id/permisos/:permisoId` | `usuarios.editar` | Permiso individual. Cuerpo: `{ otorgado, fechaVencimiento?, observacion? }` |
| `POST /usuarios/:id/permisos` | `usuarios.editar` | Varios a la vez: `{ permisoIds, otorgado, fechaVencimiento?, observacion }` (motivo obligatorio). Todo junto o nada |
| `DELETE /usuarios/:id/permisos/:permisoId` | `usuarios.editar` | Elimina el permiso individual (vuelve a lo del rol) |
| `GET /roles` | `usuarios.ver` | Roles, con `asignable` y `cantidadUsuarios` |
| `GET /roles/:id` | `usuarios.ver` | Detalle con sus permisos y `editable` |
| `POST /roles` | `roles.editar` | Crea un rol. Cuerpo: `{ nombre, descripcion?, permisoIds[] }` |
| `PATCH /roles/:id` | `roles.editar` | `{ nombre?, descripcion?, permisoIds? }`: todo junto o nada (página "Editar rol") |
| `PUT /roles/:id/permisos` | `roles.editar` | Reemplaza la lista completa: `{ permisoIds[] }` |
| `PATCH /roles/:id/estado` | `roles.editar` | Activa o inactiva: `{ activo }` |
| `GET /catalogos` | con sesión | `{ departamentos, puestos, profesiones }`; `?soloActivos=true` para los formularios |
| `GET /catalogos/:tipo` | con sesión | Un catálogo: `departamentos`, `puestos` o `profesiones` |
| `POST /catalogos/:tipo` | `catalogos.editar` | `{ nombre, descripcion? }` |
| `PATCH /catalogos/:tipo/:id` | `catalogos.editar` | `{ nombre?, descripcion? }` ("" quita la descripción) |
| `PATCH /catalogos/:tipo/:id/estado` | `catalogos.editar` | `{ activo }` |
| `GET /funcionarios` | `funcionarios.ver` | `?busqueda=&estado=activo&departamentoId=&pagina=&tamano=` |
| `GET /funcionarios/opciones` | `funcionarios.ver` | Listas activas para los formularios; `jefaturas` = solo quienes tienen el rol Aprobador permanente |
| `GET /funcionarios/:id` | `funcionarios.ver` | Ficha completa; fechas como `AAAA-MM-DD` |
| `POST /funcionarios` | `funcionarios.crear` | Datos personales, contacto y laborales; `cuenta?: { roles }` crea la cuenta en la misma transacción |
| `PATCH /funcionarios/:id` | `funcionarios.editar` | Solo lo que cambia (no `cedula` ni `estado`) |
| `POST /funcionarios/:id/salida` | `funcionarios.editar` | `{ fechaSalida, motivoSalida }` |
| `POST /funcionarios/:id/reingreso` | `funcionarios.editar` | `{ fechaIngreso }` |
| `GET /expedientes/propio` | `expediente.ver` | Expediente propio `{ funcionario, esPropio, tieneFoto }`; se anota en la bitácora |
| `GET /expedientes/:funcionarioId` | `expediente.ver` (+ `expediente.verTodos` si es de otra persona) | Abre un expediente; se anota en la bitácora |
| `GET /expedientes/:funcionarioId/historial` | igual | `?pagina=&tamano=`; movimientos `{ tipo, titulo, fechaEfectiva, cambios[{campo, antes, despues}], detalle, quien }` |
| `GET /expedientes/:funcionarioId/documentos` | `expediente.ver` (+ `expediente.verTodos` si es de otra persona) | `?pagina=&tamano=&busqueda=&tipoDocumentoId=&estado=vigentes\|bajas\|todos`. Cada documento trae `acciones` (qué puede hacer quien consulta y por qué no). `bajas`/`todos` solo con `documentos.restaurar`; para los demás se ignoran |
| `POST /expedientes/:funcionarioId/documentos` | `documentos.crear` | Subir (multipart: campo `archivo` + `tipoDocumentoId`, `titulo`, `descripcion?`, `fechaDocumento?`). Máximo 25 MB; PDF, JPG o PNG según el tipo |
| `GET /documentos/:id/archivo?modo=ver\|descargar` | `documentos.descargar` | Entrega el archivo ya descifrado (se anota `consultar` o `descargar` en la bitácora) |
| `PATCH /documentos/:id` | sesión (decide el servicio) | `{ titulo?, tipoDocumentoId?, descripcion?, fechaDocumento? }`; el archivo no se reemplaza. La persona edita lo que ella subió (`documentos.editarPropio`); RRHH cualquier documento manual (`documentos.editar`); los generados por SINERGIA solo se ven |
| `POST /documentos/:id/baja` | sesión (decide el servicio) | `{ motivo? }`. Baja lógica: `documentos.darDeBajaPropio` (lo que subió ella) o `documentos.darDeBaja` |
| `POST /documentos/:id/restauracion` | `documentos.restaurar` | Devuelve un documento dado de baja a vigente |
| `GET /funcionarios/:id/foto` | ella misma, `funcionarios.ver` o `usuarios.ver` | La fotografía (JPG o PNG); 404 `SIN_FOTOGRAFIA` si no tiene. Sin límite de peticiones por minuto (las listas piden una por fila). Las listas y fichas de funcionarios y de usuarios traen `tieneFoto`, nunca la ruta |
| `PUT /funcionarios/:id/foto` | ella misma (`perfilPropio.editar`) o `funcionarios.editar` | Multipart, campo `archivo`; JPG o PNG, máximo 5 MB. No se cambia la de una cuenta con más acceso |
| `DELETE /funcionarios/:id/foto` | igual | Quita la fotografía (el archivo anterior queda guardado en el servidor) |
| `GET /tipos-documento` | con sesión | `?soloActivos=&paraSubir=`; cada tipo trae `formatos[]`, `generadoPorSistema` y `cantidadDocumentos` |
| `POST /tipos-documento` | `tiposDocumento.editar` | `{ nombre, descripcion?, formatos[] }` (pdf, jpg, png; al menos uno) |
| `PATCH /tipos-documento/:id` | `tiposDocumento.editar` | Nombre, descripción y formatos; los tipos que genera SINERGIA solo cambian de nombre |
| `PATCH /tipos-documento/:id/estado` | `tiposDocumento.editar` | `{ activo }`; los tipos de SINERGIA no se inactivan |
| `GET /usuarios/funcionarios-disponibles?busqueda=` | `usuarios.crear` | Funcionarios activos sin cuenta, máximo 20 |

`GET /usuarios/:id` trae además `permisosEfectivos` (lo que la cuenta puede hacer de verdad),
`puedoModificar` y `motivoNoModificable` (`CUENTA_PROPIA` o `CUENTA_CON_MAYOR_ACCESO`) respecto
de quien consulta. La pantalla los usa para mostrar u ocultar botones.
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
| `CUENTA_CON_MAYOR_ACCESO` | Quiso modificar una cuenta, o editar / registrar salida o reingreso de un funcionario, con más permisos que la suya |
| `NO_PUEDE_MODIFICAR_SU_PROPIA_CUENTA` | Quiso cambiar su propio acceso |
| `FUNCIONARIO_YA_TIENE_CUENTA` / `CORREO_EN_USO` | Duplicados al crear una cuenta o cambiar el correo |
| `CORREO_SIN_CAMBIO` / `ROL_SIN_CAMBIO` / `PERMISO_SIN_CAMBIO` / `PERMISOS_SIN_CAMBIO` / `ESTADO_SIN_CAMBIO` | Se pidió dejar algo exactamente como ya estaba |
| `ROL_YA_ASIGNADO` | La cuenta ya tiene ese rol vigente con la misma fecha |
| `ROL_NO_ASIGNADO` / `PERMISO_INDIVIDUAL_NO_ASIGNADO` | Quiso quitar algo que la cuenta no tiene vigente |
| `ROL_NO_QUITABLE` | Quiso quitar un rol con permisos que él no tiene (regla 2) |
| `CUENTA_SIN_ROLES` | Quiso quitar el último rol; si no debe entrar, se inactiva la cuenta |
| `PERMISO_NO_ASIGNABLE` | Quiso dar o quitar un permiso que él no tiene (reglas 1, 2 y 5) |
| `FECHA_VENCIMIENTO_PASADA` | La fecha de vencimiento ya pasó |
| `FECHA_NO_VALIDA` | La fecha no es "AAAA-MM-DD" o ese día no existe (31 de febrero) |
| `FECHA_VENCIMIENTO_MUY_LEJANA` | La fecha pasa de 5 años (usar permanente) |
| `PERMISO_REPETIDO` | Un mismo permiso viene dos veces en la lista |
| `CATALOGO_NO_EXISTE` | El `:tipo` no es departamentos, puestos ni profesiones (404) |
| `ELEMENTO_NO_ENCONTRADO` | No hay un departamento/puesto/profesión con ese id (404) |
| `NOMBRE_DUPLICADO` | Ya hay uno con ese nombre en ese catálogo (sin importar mayúsculas ni tildes) |
| `CEDULA_EN_USO` / `NUMERO_EMPLEADO_EN_USO` | Otro funcionario ya tiene esa cédula / ese código |
| `PUESTO_NO_VALIDO` / `DEPARTAMENTO_NO_VALIDO` / `REGIMEN_NO_VALIDO` | No existe o está inactivo |
| `JEFATURA_NO_VALIDA` / `JEFATURA_CICLICA` | Jefatura inactiva, inexistente, la misma persona o sin el rol Aprobador permanente / crearía un ciclo |
| `FECHA_NACIMIENTO_NO_VALIDA` / `FECHA_INGRESO_NO_VALIDA` / `FECHA_SALIDA_NO_VALIDA` | Fuera de rango (edad mínima 15, etc.) |
| `FUNCIONARIO_PROPIO` | Nadie edita su propio registro desde Funcionarios (se hace en Mi cuenta) ni registra su propia salida |
| `EXPEDIENTE_AJENO` | Quiso abrir el expediente de otra persona sin `expediente.verTodos` (solo RRHH) |
| `FUNCIONARIO_YA_INACTIVO` / `FUNCIONARIO_YA_ACTIVO` | La salida o el reingreso ya estaban registrados |
| `FUNCIONARIO_CON_PERSONAL_A_CARGO` | Tiene subordinados: primero se les cambia la jefatura |
| `CUENTA_SIN_CORREO_INSTITUCIONAL` | Se pidió crear la cuenta sin correo institucional |
| `ROL_DE_SISTEMA` | Los 5 roles de sistema no se modifican desde la API |
| `ROL_CON_MAYOR_ACCESO` | Quiso modificar un rol con permisos que él no tiene |
| `ROL_PROPIO` | Quiso cambiar permisos o estado de un rol que él mismo tiene (regla 4) |
| `ROL_EN_USO` | Quiso inactivar un rol que alguien tiene vigente; trae `cantidadUsuarios` |
| `ROL_DUPLICADO` | Ya hay un rol con ese nombre (sin importar mayúsculas ni tildes) |
| `CUENTA_SIN_ROL_PERMANENTE` | La cuenta quedaría sin ningún rol permanente (sin fecha) |
| `SIN_CAMBIOS` | Se pidió guardar algo exactamente igual a como está |
| `ARCHIVO_REQUERIDO` / `ARCHIVO_VACIO` | No vino archivo, o vino vacío |
| `ARCHIVO_DEMASIADO_GRANDE` (413) | Pasa de 25 MB (documento) o 5 MB (fotografía) |
| `FORMATO_NO_PERMITIDO` / `FORMATO_NO_PERMITIDO_PARA_TIPO` (415) | Extensión que no es PDF/JPG/PNG, o que ese tipo de documento no acepta |
| `MIME_NO_COINCIDE` / `CONTENIDO_NO_COINCIDE` | El tipo declarado no corresponde a la extensión, o el contenido real no es lo que dice el nombre |
| `ARCHIVO_NO_DISPONIBLE` | El archivo no está en el disco o no pasó la verificación de integridad (se entrega nada) |
| `DOCUMENTO_NO_ENCONTRADO` / `DOCUMENTO_NO_EDITABLE` / `DOCUMENTO_VIGENTE` | No existe (o está en baja y quien consulta no puede verlo) / no puede editarlo / ya está vigente |
| `BAJA_NO_PERMITIDA` | No puede dar de baja ese documento (lo subió otra persona, lo generó SINERGIA o ya está en baja) |
| `TIPO_DOCUMENTO_INVALIDO` / `TIPO_DOCUMENTO_INACTIVO` / `TIPO_GENERADO_POR_SISTEMA` / `TIPO_NO_ACEPTA_EL_FORMATO` | Tipo inexistente / inactivo / lo genera SINERGIA y no se elige a mano / no acepta el formato del archivo |
| `TIPO_DOCUMENTO_NO_ENCONTRADO` / `TIPO_DE_SISTEMA` | No existe ese tipo / se quiso cambiar o inactivar un tipo que genera SINERGIA |
| `SIN_FOTOGRAFIA` / `CUENTA_CON_MAYOR_ACCESO` | La persona no tiene foto / no se cambia la foto de una cuenta con más acceso |
| `CUENTA_SIN_FUNCIONARIO` / `CORREO_INSTITUCIONAL_EN_USO` | Mi cuenta: cuenta técnica sin datos personales / correo de otra persona |

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

**Fechas de vencimiento.** Si se envía solo la fecha (`"2026-10-31"`), vale hasta el final
de ese día en hora de Costa Rica. Si se envía con hora, se respeta. Lo hace
`src/comun/fechas.ts`; no usar `new Date("2026-10-31")` directo, que en Costa Rica
corta el día anterior a las 6 p. m.

**Roles de sistema.** Los cinco roles que crea el seed no se modifican desde la API
(`ROL_DE_SISTEMA`): el seed los vuelve a completar cada vez que corre, así que un
cambio hecho desde la aplicación se perdería sin avisar. Para otra combinación de
permisos se crea un rol nuevo. Los roles no se borran: se inactivan, y solo si nadie
los tiene vigentes.

**Cuidado al agregar permisos nuevos.** Si en un sprint futuro se le agrega un permiso
al rol Aprobador (por ejemplo `vacaciones.aprobar`), **hay que agregárselo también al
rol Administrador** en el seed. Si no, por la regla 1, RRHH dejaría de poder asignar
el rol Aprobador, que es justo lo que necesita para cubrir una ausencia.

---

## 7d. Frontend

Vive en `frontend/`. React 19 + Vite 8 + TypeScript + React Router 8.

**Primera vez:**

```
cd frontend
npm install
```

**Día a día** (con Docker y el backend ya corriendo en otra terminal, `npm run dev` en `backend/`):

```
cd frontend
npm run dev
```

y abrir `http://localhost:5173`. Vite reenvía todo lo que empiece con `/api` al backend
(`vite.config.ts`), así que la cookie de sesión funciona sin configurar CORS.

Otros comandos: `npm run revisar-tipos` (TypeScript sin compilar) y `npm run build`
(genera `frontend/dist/`, que en producción sirve el propio backend en el mismo dominio
que `/api`; ver la sección 10).

**Cómo está organizado `src/`:**

| Carpeta | Qué tiene |
|---|---|
| `api/` | Las llamadas al backend. `cliente.ts` es la única puerta: manda la cookie, convierte errores en `ErrorDeApi` (con `codigo`) y avisa si la sesión venció |
| `sesion/` | `SesionProveedor` (quién está conectado, sus permisos) y las guardias de rutas |
| `diseno/` | El marco (barra superior + menú) y `menu.ts`, la lista de opciones con sus permisos |
| `paginas/` | Una carpeta por módulo |
| `componentes/` | Piezas reutilizables (ver la tabla de abajo) |
| `estilos/` | `sigel.css` es **copia del prototipo** (no tocar salvo para mantenerlo igual); lo propio va en `ajustes.css` |
| `utilidades/` | Hooks propios (`useConsulta`, `useFormularioDeCambios`, `useBusquedaDiferida`, `useParametrosEnUrl`, `useTema`), `validaciones.ts` (reglas de datos iguales al backend), política de contraseñas, textos y fechas en hora de Costa Rica |

**Regla de pantallas**: consultar = **ventana** (con pestañas); crear o editar = **página
aparte por pasos** (`FormularioPorPasos`), con subsección en el menú (`diseno/menu.ts`) y migas.
Nada de páginas largas con scroll en PC.

**Pantallas que existen** (todas con sus permisos en `App.tsx` y `diseno/menu.ts`):

| Ruta | Permiso | Qué hace |
|---|---|---|
| `/iniciar-sesion`, `/recuperar-contrasena`, `/primer-ingreso` | sin sesión / temporal | Acceso |
| `/` | con sesión | Inicio: saludo, aviso de datos personales faltantes, resumen para RRHH (cifras que llevan a la lista filtrada) y accesos directos (los mismos del menú) |
| `/usuarios` (`?ver=<id>`, `?permisos=<id>`) | `usuarios.ver` | Lista; ventanas Ver usuario, Permisos individuales, Cambiar estado |
| `/usuarios/nuevo` | `usuarios.crear` | Crear usuario (Cuenta · Roles · Revisar) |
| `/usuarios/:id/editar` | `usuarios.editar` | Editar usuario (mismos pasos, se puede saltar entre ellos) |
| `/usuarios/:id/excepciones/nueva` | `usuarios.editar` | Agregar excepción (Qué hacer · Permisos · Duración y motivo · Revisar) |
| `/usuarios/:id/excepciones/:permisoId/editar` | `usuarios.editar` | Editar excepción |
| `/roles` (`?rol=<id>`, `?pestana=permisos`) | `usuarios.ver` | Pestañas Roles (tabla con acciones) y Catálogo; ventanas Ver rol y Activar/Inactivar |
| `/roles/nuevo`, `/roles/:id/editar` | `roles.editar` | Crear / Editar rol (Datos · Permisos · Revisar) |
| `/catalogos` (`?pestana=puestos`, `?estado=activos`) | `catalogos.editar` | Departamentos, puestos y profesiones; ventanas cortas de crear, editar e inactivar |
| `/funcionarios` (`?ver=<id>`, `?estado=`, `?departamento=`) | `funcionarios.ver` | Lista; ventanas Ficha resumida, Registrar salida, Registrar reingreso |
| `/funcionarios/nuevo`, `/funcionarios/:id/editar` | `funcionarios.crear` / `funcionarios.editar` | Registrar / Editar funcionario por pasos |
| `/funcionarios/:id/expediente`, `/mi-expediente` | `expediente.ver` | Expediente laboral (página propia: tiene cinco pestañas; la de Documentos lista, ve, descarga, edita, da de baja y restaura) |
| `/funcionarios/:id/expediente/documentos/nuevo`, `/mi-expediente/documentos/nuevo` | `expediente.ver` + `documentos.crear` | Subir documento por pasos (Tipo y archivo · Datos · Revisar) |
| `/tipos-documento` (`?estado=`) | `tiposDocumento.editar` | Tipos de documento y sus formatos; ventanas cortas de crear, editar e inactivar |
| `/mi-cuenta` | con sesión | Perfil; pestañas Mis datos personales (editable), Datos laborales (editable solo con `funcionarios.editar`) y Acceso y seguridad |

`/usuarios/:id` y `/roles/:id` (sin "editar") abren la ventana de consulta.

**Piezas para armar pantallas** (en `componentes/`):

| Pieza | Para qué |
|---|---|
| `FormularioPorPasos` | Página de edición del prototipo: migas, pasos, barra de progreso, "Paso 1 de 3", Cancelar/Anterior/Siguiente/Guardar. Revisa el paso antes de avanzar y todos antes de guardar |
| `Migas` | Migas de pan (`Usuarios › Ana › Editar usuario`) |
| `CambiosSinGuardar` | `useCambiosSinGuardar(hayCambios)` en la página; menú, migas y Cancelar preguntan antes de salir |
| `SelectorPorModulos` | Elegir permisos: módulos a la izquierda (con "2/4"), casillas a la derecha, buscador, "Marcar todos"; también de solo lectura |
| `CampoFechaDeVencimiento` | Fecha de vencimiento que detecta fechas incompletas y fuera de rango |
| `Modal` | Ventana del prototipo; foco atrapado, Escape, pie propio |
| `Pasos` | Indicador de pasos (en orden al crear, libre al editar) |
| `Pestanas` + `PanelDePestana` | Pestañas accesibles (flechas, Inicio, Fin) |
| `BotonIcono`, `BotonConAyuda` | Botones con ayuda y **bloqueo explicado** (`bloqueadoPor="motivo"`) |
| `ModalExito` | "Se hizo con éxito" + Aceptar (y la página vuelve a la lista) |
| `GestorDeAyudas` | Muestra el globo de cualquier elemento con `data-ayuda="texto"` |
| `TarjetaDePerfil` | Tarjeta con degradado (foto/iniciales, nombre, chips, acciones, datos rápidos): Mi cuenta y expediente |
| `Paginacion` | "Mostrando 1–20 de 57 …" y Anterior/Siguiente de las listas |
| `PieDeGuardado` | Pie Descartar / Guardar cambios de un formulario de edición en pestaña |
| `CamposDeFormulario` | `Texto` y `Lista` con etiqueta, obligatorio y ayuda |

**Hooks propios** (en `utilidades/`), para no repetir lógica en cada pantalla:

| Hook | Para qué |
|---|---|
| `useConsulta(pedir, deps)` | Pedir datos al abrir: `{ datos, error, cargando, recargar, cambiarDatos }`. Descarta respuestas viejas; `pedir = null` = no pedir (falta permiso) |
| `useFormularioDeCambios(original, { revisar, enviar, alGuardar })` | Formulario que edita y guarda solo lo que cambió (Mi cuenta) |
| `useBusquedaDiferida(busquedaEnUrl, alBuscar)` | Buscador que espera a que se deje de escribir y pasa el texto a la URL |
| `useParametrosEnUrl()` | Filtros en la URL sin perder cambios rápidos |

**Reglas de datos**: `utilidades/validaciones.ts` (nombres, teléfono, correos, cédula, edad mínima,
fechas de ingreso). Si una regla cambia, se cambia ahí y en el backend, nunca en la pantalla.

**Para hacer una página de edición nueva** (p. ej. "Registrar funcionario"):
1. Página con `FormularioPorPasos` (mirar `paginas/roles/PaginaRol.tsx`, es la más corta).
2. `useCambiosSinGuardar(hayCambios && !terminado)`.
3. Ruta en `App.tsx` con `<ConPermisos>` y subsección en `diseno/menu.ts` (`ruta` si es fija,
   `patron` si depende de un id).
4. Al guardar, `ModalExito` y Aceptar vuelve a la lista.

**Regla para botones**: no usar `title=""` ni `disabled` para explicar un bloqueo. Usar
`data-ayuda` (globo) y, si no se puede, `bloqueadoPor` en `BotonIcono`/`BotonConAyuda`: el botón
queda atenuado, no hace nada, y el globo y el lector de pantalla dicen por qué.

---

## 8. Ramas del repositorio

| Rama | Para qué |
|---|---|
| `main` | SINERGIA completo, para la Municipalidad de Palmares |
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

---

## 10. Despliegue en la VM Windows (servidor de la Municipalidad)

Lo que dijo Joseph el 30/09/2026, para no volver a preguntarlo:

| Tema | Respuesta |
|---|---|
| Servidor | Máquina virtual **Windows**. Se puede instalar **Docker**. |
| HTTPS | **Sí.** |
| Dominio | Un **subdominio dentro de munipalmares**, en esa misma VM, provisional al principio. Lo proponemos nosotros: **`sinergia.munipalmares.go.cr`**. |
| Proxy inverso | **No hay.** Nginx está instalado en la VM, pero no se usa. |
| Base de datos | Con **TLS**. |
| Bitácora | Solo se consulta en el sistema (no se exporta). Se conserva **mínimo 3 meses**. |
| Internet | Hay, en el servidor y en las computadoras. Sin internet no se entra a SINERGIA. |
| Correo | Una cuenta de **Gmail** que la Municipalidad ya usa para esto (sección 10.5). |

Por eso **SINERGIA se sirve solo**: el mismo proceso de Node atiende HTTPS, la API (`/api`) y la
interfaz compilada, todo en el mismo dominio (la cookie de sesión funciona sin CORS).

### 10.1 Carpetas que quedan en el servidor

| Carpeta | Qué guarda | Variable | En git |
|---|---|---|---|
| `backend/registros/` | Registros (logs): un archivo por día, `sigel-AAAA-MM-DD.log`, hora de Costa Rica. Nunca llevan contraseñas, códigos ni la `DATABASE_URL`. | `RUTA_REGISTROS` | No |
| `backend/contenido/` | Textos que se muestran tal cual, por ahora el consentimiento informado del Talent Pool (`consentimiento-talent-pool.txt`, borrador). Para cambiarlo se reemplaza el contenido del archivo. | — | Sí |
| `backend/archivos/` | Documentos del expediente y fotografías, **cifrados** (`expedientes/<id>/<uuid>.enc`, `fotos/<id>/<uuid>.enc`). Nunca se sirven como carpeta pública: la descarga pasa por el backend, que revisa el permiso y descifra. Sin la llave (sección 10.6) no se pueden abrir. | `RUTA_ARCHIVOS` | No |

SINERGIA **no borra nada** de estas carpetas. TI decide su respaldo (las dos) y, si quiere, la
limpieza de registros viejos. Las rutas relativas se cuentan desde `backend/`, así que el
backend siempre se arranca **desde esa carpeta**.

### 10.2 Base de datos (Docker + TLS)

MySQL corre en Docker igual que en desarrollo. Para TLS hace falta un certificado que traiga
el nombre del servidor (`127.0.0.1` y `localhost`). **El que MySQL genera solo al arrancar no
sirve**: no trae ese nombre y SINERGIA lo rechaza (probado el 30/09). Se genera así, en **Git Bash**,
dentro de la carpeta `SIGEL` (la variable `MSYS_NO_PATHCONV=1` evita que Git Bash cambie el
`/CN=`):

```bash
mkdir certificados-bd && cd certificados-bd
export MSYS_NO_PATHCONV=1
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=SINERGIA BD CA" -keyout ca-key.pem -out ca.pem
openssl req -newkey rsa:2048 -nodes -subj "/CN=127.0.0.1" -keyout server-key.pem -out server.csr
printf "subjectAltName=IP:127.0.0.1,DNS:localhost" > san.txt
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -days 825 -extfile san.txt -out server-cert.pem
openssl verify -CAfile ca.pem server-cert.pem      # debe decir: OK
```

`ca-key.pem` se guarda aparte, en un lugar seguro de TI (solo sirve para renovar). El
certificado del servidor vence en 825 días: se renueva repitiendo las tres últimas líneas.
Los `.pem` están en `.gitignore`.

Luego, en la raíz de `SIGEL`, un archivo **`docker-compose.override.yml`** (solo existe en el
servidor, también en `.gitignore`):

```yaml
services:
  mysql:
    ports: !override
      - "127.0.0.1:3307:3306"          # la base solo se ve desde la propia VM
    volumes:
      - ./certificados-bd/ca.pem:/etc/mysql/certs/ca.pem:ro
      - ./certificados-bd/server-cert.pem:/etc/mysql/certs/server-cert.pem:ro
      - ./certificados-bd/server-key.pem:/etc/mysql/certs/server-key.pem:ro
    command:
      - --ssl-ca=/etc/mysql/certs/ca.pem
      - --ssl-cert=/etc/mysql/certs/server-cert.pem
      - --ssl-key=/etc/mysql/certs/server-key.pem
      - --require-secure-transport=ON  # rechaza cualquier conexion sin cifrar
```

`docker compose up -d` lo toma solo (`!override` necesita Docker Compose 2.24 o más nuevo).

### 10.3 Variables del `.env` del servidor

Se parte de `backend/.env.example`. Además de lo de la sección 4.1, en el servidor:

| Variable | Valor en el servidor |
|---|---|
| `PUERTO` | `443` |
| `CERTIFICADO_HTTPS` / `LLAVE_HTTPS` | Rutas a los `.pem` del certificado del subdominio que dé TI. Si TI lo entrega en `.pfx`, se convierte con `openssl pkcs12`. |
| `ORIGEN_FRONTEND` | `https://sinergia.munipalmares.go.cr` (o el subdominio que quede) |
| `RUTA_FRONTEND` | `../frontend/dist` |
| `COOKIE_SEGURA` | `true` |
| `BD_TLS` | `true` |
| `BD_TLS_CA` | Ruta al `certificados-bd/ca.pem` de la sección 10.2 |
| `RUTA_ARCHIVOS` / `RUTA_REGISTROS` | Se dejan como vienen (`./archivos`, `./registros`) |
| `ARCHIVOS_LLAVE` | **Obligatoria.** La llave de cifrado de documentos y fotografías (sección 10.6). Una distinta a la de desarrollo, generada en el servidor |
| `SEED_ADMIN_CONTRASENA` | **Vacía**: la semilla genera una al azar, se anota una sola vez y se cambia al entrar |
| `JWT_SECRETO` | Uno nuevo, distinto al de desarrollo |
| `CORREO_*` | Ver sección 10.5 |

### 10.4 Compilar y arrancar

```powershell
docker compose up -d
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy        # aplica las migraciones sin borrar datos
npm run db:seed                  # solo la primera vez y cuando cambian permisos
npm run build
cd ..\frontend
npm ci
npm run build                    # genera frontend\dist
cd ..\backend
npm run start:prod               # SINERGIA queda en https://<subdominio>
```

Al arrancar, los registros dicen la dirección (`https://...`), de qué carpeta sirve la
interfaz y dónde quedan los registros. Antes de arrancar, revisar que nada más use el puerto
443 (`netstat -ano | findstr :443`): ni IIS ni el Nginx instalado.

Mientras se dockerizan frontend y backend (queda para el final, ver CONTEXTO §2), TI deja el
proceso corriendo como servicio de Windows con la herramienta que prefiera.

### 10.5 Correo (cuenta de Gmail)

Joseph dio acceso a la cuenta de Gmail que la Municipalidad usa para enviar correos. SINERGIA la
usa por SMTP. Gmail **no acepta la contraseña normal** de la cuenta para esto: hay que crear una
**contraseña de aplicación** (una sola vez):

1. Entrar a la cuenta de Gmail → *Gestionar tu cuenta de Google* → *Seguridad* y activar la
   **verificación en dos pasos** (si no está).
2. En la misma cuenta, abrir *Contraseñas de aplicaciones* (`myaccount.google.com/apppasswords`),
   escribir `SINERGIA` como nombre y crearla. Google muestra **16 letras una sola vez**.
3. En `backend/.env` del servidor (nunca en otro lado):

   ```
   CORREO_TRANSPORTE=smtp
   CORREO_SERVIDOR=smtp.gmail.com
   CORREO_PUERTO=465
   CORREO_USUARIO=<la cuenta>@gmail.com
   CORREO_CONTRASENA=<las 16 letras, sin espacios>
   CORREO_NOMBRE_REMITENTE=SINERGIA - Municipalidad de Palmares
   ```

4. Reiniciar el backend. En los registros debe salir `Correo listo: smtp.gmail.com:465 como ...`.
   Si sale `No se pudo conectar con el correo`, el motivo viene al final (por ejemplo `535` =
   usuario o contraseña de aplicación incorrectos).

Tener en cuenta:

- Si alguien cambia la contraseña normal de la cuenta de Gmail, Google **anula** las contraseñas de
  aplicación: hay que crear otra y cambiarla en el `.env`.
- Una cuenta de Gmail normal tiene un límite diario de envíos (del orden de cientos). Para lo que
  manda SINERGIA (bienvenidas, códigos de recuperación, avisos) alcanza de sobra.
- En desarrollo se deja `CORREO_TRANSPORTE=consola`: nada sale, el mensaje se ve en la terminal.
- Los correos llevan contraseñas temporales y códigos: su contenido **nunca** se escribe en los
  registros, solo "Correo enviado a X: asunto".

### 10.6 Cifrado de documentos y fotografías (la llave)

Todo archivo que sube alguien (documentos del expediente y fotografías de perfil) se guarda
**cifrado** en `backend/archivos/` con AES-256-GCM. En la base de datos solo quedan la ruta
relativa, el hash SHA-256 del contenido y los datos del documento (título, tipo, tamaño...).
Quien copie la carpeta `archivos/` sin la llave solo se lleva datos ilegibles. Al descargar, el
backend revisa el permiso, descifra, comprueba el hash y entrega el archivo; cada ver y cada
descarga queda en la bitácora.

**La llave.** Es una línea en el `.env` del backend:

```
ARCHIVOS_LLAVE=<32 bytes en base64>
ARCHIVOS_LLAVE_VERSION=1
```

- Se genera **una sola vez** con `npm run archivos:generar-llave` (desde `backend`), que imprime
  la línea lista para pegar. Nunca se escribe a mano ni se reutiliza la de desarrollo.
- **Si el backend arranca sin llave, o con una que no mide exactamente 32 bytes, se detiene** y lo
  dice. Es a propósito: es mejor que no arranque a que guarde archivos sin cifrar.
- El `.env` no se sube a Git ni se manda por correo o chat.

**Copia aparte (muy importante).** **Si se pierde la llave, se pierden todos los documentos y
fotografías**: no hay forma de recuperarlos. Joseph / TI deben guardar una copia de esa línea
**fuera del servidor y fuera del respaldo de `archivos/`** (por ejemplo, en el gestor de
contraseñas de TI o en un sobre cerrado). Si la llave y los archivos están juntos en el mismo
respaldo, el cifrado deja de servir contra quien robe ese respaldo; si están separados, sirve.
Lo que TI respalda: la base de datos, `backend/archivos/` y, **por otro camino**, la llave.

**Cambiar la llave (rotación).** Se puede, sin perder lo anterior:

1. Generar una llave nueva.
2. En el `.env`: poner la nueva en `ARCHIVOS_LLAVE`, subir `ARCHIVOS_LLAVE_VERSION` (de 1 a 2) y
   agregar la vieja en `ARCHIVOS_LLAVES_ANTERIORES=1:<llave vieja en base64>`.
3. Los archivos nuevos se cifran con la versión 2 y los viejos siguen abriéndose con la 1 (cada
   archivo guarda con qué versión se cifró). Mientras haya archivos de la versión 1, **no se
   borra la llave vieja**.

Todavía **no existe** una herramienta que recifre los archivos viejos con la llave nueva (está
anotada en `docs/_trabajo/COSAS_POR_CORREGIR.md`).

**Qué protege y qué no.**

- Protege los archivos si alguien se lleva el disco, la carpeta `archivos/` o un respaldo de ella.
- Protege contra cambios en el disco: si alguien altera un archivo, o lo cambia de lugar, no se
  entrega y el error queda en los registros.
- **No** protege si alguien entra a la cuenta de una persona con permiso (verá lo que ella puede
  ver) ni si tiene acceso al servidor **y** al `.env` a la vez. Tampoco revisa virus: solo se
  aceptan PDF, JPG y PNG, y se comprueba que el contenido real sea de ese formato, pero un
  antivirus del servidor es decisión de TI.
- La foto anterior y los documentos dados de baja **no se borran** del disco (baja lógica).
