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
| 10 | Talent Pool (HU 38–41) | Pendiente (al final del sprint) |

## 4. Cambios pedidos por Joseph (13/10/2026)

| # | Cambio | Estado |
|---|---|---|
| 1 | **Tope de vacaciones configurable** por régimen en Reglas de vacaciones: «Solo avisar» (por omisión: se sigue acumulando) o «Vencen los días»; RRHH lo cambia cuando quiera. Migración `20261013000000_tope_de_vacaciones` | **Hecha** |
| 2 | Aviso del tope **un mes antes** (30 días; mínimo 20) a la persona, a su jefatura y a RRHH | **Hecha** |
| 3 | **Agregar o quitar días** desde Editar funcionario (sección a la vista), con motivo, bitácora y aviso a la persona | **Hecha** |
| 4 | **RRHH se entera cuando la ausencia queda en firme**: la solicitud nueva solo a la jefatura; la aprobación a la persona y a RRHH; el rechazo solo a la persona; cancelar una pendiente, solo a la jefatura; una aprobada, también a RRHH | **Hecha** |
| 5 | Pruebas: `pruebas-vacaciones` 190, `pruebas-ausencias` 142, `pruebas-notificaciones` 79; navegador `ui-vacaciones` 104, `ui-ausencias` 65; `preparar-ui-vacaciones.mjs` ya no falla cuando las fechas de octubre pasan | **Hecha** |

## 5. Notas

- El Súper Administrador tiene todos los permisos, así que también recibe los avisos de RRHH.
  Quitárselo rompería la regla de reparto de acceso (el SA tiene que tener todo); si Joseph no los
  quiere, se decide aparte (ver COSAS_POR_CORREGIR).
- La revisión periódica corre dentro del backend: 30 s después de arrancar y luego cada 6 horas
  (`AVISOS_REVISION_MINUTOS`, `AVISOS_PRIMERA_REVISION_SEGUNDOS`). No repite avisos.
