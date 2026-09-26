# SIGEL — Documento de contexto para continuar el proyecto en un chat nuevo

**Última actualización:** 16 de setiembre de 2026
**Archivo:** `C:\Users\josthyn\Documents\Proyectos\SIGEL\docs\CONTEXTO_SIGEL.md`

> Este documento existe para que un chat nuevo con Claude pueda retomar el proyecto sin tener
> que releer todo el historial. Léalo completo antes de tocar nada.

---

## 1. Quién es quién

| | |
|---|---|
| **Estudiante / desarrollador** | Josthyn Leonardo Villalobos Sánchez — cédula 02-0811-0118 |
| **Modalidad** | Práctica Profesional Supervisada |
| **Institución destino** | Municipalidad de Palmares, Costa Rica |
| **Supervisor** | Joseph Granda Vargas — Jefe del Departamento de Tecnologías de la Informática y Telecomunicaciones |
| **Equipo de TI de la Muni** | 2 personas. Toda decisión técnica se toma favoreciendo **mantenibilidad sobre elegancia**. |

**SIGEL** = *Sistema Integral de Gestión Laboral*. Sustituye el manejo en papel y Excel del
expediente laboral, vacaciones, incapacidades, horas extra y reclutamiento (Talent Pool).

---

## 2. Por dónde vamos

| Fase | Estado | Entregable |
|---|---|---|
| **0 · Modelado de base de datos** | ✅ Cerrada | `SIGEL_BaseDatos_v3.dbml` — 30 tablas, 12 enums, 51 referencias |
| **1 · Inventario de procesos** | ✅ Cerrada | Clasificación CONFIRMADO / PROPUESTA / PENDIENTE |
| **2 · Fichas de proceso** | ✅ Cerrada | `SIGEL_Analisis_Funcional.docx` — 42 fichas + matrices |
| **3 · Modelado de procesos** | ✅ Cerrada | `ModeladoDeProcesosSIGEL.docx` — 15 diagramas Mermaid renderizados |
| **4 · Prototipo navegable Sprint 1** | ✅ v4 **aprobada por Joseph sin correcciones** (16/09/2026) | Artifact `https://claude.ai/artifact/2GyUnheYmzPXqpzMaq8RM1` |
| **5 · Desarrollo del Sprint 1** | ▶ **Aquí estamos, en curso** | — |

> **Numeración de fases.** La tabla de arriba es la organización interna de trabajo con Claude.
> Para **cualquier entregable formal o académico** (informes, presentaciones) se usa **siempre** la
> numeración del *Perfil del Proyecto*: Fase 1 a Fase 4, Sprint 1, Sprint 2, Sprint 3, Fase 5 a Fase 8.

### Situación exacta hoy (25/09/2026)

- **Diseño cerrado.** Joseph aprobó el prototipo v4 del Sprint 1 sin correcciones el 16/09. Por el
  atraso del cronograma se decidió **no prototipar los Sprints 2 y 3**: se programan directo,
  tomando el Sprint 1 como referencia visual y reusando sus tokens y componentes.
- **Backend en marcha desde el 19/09**, versionado en GitHub (ver más abajo).
- **Autenticación terminada el 24/09. Backend de usuarios y roles terminado el 25/09**
  (épica 1 completa en backend, probada con 72 casos automáticos; ver "Estado del backend").
