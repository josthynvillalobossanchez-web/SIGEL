/**
 * Calculos de vacaciones y dias habiles.
 *
 * Son funciones puras (reciben datos, devuelven datos; no tocan la base),
 * para poder entenderlas y probarlas por separado. Las fechas de calendario
 * (@db.Date) se manejan como Date a medianoche UTC y como texto "AAAA-MM-DD":
 * asi un dia nunca "se corre" por la zona horaria.
 */

/** Dias de la semana que se trabajan: lunes a viernes. */
const DIAS_LABORABLES = new Set([1, 2, 3, 4, 5]);

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** "AAAA-MM-DD" de un Date. */
export function textoDeFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA_MS);
}

/** True si el dia es sabado o domingo. */
export function esFinDeSemana(fecha: Date): boolean {
  return !DIAS_LABORABLES.has(fecha.getUTCDay());
}

/**
 * Dias habiles entre dos fechas, ambas incluidas: lunes a viernes que no
 * sean feriados. "feriados" trae las fechas como "AAAA-MM-DD".
 */
export function diasHabilesEntre(inicio: Date, fin: Date, feriados: ReadonlySet<string>): number {
  let total = 0;
  for (let dia = inicio; dia <= fin; dia = sumarDias(dia, 1)) {
    if (DIAS_LABORABLES.has(dia.getUTCDay()) && !feriados.has(textoDeFecha(dia))) total++;
  }
  return total;
}

/** Cada dia del rango con su condicion, para el calendario y para explicar el calculo. */
export function desglosarDias(
  inicio: Date,
  fin: Date,
  feriados: ReadonlyMap<string, string>,
): { fecha: string; tipo: 'habil' | 'finDeSemana' | 'feriado'; nombreFeriado?: string }[] {
  const dias: { fecha: string; tipo: 'habil' | 'finDeSemana' | 'feriado'; nombreFeriado?: string }[] = [];
  for (let dia = inicio; dia <= fin; dia = sumarDias(dia, 1)) {
    const texto = textoDeFecha(dia);
    const feriado = feriados.get(texto);
    if (feriado !== undefined) dias.push({ fecha: texto, tipo: 'feriado', nombreFeriado: feriado });
    else if (esFinDeSemana(dia)) dias.push({ fecha: texto, tipo: 'finDeSemana' });
    else dias.push({ fecha: texto, tipo: 'habil' });
  }
  return dias;
}

/** Anios de servicio cumplidos entre el ingreso y una fecha. */
export function aniosCumplidos(ingreso: Date, hasta: Date): number {
  let anios = hasta.getUTCFullYear() - ingreso.getUTCFullYear();
  if (hasta < aniversario(ingreso, anios)) anios--;
  return Math.max(0, anios);
}

/**
 * Fecha en que se cumplen "n" anios de servicio. Quien ingreso un 29 de
 * febrero cumple el 28 de febrero en los anios que no son bisiestos.
 */
export function aniversario(ingreso: Date, n: number): Date {
  const anio = ingreso.getUTCFullYear() + n;
  const mes = ingreso.getUTCMonth();
  const dia = ingreso.getUTCDate();
  const ultimoDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimoDelMes)));
}

/** Tramo de un regimen (tabla reglaVacaciones). */
export interface Tramo {
  aniosMinimos: number;
  aniosMaximos: number | null;
  diasPorPeriodo: number;
}

/**
 * Dias que se ganan en un periodo, segun cuantos anios de servicio llevaba
 * la persona AL EMPEZAR ese periodo. Con el regimen general: los periodos
 * 1 a 6 empiezan con 0 a 5 anios cumplidos (15 dias) y del 7 en adelante
 * con 6 o mas (20 dias). Devuelve null si ningun tramo aplica.
 */
export function diasDelPeriodo(tramos: readonly Tramo[], aniosAlEmpezar: number): number | null {
  const tramo = tramos
    .filter((t) => t.aniosMinimos <= aniosAlEmpezar && (t.aniosMaximos === null || aniosAlEmpezar <= t.aniosMaximos))
    .sort((a, b) => b.aniosMinimos - a.aniosMinimos)[0];
  return tramo ? tramo.diasPorPeriodo : null;
}

/** Etiqueta del periodo que termina en el aniversario "n": por ejemplo 2024-2025. */
export function etiquetaDePeriodo(ingreso: Date, n: number): string {
  return `${aniversario(ingreso, n - 1).getUTCFullYear()}-${aniversario(ingreso, n).getUTCFullYear()}`;
}

/**
 * Dias que se perderian al acumular un periodo nuevo: lo que pase del tope
 * (periodos maximos x dias del periodo). Nunca es negativo.
 */
export function excedenteDelTope(saldoConElPeriodoNuevo: number, periodosMaximos: number, diasDelPeriodoNuevo: number): number {
  return Math.max(0, saldoConElPeriodoNuevo - periodosMaximos * diasDelPeriodoNuevo);
}

/** Redondea a 2 decimales (los dias se guardan como DECIMAL(6,2)). */
export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
