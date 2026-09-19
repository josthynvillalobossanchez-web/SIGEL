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

### Situación exacta hoy

El 16/09/2026 **Joseph aprobó el prototipo v4 del Sprint 1 sin correcciones**. No dijo nada
nuevo sobre `nombreUsuario` ni sobre el almacenamiento de archivos: esos dos siguen pendientes
(§8) y Josthyn los plantea en la revisión de los martes.

Decisión tomada el 16/09/2026: *el proyecto va atrasado respecto al cronograma*, por lo que
**no se van a prototipar los Sprints 2 y 3**. **El desarrollo del Sprint 1 ya arrancó** y no habrá
más prototipos: los Sprints 2 y 3 se programan directo, tomando el prototipo del Sprint 1 como
referencia visual y de interacción y reusando los mismos tokens y componentes.

### Lo que toca ahora, en orden

1. **Informe de Avance Intermedio** (generado el 16/09 en `Proyectos\Informe_Avance_Intermedio_SIGEL.docx`; faltan capturas de Jira/GitHub, minutas y el criterio de Joseph) del curso EIF408 (entrega: sábado 19/09/2026, por correo
   desde la cuenta UNA). Word editable, Arial, con la guía `EIF408-04-Guia Avance Intermedio`.
   Requiere además el *Aval del Patrocinador* firmado por Joseph y Josthyn.
2. **Resolver los pendientes de §8** que bloquean partes del Sprint 1 (dónde se guardan los
   archivos del expediente y si se elimina `nombreUsuario` del DBML).
3. **Desarrollo del Sprint 1** (en curso desde el 17/09; ver "Entorno de desarrollo" abajo):
   autenticación, gestión de usuarios, roles/permisos y expediente laboral.

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
    del backend, el generador es **`prisma-client`** con `output` obligatorio
    (`backend/generated/prisma`), el cliente se importa desde `../generated/prisma/client.js`
    y la conexión necesita el **driver adapter `@prisma/adapter-mariadb`** (sirve para MySQL).
    `migrate dev` ya no corre `generate` ni `seed` automáticamente.
- **Verificación hecha:** `tsc --noEmit` y `nest build` pasan. El `prisma generate` y las
  migraciones no se pudieron correr desde aquí (el proxy bloquea `binaries.prisma.sh`); los
  corre Josthyn en Windows.
- **Ramas:** `main` = SIGEL completo. Cuando el expediente esté terminado (antes del Talent
  Pool) se saca la rama **`piscinas`** desde `main`, sin Talent Pool, para el proyecto de las
  piscinas municipales.

### Estado del backend (Sprint 1)

Ya está en el repositorio: estructura NestJS (ESM), `PrismaService` global, endpoint
`GET /api/salud`, `schema.prisma` con las 15 tablas del Sprint 1 traducidas del DBML v3
(incluye `usuarioBajaId`, `fechaBaja` y `motivoBaja` en `documento`) y `prisma/seed.ts` con
19 permisos, los 5 roles de sistema, los regímenes de vacaciones, los tipos de documento y la
cuenta del Súper Administrador. Falta: autenticación (Argon2id + JWT), guard de permisos
`modulo.accion`, módulos de usuarios/roles, funcionarios, expediente y documentos, y el
frontend.

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
| 2 | **Dónde se guardan físicamente los archivos** del expediente (ruta de servidor, nube, permisos, respaldo). La BD solo guarda la referencia. | Joseph / TI |
| 3 | **Horas extra**: Joseph delegó la definición. Falta proponerle un flujo. | Josthyn propone |
| 4a | **Texto del consentimiento informado** del Talent Pool: lo define Joseph. | Joseph |
| 4b | **Envío de notificaciones** desde el dominio `@munipalmares.go.cr`: confirmar las restricciones del servidor de correo para envío automático. | Joseph / TI |
| 4 | **Ficha 17 — Historial laboral**: en el prototipo es una pestaña marcador de posición. Falta diseñarla (solo lectura, alimentada por la bitácora). | Josthyn / Joseph |

> Resueltos el 16/09/2026: el **stack** quedó definido (§2), Joseph **aprobó el prototipo v4** sin
> correcciones, el **almacenamiento de archivos** es el servidor de la Municipalidad y `nombreUsuario`
> **se da por eliminado** (se entra con el correo; ya se quitó del DBML v3).

### Pendientes para el prototipo v5 (no hacer hasta terminar el informe intermedio)

- En la vista de funcionaria, el botón de baja debe aparecer **solo** en las filas de documentos que
  ella subió (hoy está oculto en todas).
- Agregar `documentos.darDeBajaPropio` al catálogo de permisos de `p_seguridad.html`.
- En "Mi cuenta" con vista RRHH, los campos de correo muestran los de María José (datos de
  ejemplo que no cambian con el selector RRHH/Funcionaria). Corregir en `app.js`.
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
- **Primer ingreso**: la contraseña inicial es temporal y el sistema obliga a cambiarla.
- **Bloqueo**: 3 intentos fallidos → bloqueo temporal de 3 minutos.
- **Bitácora**: se registra abrir un expediente y abrir o descargar un documento, con usuario,
  fecha y documento. **No** se registran consultas generales ni accesos fallidos (T-4).
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

---

## 11. Bitácora / cronograma

Josthyn lleva una bitácora de horas de la práctica. Ya se le preparó el cronograma de la semana
del **lunes 7 al viernes 11 de setiembre de 2026 (25 horas)**, con la nota de que **los martes
son de revisión con Joseph**. Si pide otra semana, seguir ese mismo formato.