- **Frontend: épica 1 completa el 25/09 (noche)** en `frontend\` (React + Vite): acceso
  (login, recuperación, primer ingreso), usuarios (lista, crear, detalle con roles,
  suplencias, permisos individuales, estado y correo), roles y permisos (lista, crear,
  detalle, permisos, estado) y "Mi cuenta". **La épica 1 queda terminada de punta a punta.**
- **El Sprint 1 vencía el 25/09 según el cronograma y no está terminado**: faltan las épicas de
  funcionarios y de gestión documental. El
  reacomodo de fechas queda para conversarlo con Joseph.

### Lo que toca ahora, en orden

1. ~~Épica 1~~: terminada y en GitHub (commit `e860270`).
2. **Épica 2**, por partes completas (backend + pantallas + pruebas, un commit cada una):
   - ✔ **Catálogos** de departamentos, puestos y profesiones (27/09, commit `c05a357`).
   - ✔ **Funcionarios** (27/09): lista, ficha resumida, "Registrar funcionario" por pasos (con
     "crear también su cuenta"), "Editar funcionario", salida y reingreso.
   - **Expediente**: ficha con pestañas e historial laboral.
   - Enlaces entre módulos, inicio, menú y documentación.
3. **Épica 3**: tipos de documento, subir y descargar, baja lógica y restauración.
4. **Informe de Avance Intermedio** (`Proyectos\Informe_Avance_Intermedio_SIGEL.docx`): las
   capturas de Jira/GitHub, las minutas y el criterio de Joseph los aporta Josthyn.

**Pendientes externos**, que dependen de Joseph o de TI: confirmar que habrá HTTPS, los datos del
servidor de correo, y si la cuenta de Informática se asocia a Joseph.

### Entorno de desarrollo (armado el 17/09/2026)

- **Estrategia de Docker (fijada por Josthyn, no cambiarla):** MySQL 8.4 vive en Docker
  durante todo el desarrollo; React/Vite y NestJS corren localmente contra ese contenedor.
  Los sprints se desarrollan, prueban y versionan normalmente. **Cuando la arquitectura esté
  estable, antes de las pruebas finales y del despliegue**, se dockerizan frontend y backend
  para levantar todo SIGEL con Docker Compose. No agregar complejidad de Docker antes de eso.
- **Monorepo:** `SIGEL\backend\` (NestJS) y `SIGEL\frontend\` (React + Vite), un solo
  repositorio, para que TI lo mantenga en un solo lugar.
- **Versiones reales verificadas (setiembre 2026):** NestJS 12, Prisma 7.10, TypeScript 6,
  Vite 8, React 19. Ojo con dos cosas que cambiaron respecto a lo que uno esperaría:
  - **NestJS 12 se distribuye como ESM.** El backend está configurado como **ESM**
    (`"type": "module"`, `module`/`moduleResolution` = `nodenext`) y **los imports relativos
    llevan extensión `.js`** (`./app.module.js`). Sin eso, TypeScript 6 falla con TS1479.
    `@nestjs/schematics` 12 exige **TypeScript >= 6**, y las herramientas piden **Node
    >= 22.22.3** (o 24 LTS).
  - **Prisma 7** ya no lleva la URL en `schema.prisma`: usa **`prisma.config.ts`** en la raíz
    del backend, el generador es **`prisma-client`** con `output` obligatorio, y el cliente se
    genera como **código TypeScript**, así que tiene que quedar **dentro de `src`**:
    `backend/src/generated/prisma`. Si se deja fuera, `tsc` falla con **TS6059** porque el
    archivo queda afuera del `rootDir`. Se importa desde `../generated/prisma/client.js` en el
    código de `src`, y desde `../src/generated/prisma/client.js` en `prisma/seed.ts`. La conexión
    necesita el **driver adapter `@prisma/adapter-mariadb`** (sirve para MySQL) y `migrate dev`
    ya no corre `generate` ni `seed` automáticamente.
- **Verificación hecha (18 y 19/09/2026, en la máquina de Josthyn):** `tsc --noEmit` y
  `nest build` pasan, `prisma generate` produce el cliente, la migración
  `20260919022756_inicial` quedó aplicada sobre MySQL, el seed cargó permisos, roles,
  regímenes, tipos de documento y la cuenta del Súper Administrador, y `GET /api/salud`
  responde con la base conectada. Desde el entorno de Claude **no** se pueden correr
  `prisma generate` ni las migraciones (el proxy bloquea `binaries.prisma.sh`): esos comandos
  los corre siempre Josthyn en Windows.
- **Máquina de desarrollo:** Windows con Node 24.19.0. El contenedor se llama `sigel-mysql` y
  expone el puerto **3307**. Las credenciales de MySQL se regeneraron el 17/09 con
  `docker compose down -v` porque la contraseña anterior se había perdido; viven únicamente en
  los `.env`, que no se versionan.
- **Ramas:** `main` = SIGEL completo. Cuando el expediente esté terminado (antes del Talent
  Pool) se saca la rama **`piscinas`** desde `main`, sin Talent Pool, para el proyecto de las
  piscinas municipales.

### Estado del backend (Sprint 1)

**Cimientos (17–19/09):** estructura NestJS (ESM), `PrismaService` global con el adapter de
MariaDB, endpoint `GET /api/salud`, `schema.prisma` con las 15 tablas del Sprint 1 traducidas
del DBML v3 (incluye `usuarioBajaId`, `fechaBaja` y `motivoBaja` en `documento`), la migración
inicial aplicada y `prisma/seed.ts` cargando 19 permisos, los 5 roles de sistema, los 2
regímenes de vacaciones, los 6 tipos de documento y la cuenta del Súper Administrador con
contraseña temporal.

**Autenticación y seguridad (22–24/09), probado de punta a punta:**

- Inicio de sesión con verificación **Argon2id**, bloqueo de tres minutos a los tres intentos
  fallidos y límite de peticiones por dirección IP.
- La sesión viaja en una **cookie `httpOnly`, `Secure` y `SameSite=strict`**, no en
  `localStorage`. El token no lleva los permisos dentro: el guard los consulta en cada
  petición, de modo que un cambio de rol surte efecto de inmediato.
- **Guard de sesión global**: la API está cerrada por omisión y solo se abre lo marcado con
  `@Publico()`.
- **Guard de permisos** `modulo.accion`, con permisos individuales que pisan los del rol en
  los dos sentidos.
- **Cambio obligatorio de contraseña** en el primer ingreso: mientras no la cambie, la persona
  solo puede ver su sesión y cambiarla.
- **Recuperación por correo** con código de 6 dígitos, vigencia de 15 minutos y un solo uso,
  tal como lo muestra el prototipo aprobado.
- **Filtro global de errores**: toda respuesta de error sale con `statusCode`, `codigo` y
  `message`, sin trazas ni datos internos. El frontend se guía por `codigo`, nunca por el texto.
- **Bitácora** con consulta paginada y filtros, que ya audita los cambios de contraseña.
- **Salida de correo** centralizada: en desarrollo imprime en consola, a la espera de los datos
  del servidor de la Municipalidad.
- Comando `npm run contrasena:restablecer` para recuperar una cuenta desde la terminal.

**Usuarios y reparto de acceso (24–25/09), probado de punta a punta:**

- **Listar cuentas**, paginado, con búsqueda por correo, cédula, nombre o apellidos, y filtros por
  estado y por rol.
- **Detalle de una cuenta**, con sus roles y permisos individuales; cada uno trae su fecha de
  vencimiento y la marca `vigente`, así RRHH ve cuándo terminó una suplencia.
- **Crear la cuenta de un funcionario.** La contraseña temporal la genera el sistema, se envía por
  correo y se devuelve una sola vez en la respuesta; la cuenta queda obligada a cambiarla. Todo
  ocurre en una transacción junto con la anotación en bitácora. La pieza que crea la cuenta está
  separada para que el registro de funcionarios la reutilice.
- **Cambiar el estado** de una cuenta (activo, inactivo, bloqueado), con motivo obligatorio al
  inactivar o bloquear. El efecto es inmediato: la persona queda fuera en su siguiente petición.
- **Las cinco reglas de reparto de acceso aplicadas** en todos los endpoints de usuarios y roles
  (ver `GUIA_DESARROLLO.md` §7c).
- **Vencimiento de asignaciones** activo en todo cálculo de permisos: lo vencido deja de contar
  solo.
- Comando `npm run db:datos-de-prueba`, que crea seis funcionarios ficticios para probar.

**Cierre de usuarios y módulo de roles (25/09), probado con 72 casos automáticos:**

- **Editar el correo** de una cuenta, con aviso por correo a la dirección anterior y a la nueva.
- **Asignar un rol** a una cuenta existente, o cambiarle la vigencia (suplencias). Si lo tuvo y
  le venció, se reactiva la misma fila.
- **Quitar un rol**: no borra la fila, la vence "ahora". La cuenta no puede quedar sin roles
  (para eso se inactiva).
- **Permisos individuales**: conceder o quitar uno puntual, con vencimiento y observación, y
  eliminar la excepción para volver a lo que dan los roles.
- **Módulo de roles**: listar (con `asignable` para quien consulta y cuántas cuentas lo tienen
  vigente), detalle, crear, renombrar, reemplazar permisos y activar/inactivar.
- **Fechas de vencimiento**: `"2026-10-31"` significa hasta el final del 31 en hora de Costa
  Rica (antes se cortaba el 30 a las 6 p. m. por la zona horaria).

**Endpoints disponibles:**

| Método y ruta | Permiso | Para qué |
|---|---|---|
| `POST /api/autenticacion/iniciar-sesion` | público | Inicia sesión y deja la cookie |
| `POST /api/autenticacion/cerrar-sesion` | público | Borra la cookie |
| `GET /api/autenticacion/mi-sesion` | con sesión | Datos, roles y permisos efectivos |
| `POST /api/autenticacion/cambiar-contrasena` | con sesión | Cambio propio y del primer ingreso |
| `POST /api/autenticacion/solicitar-recuperacion` | público | Envía el código al correo |
| `POST /api/autenticacion/restablecer-contrasena` | público | Cambia la contraseña con el código |
| `GET /api/permisos` | `usuarios.ver` | Catálogo de permisos por módulo, con `asignable` |
| `GET /api/bitacora` | `bitacora.ver` | Auditoría, paginada y con filtros |
| `GET /api/usuarios` | `usuarios.ver` | Lista de cuentas con búsqueda y filtros |
| `GET /api/usuarios/:id` | `usuarios.ver` | Detalle con roles y permisos individuales |
| `POST /api/usuarios` | `usuarios.crear` | Crea la cuenta de un funcionario |
| `PATCH /api/usuarios/:id/estado` | `usuarios.cambiarEstado` | Activa, inactiva o bloquea |
| `PATCH /api/usuarios/:id` | `usuarios.editar` | Página "Editar usuario": correo y/o lista completa de roles, todo junto |
| `GET /api/mi-cuenta` | con sesión | Perfil propio para "Mi cuenta" |
| `PATCH /api/mi-cuenta/datos-personales` | `perfilPropio.editar` | La persona actualiza sus datos de contacto |
| `POST /api/usuarios/:id/roles` | `usuarios.editar` | Asigna un rol o cambia su vigencia |
| `DELETE /api/usuarios/:id/roles/:rolId` | `usuarios.editar` | Quita un rol (lo vence hoy) |
| `PUT /api/usuarios/:id/permisos/:permisoId` | `usuarios.editar` | Permiso individual (conceder o quitar) |
| `POST /api/usuarios/:id/permisos` | `usuarios.editar` | Página "Agregar excepción": varios permisos, misma fecha y motivo (obligatorio), todo junto |
| `DELETE /api/usuarios/:id/permisos/:permisoId` | `usuarios.editar` | Elimina el permiso individual |
| `GET /api/roles` | `usuarios.ver` | Lista de roles |
| `GET /api/roles/:id` | `usuarios.ver` | Detalle con sus permisos |
| `POST /api/roles` | `roles.editar` | Crea un rol |
| `PATCH /api/roles/:id` | `roles.editar` | Página "Editar rol": nombre, descripción y/o lista completa de permisos, todo junto |
| `PUT /api/roles/:id/permisos` | `roles.editar` | Reemplaza la lista de permisos |
| `PATCH /api/roles/:id/estado` | `roles.editar` | Activa o inactiva |
| `GET /api/catalogos` (`?soloActivos=true`) | con sesión | Departamentos, puestos y profesiones de una vez, con cuántos funcionarios activos usan cada uno |
| `GET /api/catalogos/:tipo` | con sesión | Uno solo (`departamentos`, `puestos` o `profesiones`) |
| `POST /api/catalogos/:tipo` | `catalogos.editar` | Crea (nombre único sin importar mayúsculas ni tildes) |
| `PATCH /api/catalogos/:tipo/:id` | `catalogos.editar` | Nombre y/o descripción |
| `PATCH /api/catalogos/:tipo/:id/estado` | `catalogos.editar` | Inactiva o reactiva (se puede aunque esté en uso) |
| `GET /api/funcionarios` | `funcionarios.ver` | Lista paginada; busca por cédula, nombre o correo (varias palabras), filtra por estado y departamento |
| `GET /api/funcionarios/opciones` | `funcionarios.ver` | Listas activas para los formularios (catálogos, regímenes, jefaturas, nombramientos) |
| `GET /api/funcionarios/:id` | `funcionarios.ver` | Ficha completa (no se audita; el expediente sí se auditará) |
| `POST /api/funcionarios` | `funcionarios.crear` | Registra; con `cuenta` crea también la cuenta (pide `usuarios.crear`), todo junto |
| `PATCH /api/funcionarios/:id` | `funcionarios.editar` | Corrige datos (no la cédula ni el estado) |
| `POST /api/funcionarios/:id/salida` | `funcionarios.editar` | Salida con fecha y motivo; inactiva su cuenta a la vez |
| `POST /api/funcionarios/:id/reingreso` | `funcionarios.editar` | Vuelve a quedar activo (la cuenta se reactiva aparte) |
| `GET /api/usuarios/funcionarios-disponibles` | `usuarios.crear` | Funcionarios activos sin cuenta (para crear una) |
| `GET /api/salud` | público | Comprobación del servicio |

**Falta en backend:** expediente, historial laboral y documentos.

### Estado del frontend (desde el 25/09)

Carpeta `frontend\`: React 19 + Vite 8 + TypeScript, React Router 8 (modo declarativo:
`BrowserRouter`/`Routes`). **Reusa el CSS del prototipo tal cual** (`src/estilos/sigel.css`, con
los mismos nombres de clase) y lo propio va en `src/estilos/ajustes.css`. En desarrollo, Vite
reenvía `/api` al backend (puerto 3000), así la cookie funciona sin CORS.

Hecho y probado en navegador (escritorio, celular, claro y oscuro):

- Inicio de sesión con los casos del backend: credenciales, bloqueo de 3 min con cuenta
  regresiva real (`segundosRestantes`), cuenta inactiva o bloqueada, límite de intentos, sin
  conexión.
- Recuperación en 3 pasos, primer ingreso obligatorio, lista de requisitos de contraseña en vivo.
- Marco con barra superior, menú lateral plegable (y menú de celular) que muestra solo lo que
  los permisos permiten; página "sin permiso" y "no encontrada".
- Sesión vencida: cualquier 401 lleva al login con aviso y, al volver a entrar, regresa a la
  página donde estaba. Después de "Salir" no (puede entrar otra persona).
- "Mi cuenta" (datos de acceso y cambio de contraseña) y la lista de usuarios con búsqueda,
  filtro de estado y paginación en la URL.

**Rehecho el 26/09 para ser fiel al prototipo** (pedido de Josthyn) y **ajustado el 26/09 en la
tarde** con la regla de abajo. Probado con 36 pasos automáticos en navegador (escritorio, celular,
claro y oscuro) y 125 casos contra la API.

**Regla de pantallas (Josthyn, 26/09):** lo que solo se **consulta** va en una **ventana**,
dividida en pestañas; lo que se **crea o edita** va en una **página aparte**, dividida en
**pasos** (sin bajar en PC), con su **subsección en el menú lateral** (p. ej. Usuarios → Editar
usuario) y migas de pan arriba. Siempre por encima de todo: la comodidad de la persona.

- **Usuarios** (`/usuarios`): la lista tiene la columna **Acciones** del prototipo (Editar usuario,
  Permisos individuales, Cambiar estado). Tocar una fila abre **Ver usuario** (ventana de solo
  lectura, pestañas Resumen / Roles / Permisos) con el botón "Editar usuario", que lleva a la
  página **Editar usuario** (`/usuarios/:id/editar`, pasos Cuenta · Roles · Revisar y guardar).
  **Crear usuario** es la página `/usuarios/nuevo` (mismos pasos, en orden). Al terminar, ventana
  "…con éxito" (con la contraseña temporal al crear) y **Aceptar** vuelve a la lista.
- **Permisos individuales**: la ventana muestra las excepciones vigentes (y deja eliminarlas).
  **Agregar excepción** es la página `/usuarios/:id/excepciones/nueva` en 4 pasos: Qué hacer (dar o
  quitar) · Permisos (módulos a la izquierda, casillas a la derecha, buscador) · Duración y motivo
  (motivo obligatorio) · Revisar (hoy / después). Se pueden dar o quitar **varios permisos a la
  vez** con la misma fecha y motivo. Editar una excepción: `/usuarios/:id/excepciones/:permisoId/editar`.
- **Roles y permisos** (`/roles`): pestañas **Roles** (tabla con acciones por fila: Editar rol y
  Activar/Inactivar; tocar la fila abre **Ver rol**, ventana con Resumen y Permisos por módulo) y
  **Catálogo de permisos** (consulta). **Crear rol** (`/roles/nuevo`) y **Editar rol**
  (`/roles/:id/editar`) son páginas en 3 pasos: Datos · Permisos (por módulo) · Revisar (lo que se
  agrega/quita y a cuántas cuentas afecta). Nombre, descripción y permisos se guardan juntos.
- **Vigencias**: cada rol o excepción es "Permanente" o "Hasta el [fecha]". Una fecha incompleta,
  pasada o a más de 5 años se marca en rojo y no deja avanzar (antes una fecha a medio escribir
  se guardaba como permanente). El backend también la rechaza.
- **Cambios sin guardar**: si la persona sale de una página de edición por el menú, las migas,
  Cancelar o "Salir", se le pregunta antes; al recargar o cerrar, avisa el navegador.
- **Mi cuenta** (`/mi-cuenta`): tarjeta de perfil con el degradado (iniciales si no hay foto),
  pestañas **Mis datos personales** (teléfono, correos, profesión, dirección; permiso
  `perfilPropio.editar`) y **Acceso y seguridad** (datos de acceso, roles, contraseña en ventana).
- **Acciones bloqueadas explicadas**: toda acción que no se puede queda atenuada y dice **por
  qué** al pasar el mouse, al llegar con Tab o al tocarla en el celular (globo de ayuda propio,
  `componentes/Ayudas.tsx`). Todos los botones de ícono dicen para qué sirven.
- **Accesibilidad**: ventanas con foco atrapado y devuelto al cerrar, Escape, pestañas y módulos
  con flechas, pasos con "Paso 1 de 3" y el foco en el título del paso nuevo, lectores de
  pantalla con el motivo de cada bloqueo, campos obligatorios marcados, errores ligados a su
  campo, avisos en regiones vivas.

**Catálogos de personal** (`/catalogos`, 27/09): pestañas Departamentos, Puestos y Profesiones
con el diseño de `pgTipos` del prototipo (tabla con Nombre, Descripción, Funcionarios, Estado y
Acciones). Crear, editar e inactivar/reactivar son **ventanas cortas** (uno o dos campos). Crear
tiene "Guardar y crear otro" para la carga inicial. Menú: grupo **Catálogos** del prototipo (ahí
irá también "Tipos de documento" en la épica 3).

Decisiones de catálogos: no se borran, se **inactivan**, y **sí** se pueden
inactivar aunque haya funcionarios con ellos (lo conservan, pero no se puede elegir para nadie más:
p. ej. un departamento que cierra). A diferencia de un rol, no le quita acceso a nadie. Las listas
las puede leer cualquiera con sesión (las usan los formularios); administrarlas pide
`catalogos.editar`. Los regímenes de vacaciones quedan para el Sprint 2.

**Funcionarios** (`/funcionarios`, 27/09): lista de `pgFuncionarios` con acciones por fila (ver
ficha, editar, registrar salida o reingreso, expediente); tocar la fila abre la **ficha
resumida** (`mdResumen`). **Registrar funcionario** (`/funcionarios/nuevo`) es la página por pasos
de `pgAltaFuncionario`: Datos personales · Contacto · Datos laborales · **Cuenta de acceso** ·
Revisar. **Editar funcionario** (`/funcionarios/:id/editar`), mismos pasos sin la cuenta. Salida y
reingreso son ventanas cortas. Menú: grupo **Personal** del prototipo.

Decisiones de funcionarios (27/09; se pueden revertir):
- **Cédula**: la nacional de 9 dígitos se guarda siempre `2-0678-0432` (con o sin guiones al
  escribir), para que la misma persona no quede dos veces; DIMEX o pasaporte, en mayúsculas.
  No se repite y **no se edita**.
- **Fechas**: edad mínima **15 años** (Código de Trabajo); ingreso después de cumplirlos, desde 1950
  y hasta un año hacia adelante. Las fechas de calendario viajan como `AAAA-MM-DD` (esto corrigió
  además "Mi cuenta", que mostraba la fecha de ingreso un día antes).
- **Obligatorios** (como el prototipo): cédula, nombre, primer apellido, correo personal, puesto,
  departamento, nombramiento, régimen y fecha de ingreso. Código de empleado opcional y único.
- **Jefatura**: un funcionario activo, distinto de la persona y **sin ciclos**. Sin jefatura = tope.
- **Cuenta desde el registro**: el correo de ingreso es el institucional; sin él, la casilla se
  bloquea y la cuenta se crea después desde Usuarios. Se propone el rol Solicitante.
- **Nadie edita su propio registro** ni registra su propia salida (los datos propios van en Mi cuenta).
- **Salida**: queda inactivo con fecha y motivo, **su cuenta se inactiva a la vez**. No se permite
  si tiene personal a cargo (primero se les cambia la jefatura) ni si su cuenta tiene más acceso
  que quien la registra (regla 3). **Reingreso**: vuelve a activo con nueva fecha de ingreso; la
  cuenta **no** se reactiva sola.
- Cada cambio va a la bitácora con el **antes y el después legibles** (nombre del puesto, no su id):
  de ahí saldrá el historial laboral.

Pendiente: expediente e historial laboral (épica 2) y la épica 3.

### Repositorio en GitHub (versionado el 19/09/2026)

- Remoto: `https://github.com/josthynvillalobossanchez-web/SIGEL.git`, rama `main`.
- El primer commit lleva los cimientos: el backend completo del Sprint 1 y toda la
  documentación vigente (contexto, DBML v3, los dos `.docx` de análisis, el prototipo y la
  guía de desarrollo).
