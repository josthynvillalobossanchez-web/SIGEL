# Entregable 2 — Sprint 2: Vacaciones, permisos y calendario inteligente

Rama de trabajo: `Sprint-2` (sale de `main` con el endurecimiento del Sprint 1 incluido).
Alcance del cronograma: vacaciones (solicitudes, aprobación/rechazo, saldo, PDF) · permisos, licencias e
incapacidades · capacitaciones y horas extra. **Orden decidido (01/10/2026): vacaciones completas primero.**

## 1. Decisiones de Josthyn (01/10/2026)

1. **Orden:** vacaciones completas → permisos y licencias → incapacidades → capacitaciones que chocan con
   el horario → horas extra. El calendario inteligente se construye con las vacaciones y los demás trámites
   se enchufan a él.
2. **Regla de acumulación** (ya estaba en el modelo de datos): régimen *general* = 15 días por año los
   primeros 6 años de servicio y 20 desde ahí; régimen *anterior* = 30 días al año. Tope de 2 periodos
   acumulados; lo que exceda vence (movimiento negativo, nunca se borra). Solo días completos.
3. **Saldo inicial:** lo carga RRHH **al crear el funcionario** y lo puede corregir después desde un lugar
   discreto de «Editar funcionario» (ajuste con motivo y bitácora), para que no se modifique por error.
4. **El calendario inteligente es una de las razones principales del sistema:** tiene que verse bien, ser
   fácil e intuitivo. Cubre vacaciones, permisos, licencias, incapacidades y capacitaciones que chocan con el
   horario. Tres vistas (T-3): el funcionario ve el suyo; la jefatura el de su equipo; RRHH el de todos.
5. **Feriados:** los carga RRHH por año y son editables (no se siembran: la ley cambia y es RRHH quien la
   conoce). Los marcados como recurrentes sirven para proponer el año siguiente.
6. Las notificaciones son Sprint 3: por ahora la bandeja de la jefatura y el estado en «Mis solicitudes»
   hacen de aviso dentro de la app.

## 2. Modelo de datos (migración `20261003000000_solicitudes_y_vacaciones`)

`tipoSolicitud` (catálogo: vacaciones, permiso con goce, permiso sin goce, licencia, capacitación),
`solicitud` (una sola tabla para todos los trámites), `diaNoLaborable` (feriados), `reglaVacaciones`
(tramos por régimen) y `movimientoVacaciones` (el saldo es la **suma** de los movimientos). El seed carga
los 5 tipos de solicitud y los 3 tramos (general 0–5 años: 15; general 6+: 20; anterior: 30).
Las horas extra **no** son solicitud (solo las registra RRHH). Las incapacidades llegan con su propia tabla.

## 3. Tareas

| # | Tarea | Estado |
|---|---|---|
| 1 | Tablas, migración y seed | **Hecha** (pendiente que Josthyn corra la migración) |
| 2 | Saldo: acumulación por aniversario, tope de 2 periodos, vencimientos, saldo inicial al crear funcionario y ajuste discreto | **Hecha** (162 pruebas de API + 26 de cálculo) |
| 3 | Solicitudes: crear (días hábiles sin feriados ni fines de semana, saldo suficiente), cancelar, aprobar/rechazar con motivo, jefatura inmediata, tope de jerarquía, a nombre de otra persona (RRHH de cualquiera; la jefatura de su personal, y queda aprobada) | **Hecha** |
| 4 | Feriados | **Hecha**: catálogo que se repite solo cada año (cada año el mismo día, Jueves/Viernes Santo calculados con la Pascua, o solo una vez) y botón «Cargar feriados de ley» (migración `20261004000000_feriados_que_se_repiten`) |
| 5 | Pantallas: Mis vacaciones (pestañas), nueva solicitud por pasos, solicitud para otra persona, bandeja de la jefatura, solicitudes de RRHH, ajuste del saldo en Editar funcionario | **Hecha** (falta el justificante de las licencias, en la etapa de permisos/licencias) |
| 6 | Calendario inteligente (tres alcances, colores por estado y tipo, varios eventos el mismo día) | **Hecha**: vistas Mes, Por persona y Lista; filtros de estado, persona y departamento; leyenda filtrable; lista del día; «Ver en calendario» resalta la solicitud |
| 7 | Constancia de vacaciones en PDF al aprobar (`DocumentosService.registrarGenerado`) | Pendiente |
| 8 | Pruebas de API y de navegador; documentación | **Hecha**: API 182 + 26; navegador `ui-vacaciones.py` (102 pasos, escritorio y celular, tema oscuro); CONTEXTO y GUIA al día |

