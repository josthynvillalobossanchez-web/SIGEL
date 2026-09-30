/*
 * Paginas "Registrar funcionario" (/funcionarios/nuevo) y "Editar
 * funcionario" (/funcionarios/:id/editar). Mismo asistente del prototipo
 * (pgAltaFuncionario), por pasos para no tener que bajar:
 *
 *   1. Datos personales   cedula, nombre, apellidos, nacimiento y profesion.
 *   2. Contacto           correos, telefono y direccion.
 *   3. Datos laborales    puesto, departamento, jefatura, nombramiento,
 *                         regimen e ingreso.
 *   4. Cuenta de acceso   (solo al registrar) casilla "crear tambien su
 *                         cuenta", con el correo institucional y sus roles.
 *   5. Revisar            lo que se va a registrar, o la lista de cambios.
 *
 * Registrar: pasos en orden. Editar: se puede saltar entre pasos y solo se
 * manda lo que cambio. La cedula no se edita (identificador permanente).
 *
 * Las reglas se revisan aqui para avisar antes (edad minima 15 anios,
 * ingreso despues de los 15, formatos...) y el backend las revisa otra vez.
 * Si el backend rechaza algo, la pagina vuelve al paso de ese dato.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  minimoDeIngreso,
  problemaDeCedula,
  problemaDeContacto,
  problemaDeIngreso,
  problemaDeNacimiento,
  problemaDeNombres,
} from '../../utilidades/validaciones';
import { useConsulta } from '../../utilidades/useConsulta';
import { useNavigate, useParams } from 'react-router';
import { ErrorDeApi, textoDelError } from '../../api/cliente';
import {
  consultarFuncionario,
  consultarOpcionesDeFuncionario,
  editarFuncionario,
  registrarFuncionario,
  type DatosDeFuncionario,
  type DetalleDeFuncionario,
  type OpcionesDeFormulario,
} from '../../api/funcionarios';
import { consultarRoles } from '../../api/roles';
import type { CuentaCreada } from '../../api/usuarios';
import { useSesion } from '../../sesion/SesionProveedor';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { Migas } from '../../componentes/Migas';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { Icono } from '../../componentes/Icono';
import { formatearFecha, hoyEnCostaRica } from '../../utilidades/fechas';
import { nombreCompleto } from '../../utilidades/texto';
import { ContrasenaTemporal } from '../usuarios/ContrasenaTemporal';
import { aPedidos, revisarRoles, type RolesMarcados } from '../usuarios/SelectorDeRoles';
import { motivoParaEditar } from './motivos';
import { listasConActuales } from './listasDeFormulario';
import {
  PasoContacto,
  PasoCuenta,
  PasoDatosLaborales,
  PasoDatosPersonales,
  RevisarCambios,
  RevisarRegistro,
  type Formulario,
} from './PasosDeFuncionario';

const LISTA = '/funcionarios';

const CAMPOS_OPCIONALES = ['segundoApellido', 'fechaNacimiento', 'profesionId', 'correoInstitucional', 'telefonoPersonal', 'direccion', 'jefaturaId'] as const;

/** Que paso corrige cada error del backend. */
const PASO_DEL_ERROR: Record<string, number> = {
  CEDULA_EN_USO: 0,
  FECHA_NACIMIENTO_NO_VALIDA: 0,
  PROFESION_NO_VALIDA: 0,
  CORREO_INSTITUCIONAL_EN_USO: 1,
  PUESTO_NO_VALIDO: 2,
  DEPARTAMENTO_NO_VALIDO: 2,
  REGIMEN_NO_VALIDO: 2,
  JEFATURA_NO_VALIDA: 2,
  JEFATURA_CICLICA: 2,
  FECHA_INGRESO_NO_VALIDA: 2,
  CUENTA_SIN_CORREO_INSTITUCIONAL: 3,
  CORREO_EN_USO: 3,
  ROL_NO_ASIGNABLE: 3,
  ROL_INACTIVO: 3,
  CUENTA_SIN_ROL_PERMANENTE: 3,
  FECHA_VENCIMIENTO_PASADA: 3,
  FECHA_VENCIMIENTO_MUY_LEJANA: 3,
};

/* ================================================================== */

export function PaginaRegistrarFuncionario() {
  const { datos: opciones, error } = useConsulta(consultarOpcionesDeFuncionario, []);
  if (!opciones) return <Cargando titulo="Registrar funcionario" error={error} />;
  return <FormularioDeFuncionario opciones={opciones} />;
}

