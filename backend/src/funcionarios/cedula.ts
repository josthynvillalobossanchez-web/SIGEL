/**
 * Cedulas: se guardan siempre con el mismo formato para que la misma persona
 * no quede registrada dos veces ("2-0678-0432" y "206780432" son la misma).
 *
 *   - Cedula de identidad costarricense (9 digitos): se guarda "2-0678-0432",
 *     la escriban con guiones, con espacios o todo junto.
 *   - Cualquier otra identificacion (DIMEX, pasaporte): se guarda en
 *     mayusculas y sin espacios, tal cual.
 */
export function normalizarCedula(texto: string): string {
  const limpia = texto.replace(/\s+/g, '').toUpperCase();
  const digitos = limpia.replace(/-/g, '');
  if (/^\d{9}$/.test(digitos) && /^[\d-]+$/.test(limpia)) {
    return `${digitos[0]}-${digitos.slice(1, 5)}-${digitos.slice(5)}`;
  }
  return limpia;
}
