/*
 * Listas de los formularios de funcionario (Registrar/Editar y Mi cuenta).
 */
import type { DetalleDeFuncionario, OpcionesDeFormulario, Referencia } from '../../api/funcionarios';

/**
 * Agrega a la lista lo que la persona YA tiene aunque se haya inactivado
 * (p. ej. un puesto que ya no se ofrece): lo conserva mientras no lo cambie.
 */
export function conActual<T extends Referencia>(lista: T[], actual: Referencia | null | undefined, marca = 'inactivo'): T[] {
  return actual && !lista.some((x) => x.id === actual.id) ? [...lista, { ...actual, nombre: `${actual.nombre} (${marca})` } as T] : lista;
}

/** Las listas del formulario con los valores actuales de la persona y sin ella misma como jefatura. */
export function listasConActuales(opciones: OpcionesDeFormulario, detalle?: DetalleDeFuncionario | null) {
  return {
    puestos: conActual(opciones.puestos, detalle?.puesto),
    departamentos: conActual(opciones.departamentos, detalle?.departamento),
    profesiones: conActual(opciones.profesiones, detalle?.profesion),
    regimenes: conActual(opciones.regimenes, detalle?.regimenVacaciones),
    // Nadie es su propia jefatura; si la actual ya no es Aprobadora, se muestra igual.
    jefaturas: conActual(
      opciones.jefaturas.filter((j) => j.id !== detalle?.id),
      detalle?.jefatura,
      'ya no tiene el rol Aprobador',
    ),
  };
}

/** Texto de cada jefatura en la lista: "Carla Prueba · Jefa de Hacienda". */
export function opcionesDeJefatura(jefaturas: (Referencia & { puesto: string | null })[]): Referencia[] {
  return jefaturas.map((j) => ({ id: j.id, nombre: j.puesto ? `${j.nombre} · ${j.puesto}` : j.nombre }));
}