export function PaginaEditarFuncionario() {
  const { id = '' } = useParams();
  const { tienePermisos } = useSesion();
  const { datos, error } = useConsulta(() => Promise.all([consultarOpcionesDeFuncionario(), consultarFuncionario(id)]), [id]);
  const [opciones, detalle] = datos ?? [null, null];
  const bloqueo = detalle ? motivoParaEditar(detalle, tienePermisos) : null;
  if (!opciones || !detalle || bloqueo) {
    return <Cargando titulo="Editar funcionario" error={error} bloqueo={bloqueo} detalle={detalle} />;
  }
  return <FormularioDeFuncionario opciones={opciones} detalle={detalle} />;
}

function Cargando({ titulo, error, bloqueo, detalle }: { titulo: string; error: string | null; bloqueo?: string | null; detalle?: DetalleDeFuncionario | null }) {
  const navegar = useNavigate();
  return (
    <section className="pagina">
      <Migas migas={[{ texto: 'Funcionarios', a: LISTA }, { texto: titulo }]} />
      <div className="pagina-cab">
        <div>
          <h1>{titulo}</h1>
          {detalle && <p>{nombreCompleto(detalle)} · Cédula {detalle.cedula}</p>}
        </div>
      </div>
      {!error && !bloqueo && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {bloqueo && <Mensaje tipo="info">No puede editar este registro: {bloqueo}</Mensaje>}
      {(error || bloqueo) && (
        <button className="volver" type="button" onClick={() => navegar(LISTA)}>
          <Icono nombre="volver" tamano={17} /> Volver a funcionarios
        </button>
      )}
    </section>
  );
}

/* ================================================================== */

function FormularioDeFuncionario({ opciones, detalle }: { opciones: OpcionesDeFormulario; detalle?: DetalleDeFuncionario }) {
  const editando = Boolean(detalle);
  const { tienePermisos } = useSesion();
  const irSeguro = useIrSeguro();
  const navegar = useNavigate();
  const hoy = hoyEnCostaRica();

  const inicial = useMemo<Formulario>(
    () => ({
      cedula: detalle?.cedula ?? '',
      nombre: detalle?.nombre ?? '',
      primerApellido: detalle?.primerApellido ?? '',
      segundoApellido: detalle?.segundoApellido ?? '',
      fechaNacimiento: detalle?.fechaNacimiento ?? '',
      profesionId: detalle?.profesion?.id ?? '',
      correoPersonal: detalle?.correoPersonal ?? '',
      correoInstitucional: detalle?.correoInstitucional ?? '',
      telefonoPersonal: detalle?.telefonoPersonal ?? '',
      direccion: detalle?.direccion ?? '',
      puestoId: detalle?.puesto?.id ?? '',
      departamentoId: detalle?.departamento?.id ?? '',
      jefaturaId: detalle?.jefatura?.id ?? '',
      tipoNombramiento: detalle?.tipoNombramiento ?? 'propiedad',
      regimenVacacionesId: detalle?.regimenVacaciones.id ?? opciones.regimenes.find((r) => r.nombre === 'general')?.id ?? '',
      fechaIngreso: detalle?.fechaIngreso ?? hoy,
    }),
    [detalle, opciones, hoy],
  );

  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Formulario>(inicial);
  const [crearCuenta, setCrearCuenta] = useState(false);
  const [marcados, setMarcados] = useState<RolesMarcados>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState<{ nombre: string; cuenta: CuentaCreada | null } | null>(null);
  const [editado, setEditado] = useState<string | null>(null);

  // Un error del servidor deja de aplicar en cuanto se corrige algo.
  useEffect(() => setError(null), [datos, marcados, crearCuenta]);

  // Roles para "crear tambien su cuenta" (solo si se puede crear cuentas).
  // Si fallan, la lista queda vacia y el paso de cuenta lo explica.
  const puedeCrearCuenta = !editando && tienePermisos('usuarios.crear');
  const consultaDeRoles = useConsulta(puedeCrearCuenta ? consultarRoles : null, []);
  const roles = consultaDeRoles.error ? [] : consultaDeRoles.datos;

  const poner = (campo: keyof Formulario) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));

  /* ---------- Listas: se agregan los valores actuales aunque ya esten inactivos ---------- */
  const listas = useMemo(() => listasConActuales(opciones, detalle), [opciones, detalle]);

  /* ---------- Cambios (editar) ---------- */
  const cambios = useMemo(
    () => (Object.keys(datos) as (keyof Formulario)[]).filter((c) => c !== 'cedula' && datos[c].trim() !== inicial[c].trim()),
    [datos, inicial],
  );
  const hayCambios = editando ? cambios.length > 0 : Object.entries(datos).some(([c, v]) => v.trim() !== inicial[c as keyof Formulario].trim()) || crearCuenta;
  useCambiosSinGuardar(hayCambios && !registrado && !editado);

  // Sin correo institucional no hay cuenta desde aqui.
  const bloqueoCuenta = !tienePermisos('usuarios.crear')
    ? 'su cuenta no tiene permiso para crear cuentas de usuario. Regístrelo sin cuenta; alguien con ese permiso la crea después desde Usuarios.'
    : !datos.correoInstitucional.trim()
      ? 'hace falta el correo institucional (paso «Contacto»): es el correo de ingreso. También puede crear la cuenta después desde Usuarios con otro correo.'
      : null;
  useEffect(() => {
    if (bloqueoCuenta && crearCuenta) setCrearCuenta(false);
  }, [bloqueoCuenta, crearCuenta]);

  function alternarCuenta() {
    if (bloqueoCuenta) return;
    const nuevo = !crearCuenta;
    setCrearCuenta(nuevo);
    // Al marcarla, se propone "Solicitante" (autoservicio de todo funcionario).
    if (nuevo && Object.keys(marcados).length === 0) {
      const solicitante = roles?.find((r) => r.nombre === 'Solicitante' && r.asignable && r.activo);
      if (solicitante) setMarcados({ [solicitante.id]: { conFecha: false, fecha: '' } });
    }
  }

  /* ---------- Revision de cada paso ---------- */
  // Reglas comunes (utilidades/validaciones.ts), iguales al backend.
  const minimoIngreso = minimoDeIngreso(datos.fechaNacimiento || null);
  const errorNacimiento = problemaDeNacimiento(datos.fechaNacimiento, hoy);
  const errorIngreso = problemaDeIngreso(datos.fechaIngreso, datos.fechaNacimiento || null, hoy);

  function revisarPaso(indice: number): string | null {
    if (indice === 0) {
      const cedula = editando ? null : problemaDeCedula(datos.cedula);
      if (cedula) return cedula;
      const nombres = problemaDeNombres(datos);
      if (nombres) return nombres;
      if (errorNacimiento) return `Fecha de nacimiento: ${errorNacimiento}`;
    }
    if (indice === 1) {
      const contacto = problemaDeContacto(datos);
      if (contacto) return contacto;
    }
    if (indice === 2) {
      if (!datos.puestoId) return 'Elija el puesto.';
      if (!datos.departamentoId) return 'Elija el departamento.';
      if (!datos.regimenVacacionesId) return 'Elija el régimen de vacaciones.';
      if (!datos.fechaIngreso) return 'Indique la fecha de ingreso.';
      if (errorIngreso) return `Fecha de ingreso: ${errorIngreso}`;
    }
    if (indice === 3 && !editando && crearCuenta) {
      return revisarRoles(marcados, (id) => roles?.find((r) => r.id === id)?.nombre ?? 'Rol');
    }
    return null;
  }

  /** "" -> null en los campos opcionales; texto recortado en los demas. */
  function aEnviar(campo: keyof Formulario): string | null {
    const valor = datos[campo].trim();
    return valor === '' && (CAMPOS_OPCIONALES as readonly string[]).includes(campo) ? null : valor;
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      if (!detalle) {
        const cuerpo = Object.fromEntries((Object.keys(datos) as (keyof Formulario)[]).map((c) => [c, aEnviar(c)])) as unknown as DatosDeFuncionario;
        const r = await registrarFuncionario({ ...cuerpo, ...(crearCuenta ? { cuenta: { roles: aPedidos(marcados) } } : {}) });
        setRegistrado({ nombre: nombreCompleto(r.funcionario), cuenta: r.cuenta });
      } else {
        const cuerpo = Object.fromEntries(cambios.map((c) => [c, aEnviar(c)]));
        const r = await editarFuncionario(detalle.id, cuerpo);
        setEditado(nombreCompleto(r));
      }
    } catch (e) {
      setError(textoDelError(e));
      const destino = e instanceof ErrorDeApi ? PASO_DEL_ERROR[e.codigo] : undefined;
      if (destino !== undefined && (editando ? destino < 3 : true)) setPaso(destino);
    } finally {
      setOcupado(false);
    }
  }

  /* ---------- Pasos ---------- */
  const PASOS: PasoDeFormulario[] = [
    {
      titulo: 'Datos personales',
      sub: 'Cédula y nombre',
      descripcion: editando
        ? 'La cédula es el identificador permanente de la persona y no se cambia.'
        : 'Identifican a la persona. La cédula queda como identificador permanente y no se puede repetir en el sistema.',
    },
    {
      titulo: 'Contacto',
      sub: 'Correos y teléfono',
      descripcion: 'El correo personal es obligatorio: es a donde llegan los avisos del sistema cuando la persona no tiene correo institucional.',
    },
    { titulo: 'Datos laborales', sub: 'Puesto y jefatura', descripcion: 'Definen su relación con la Municipalidad y quién aprueba sus trámites.' },
    ...(editando
      ? []
      : [
          {
            titulo: 'Cuenta de acceso',
            sub: 'Opcional',
            descripcion: 'Si la persona va a usar SINERGIA, se le puede crear la cuenta ahora mismo: funcionario y cuenta se guardan juntos, o ninguno.',
          },
        ]),
    {
      titulo: editando ? 'Revisar y guardar' : 'Revisar y registrar',
      sub: editando ? 'Lo que va a cambiar' : 'Confirmar los datos',
      descripcion: editando
        ? 'Revise los cambios. Se guardan todos juntos y quedan en la bitácora (de ahí sale el historial laboral).'
        : 'Revise los datos antes de registrar. Al guardar se crea también su expediente laboral.',
    },
  ];
  const ultimo = PASOS.length - 1;

  return (
    <>
      <FormularioPorPasos
        migas={
          detalle
            ? [{ texto: 'Funcionarios', a: LISTA }, { texto: nombreCompleto(detalle), a: `${LISTA}?ver=${detalle.id}` }, { texto: 'Editar funcionario' }]
            : [{ texto: 'Funcionarios', a: LISTA }, { texto: 'Registrar funcionario' }]
        }
        titulo={editando ? 'Editar funcionario' : 'Registrar funcionario'}
        descripcion={
          detalle ? (
            <>
              <b>{nombreCompleto(detalle)}</b> · Cédula {detalle.cedula}
            </>
          ) : (
            'Al guardar se crea automáticamente su expediente laboral. La cédula no se puede repetir.'
          )
        }
        pasos={PASOS}
        actual={paso}
        alCambiarPaso={setPaso}
        revisarPaso={revisarPaso}
        libre={editando}
        alCancelar={() => irSeguro(LISTA)}
        alGuardar={() => void guardar()}
        textoGuardar={editando ? 'Guardar cambios' : 'Registrar funcionario'}
        bloqueoGuardar={editando && !hayCambios ? 'no hay cambios que guardar.' : null}
        ocupado={ocupado}
        error={error}
        claveDeDatos={JSON.stringify([datos, crearCuenta, marcados])}
      >
        {paso === 0 && (
          <PasoDatosPersonales datos={datos} poner={poner} editando={editando} listas={listas} opciones={opciones} errorNacimiento={errorNacimiento} hoy={hoy} />
        )}
        {paso === 1 && <PasoContacto datos={datos} poner={poner} editando={editando} detalle={detalle} />}
        {paso === 2 && (
          <PasoDatosLaborales
            datos={datos}
            poner={poner}
            listas={listas}
            opciones={opciones}
            minimoIngreso={minimoIngreso}
            errorIngreso={errorIngreso}
            hoy={hoy}
          />
        )}
        {!editando && paso === 3 && (
          <PasoCuenta
            datos={datos}
            crearCuenta={crearCuenta}
            bloqueoCuenta={bloqueoCuenta}
            alAlternar={alternarCuenta}
            roles={roles}
            marcados={marcados}
            alCambiarRoles={setMarcados}
          />
        )}
        {paso === ultimo && !editando && <RevisarRegistro datos={datos} listas={listas} crearCuenta={crearCuenta} marcados={marcados} roles={roles} />}
        {paso === ultimo && editando && <RevisarCambios cambios={cambios} inicial={inicial} datos={datos} listas={listas} />}
      </FormularioPorPasos>

      {registrado && (
        <ModalExito titulo="Funcionario registrado con éxito" alAceptar={() => navegar(LISTA)}>
          <p>
            <b>{registrado.nombre}</b> quedó registrado y su expediente laboral ya existe.
          </p>
          {registrado.cuenta && (
            <>
              <p className="nota-modal" style={{ margin: '10px 0 6px' }}>
                Cuenta: {registrado.cuenta.correo} · Roles:{' '}
                {registrado.cuenta.roles.map((r) => (r.fechaVencimiento ? `${r.nombre} (hasta ${formatearFecha(r.fechaVencimiento)})` : r.nombre)).join(', ')}
              </p>
              <ContrasenaTemporal contrasena={registrado.cuenta.contrasenaTemporal} />
            </>
          )}
        </ModalExito>
      )}
      {editado && (
        <ModalExito titulo="Funcionario actualizado con éxito" alAceptar={() => navegar(LISTA)}>
          <p>
            Se guardaron los cambios de <b>{editado}</b>. Quedaron registrados en la bitácora y en su historial laboral.
          </p>
        </ModalExito>
      )}
    </>
  );
}
