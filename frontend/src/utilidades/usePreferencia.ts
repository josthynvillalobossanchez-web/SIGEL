/*
 * Preferencia de pantalla de esta persona en este navegador (p. ej. ver las
 * solicitudes en tarjetas o en lista compacta). Es solo comodidad: si el
 * navegador no guarda nada (modo privado, almacenamiento bloqueado), se usa
 * el valor por omision y todo funciona igual.
 */
import { useState } from 'react';

export function usePreferencia<T extends string>(clave: string, permitidos: readonly T[], porOmision: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(`sinergia-${clave}`) as T | null;
      return guardado && permitidos.includes(guardado) ? guardado : porOmision;
    } catch {
      return porOmision;
    }
  });
  function cambiar(nuevo: T) {
    setValor(nuevo);
    try {
      localStorage.setItem(`sinergia-${clave}`, nuevo);
    } catch {
      // Sin almacenamiento: la preferencia dura solo esta visita.
    }
  }
  return [valor, cambiar];
}