- Fuera de Git por `.gitignore`: `node_modules`, `dist`, `backend/src/generated`, los `.env` y
  la carpeta **`docs\_trabajo\`**, que es donde van respaldos, borradores y material del curso.
  Lo que se deje ahí no sube a GitHub, así que nunca debe ser la única copia de nada.
- Se eliminaron las versiones históricas del DBML (`SIGEL_BaseDatos.dbml`, `_v2` y
  `_Extendido`): de aquí en adelante el historial de cambios lo lleva el propio repositorio.
- El repositorio pertenece a la cuenta `josthynvillalobossanchez-web`. La cuenta con la que
  Josthyn trabaja a diario se agregó como colaboradora para poder empujar; los commits quedan
  firmados con su correo institucional de la UNA.

### Stack tecnológico (definido)

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | NestJS + TypeScript, API REST |
| Base de datos | MySQL 8.4 con Prisma ORM y Prisma Migrations |
| Infraestructura | Docker + Docker Compose |
| Control de versiones | Git + GitHub |
| Gestión | Scrum, con Jira |

Arquitectura: `React + Vite + TS → API REST NestJS + TS → Prisma → MySQL 8.4`, todo ejecutable
con Docker Compose (`SIGEL\docker-compose.yml` ya levanta `mysql:8.4` en el puerto 3307).

Seguridad definida:

- **Argon2id** para el hash de contraseñas.
- **UUID** como identificadores públicos.
- Variables sensibles en **`.env`** (nunca en el repositorio; existe `.env.example`).
  Claude **no abre** `SIGEL\.env` ni toca `SIGEL\.git`.
- **Validación de DTOs** en el backend.
- Autenticación, autorización y **permisos granulares** por clave `modulo.accion`.
- **Validación segura de archivos**: PDF/JPG/PNG, máximo **25 MB**.
- **Auditoría** de acciones importantes (ver T-4).

> Ojo: el *Perfil del Proyecto* (31/07/2026) todavía dice backend en **Spring Boot (Java)**.
> Lo vigente es **NestJS**. Si se cita el perfil, contrastar.

---

## 3. Archivos del proyecto

Todo vive en `C:\Users\josthyn\Documents\Proyectos\SIGEL\docs\`

```
docs\
├── CONTEXTO_SIGEL.md               ← este archivo
├── GUIA_DESARROLLO.md              ← entorno de desarrollo: Docker, backend, ramas
├── SIGEL_BaseDatos_v3.dbml         ← BASE DE DATOS VIGENTE (30 tablas, 12 enums, 51 refs)
├── SIGEL_Analisis_Funcional.docx   ← 42 fichas de proceso + matrices
├── ModeladoDeProcesosSIGEL.docx    ← 15 diagramas de proceso renderizados
├── diseno\
│   ├── sigel-tokens.css            ← tokens de diseño documentados
│   ├── escudo.png
│   └── MuniLogo_principal.png
├── prototipo\                      ← FUENTES DEL PROTOTIPO (ver §4)
└── _trabajo\                       ← respaldos y borradores; fuera de Git (.gitignore)
```

Las versiones históricas del modelo de datos (`SIGEL_BaseDatos.dbml`, `_v2` y
`_Extendido`) se eliminaron el 19/09/2026, al versionar el proyecto en Git: de
aquí en adelante el historial de cambios lo lleva el propio repositorio.

Además, en `C:\Users\josthyn\Documents\Proyectos\` (raíz):

```
Proyectos\
├── Perfil_del_Proyecto_SIGEL.pdf          ← marco formal del curso (31/07/2026)
├── Documento_Requerimientos_SIGEL.docx    ← HISTÓRICO
├── Documento_Especificacion_SIGEL.docx    ← HISTÓRICO
├── HistoriasDeUsuario.SIGEL.docx          ← HISTÓRICO
└── SIGEL\                                 ← repositorio (README.md, docker-compose.yml, .env*, .git)
```

### Jerarquía de fuentes (de mayor a menor autoridad)

Los documentos **no** están todos igual de actualizados. Los tres `.docx` de la raíz y el PDF
del perfil se escribieron **antes** de redefinir buena parte del proyecto.

1. **`CONTEXTO_SIGEL.md`** — lo más reciente; manda en caso de duda.
2. **`SIGEL_BaseDatos_v3.dbml`** — el modelo de datos vigente.
3. **`SIGEL_Analisis_Funcional.docx`** (42 fichas) y **`ModeladoDeProcesosSIGEL.docx`**
   (15 diagramas) — la verdad funcional.
4. **`docs\prototipo\`** — la verdad visual y de interacción del Sprint 1.
5. **`Perfil_del_Proyecto_SIGEL.pdf`** — vigente **solo** para el marco formal: objetivos,
   justificación, alcance declarado, cronograma y sprints.
6. **`Documento_Requerimientos_SIGEL.docx`, `Documento_Especificacion_SIGEL.docx`,
   `HistoriasDeUsuario.SIGEL.docx`** — **históricos**. Sirven como referencia de redacción y para
   no perder requerimientos, pero **no** se citan como estado actual sin contrastarlos contra 1 a 4.

**Regla:** si un documento viejo contradice al CONTEXTO, al DBML v3 o a las fichas, **no se elige
por cuenta propia ni se corrige en silencio**. Se anota y se le reporta a Josthyn en una lista al
final, y él decide.

> ⚠️ **Los `.docx` no se editan ni se regeneran sin que Josthyn lo pida explícitamente.**
> Él los mantiene a mano. Regla que ya dio una vez y sigue vigente.

---

## 4. El prototipo: cómo está hecho y cómo se modifica

### Regla de oro

El prototipo se entrega como **un solo archivo** `prototipo.html` (~188 KB), pero
**ese archivo es generado, no se edita a mano**. Se arma a partir de fuentes modulares.

> Ya pasó una vez: se aplicaron correcciones directamente sobre `prototipo.html` y se
> perdieron todas al siguiente rearmado. **Editar siempre las fuentes.**

### Fuentes, en `docs\prototipo\`

| Archivo | Qué contiene |
|---|---|
| `base.css` | Tokens, base, barra superior, estructura, tarjetas, tablas, modales, adaptable |
| `extra.css` | Pantallas de acceso, formularios, encabezados, roles, paginación, perfil, pasos, v2/v3/v4 |
| `p_acceso.html` | Login, recuperar contraseña (3 pasos), primer ingreso |
| `p_shell.html` | Barra superior + franja de prototipo + barra lateral + tirador. Tiene el marcador `__PAGINAS__` |
| `pagina_expediente.html` | Expediente laboral: perfil, pestañas, documentos, info personal/laboral |
| `p_funcionarios.html` | Buscar funcionarios + registrar funcionario (asistente de 3 pasos) |
| `p_seguridad.html` | Usuarios, roles y permisos, tipos de documento, mi cuenta |
| `p_modales.html` | 11 modales (ver usuario, ficha resumida, crear/editar usuario, permisos, estado, subir documento, rol, permiso, tipo de documento, cambiar contraseña, baja de documento) |
| `app.js` | ~470 líneas: tema, ojo de contraseña, vistas de acceso, bloqueo a 3 intentos, navegación, barra lateral, pestañas, filtros reales, modales, asistentes, validación de cédula, búsqueda, cambio de rol RRHH/funcionaria |
| `armar.py` | Script que junta todo y produce `prototipo.html` |
| `m_blanca.txt`, `m_color.txt` | Logos de la Municipalidad en base64 (versión blanca para fondo oscuro, a color para fondo claro) |
| `medir.mjs` | Comprobación con Playwright: mide si cada pantalla cabe sin scroll a 1366×768, 1536×864 y 1920×1080 |

### Armar el prototipo

```bash
python3 armar.py      # lee las fuentes y escribe prototipo.html
node medir.mjs        # verifica que las pantallas quepan sin scroll
```

`armar.py` sustituye tres marcadores: `__PAGINAS__` en el shell, y `__LOGO__` /
`__LOGO_COLOR__` / `__LOGO_BLANCO__` por los base64 de los logos.

### Verificación visual

Se usa Playwright con el Chromium que ya viene en el entorno:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
```

