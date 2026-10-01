/*
 * Aplica el tema guardado ANTES de pintar (para que no parpadee en claro cuando
 * la persona eligio el oscuro). Es un archivo aparte y no un script dentro del
 * HTML porque la politica de seguridad (CSP) solo permite scripts propios.
 * Misma clave que el prototipo: sinergia-tema.
 */
try {
  var tema = localStorage.getItem('sinergia-tema');
  if (tema === 'light' || tema === 'dark') document.documentElement.setAttribute('data-theme', tema);
} catch (e) {}
