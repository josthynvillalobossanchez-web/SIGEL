# Entregable 1 — Endurecimiento del Sprint 1

Qué falta para dejar el Sprint 1 listo para producción, en qué orden hacerlo y cómo se usan las
herramientas de operación (recifrar documentos, antivirus). **Esto no es funcionalidad nueva**:
las tres épicas del Sprint 1 (autenticación y usuarios, funcionarios y expediente, gestión
documental) ya están hechas y probadas. Aquí se anota lo que las hace seguras y operables.

Estado al 30/09/2026. Cada tarea dice quién la hace: **[Dev]** código en el repositorio,
**[TI]** Joseph o el equipo de TI de la Municipalidad, **[Joseph]** una decisión suya.

---

## 1. Decisiones de partida

1. **Los documentos del expediente no se borran.** Una baja es lógica: el documento deja de verse
   para casi todos, pero el archivo cifrado y su registro se conservan. Esto es decisión de
   Josthyn (30/09) y se mantiene.
2. **Depuración de archivos viejos: NO se programa ahora.** Si algún día hace falta espacio, se
   hace con una política escrita (propuesta en la sección 4, tarea G) y nunca a mano.
3. **Rama de Git:** este endurecimiento va en la rama `Sprint-1` (creada en GitHub desde `main`);
   el Sprint 2 tendrá la suya.
4. **Orden decidido (Josthyn, 30/09):** ahora solo **A** y **B**. **C, E, F y G** quedan para antes
   del despliegue. **D** espera a que el correo esté probado en el servidor. Después sigue el Sprint 2.
