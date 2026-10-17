# Entregable 3 — Sprint 3: Notificaciones, Auditoría y Talent Pool

Rama `Sprint-3`. El Talent Pool va al final del sprint (decisión de Josthyn, 09/10).

## 1. Decisiones de Josthyn (10/10/2026)

- **Notificaciones solo dentro del sistema.** Por correo va únicamente la creación de cuenta con su
  contraseña temporal; ningún otro aviso se envía por correo.
- **A quién se avisa:**
  - Solicitudes que requieren aprobación (vacaciones, permisos, capacitaciones que chocan con el horario):
    la petición y su cancelación a la **jefatura y RRHH**; el resultado (aprobada o rechazada) al
    **solicitante**. Si RRHH o la jefatura la registró por la persona, también se le avisa a ella.
  - **Licencias e incapacidades**: a la **jefatura y RRHH**. A la jefatura no se le dice el tipo de
    incapacidad (dato médico).
  - La persona cambia algo **suyo** (Mi cuenta, documentos, foto, capacitaciones) → se avisa a **RRHH**.
  - **RRHH** cambia algo de una persona (datos, documentos, foto, saldo, horas extra, incapacidad o
    capacitación a su nombre) → se le avisa a **esa persona**.
  - **Asignar nueva jefatura** (cuando una jefatura sale, pierde el rol o le inactivan la cuenta) → RRHH.
  - **Vacaciones por vencer** → la persona, una vez por aniversario, con la anticipación de su régimen.
  - **Constancia que no se pudo generar** → RRHH.
  - Nadie se avisa a sí mismo.
- **Bitácora**: se mantiene lo acordado (T-4 y decisiones del 30/09): creaciones, modificaciones, bajas,
  aprobaciones, cambios de contraseña, intentos denegados, abrir un expediente y ver o descargar un
  documento. **No** se registran entradas ni salidas del sistema, ni consultas generales. Solo la ve el
  Súper Administrador y no se puede editar ni borrar.

## 2. Modelo de datos (migración `20261010030000_notificaciones`)

Tabla `notificacion` (destinatario, clave del evento, título, mensaje, entidad y registro que la
originaron, referencia para no repetir avisos periódicos, enlace a la pantalla, leída) y dos permisos:
`notificaciones.ver` (los cinco roles) y `notificaciones.rrhh` (Administrador y Súper Administrador:
recibe los avisos dirigidos a RRHH). Se quitaron del diseño las columnas de envío por correo.

## 3. Tareas

| # | Tarea | Estado |
|---|---|---|
| 1 | Servicio central de notificaciones (`backend/src/notificaciones`) y endpoints | **Hecha** |
| 2 | Avisos de solicitudes, licencias, incapacidades, expedientes, saldo, horas extra, jefatura y constancias | **Hecha** |
| 3 | Revisión periódica (vacaciones por vencer y jefaturas por asignar), sin instalar nada | **Hecha** |
| 4 | Campana en la barra superior y página **Notificaciones**; cada aviso abre su trámite (`?abrir=`) | **Hecha** |
| 5 | Bitácora: filtro de texto, fechas «hasta» que incluyen el día completo, opciones de filtros | **Hecha** |
| 6 | Página **Bitácora de auditoría** (Súper Administrador): filtros y detalle con el antes y el después | **Hecha** |
| 7 | Pruebas: `pruebas-notificaciones.mjs` (74) y `ui-notificaciones.py` (28); regresión completa en verde | **Hecha** |
| 8 | Ajustes del 12/10: campana en la esquina ([Salir] [Tema] [Notificaciones]); en la Bitácora, «Sobre qué» con el nombre de la persona y el UUID aparte como «Código interno del registro»; la ayuda emergente se esconde al hacer clic | **Hecha** |
| 9 | Inicio más visual (12/10), sin librerías ni consultas nuevas al backend: anillo del saldo y próximas 3 ausencias; «Fuera esta semana» (lunes a viernes, iniciales por tipo; jefatura: su equipo, RRHH: todos); barras de ausencias del mes por tipo (RRHH); accesos directos compactos agrupados como el menú. Como mucho 2 llamadas al calendario que ya existía | **Hecha** |
| 10 | Talent Pool (HU 38–41): ver §5 | **Hecha** (13/10) |

## 4. Cambios pedidos por Joseph (13/10/2026)

| # | Cambio | Estado |
|---|---|---|
| 1 | **Tope de vacaciones configurable** por régimen en Reglas de vacaciones: «Solo avisar» (por omisión: se sigue acumulando) o «Vencen los días»; RRHH lo cambia cuando quiera. Migración `20261013000000_tope_de_vacaciones` | **Hecha** |
| 2 | Aviso del tope **un mes antes** (30 días; mínimo 20) a la persona, a su jefatura y a RRHH | **Hecha** |
| 3 | **Agregar o quitar días** desde Editar funcionario (sección a la vista), con motivo, bitácora y aviso a la persona | **Hecha** |
| 4 | **RRHH se entera cuando la ausencia queda en firme**: la solicitud nueva solo a la jefatura; la aprobación a la persona y a RRHH; el rechazo solo a la persona; cancelar una pendiente, solo a la jefatura; una aprobada, también a RRHH | **Hecha** |
| 5 | Pruebas: `pruebas-vacaciones` 190, `pruebas-ausencias` 142, `pruebas-notificaciones` 79; navegador `ui-vacaciones` 104, `ui-ausencias` 65; `preparar-ui-vacaciones.mjs` ya no falla cuando las fechas de octubre pasan | **Hecha** |

## 5. Talent Pool (13/10/2026, HU 38–41; Fichas 32–35 y 41)