Para ver una pantalla concreta sin pasar por el login:

```js
await p.evaluate(() => {
  document.querySelectorAll('.acceso').forEach(a => a.hidden = true);
  document.getElementById('app').removeAttribute('hidden');
  document.querySelectorAll('.pagina').forEach(s => s.hidden = (s.id !== 'pgAltaFuncionario'));
});
```

### Publicar

El prototipo vive en **un solo artifact** que se va actualizando por versiones:
`https://claude.ai/artifact/2GyUnheYmzPXqpzMaq8RM1` (va por la **Versión 4**).

Desde un chat nuevo hay que pasar esa URL como parámetro `url` al publicar, o se crea un
artifact distinto y se pierde el enlace que Josthyn ya tiene.

---

## 5. Diseño: decisiones que no se deben romper

- **Los tokens son variables CSS**, no clases de un framework. Es la única fuente de verdad;
  si más adelante se usa Tailwind, se mapea contra estas variables.
- **Tema en tres estados**: `:root` (claro) + `@media (prefers-color-scheme:dark)` protegido con
  `:root:not([data-theme="light"])` + `:root[data-theme="dark"]`. El botón de tema aparece en
  **todas** las pantallas, incluido el login.
- **Paleta clara**: azul marino `#1F3140` para la barra, verde oliva `#667306` para la acción.
- **Paleta oscura**: gris + dorado — `--superficie:#17191C`, `--card:#1F2226`, `--accion:#D4A03A`.
  Fue la que Josthyn escogió expresamente.
