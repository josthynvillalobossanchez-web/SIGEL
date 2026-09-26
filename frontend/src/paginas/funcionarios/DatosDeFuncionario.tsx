/*
 * Vistas de SOLO LECTURA de los datos de un funcionario, iguales en todo el
 * sistema (pedido de Josthyn, 28/09: "todos los datos personales salen en
 * Datos personales y todos los laborales en Datos laborales", en Mi cuenta,
 * en Funcionarios y en Usuarios):
 *
 *   <DatosPersonalesVista f={detalle} />   nombre, cedula, nacimiento, contacto...
 *   <DatosLaboralesVista f={detalle} />    puesto, jefatura, nombramiento, fechas...
 *
 * Reciben el DetalleDeFuncionario de la API (GET /funcionarios/:id o el
 * "funcionario" de GET /mi-cuenta, que tiene la misma forma). Si se agrega
 * un dato al funcionario, se agrega AQUI y aparece en las tres pantallas.
 */
import { NOMBRES_DE_NOMBRAMIENTO, nombreDeRegimen, type DetalleDeFuncionario } from '../../api/funcionarios';
import { formatearFecha, formatearFechaSola } from '../../utilidades/fechas';
import { ChipDeFuncionario } from './ChipDeFuncionario';

/** Una celda "titulo / valor"; sin valor muestra "Sin registrar" en gris. */
export function Dato({ titulo, valor, num, detalle }: { titulo: string; valor: React.ReactNode; num?: boolean; detalle?: string | null }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <div className="dato">
      <dt>{titulo}</dt>
      <dd className={vacio ? 'vacio-dato' : num ? 'num' : undefined}>
        {vacio ? 'Sin registrar' : valor}
        {detalle && <span className="sec-dato mc-detalle">{detalle}</span>}
      </dd>
    </div>
  );
}

/** Edad cumplida a hoy, para acompanar la fecha de nacimiento. */
function edad(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--;
  return anios;
}

/** Datos personales y de contacto. "compacto" = 3 columnas (ventanas). */
export function DatosPersonalesVista({ f, compacto }: { f: DetalleDeFuncionario; compacto?: boolean }) {
  return (
    <dl className={`info-rejilla vista-datos${compacto ? ' compacto' : ''}`}>
      <Dato titulo="Nombre" valor={f.nombre} />
      <Dato titulo="Primer apellido" valor={f.primerApellido} />
      <Dato titulo="Segundo apellido" valor={f.segundoApellido} />
      <Dato titulo="Cédula" valor={f.cedula} num />
      <Dato
        titulo="Fecha de nacimiento"
        valor={f.fechaNacimiento ? formatearFechaSola(f.fechaNacimiento) : null}
        num
        detalle={f.fechaNacimiento ? `${edad(f.fechaNacimiento)} años` : null}
      />
      <Dato titulo="Profesión" valor={f.profesion?.nombre} />
      <Dato titulo="Teléfono" valor={f.telefonoPersonal} num />
      <Dato titulo="Correo personal" valor={f.correoPersonal} />
      <Dato titulo="Correo institucional" valor={f.correoInstitucional} />
      <div className="dato ancho-completo">
        <dt>Dirección exacta</dt>
        <dd className={f.direccion ? undefined : 'vacio-dato'}>{f.direccion || 'Sin registrar'}</dd>
      </div>
    </dl>
  );
}

/** Datos laborales (nombramiento, jefatura, fechas y estado). */
export function DatosLaboralesVista({ f, compacto }: { f: DetalleDeFuncionario; compacto?: boolean }) {
  return (
    <dl className={`info-rejilla vista-datos${compacto ? ' compacto' : ''}`}>
      <Dato titulo="Puesto" valor={f.puesto?.nombre} />
      <Dato titulo="Departamento" valor={f.departamento?.nombre} />
      <Dato titulo="Jefatura inmediata" valor={f.jefatura?.nombre ?? 'Sin jefatura (tope de la jerarquía)'} />
      <Dato titulo="Código de empleado" valor={f.numeroEmpleado} num />
      <Dato titulo="Tipo de nombramiento" valor={NOMBRES_DE_NOMBRAMIENTO[f.tipoNombramiento]} />
      <Dato titulo="Régimen de vacaciones" valor={nombreDeRegimen(f.regimenVacaciones.nombre)} detalle={f.regimenVacaciones.descripcion} />
      <Dato titulo="Fecha de ingreso" valor={formatearFechaSola(f.fechaIngreso)} num />
      <Dato titulo="Estado" valor={<ChipDeFuncionario estado={f.estado} />} />
      <Dato titulo="Personal a cargo" valor={String(f.cantidadACargo)} num />
      {f.estado === 'inactivo' && (
        <>
          <Dato titulo="Fecha de salida" valor={formatearFechaSola(f.fechaSalida)} num />
          <Dato titulo="Motivo de salida" valor={f.motivoSalida} />
        </>
      )}
      <Dato titulo="Registrado en SIGEL" valor={formatearFecha(f.fechaRegistro)} num />
    </dl>
  );
}
