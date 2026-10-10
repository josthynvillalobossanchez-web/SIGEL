/**
 * Tipos de documento que se suben DENTRO de un tramite (no desde "Subir documento"
 * del expediente): el justificante de una solicitud, la boleta de una incapacidad y
 * el certificado de una capacitacion. Los modulos los buscan por nombre, asi que no
 * se pueden renombrar ni inactivar; sus formatos y descripcion si se pueden ajustar.
 */
export const TIPOS_DE_TRAMITE = ['Justificante de solicitud', 'Boleta de incapacidad', 'Certificado de capacitación'] as const;

export type TipoDeTramite = (typeof TIPOS_DE_TRAMITE)[number];

export function esDeTramite(nombre: string): boolean {
  return (TIPOS_DE_TRAMITE as readonly string[]).includes(nombre);
}