Migración `20261013010000_talent_pool`: tablas `consentimiento` (versionado), `candidato`, `formacionCandidato`,
`habilidad` (20 iniciales), `candidatoHabilidad` y `experienciaCandidato`; permisos `talentPool.ver` y
`talentPool.administrar` (SA y Administrador). Módulo `backend/src/talent-pool/` aislado: nada más depende de él.

**Reglas de Josthyn (13/10):**
1. **Página pública** `/trabaje-con-nosotros`, sin cuenta, identificada **solo con la cédula**.
2. **Privacidad primero:** el formulario **nunca trae datos guardados**. Si la cédula ya existe, la persona
   llena todo de nuevo y al enviar **se reemplaza el registro completo** (estudios, experiencia, habilidades y
   currículum; el anterior se borra del disco). La respuesta es la misma exista o no la cédula, para no
   confirmar quién está registrado. Riesgo aceptado: alguien con la cédula de otro puede reemplazar su
   registro; es preferible a revelar información privada.
3. Consentimiento informado obligatorio (texto de `backend/contenido/consentimiento-talent-pool.txt`; si cambia,
   al arrancar se guarda una versión nueva y cada candidato queda ligado a la que aceptó).

| # | Tarea | Estado |
|---|---|---|
| 1 | Formulario público por pasos: datos personales, estudios (profesión del catálogo o «no encuentro la mía»), experiencia, habilidades (chips con nivel), currículum PDF opcional y consentimiento | **Hecha** |
| 2 | Seguridad del formulario: límite de 5 envíos cada 10 minutos por IP (`TALENT_POOL_ENVIOS_POR_IP`), campo trampa contra robots, validación completa en el backend, currículum cifrado | **Hecha** |
| 3 | Pantalla de RRHH `/talent-pool` (menú Personal): pestañas por estado, buscador (cédula, nombre, profesión, estudios, puestos, habilidades) y filtros (profesión, nivel mínimo, habilidades, años de experiencia, con currículum, orden) | **Hecha** |
| 4 | Perfil: datos, estudios, experiencia, habilidades, currículum (su consulta queda en la bitácora), nota interna, estados activo/inactivo/descartado | **Hecha** |
| 5 | **Contratar** (Ficha 41): doble confirmación → «Registrar funcionario» con los datos personales del candidato (cédula fija); RRHH completa los laborales y decide si tendrá cuenta; en una sola transacción se crea el funcionario y el candidato queda «contratado»; el currículum se copia al expediente (tipo «Curriculum»; si falla, se avisa a RRHH) | **Hecha** |
| 6 | Catálogo de habilidades (agregar, cambiar categoría, inactivar) y **eliminar los datos a pedido de la persona** (Ley 8968; la bitácora guarda solo la cédula) | **Hecha** |
| 7 | Avisos: «Nuevo candidato» / «Candidato actualizado» a RRHH. Bitácora: registro y reemplazo anónimos («Formulario público (sin cuenta)»), cambios de RRHH, contratación | **Hecha** |
| 8 | Pruebas: `pruebas-talent-pool.mjs` (88) y `ui-talent-pool.py` (57); regresión completa en verde | **Hecha** |

**Ajustes de Josthyn (17/10/2026):**

| # | Ajuste | Estado |
|---|---|---|
| 9 | **Página de bienvenida** en `/` (sin sesión): qué hace el sistema (explorador de funciones con ejemplos inventados), quién ve qué, y la sección «¿Quiere formar parte de nuestro equipo?» que explica el Talent Pool (pasos y preguntas frecuentes). Dos caminos: «Ingresar a SINERGIA» y «Postularme al Talent Pool». Solo información general: ningún dato de funcionarios | **Hecha** |
| 10 | Se quitan los enlaces entre Iniciar sesión y el Talent Pool; ambas pantallas tienen «Volver al inicio» | **Hecha** |
| 11 | Habilidades **«Otra»** en cada categoría (Técnicas, Personales, Idiomas, Herramientas): la persona escribe la suya (máx. 12). Quedan **solo en su perfil** (tabla `habilidadPropiaCandidato`, migración `20261017000000_habilidades_propias`), nunca entran al catálogo; no se acepta una que ya esté en el catálogo. RRHH las ve marcadas «propia» y el buscador las encuentra | **Hecha** |
| 12 | Filtro de habilidades de RRHH **sin límite** (antes 10) | **Hecha** |
| 13 | Campos obligatorios: cada estudio agregado (nivel, título, institución y año si está concluido); cada experiencia (empresa, puesto, desde, **hasta** salvo trabajo actual —no futura—, **funciones principales**); **currículum PDF obligatorio** | **Hecha** |

Respuestas del 17/10: «Profesión u oficio» sale de la tabla `profesion` (Catálogos de personal), así que es
escalable. El nivel de estudio es una lista fija en el código (primaria a posgrado, más «curso»), porque el
filtro «nivel mínimo» necesita su orden. «Copiar enlace del formulario» copia la dirección pública para
compartirla (redes, sitio web, correo).

**Se apartan de las fichas (a propósito):** no se envía correo de confirmación al candidato (decisión del 10/10:
el correo solo se usa para la cuenta nueva); el mensaje de éxito en pantalla lo reemplaza. Si una persona
«inactiva» vuelve a enviar el formulario, queda «activa» otra vez; «descartado» y «contratado» se conservan.

## 6. Notas

- El Súper Administrador tiene todos los permisos, así que también recibe los avisos de RRHH.
  Quitárselo rompería la regla de reparto de acceso (el SA tiene que tener todo); si Joseph no los
  quiere, se decide aparte (ver COSAS_POR_CORREGIR).
- La revisión periódica corre dentro del backend: 30 s después de arrancar y luego cada 6 horas
  (`AVISOS_REVISION_MINUTOS`, `AVISOS_PRIMERA_REVISION_SEGUNDOS`). No repite avisos.