- **Contraste WCAG AA verificado por cálculo**, no a ojo. Ya se encontraron dos fallos reales así.
- `[hidden]{display:none!important}` es obligatorio: sin él, las reglas de clase con
  `display:flex/grid` le ganan al `[hidden]` del navegador y los permisos por rol dejan de ocultarse.
  Ya se rompió dos veces por esto.
- `--h-barra` y `--h-franja` son variables porque la barra mide distinto en móvil. Si se cambia el
  alto real de la barra superior o de la franja amarilla, **hay que actualizar la variable**, o
  toda pantalla se pasa del alto de la ventana aunque su contenido quepa.
- **Espacio vertical (v4)**: la mayoría de pantallas caben sin scroll en 1920×1080 y 1536×864.
  Solo la tabla de documentos y la rejilla de permisos hacen scroll en pantallas chicas, y eso
  está aceptado. Si se agregan bloques, medir con `medir.mjs` antes de dar por bueno.
- Instrucción textual de Josthyn: *"procura siempre con cada cambio que te digo hacerlo estético
  y bonito y pensar un poco en otras cosas"*. No implementar un pedido de forma literal si el
  resultado queda feo o desbalanceado.

---

## 6. Reglas de negocio confirmadas por Joseph

Estas ya están validadas. **Trátelas como verdad** salvo que Josthyn diga lo contrario.

### Reglas transversales

| Clave | Regla |
|---|---|
| **T-1** | Una sola jefatura aprueba cada solicitud. |
| **T-2** | Notificación bidireccional: se avisa al solicitante y al aprobador. |
| **T-3** | Vistas de calendario para vacaciones e incapacidades. |
| **T-4** | No se auditan las consultas… **salvo** abrir un expediente y abrir/descargar un documento, que sí se auditan siempre. |
| **T-5** | Autoservicio delimitado: el funcionario mantiene sus datos de contacto, nada más. |

### Decisiones puntuales

**Consultadas a Joseph el 23/09/2026:**

- **Dónde se guardan los archivos del expediente**: en una carpeta del propio backend, la que
  el equipo defina; no hay una ubicación impuesta por TI. Se configura con `RUTA_ARCHIVOS` en
  el `.env`, queda fuera de Git, se organiza por funcionario, el archivo se guarda con un
  nombre generado (no el original) y **nunca se sirve como carpeta pública**: la descarga pasa
  siempre por el backend, que verifica el permiso antes de entregar el archivo.
- **Envío de correos**: se hará desde una cuenta que ya tiene la Municipalidad, presumiblemente
  del dominio institucional. TI debe pasar servidor, puerto, cuenta, si exige TLS y si el
  dominio autoriza el envío desde una aplicación. Mientras tanto el envío queda detrás de una
  interfaz: en desarrollo el código se imprime en consola y en producción se enchufa el correo
  real sin tocar la lógica.
- **Carga inicial de datos**: la hace una persona de Recursos Humanos desde el sistema. El
  equipo de práctica, a lo sumo, registra funcionarios o usuarios como apoyo. Confirma que la
  semilla no debe crear funcionarios, departamentos ni puestos.
- **Historial laboral (Ficha 17)**: Joseph delegó el diseño. Se resuelve como pestaña de solo
  lectura, en línea de tiempo descendente, con los movimientos del funcionario: cambios de
  puesto, departamento, jornada, salario y régimen de vacaciones; el ingreso y la salida; y los
  documentos agregados o dados de baja en su expediente. Cada entrada muestra fecha, qué
  cambió, de qué valor a cuál y quién lo hizo. Se alimenta de `bitacoraCambio` filtrada por ese
  funcionario, sin tabla aparte. Si Joseph pide otra cosa, se ajusta.
- **Sesión sobre HTTPS (asumido, pendiente de confirmar)**: se programa asumiendo que SIGEL se
  sirve por HTTPS, aunque sea dentro de la red interna. Por lo tanto el token de sesión viaja
  en una **cookie `httpOnly`, `Secure` y `SameSite`**, no en `localStorage`, de modo que un XSS
  no pueda robarla. En desarrollo la marca `Secure` se apaga por `.env`, porque `localhost` no
  usa HTTPS. Si Joseph confirmara que no hay certificado, habría que rehacer el manejo de
  sesión completo.

**Decididas por Josthyn el 24/09/2026:**

- **Toda cuenta de usuario debe estar ligada a un funcionario.** Única excepción: la cuenta de
  Informática que crea la semilla (`informatica@munipalmares.go.cr`, Súper Administrador). Josthyn
  va a consultar si esa cuenta se asocia a Joseph; mientras tanto queda sin funcionario. Si aparece
  otra excepción, la indica él. Esto **contradice el prototipo aprobado**, que ofrece "Cuenta
  administrativa, sin expediente": queda para la v5 quitar esa opción.
