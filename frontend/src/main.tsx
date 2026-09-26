/*
 * Punto de entrada del frontend: carga los estilos y dibuja <App /> dentro
 * de <div id="raiz"> (index.html).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/sigel.css';
import './estilos/ajustes.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontro <div id="raiz"> en index.html.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
