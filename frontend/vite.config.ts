/*
 * Configuracion de Vite (servidor de desarrollo y compilacion del frontend).
 *
 * El "proxy" hace que, en desarrollo, todo lo que el navegador pida a /api
 * lo reenvie Vite al backend de NestJS (puerto 3000). Asi el navegador cree
 * que frontend y backend son el mismo sitio y la cookie de sesion
 * (httpOnly, SameSite=strict, path=/api) funciona sin configurar CORS.
 *
 * En produccion se hace lo mismo con el servidor web (IIS o Nginx): servir
 * la carpeta dist/ y reenviar /api al backend. Ver docs/GUIA_DESARROLLO.md.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // strictPort: si el 5173 esta ocupado, falla en vez de usar otro puerto
    // (asi siempre se sabe en que direccion esta la aplicacion).
    strictPort: true,
    proxy: {
      '/api': {
        // 127.0.0.1 y no "localhost": en Windows "localhost" puede resolver a
        // ::1 (IPv6) y el backend no siempre escucha ahi (mismo problema que
        // tuvimos con MySQL).
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Mapas de codigo solo si se piden: no publicar el codigo fuente en produccion.
    sourcemap: false,
  },
});
