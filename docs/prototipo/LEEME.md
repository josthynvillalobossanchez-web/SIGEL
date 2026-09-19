# Prototipo SIGEL — Sprint 1

Prototipo navegable del Sprint 1 (autenticación, usuarios, roles y permisos, expediente
laboral). Versión **v4**, 16 de setiembre de 2026.

Publicado en: `https://claude.ai/artifact/2GyUnheYmzPXqpzMaq8RM1`

---

## ⚠️ Regla de oro

`prototipo.html` **es un archivo generado**. No se edita a mano: cualquier cambio directo
se pierde la próxima vez que se arma. **Se editan las fuentes y se vuelve a armar.**

---

## Cómo se arma

```bash
python3 armar.py      # junta las fuentes → prototipo.html
node medir.mjs        # verifica que las pantallas quepan sin scroll
```

`armar.py` hace tres cosas:

1. Concatena `base.css` + `extra.css` dentro de un `<style>`.
2. Inserta `pagina_expediente.html` + `p_funcionarios.html` + `p_seguridad.html` en el
   marcador `__PAGINAS__` de `p_shell.html`. El `<main class="contenido">` del expediente
   se convierte en `<section class="pagina" id="pgExpediente">` durante el armado.
3. Sustituye `__LOGO__`, `__LOGO_COLOR__` y `__LOGO_BLANCO__` por los base64 de
   `m_blanca.txt` y `m_color.txt`.

Orden final del documento: cabecera → `<style>` → acceso → shell (con las páginas dentro)
→ modales → `<script>` con `app.js`.

---

## Qué hay en cada archivo

| Archivo | Contenido |
|---|---|
| `base.css` | Tokens de color y tema, base, barra superior, estructura de layout, barra lateral, tarjetas, botones, chips, tablas, estado vacío, modales, adaptable a móvil |
| `extra.css` | Pantallas de acceso, formularios, encabezados de página, tablas de administración, panel de roles, paginación, carga de archivo, Mi cuenta, franja de prototipo, barra lateral plegable, formularios por pasos, tarjeta de perfil, bloques de información |
| `p_acceso.html` | `#vLogin`, `#vRecuperar` (3 pasos), `#vPrimerIngreso` |
| `p_shell.html` | Barra superior, franja amarilla de prototipo, barra lateral, tirador de plegado, marcador `__PAGINAS__` |
| `pagina_expediente.html` | `#pgExpediente` — perfil, 5 pestañas, tabla de documentos |
| `p_funcionarios.html` | `#pgFuncionarios`, `#pgAltaFuncionario` (asistente de 3 pasos) |
| `p_seguridad.html` | `#pgUsuarios`, `#pgRoles`, `#pgTipos`, `#pgCuenta` |
| `p_modales.html` | 11 modales: `mdVerUsuario`, `mdResumen`, `mdUsuario`, `mdPermisos`, `mdEstado`, `mdSubir`, `mdRol`, `mdPermiso`, `mdTipoDoc`, `mdCambiarPass`, `velo` |
| `app.js` | Tema, ojo de contraseña, vistas de acceso, bloqueo a 3 intentos, navegación entre páginas, barra lateral plegable, pestañas, filtros reales, modales, asistentes por pasos, validación de cédula, búsqueda, cambio de vista RRHH ↔ funcionaria |
| `armar.py` | El armador |
| `medir.mjs` | Mide el alto de cada pantalla contra el de la ventana a 1366×768, 1536×864 y 1920×1080 |
| `m_blanca.txt`, `m_color.txt` | Logos en base64 (blanco para tema oscuro, a color para tema claro) |

---

## Cosas que se rompen fácil

- **`[hidden]{display:none!important}`** en `base.css` es obligatorio. Sin él, las reglas de
  clase con `display:flex/grid` le ganan al `[hidden]` del navegador y los elementos que
  deberían ocultarse según el rol se quedan visibles. Ya se rompió dos veces.
- **`--h-barra` y `--h-franja`** tienen que coincidir con el alto real de la barra superior y
  de la franja amarilla. Si no coinciden, toda pantalla se pasa del alto de la ventana aunque
  su contenido quepa. Pasó con la franja: decía 38 px y medía 50.
- **Especificidad de los logos**: `.acceso-marca img.logo-oscuro` / `.logo-claro`. Si se
  escribe solo `.logo-oscuro`, `.acceso-marca img` le gana y salen los dos logos.
- El botón de cambiar tema tiene que estar en **todas** las pantallas, login incluido.

---

## Verificación visual

Playwright con el Chromium del entorno:

```js
import { chromium } from 'playwright';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
});
```

Para saltarse el login y mostrar una pantalla concreta:

```js
await p.evaluate(() => {
  document.querySelectorAll('.acceso').forEach(a => a.hidden = true);
  document.getElementById('app').removeAttribute('hidden');
  document.querySelectorAll('.pagina').forEach(s => s.hidden = (s.id !== 'pgAltaFuncionario'));
});
```

Para forzar el tema: `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`.

---

## Estado del espacio vertical (v4)

| Pantalla | 1366×768 | 1536×864 | 1920×1080 |
|---|---|---|---|
| Funcionarios | cabe | cabe | cabe |
| Registrar funcionario | cabe | cabe | cabe |
| Usuarios | cabe | cabe | cabe |
| Tipos de documento | cabe | cabe | cabe |
| Mi cuenta | +63 px | cabe | cabe |
| Roles y permisos | +194 px | cabe | cabe |
| Expediente (documentos) | +307 px | +211 px | cabe |

Las dos que aún hacen scroll en pantallas chicas son las de mucho dato (tabla de documentos
y rejilla de permisos), y está aceptado así. Si se agregan bloques, medir con `medir.mjs`
antes de dar el cambio por bueno.