## 4. Ajustes del 01/10/2026 (revisión de Josthyn con las pantallas)

1. **La jefatura administra a su personal; RRHH a todos.** Nuevo permiso `funcionarios.verTodos`
   (Administrador, Consulta y SA). Con solo `funcionarios.ver` (rol Aprobador) la lista, la ficha y la
   fotografía alcanzan **solo al personal a cargo** (`FUNCIONARIO_FUERA_DE_ALCANCE`); el menú dice
   «Mi personal».
2. **A nombre de otra persona:** RRHH de cualquiera; **la jefatura, de su personal a cargo**. Si la
   registra la propia jefatura **queda aprobada** al momento (ella es quien aprueba). Sección propia en el
   menú: «Solicitud para otra persona», por pasos: **primero la persona**, luego tipo, fechas y revisar.
3. **Pedir no resta.** El número grande del saldo es el **disponible**; lo pendiente se muestra aparte
   («se descuentan solo si se aprueban»). Por dentro sigue reservándose para no pedir dos veces lo mismo.
4. **Textos según el tipo:** los permisos y las capacitaciones **no descuentan vacaciones** y ya no dicen
   «se descontó de su saldo». Solo las vacaciones descuentan, y solo al aprobarse.
5. **Nueva solicitud por pasos, sin bajar** (celular primero): ¿Qué? → ¿Cuándo? → Revisar y enviar. Si
   falta algo, «Siguiente» o «Enviar» abren una ventana con la lista de errores y un botón para corregir.
6. **Cancelar:** pendiente sin abrir, como antes. **Quien está en el tope de la jerarquía** puede cancelar
   su solicitud **ya aprobada** mientras no haya empezado, con **doble confirmación** (casilla «entiendo que
   no se puede deshacer»); los días vuelven al saldo con un movimiento de devolución (nada se borra).
7. **Bandeja:** cada solicitud marca si **coincide con días de otra persona del equipo**; el detalle lo
   explica (quién y qué días) y tiene **«Ver en calendario»**, que abre ese mes con la solicitud resaltada.
   «Mi equipo» incluye también las solicitudes de la propia jefatura.
8. **Que no maree:** la persona elige cómo ver: **Tarjetas o Lista compacta** (bandeja y solicitudes del
   personal, se recuerda en el navegador) y en el calendario **Mes, Por persona o Lista**. Filtros: estado,
   persona, departamento, tipo (leyenda) y, en la lista de RRHH, rango de fechas.
9. **Menú lateral:** los grupos (Vacaciones y permisos, Personal, Seguridad…) **se pliegan**; abierto solo el
   de la página actual. Feriados pasó a ser subsección de Calendario (`/calendario/feriados`).
10. **Ayudas en todos los botones** (`data-ayuda` y, en los de solo icono, `aria-label` para lectores de
    pantalla). El gestor de ayudas usa el `aria-label` si falta `data-ayuda`.
11. **Logo de SINERGIA** en la barra y en las pantallas de acceso; el de la Municipalidad queda más
    pequeño a un lado (pedido de Joseph). También es el ícono de la pestaña.
12. **Privacidad del calendario:** hoy los compañeros **no** ven los días de los demás (solo la persona, su
    jefatura y RRHH). Si más adelante se agrega una vista de compañeros, mostrará «Ausente» sin el tipo; la
    jefatura y RRHH sí ven el tipo.
13. **Feriados como catálogo (segunda revisión del 01/10):** se digitan una vez y se repiten solos. Reglas:
    cada año el mismo día y mes; Jueves y Viernes Santo calculados con la Pascua; o solo una vez (asuetos o
    traslados). «Cargar feriados de ley» agrega los 12 de Costa Rica (art. 148 del Código de Trabajo). Se quitó
    «Proponer el año». API: `GET /dias-no-laborables` (catálogo), `GET /dias-no-laborables/fechas?anio=`,
    `POST /dias-no-laborables/de-ley`.
14. **RRHH y SA ven a todo el personal**: además de `funcionarios.verTodos` (que la migración nueva agrega a
    SA, Administrador y Consulta sin depender del seed), quien tiene `funcionarios.crear` o `funcionarios.editar`
    ve a todos. Solo la jefatura (Aprobador) queda limitada a su personal.
15. **Los días se ganan al cumplir cada año** de servicio (ya era así en el cálculo); al registrar a alguien
    solo queda lo que RRHH cargue como saldo inicial. La pantalla ahora separa «Saldo inicial» de «Ganados» y,
    en el primer año, explica cuándo llegan los primeros días.
16. «Ver en calendario» no aparece en solicitudes rechazadas o canceladas (no se pintan en el calendario).