- **Crear la cuenta desde el registro del funcionario.** El asistente de registro llevará una
  casilla para crear también la cuenta; funcionario y cuenta se crean en la misma transacción, o
  ninguno. El correo de la cuenta se toma del institucional del funcionario. El módulo de usuarios
  sigue existiendo para dar cuenta a un funcionario ya registrado.
- **Quién reparte acceso.** Solo quien tiene `usuarios.editar`, que en el catálogo sembrado son
  Administrador (Recursos Humanos) y Súper Administrador. Aprobador, Solicitante y Consulta no
  pueden dar ni quitar nada. Y quien sí puede, lo hace bajo cinco reglas:
  1. Solo se da lo que se tiene: asignar un rol exige tener todos sus permisos; conceder un
     permiso individual exige tenerlo.
  2. Solo se quita lo que se tiene, con el mismo criterio.
  3. No se toca a quien tiene más acceso que uno: si la cuenta tiene algún permiso que yo no
     tengo, no le puedo cambiar estado, roles ni permisos.
  4. Nadie cambia su propio acceso: ni roles, ni permisos, ni estado.
  5. Al editar un rol, solo se le agregan permisos que uno tenga.

  Resultado con el catálogo actual: RRHH puede asignar Administrador, Aprobador, Solicitante y
  Consulta, y conceder o quitar cualquier permiso salvo `bitacora.ver` y `permisos.editar`; no
  puede crear Súper Administradores. Ningún nombre de rol queda escrito en el código: si se crea
  un rol nuevo, la regla se aplica sola.
- **Suplencias con fecha de vencimiento.** Las asignaciones de rol y de permiso individual
  pueden tener `fechaVencimiento`. Vacía = permanente. Al vencer, dejan de contar solas, sin que
  nadie tenga que quitarlas; quedan en la base como historia. Caso de uso: una jefatura
  incapacitada y RRHH le da el rol Aprobador a otra persona hasta su regreso. Migración
  `20260924210839_vencimiento_asignaciones`.

**Decisiones anteriores:**

- **Vacaciones**: tope de 2 periodos acumulados, con avisos antes de llegar al tope.
  Solo días completos, nada de medios días.
- **Perfil propio (autoservicio, aclarado 16/09/2026)**: el funcionario edita sus **datos personales
  y de contacto**; cada cambio se **notifica a RRHH** y queda en bitácora. Los datos **laborales** los
  ve pero no los toca. RRHH (rol Administrador) y los administradores pueden editar todo.
- **Documentos propios en autoservicio (decisión 16/09/2026)**: el funcionario puede subir
  documentos a su expediente y, **solo sobre los que él mismo subió**, editar el título y el tipo y
  darlos de baja. Los que subió RRHH o que generó SIGEL solo los puede ver. Ver §9.
- **Tope de la jerarquía**: quien no tiene jefatura arriba, se autoaprueba.
- **Carga inicial de datos**: la hace la Municipalidad, no el sistema.
- **Accesos fallidos**: no se auditan.
- **Talent Pool**: sin cambios respecto a lo ya modelado.
- **Contratación desde Talent Pool**: crea el perfil del funcionario, crea el usuario y adjunta
  los documentos del candidato al expediente nuevo.
- **Cancelar una solicitud**: solo si la jefatura aún no la ha leído; si ya la leyó, se maneja por
  notas/observaciones.
- **Horas extra**: Joseph dijo *"trabajalo como lo más lógico que consideres tú"*. Sigue abierto.
- **Tipos de nombramiento**: 3 — en propiedad, interino, contratación por servicios.
- **Incapacidades**: `tipoIncapacidad` es tabla escalable (no enum). Ninguna incapacidad afecta
  el cálculo de vacaciones.
- **Estados de cuenta** (activa / inactiva / bloqueada): aprobados tal como están.
- **Número de empleado**: se contempla y se mantiene, aunque el PK sea UUID. Su formato no está
  definido todavía; se verá con Joseph después del Sprint 1. **No se menciona en el informe intermedio.**
- **Archivos (confirmado con Joseph)**: los documentos **no se guardan en la base de datos**. Al subir
  un archivo se crea una copia en el **servidor de la Municipalidad** y la BD guarda solo su ruta.
- **Correo**: la Municipalidad paga el dominio institucional, con formato `usuario@munipalmares.go.cr`
  (el de Joseph es `informatica@munipalmares.go.cr`). Si un funcionario no tiene correo
  institucional, se usa el personal — por eso el correo personal es obligatorio.
- **Feriados**: se cargan por año y son editables.
- **Cambio de jefatura**: mueve las solicitudes pendientes a la jefatura nueva.
- **Liquidación**: queda fuera del alcance de SIGEL.
- **Escalabilidad**: `profesion`, `tipoIncapacidad` y `regimenVacaciones` son tablas catálogo
  editables. `tipoSalida` e `institucion` quedan como texto plano.

### Decisiones del 25/09/2026 (tomadas al cerrar la épica 1; se pueden revertir)

- **Los roles de sistema no se editan desde la API** (ni nombre, ni descripción, ni permisos, ni
  estado): su contenido lo define `prisma/seed.ts`, que los vuelve a completar cada vez que corre;
  un cambio hecho desde la aplicación se desharía sin avisar. Para otra combinación de permisos se
  crea un rol nuevo. Si Joseph prefiere lo contrario, hay que cambiar el seed para que no pise.
- **Los roles no se borran, se inactivan**, y no se inactiva uno que alguien tiene vigente.
- **Nadie cambia los permisos ni el estado de un rol que él mismo tiene** (regla 4 aplicada a roles).
- **Una cuenta no puede quedar sin roles** al quitar el último: si ya no debe entrar, se inactiva.
- **El correo propio no se cambia desde la administración** (regla 4): "Mi cuenta" tendrá su
  flujo con código de verificación.
- **El catálogo de permisos lo ve quien tiene `usuarios.ver`** (antes pedía `permisos.editar`,
  que Administrador no tiene: RRHH no habría podido armar roles).
- **Vencimientos por día**: una fecha sin hora vale hasta las 23:59:59 de ese día en Costa Rica.

### Decisiones del 26/09/2026

- **Toda cuenta conserva al menos un rol PERMANENTE** (sin fecha de vencimiento). Se valida al
  crear, al editar, al cambiar la vigencia y al quitar un rol (`CUENTA_SIN_ROL_PERMANENTE`); si
  todos vencieran, llegaría el día en que la cuenta se queda sin acceso sin que nadie lo decida.
  Cada cambio de rol o de vigencia queda en la bitácora.
- **La cuenta propia no se edita desde Usuarios** (solo lectura): los datos personales se
  cambian en "Mi cuenta" con `perfilPropio.editar`; el acceso (roles, estado) lo cambia otra
  persona.
- **El catálogo de permisos es solo de consulta.** No hay "Crear permiso" (el prototipo lo tenía):
  un permiso sin código detrás no hace nada; cada permiso nace con su funcionalidad (seed).
- **Crear usuario no escribe contraseña**: la genera el sistema (el prototipo tenía el campo).
- **Consultar = ventana; crear o editar = página por pasos** con su subsección en el menú (ver
  "Frontend"). Cambiar estado (de una cuenta o de un rol) sigue en ventana: es una confirmación
  corta, no un formulario.
- **Vencimientos**: "Permanente" o "Hasta el [fecha]", explícito. La fecha va de hoy a **5 años**
  como máximo (más que eso es permanente, o un año mal escrito). `FECHA_NO_VALIDA`,
  `FECHA_VENCIMIENTO_PASADA`, `FECHA_VENCIMIENTO_MUY_LEJANA`.
- **Excepciones de permisos**: el motivo es obligatorio al agregarlas desde la página (queda en la
  bitácora). Se pueden hacer varias a la vez.

### Decisiones del 27/09/2026 (Josthyn)

