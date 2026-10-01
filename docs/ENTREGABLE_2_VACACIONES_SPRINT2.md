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
| 2 | Saldo: acumulación por aniversario, tope de 2 periodos, vencimientos, saldo inicial al crear funcionario y ajuste discreto | **Hecha en backend** (137 pruebas de API + 26 de cálculo) |
| 3 | Solicitudes: crear (días hábiles sin feriados ni fines de semana, saldo suficiente), cancelar si no fue leída, aprobar/rechazar con motivo, jefatura inmediata, tope de jerarquía, RRHH en nombre de terceros | **Hecha en backend** |
| 4 | Feriados (pantalla de RRHH) | **API hecha**; falta la pantalla |
| 5 | Pantallas: Mis vacaciones (saldo), nueva solicitud, bandeja de la jefatura | Pendiente |
| 6 | Calendario inteligente (tres alcances, colores por estado y tipo, varios eventos el mismo día) | Pendiente |
| 7 | Constancia de vacaciones en PDF al aprobar (`DocumentosService.registrarGenerado`) | Pendiente |
| 8 | Pruebas de API y de navegador; documentación | Pendiente |