5. **Los avisos a Recursos Humanos** (cambio de datos personales #12, baja de documento propio #19,
   «Revisar jefatura» #18) **dependen del módulo de notificaciones (Sprint 3)** y no se adelantan.
   Esos avisos irán **dentro de la aplicación web**; el **correo se usa solo para lo muy importante**
   (códigos de recuperación y contraseñas temporales). La cuenta de Gmail es normal (sin dominio) y
   **la comparten otros sistemas**, así que su límite diario de envío se reparte entre todos.
6. **Ya está hecho y no es pendiente:** el límite de intentos por IP (COSAS #2, desde el 23/09).

---

## 2. Lista de tareas, en orden

Marcar con `[x]` al terminar cada una y anotar la fecha.

### A. Cabeceras de seguridad (`helmet`) — [Dev] — prioridad alta
Origen: COSAS_POR_CORREGIR #6.
**Hecha el 30/09/2026** (falta que Josthyn corra `npm install helmet` en `backend` y haga el commit).
- [x] `helmet` activado en `main.ts` (`opcionesDeCabeceras`) con una CSP a la medida: scripts solo
  propios, `frame-src 'self' blob:` (visor de PDF), `img-src 'self' data: blob:` (fotos y vistas
  previas), Google Fonts para estilos y tipografía, `frame-ancestors 'none'`, `object-src 'none'`.
  HSTS y `upgrade-insecure-requests` solo con HTTPS (con HTTP en desarrollo romperían la carga).
- [x] El script del tema pasó de estar dentro del HTML a `frontend/public/tema.js` (la CSP no
  permite scripts en línea).
- [x] Las respuestas de archivos conservan su CSP propia, más estricta (`default-src 'none'; sandbox`).
- [x] Prueba `ui-csp.py` (11 pasos): contra el backend sirviendo la interfaz compilada, recorre
  inicio, visor de PDF e imagen, fotos, vista previa y listas, y falla ante cualquier bloqueo de
  la CSP. Se corre con `BASE_URL=http://127.0.0.1:3100`; antes `_csp_preparar.mjs`.
- [ ] Al desplegar con HTTPS: comprobar en el navegador del servidor que no hay avisos de CSP en la consola.

### B. Contador de intentos por código de recuperación — [Dev] — **siguiente**
Origen: #5d. Hoy el código de 6 dígitos solo está protegido por el límite por IP.
- [ ] Agregar la columna `intentosFallidos` a `tokenRecuperacionContrasena` (**migración**:
  la corre Josthyn con `npx prisma migrate dev`).
- [ ] Al fallar un código, sumar 1; al llegar a 5, el código se anula y hay que pedir otro.
- [ ] Mensaje al usuario: «Demasiados intentos. Solicite un código nuevo.»
- [ ] Pruebas: 5 fallos anulan el código aunque el sexto sea el correcto.

### C. Cierre de sesión real (revocar tokens) — [Dev] — antes del despliegue
Origen: #4. Hoy un token robado sirve hasta que vence, aunque la persona haya cerrado sesión.
- [ ] Decidir el método (recomendado: guardar en base un identificador de sesión `jti` por
  token y marcarlo revocado al cerrar sesión o al cambiar la contraseña). **Migración.**
- [ ] El guard rechaza tokens revocados; «Salir» y «cambiar contraseña» revocan.
- [ ] Limpieza periódica de sesiones vencidas.
- [ ] Pruebas: un token usado después de «Salir» da 401.

### D. Contraseña temporal solo por correo — [Josthyn] y después [Dev] — **no se hace hasta probar el correo en el servidor**
Origen: #5c-bis. Hoy `POST /api/usuarios` devuelve la contraseña temporal una vez.
- [ ] **[Josthyn]** La cuenta de Gmail ya existe y los datos de SMTP son públicos
  (`smtp.gmail.com`, puerto 465). Falta crear la **contraseña de aplicación** y ponerla en el `.env`
  del servidor (GUIA_DESARROLLO.md §10.5). No depende de Joseph ni de TI.
- [ ] **[Josthyn]** Probar el envío real en el servidor (los registros deben decir `Correo listo`).
- [ ] **[Dev]** Solo después, evaluar dejar de devolver la contraseña en la respuesta. Mientras no
  haya correo probado **no se hace**: RRHH necesita verla para entregarla.
- Recordar: cuenta Gmail normal, compartida con otros sistemas, sin dominio propio (los correos
  pueden caer en «no deseado»); por eso el correo se reserva para lo muy importante.

### E. Herramienta de recifrado — [Dev] — antes del despliegue
Origen: #20. Explicada paso a paso en la sección 3.
- [ ] Programar `npm run archivos:recifrar` (simulacro por defecto).
- [ ] Pruebas con archivos de dos versiones de llave.
- [ ] Documentar el procedimiento en GUIA_DESARROLLO.md §10.6.

### F. Antivirus al subir — antes del despliegue — [Joseph] decide, [TI] instala, [Dev] programa
Origen: #22. Explicado en la sección 4.
- [ ] **[Joseph]** ¿La Municipalidad lo pide? ¿Qué antivirus usa TI? ¿Qué pasa si el antivirus no responde (rechazar o dejar pasar)?
- [ ] **[TI]** Instalar ClamAV como servicio en el servidor (o confirmar otra solución).
- [ ] **[Dev]** Escaneo en memoria antes de cifrar y guardar; rechazo con mensaje; bitácora.

### G. Política de depuración de archivos viejos — antes del despliegue — [Joseph] — solo documento, sin código
Origen: #21. **No borrar nada hasta tener esta política aprobada.** Propuesta para discutir:
- **Documentos del expediente** (vigentes o en baja): **se conservan**. Un documento laboral puede
  hacer falta años después (reclamos, auditorías) y las instituciones públicas tienen reglas de
  conservación de documentos. Consultar al archivo institucional de la Municipalidad antes de
  cualquier eliminación definitiva.
- **Documentos en baja con más de 3 meses** (idea de Josthyn): candidatos a un **archivo frío**
  (moverlos a otro almacenamiento, no borrarlos) o, solo con aprobación escrita, a depuración.
- **Fotografías reemplazadas o quitadas**: sí se pueden depurar pasado un plazo (p. ej. 3 meses),
  porque no son documentos del expediente. Se necesitaría una herramienta que las distinga (las
  que ya ninguna fila de la base usa).
- Cualquier depuración sería **otra herramienta con simulacro**, con respaldo previo y
  registro en la bitácora. No se programa hasta que Joseph apruebe la política.

### H. «Atrás» del navegador con cambios sin guardar — [Dev] — prioridad baja
Origen: #14. Pasar a `createBrowserRouter` y usar `useBlocker`. Se evalúa al final.

### I. El día del despliegue — [TI] con [Dev] — no es programación
Son valores que se llenan en el servidor ese día; no hay nada que programar.
Ver GUIA_DESARROLLO.md, «Despliegue en la VM Windows».
- [ ] **[TI]** Subdominio (propuesto: `sinergia.munipalmares.go.cr`), certificado y registro DNS.
- [ ] **[TI]** `.env` del servidor: `COOKIE_SEGURA=true`, `CERTIFICADO_HTTPS`, `LLAVE_HTTPS`,
  `RUTA_FRONTEND=../frontend/dist`, `ORIGEN_FRONTEND=https://<subdominio>`, `PUERTO=443`, `BD_TLS=true`.
- [ ] **[TI]** Generar la llave del servidor con `npm run archivos:generar-llave` **en el servidor**
  y guardar una copia **aparte** (fuera del servidor y del respaldo de `archivos/`).
- [ ] **[TI]** Dejar `SEED_ADMIN_CONTRASENA` vacía: el seed genera una al azar; anotarla una vez y
  cambiarla en el primer ingreso.
- [ ] **[TI]** Respaldos: base de datos y `backend/archivos/`; **la llave por otro camino**.
- [ ] **[Joseph]** Texto oficial del consentimiento del Talent Pool (reemplazar el borrador).
- [ ] **[Dev + TI]** Prueba final en el servidor: inicio de sesión, crear funcionario, subir y
  descargar un documento, ver la bitácora.

---

## 3. Herramienta de recifrado: cómo funciona y cómo se usa

> **Estado: todavía no existe** (tarea E). Esto describe cómo va a funcionar para que TI sepa qué
> esperar. Cuando se programe, esta sección se ajusta a lo real.

### 3.1 Para qué sirve
Cada archivo guardado en `backend/archivos/` lleva dentro **con qué versión de llave** se cifró.
El sistema ya puede abrir archivos de llaves anteriores (variable `ARCHIVOS_LLAVES_ANTERIORES`),
pero los archivos viejos **siguen cifrados con la llave vieja**. Mientras sea así, la llave vieja
**no se puede descartar** (si se pierde o se filtra, esos archivos quedan expuestos o ilegibles).
La herramienta recorre los archivos y los **vuelve a cifrar con la llave actual**. Cuando ya no
queda ninguno con la versión vieja, esa llave se puede retirar del `.env`.

### 3.2 Cuándo se usa
- Se **sospecha que la llave se filtró** (urgente).
- Se rota la llave por política (p. ej. cada cierto tiempo que decida TI).
- Cambió la persona que custodia la llave.

### 3.3 Procedimiento paso a paso (diseño)
1. **Respaldo completo antes de empezar**: base de datos y la carpeta `backend/archivos/`. Sin
   respaldo no se recifra.
2. **Generar la llave nueva**: `npm run archivos:generar-llave`. Guardar la copia aparte.
3. **Editar el `.env`**: la nueva en `ARCHIVOS_LLAVE`, subir `ARCHIVOS_LLAVE_VERSION` (1 → 2) y
   dejar la vieja en `ARCHIVOS_LLAVES_ANTERIORES=1:<llave vieja>`. Reiniciar el backend.
   Desde aquí los archivos nuevos ya usan la versión 2 y los viejos siguen abriéndose.
4. **Simulacro** (no cambia nada): `npm run archivos:recifrar` muestra cuántos archivos hay por
   versión de llave y cuáles se recifrarían, y avisa de cualquier archivo ilegible.
5. **Ejecutar de verdad**: `npm run archivos:recifrar -- --aplicar`. Por cada archivo con versión
   vieja: lo descifra en memoria, comprueba que su hash coincide con el guardado, lo cifra con la
   llave nueva, lo escribe en un archivo temporal y **solo entonces lo reemplaza** (si algo falla
   a mitad, el archivo original queda intacto). Se puede interrumpir y volver a correr: salta los
   que ya están en la versión nueva.
6. **Verificar**: volver a correr el simulacro. Debe decir **0 archivos con versión vieja** y 0
   ilegibles. Descargar un par de documentos desde SINERGIA para comprobar.
7. **Retirar la llave vieja** de `ARCHIVOS_LLAVES_ANTERIORES` **solo si el paso 6 dio 0**, y
   reiniciar. Guardar la copia de la llave nueva (y conservar la vieja en el respaldo anterior
   mientras ese respaldo exista).
8. **Anotar** la fecha y quién lo hizo.

### 3.4 Cuidados
- Correrla en horario de poco uso. Con muchos archivos tarda; el simulacro dice cuántos son.
- Un archivo ilegible (alterado o con llave que falta) **no se toca**: se lista para que TI decida.
- La herramienta no borra nada ni toca la base de datos; solo reescribe los archivos cifrados.

---

## 4. Antivirus para los documentos: cómo funcionaría

> **Estado: no incluido todavía** (tarea F). Decisión de Joseph y TI.

### 4.1 El problema
Hoy SINERGIA solo acepta PDF, JPG y PNG y comprueba que el contenido real sea de ese formato.
Eso evita que se suba un `.exe` disfrazado, pero **no detecta un PDF o una imagen con código
malicioso dentro**. Además, como los archivos se guardan **cifrados**, el antivirus normal del
servidor **no puede revisarlos** en la carpeta `archivos/`: ve datos ilegibles.

### 4.2 La idea: revisar al subir, antes de cifrar
El archivo llega al backend en memoria. Ahí es el único momento en que está sin cifrar y se puede
revisar sin escribirlo a disco:

1. La persona sube el archivo.
2. SINERGIA valida extensión, tipo, firma real y tamaño (ya lo hace).
3. **Nuevo:** SINERGIA envía el contenido, desde la memoria, a un **servicio antivirus** que corre
   en el mismo servidor. El más usado y gratuito es **ClamAV** (servicio `clamd`).
4. El antivirus responde «limpio» o «infectado con tal nombre».
5. Si está limpio, sigue lo de siempre: cifrar, guardar, registrar en la bitácora.
6. Si está infectado, **se rechaza**: la persona ve «El archivo fue rechazado por el antivirus.
   Avise al Departamento de TI.», no se guarda nada y **queda en la bitácora** («Archivo rechazado
   por antivirus: nombre del virus»).

### 4.3 Qué hay que instalar y configurar
- **[TI]** ClamAV en el servidor (existe versión para Windows) con su servicio `clamd` y la
  actualización automática de firmas (`freshclam`, diaria). Las firmas desactualizadas casi no sirven.
- **[Dev]** Variables nuevas en el `.env`, por ejemplo `ANTIVIRUS_ACTIVO=true`,
  `ANTIVIRUS_HOST=127.0.0.1`, `ANTIVIRUS_PUERTO=3310` y `ANTIVIRUS_SI_FALLA=rechazar`.
- El límite de tamaño de ClamAV para esa conexión (`StreamMaxLength`) debe ser **mayor a 25 MB**,
  que es el máximo de un documento.

### 4.4 Decisiones que tiene que tomar Joseph
1. **¿Se hace?** Es opcional. Si el servidor ya tiene un antivirus institucional, TI puede preferir otra solución.
2. **Si el antivirus no responde** (se cayó, se está actualizando), ¿qué hace SINERGIA?
   - `rechazar`: nadie puede subir documentos hasta que vuelva. Es lo más seguro (recomendado
     para documentos de RRHH), pero detiene la subida.
   - `permitir`: se sube sin revisar y se deja constancia en la bitácora y el registro.
3. **Los documentos que ya estén guardados** cuando se active: no se revisan solos. Una
   herramienta aparte los podría descifrar en memoria y pasarlos por el antivirus, si se pide.

### 4.5 Límites que hay que conocer
- Un antivirus detecta **lo que ya conoce**. Un ataque nuevo puede pasar. Por eso se suma a lo que
  ya hay: validación de formato, firma real, CSP estricta y `nosniff` en las descargas, visor en
  marco aislado y cifrado.
- Es una capa más, no una garantía. Dar de alta a usuarios correctos y revisar la bitácora sigue
  siendo igual de importante.
- No conviene escribir el archivo en claro a una carpeta temporal para que el antivirus del sistema
  lo revise: dejaría el documento sin cifrar en disco.

---

## 5. Registro de avance

| Tarea | Responsable | Estado | Fecha |
|---|---|---|---|
| A. Cabeceras de seguridad | Dev | Hecha (falta commit y `npm install helmet`) | 30/09/2026 |
| B. Intentos por código de recuperación | Dev | **Siguiente** | |
| C. Cierre de sesión real | Dev | Antes del despliegue | |
| D. Contraseña temporal solo por correo | Josthyn / Dev | Espera a probar el correo en el servidor | |
| E. Herramienta de recifrado | Dev | Antes del despliegue | |
| F. Antivirus al subir | Joseph / TI / Dev | Antes del despliegue; espera decisión | |
| G. Política de depuración | Joseph | Antes del despliegue (sin código) | |
| H. «Atrás» del navegador | Dev | Pendiente (baja) | |
| I. El día del despliegue | TI / Dev | Ese día | |