- **Permiso `solicitudes.aprobar`**: lo tienen el rol **Aprobador** (las jefaturas),
  **Administrador** (RRHH: no para aprobar en el día a día, sino para poder asignar el rol
  Aprobador en una emergencia o al crear el funcionario, por la regla "solo se da lo que se
  tiene") y el Super Administrador. Se puede dar suelto como caso especial.
- **Jefatura inmediata = rol Aprobador PERMANENTE** (corregido el 28/09; no se decide por el
  permiso). Las suplencias con fecha no cuentan. Quien tiene solo el permiso suelto no es
  jefatura. La jefa de RRHH, para ser jefatura de su equipo, lleva también el rol Aprobador. En
  el formulario solo aparecen esas personas; el backend lo revisa (`JEFATURA_NO_VALIDA`).
- **Todo usuario puede hacer solicitudes** (`solicitudes.crear`, en el autoservicio de
  Solicitante; por lo tanto también en Aprobador y Administrador): vacaciones, permisos,
  incapacidades con comprobante, capacitaciones que chocan con el horario. Es la razón principal
  del sistema. Las pantallas llegan en el Sprint 2.
- **El Aprobador incluye todo lo del Solicitante** (es jefatura y también pide sus vacaciones).
- **Nombres realistas**: nombre hasta 50 caracteres y 5 palabras; cada apellido hasta 40 y 4
  palabras; solo letras, espacios, apóstrofo, guion y punto; no se acepta la misma letra 3 veces
  seguidas ("iiii"). Ningún nombre real cumple eso.
- **Teléfono de Costa Rica**: 8 dígitos; empieza en 2 o 4 (fijo), 5 (servicios especiales/IP) o
  6, 7, 8 (móvil). Se acepta con espacios, guion o +506 y se guarda como `8712-4408`.
- **Mi cuenta** muestra todo: tarjeta con la cuenta, pestaña de datos personales, pestaña de
  **datos laborales** y acceso. Pestañas centradas. (Quién edita qué: ver decisiones del 28/09.)
- **Menú**: las subsecciones fijas (Crear usuario, Crear rol…) se ven solo en la sección actual
  o si se despliegan con la flecha; al cambiar de sección se pliegan las otras. Las de contexto
  (Editar …) siguen apareciendo solo en su página. Las secciones nunca se ocultan.

### Decisiones del 28/09/2026 (Josthyn)

- **Datos personales propios**: cada quien (con `perfilPropio.editar`) cambia en Mi cuenta todo
  lo personal **menos la cédula** (nombre, apellidos, fecha de nacimiento, profesión, contacto).
  La cédula la corrige RRHH desde Funcionarios.
- **Datos laborales**: todos los VEN en Mi cuenta; solo quien tiene `funcionarios.editar` (RRHH)
  los cambia, **también los suyos, desde Mi cuenta** (no tiene sentido pedirle a otra persona de
  RRHH). Desde Funcionarios nadie edita su propio registro (`FUNCIONARIO_PROPIO`).
- **"Para arriba no"**: en Funcionarios se edita, se registra salida o reingreso solo a quien
  tiene **igual o menos acceso** (`CUENTA_CON_MAYOR_ACCESO`). La lista y la ficha lo marcan
  (`tieneMasAcceso`) y el botón explica por qué está bloqueado.
- **Todos los datos en todos lados**: "Datos personales" y "Datos laborales" muestran todo lo
  guardado, igual en Mi cuenta, en la ficha de Funcionarios y en Ver usuario (misma vista:
  `paginas/funcionarios/DatosDeFuncionario.tsx`). En Ver usuario solo si quien mira tiene
  `funcionarios.ver`.
- **Quién ve Funcionarios y Usuarios**: RRHH y administradores. **Aprobador solo ve funcionarios
  (no cambiar)**. Solicitante no ve ninguno. **Consulta** (Auditoría Interna) se deja como está:
  ve funcionarios, expedientes y usuarios, sin editar.

### Convenciones de la base de datos

- Nombres en **español, camelCase**.
- **UUID `char(36)`** como llave primaria en todas las tablas, incluidas las de unión M:M.
- Criterio enum vs. tabla catálogo: si la Municipalidad va a querer agregar valores sin tocar
  código, es **tabla**; si el valor está amarrado a lógica de programa, es **enum**.
- El DBML se valida con el paquete `@dbml/core` desde un script Node
  (`Parser.parse`). **El CLI `npx @dbml/cli` no funciona** en este entorno.

---

## 6b. Distribución de sprints por épicas (vigente desde 16/09/2026)

Las fechas del perfil no cambian; sí el contenido de cada sprint.

| Sprint | Épicas |
|---|---|
| **Sprint 1** (14–25 set) | Autenticación y usuarios (login, usuarios, roles, permisos y control de acceso) · Funcionarios y expediente · Gestión documental |
| **Sprint 2** (28 set–9 oct) | Gestión de vacaciones (solicitudes, aprobación/rechazo, días disponibles, PDF) · Permisos, licencias e incapacidades · Capacitaciones y horas extra |
| **Sprint 3** (12–23 oct) | Talent Pool · Notificaciones · Auditoría (bitácora y trazabilidad) |

Objetivo de la épica Autenticación y usuarios: proporcionar un mecanismo seguro para autenticar a
los usuarios de SIGEL y administrar usuarios, roles y permisos, garantizando que cada usuario acceda
únicamente a las funcionalidades autorizadas.

**Motivo del cambio:** la universidad pidió un segundo proyecto con la misma base (expediente laboral)
para los encargados de las **piscinas municipales**, que las administran otras personas. Se termina
primero todo lo del expediente, se crea una **rama del proyecto sin Talent Pool** para adaptarla a
las piscinas, y luego se hace el Talent Pool en SIGEL. En ese proyecto participan otros dos
estudiantes (facturación); Josthyn se encarga del expediente. En documentos formales **no** se
nombran a los otros estudiantes.

## 7. Alcance del Sprint 1 y qué cubre el prototipo

Sprint 1 según el cronograma (14–25 de setiembre de 2026):
*"Desarrollo del módulo de autenticación, gestión de usuarios, roles y expediente laboral."*

Fichas cubiertas: **1–15, 18–21 y 42**.

| Pantalla del prototipo | Fichas |
|---|---|
| Inicio de sesión, recuperar contraseña, primer ingreso | 1, 7 |
| Funcionarios (buscar, paginar, ficha resumida) | 13, 14 |
| Registrar funcionario (asistente de 3 pasos) | 11 |
| Expediente laboral (perfil, info personal, info laboral, documentos, capacitaciones, historial) | 12, 15, 19, 20, 21, 42 |
| Usuarios (crear, editar, permisos individuales, estado de cuenta) | 2, 5, 7, 10 |
| Roles y permisos (roles + catálogo de permisos) | 3, 4, 6, 9 |
| Tipos de documento | 18 |
| Mi cuenta (datos personales + acceso y seguridad) | 8 |

**Fuera del Sprint 1**: vacaciones, permisos, incapacidades, capacitaciones y horas extra → Sprint 2; Talent Pool, notificaciones y auditoría → Sprint 3 (ver §6b).
La barra lateral del prototipo lo dice al pie.

---

## 8. Pendientes abiertos

| # | Pendiente | Quién decide |
|---|---|---|
| 2 | **Certificado HTTPS**: confirmar con Joseph que SIGEL se servirá por HTTPS. Se está programando asumiendo que sí (ver §6). | Joseph / TI |
| 3 | **Horas extra**: Joseph delegó la definición. Falta proponerle un flujo. | Josthyn propone |
| 4a | **Texto del consentimiento informado** del Talent Pool: lo define Joseph. | Joseph |
| 6 | **Cambio de contraseña en "Mi cuenta"**: Josthyn decidió (25/09) dejarlo con la contraseña actual en vez del código al correo del prototipo (evita correos de más y mantiene la seguridad). **Falta mostrárselo a Joseph.** | Joseph |
| 4b | **Datos del servidor de correo**: servidor, puerto, cuenta, TLS y autorización del dominio para envío desde la aplicación. Es lo único que falta para cerrar la recuperación de contraseña. | TI |

> Resueltos el 16/09/2026: el **stack** quedó definido (§2), Joseph **aprobó el prototipo v4** sin
> correcciones y `nombreUsuario` **se da por eliminado** (se entra con el correo; ya se quitó del
> DBML v3).
>
> Resuelto el 25/09/2026: los **mensajes que ve la persona** (errores del backend, correos,
> descripciones de roles y permisos) llevan tildes y eñes. Los comentarios del código siguen sin ellas.
>
> Resueltos el 23/09/2026 (ver §6): **dónde se guardan los archivos**, **quién hace la carga
> inicial de datos**, el **diseño del historial laboral** y el **envío de correos**, que queda
> a la espera únicamente de los datos técnicos del servidor.

### Pendientes para el prototipo v5 (no hacer hasta terminar el informe intermedio)

- Ajustes que la aplicación ya hace distinto del prototipo (26/09): quitar "Crear permiso" del
  catálogo, quitar el campo "Contraseña temporal" y la opción "Cuenta administrativa, sin
  expediente" de "Crear usuario", y el cambio de contraseña de "Mi cuenta" con la contraseña actual
  en vez de código al correo.

- En la vista de funcionaria, el botón de baja debe aparecer **solo** en las filas de documentos que
  ella subió (hoy está oculto en todas).
- Agregar `documentos.darDeBajaPropio` al catálogo de permisos de `p_seguridad.html`.
- En "Mi cuenta" con vista RRHH, los campos de correo muestran los de María José (datos de
  ejemplo que no cambian con el selector RRHH/Funcionaria). Corregir en `app.js`.
- El texto de ayuda de las contraseñas dice "al menos una letra y un número"; la política
  vigente (24/09) es mínimo 8, mayúscula, minúscula, número y carácter especial.
- Republicar el artifact con los cambios del 16/09 ya hechos en fuentes: rol "Consulta" y dominio
  `@munipalmares.go.cr` en los correos de ejemplo.

---

## 9. Seguridad y cumplimiento

Josthyn pidió expresamente que el sistema considere **ISO 27001** y **accesibilidad para
personas con discapacidad visual**. Lo que ya está definido:

- **Permisos por clave `modulo.accion`** (`funcionarios.ver`, `documentos.darDeBaja`,
  `bitacora.ver`…), nunca amarrados a un rol fijo. Cada funcionalidad nueva necesita su permiso
  y la clave no se puede repetir. Además hay permisos individuales por usuario, encima del rol.
- **Roles de sistema** (decisión 16/09/2026: "Consulta RRHH" se renombra a **Consulta**). RRHH **no**
  es un rol: el personal de Recursos Humanos usa el rol Administrador.

  | Rol | Alcance | Quién |
  |---|---|---|
  | Súper Administrador | Control total. Único que consulta la bitácora. | Informática / Joseph |
  | Administrador | Gestión completa de funcionarios, expedientes, usuarios y catálogos. | Recursos Humanos |
  | Aprobador | Aprueba las solicitudes de su personal. | Jefaturas |
  | Solicitante | Autoservicio sobre su propio expediente. | Todo funcionario |
  | Consulta | Solo lectura de funcionarios y expedientes: permisos `.ver` y `documentos.descargar`, ninguno de escritura. | Auditoría Interna |

  Los de sistema no se pueden eliminar. Lo que se destaca es que **los roles son administrables**:
  si hace falta otro perfil, se crea desde el panel sin tocar código.
- **Contraseñas cifradas**. Ni Informática ni RRHH pueden verlas. El cambio se hace con código de
  verificación enviado al correo.
- **Primer ingreso**: la contraseña inicial es temporal y el sistema obliga a cambiarla. Mientras
  no la cambie, la persona solo puede consultar su sesión y cambiar la contraseña; el resto de la
  API le responde `CONTRASENA_TEMPORAL`.
- **Política de contraseñas (decidida por Josthyn el 24/09/2026)**: mínimo 8 caracteres, con al
  menos una minúscula, una mayúscula, un número y un carácter especial. Vive en
  `backend/src/autenticacion/politica-contrasena.ts` y se aplica al crear o cambiar la contraseña,
  nunca al usarla para entrar.
- **Bloqueo**: 3 intentos fallidos → bloqueo temporal de 3 minutos.
- **Bitácora**: se registra abrir un expediente y abrir o descargar un documento, con usuario,
  fecha y documento. **No** se registran consultas generales ni accesos fallidos (T-4).
- **Cambios de contraseña en bitácora (decisión de Josthyn, 24/09/2026)**: sí se auditan, tanto el
  cambio voluntario como el restablecimiento con código, con usuario, fecha y dirección IP. Es el
  rastro que permite investigar un cambio no autorizado. **Nunca** se guarda la contraseña ni su
  hash, solo la constancia de que hubo un cambio. No contradice lo anterior: lo que Joseph descartó
  auditar son los accesos, no las modificaciones sobre la cuenta.
- **Baja lógica** de documentos (Ficha 42): se ocultan, nunca se borran, y se pueden restaurar.
  **No existe el borrado físico**: eso es lo que sostiene la trazabilidad del expediente.
- **Baja de un documento propio (decisión 16/09/2026)** — permiso nuevo `documentos.darDeBajaPropio`.
  El funcionario puede dar de baja un documento solo si se cumplen **las tres** condiciones:
  está en su propio expediente, él lo subió (`usuarioRegistroId` = usuario actual) y no lo generó
  SIGEL. Para él desaparece por completo (ni en el filtro "Dados de baja"); para RRHH y Súper
  Administrador sigue visible como "dado de baja por el funcionario", con fecha y motivo, y se puede
  restaurar. Se pide un motivo corto opcional (sugerencias: "archivo equivocado", "documento
  duplicado"), se **notifica a RRHH** y queda en bitácora. Cuando RRHH da de baja, aplica la
  Ficha 42 tal cual ("No vigente", restaurable).
- **Editar un documento**: el **archivo nunca se reemplaza** (ni el funcionario ni RRHH). Si está malo,
  se da de baja y se sube el correcto. Solo se editan el **título y el tipo**, y el funcionario solo
  sobre los que él subió. Cada edición queda en bitácora.
- **Accesibilidad**: contraste WCAG AA verificado, `aria-label` / `aria-current` / `role` en toda
  la navegación y pestañas, tooltips en los botones de icono, foco visible.

---

## 10. Cómo trabajar en el chat nuevo

> Redacción de entregables formales: voz cercana, desde el autor ("se mostrará", "como se definió en el perfil"), no como un tercero que describe el documento. No citar el perfil del proyecto como referencia APA: se menciona por nombre.

Preferencias que Josthyn ya expresó y conviene mantener:

1. **En español**, tono directo, sin rodeos.
2. **No inventar nada.** Antes de afirmar algo del proyecto, revisar los documentos. Josthyn lo
   pidió textualmente: *"no quiero que inventes nada, revisa todos los documentos de nuevo"*.
3. **No editar los `.docx`** de `docs\` salvo que él lo pida en ese mensaje.
4. **Verificar visualmente** antes de dar algo por bueno: capturas con Playwright, medición de
   alto de pantalla, validación del DBML con `@dbml/core`.
5. **Reportar los cambios en texto plano** en el chat, en una lista corta, después de hacerlos.
6. **Editar fuentes, nunca el archivo armado.**
7. Cuando él dé una lista larga de correcciones, aplicarlas todas y decir cuáles quedaron y
   cuáles no se pudieron, sin dejar ninguna en silencio.
8. **Respetar la jerarquía de fuentes** (§3) y reportar contradicciones en vez de resolverlas.
9. En entregables formales usar la **numeración del Perfil del Proyecto** (§2).
10. No abrir `SIGEL\.env` ni tocar `SIGEL\.git`.
11. Nada de respaldos, borradores ni material del curso dentro del repositorio: eso va en
    `docs\_trabajo\`, que Git ignora.
12. Antes de borrar archivos, listarlos y pedir confirmación explícita.
13. Programar **paso a paso**, no todo de golpe: Josthyn escribe el código y Claude explica.

---

## 11. Bitácora / cronograma

Josthyn lleva una bitácora de horas de la práctica. Ya se le preparó el cronograma de la semana
del **lunes 7 al viernes 11 de setiembre de 2026 (25 horas)**, con la nota de que **los martes
son de revisión con Joseph**. Si pide otra semana, seguir ese mismo formato.
