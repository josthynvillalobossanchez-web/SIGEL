/*
 * Paginas "Registrar funcionario" (/funcionarios/nuevo) y "Editar
 * funcionario" (/funcionarios/:id/editar). Mismo asistente del prototipo
 * (pgAltaFuncionario), por pasos para no tener que bajar:
 *
 *   1. Datos personales   cedula, nombre, apellidos, nacimiento y profesion.
 *   2. Contacto           correos, telefono y direccion.
 *   3. Datos laborales    puesto, departamento, jefatura, nombramiento,
 *                         regimen, ingreso y codigo de empleado.
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
import { useNavigate, useParams } from 'react-router';
import { ErrorDeApi, textoDelError } from '../../api/cliente';
import {
  consultarFuncionario,
  consultarOpcionesDeFuncionario,
  editarFuncionario,
  NOMBRES_DE_NOMBRAMIENTO,
  nombreDeRegimen,
  registrarFuncionario,
  type DatosDeFuncionario,
  type DetalleDeFuncionario,
  type OpcionesDeFormulario,
  type TipoDeNombramiento,
} from '../../api/funcionarios';
import { consultarRoles, type RolResumido } from '../../api/roles';
import type { CuentaCreada } from '../../api/usuarios';
import { useSesion } from '../../sesion/SesionProveedor';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Migas } from '../../componentes/Migas';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { Icono } from '../../componentes/Icono';
import { formatearFecha, formatearFechaSola, hoyEnCostaRica, sumarAnios } from '../../utilidades/fechas';
import {
  LARGO_APELLIDO,
  LARGO_NOMBRE,
  MENSAJE_TELEFONO,
  nombreCompleto,
  normalizarCedula,
  normalizarTelefono,
  problemaDeNombre,
} from '../../utilidades/texto';
import { ContrasenaTemporal } from '../usuarios/ContrasenaTemporal';
import { aPedidos, revisarRoles, SelectorDeRoles, type RolesMarcados } from '../usuarios/SelectorDeRoles';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { motivoParaEditar } from './motivos';

const LISTA = '/funcionarios';
const EDAD_MINIMA = 15;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** El formulario completo, todo como texto ("" = vacio). */
type Formulario = Record<keyof DatosDeFuncionario, string>;

const CAMPOS_OPCIONALES = ['segundoApellido', 'fechaNacimiento', 'profesionId', 'correoInstitucional', 'telefonoPersonal', 'direccion', 'jefaturaId', 'numeroEmpleado'] as const;

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
  NUMERO_EMPLEADO_EN_USO: 2,
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
  const [opciones, setOpciones] = useState<OpcionesDeFormulario | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    consultarOpcionesDeFuncionario()
      .then(setOpciones)
      .catch((e) => setError(textoDelError(e)));
  }, []);
  if (!opciones) return <Cargando titulo="Registrar funcionario" error={error} />;
  return <FormularioDeFuncionario opciones={opciones} />;
}

export function PaginaEditarFuncionario() {
  const { id = '' } = useParams();
  const { tienePermisos } = useSesion();
  const [opciones, setOpciones] = useState<OpcionesDeFormulario | null>(null);
  const [detalle, setDetalle] = useState<DetalleDeFuncionario | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([consultarOpcionesDeFuncionario(), consultarFuncionario(id)])
      .then(([o, d]) => {
        setOpciones(o);
        setDetalle(d);
      })
      .catch((e) => setError(textoDelError(e)));
  }, [id]);
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
      numeroEmpleado: detalle?.numeroEmpleado ?? '',
    }),
    [detalle, opciones, hoy],
  );

  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Formulario>(inicial);
  const [crearCuenta, setCrearCuenta] = useState(false);
  const [roles, setRoles] = useState<RolResumido[] | null>(null);
  const [marcados, setMarcados] = useState<RolesMarcados>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState<{ nombre: string; cuenta: CuentaCreada | null } | null>(null);
  const [editado, setEditado] = useState<string | null>(null);

  // Un error del servidor deja de aplicar en cuanto se corrige algo.
  useEffect(() => setError(null), [datos, marcados, crearCuenta]);

  const puedeCrearCuenta = !editando && tienePermisos('usuarios.crear');
  useEffect(() => {
    if (puedeCrearCuenta) consultarRoles().then(setRoles).catch(() => setRoles([]));
  }, [puedeCrearCuenta]);

  const poner = (campo: keyof Formulario) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));

  /* ---------- Listas: se agregan los valores actuales aunque ya esten inactivos ---------- */
  const listas = useMemo(() => {
    const conActual = <T extends { id: string; nombre: string }>(lista: T[], actual: { id: string; nombre: string } | null | undefined) =>
      actual && !lista.some((x) => x.id === actual.id) ? [...lista, { ...actual, nombre: `${actual.nombre} (inactivo)` } as T] : lista;
    return {
      puestos: conActual(opciones.puestos, detalle?.puesto),
      departamentos: conActual(opciones.departamentos, detalle?.departamento),
      profesiones: conActual(opciones.profesiones, detalle?.profesion),
      regimenes: conActual(opciones.regimenes, detalle?.regimenVacaciones),
      // Nadie es su propia jefatura.
      jefaturas: opciones.jefaturas.filter((j) => j.id !== detalle?.id),
    };
  }, [opciones, detalle]);

  const nombreDe = (lista: { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? '';
  const textoDe = (campo: keyof Formulario, valor: string): string => {
    if (!valor) return campo === 'jefaturaId' ? 'Sin jefatura (tope de la jerarquía)' : '—';
    switch (campo) {
      case 'puestoId':
        return nombreDe(listas.puestos, valor);
      case 'departamentoId':
        return nombreDe(listas.departamentos, valor);
      case 'profesionId':
        return nombreDe(listas.profesiones, valor);
      case 'regimenVacacionesId':
        return nombreDeRegimen(nombreDe(listas.regimenes, valor));
      case 'jefaturaId':
        return nombreDe(listas.jefaturas, valor);
      case 'tipoNombramiento':
        return NOMBRES_DE_NOMBRAMIENTO[valor as TipoDeNombramiento];
      case 'fechaNacimiento':
      case 'fechaIngreso':
        return formatearFechaSola(valor);
      default:
        return valor;
    }
  };

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
  const minimoIngreso = datos.fechaNacimiento ? sumarAnios(datos.fechaNacimiento, EDAD_MINIMA) : '1950-01-01';
  const errorNacimiento =
    datos.fechaNacimiento && (datos.fechaNacimiento > sumarAnios(hoy, -EDAD_MINIMA) || datos.fechaNacimiento < '1900-01-01')
      ? `La persona debe tener al menos ${EDAD_MINIMA} años.`
      : null;
  const errorIngreso = !datos.fechaIngreso
    ? null
    : datos.fechaIngreso < minimoIngreso
      ? datos.fechaNacimiento
        ? `No puede ser antes de que cumpliera ${EDAD_MINIMA} años (${formatearFechaSola(minimoIngreso)}).`
        : 'Debe ser desde 1950.'
      : datos.fechaIngreso > sumarAnios(hoy, 1)
        ? 'No puede pasar de un año hacia adelante.'
        : null;

  function revisarPaso(indice: number): string | null {
    const t = (c: keyof Formulario) => datos[c].trim();
    if (indice === 0) {
      if (!editando) {
        const cedula = t('cedula').replace(/\s+/g, '');
        if (!cedula) return 'Escriba la cédula.';
        if (!/^[0-9A-Za-z-]{5,20}$/.test(cedula)) return 'La cédula solo puede tener números, letras y guiones (entre 5 y 20).';
      }
      const nombre = problemaDeNombre(datos.nombre, 'El nombre', LARGO_NOMBRE, 5);
      if (nombre) return nombre;
      const apellido = problemaDeNombre(datos.primerApellido, 'El primer apellido', LARGO_APELLIDO, 4);
      if (apellido) return apellido;
      if (t('segundoApellido')) {
        const segundo = problemaDeNombre(datos.segundoApellido, 'El segundo apellido', LARGO_APELLIDO, 4);
        if (segundo) return segundo;
      }
      if (errorNacimiento) return `Fecha de nacimiento: ${errorNacimiento}`;
    }
    if (indice === 1) {
      if (!t('correoPersonal')) return 'El correo personal es obligatorio: es el canal de respaldo para los avisos.';
      if (!CORREO.test(t('correoPersonal'))) return 'El correo personal no tiene un formato válido.';
      if (t('correoInstitucional') && !CORREO.test(t('correoInstitucional'))) return 'El correo institucional no tiene un formato válido.';
      if (t('telefonoPersonal') && !normalizarTelefono(t('telefonoPersonal'))) return MENSAJE_TELEFONO;
    }
    if (indice === 2) {
      if (!datos.puestoId) return 'Elija el puesto.';
      if (!datos.departamentoId) return 'Elija el departamento.';
      if (!datos.regimenVacacionesId) return 'Elija el régimen de vacaciones.';
      if (!datos.fechaIngreso) return 'Indique la fecha de ingreso.';
      if (errorIngreso) return `Fecha de ingreso: ${errorIngreso}`;
      if (t('numeroEmpleado') && !/^[0-9A-Za-z-]{1,30}$/.test(t('numeroEmpleado'))) return 'El código de empleado solo puede tener números, letras y guiones.';
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
            descripcion: 'Si la persona va a usar SIGEL, se le puede crear la cuenta ahora mismo: funcionario y cuenta se guardan juntos, o ninguno.',
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
  const nombre = nombreCompleto({ nombre: datos.nombre || '—', primerApellido: datos.primerApellido, segundoApellido: datos.segundoApellido || null });

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
        {/* ---------------- 1. Datos personales ---------------- */}
        {paso === 0 && (
          <div className="campo-fila">
            <div className="campo">
              <label htmlFor="fnCedula">Cédula {!editando && <span className="obligatorio">*</span>}</label>
              <input
                id="fnCedula"
                value={datos.cedula}
                onChange={(e) => poner('cedula')(e.target.value)}
                placeholder="2-0678-0432"
                maxLength={25}
                readOnly={editando}
                aria-readonly={editando || undefined}
                aria-required={!editando || undefined}
                style={{ fontVariantNumeric: 'tabular-nums' }}
                autoComplete="off"
              />
              <span className="ayuda">{editando ? 'No se puede cambiar.' : 'Con o sin guiones. También DIMEX o pasaporte.'}</span>
            </div>
            <Texto id="fnNombre" etiqueta="Nombre" obligatorio valor={datos.nombre} alCambiar={poner('nombre')} max={LARGO_NOMBRE} />
            <Texto id="fnAp1" etiqueta="Primer apellido" obligatorio valor={datos.primerApellido} alCambiar={poner('primerApellido')} max={LARGO_APELLIDO} />
            <Texto id="fnAp2" etiqueta="Segundo apellido" valor={datos.segundoApellido} alCambiar={poner('segundoApellido')} max={LARGO_APELLIDO} />
            <CampoFecha
              id="fnNac"
              etiqueta="Fecha de nacimiento"
              valor={datos.fechaNacimiento}
              alCambiar={poner('fechaNacimiento')}
              max={sumarAnios(hoy, -EDAD_MINIMA)}
              min="1900-01-01"
              error={errorNacimiento}
            />
            <Lista
              id="fnProf"
              etiqueta="Profesión"
              valor={datos.profesionId}
              alCambiar={poner('profesionId')}
              opciones={listas.profesiones}
              vacio="Sin profesión"
              ayuda={opciones.profesiones.length === 0 ? 'Todavía no hay profesiones: se agregan en Catálogos de personal.' : undefined}
            />
          </div>
        )}

        {/* ---------------- 2. Contacto ---------------- */}
        {paso === 1 && (
          <>
            <div className="campo-fila">
              <Texto
                id="fnCorreoP"
                etiqueta="Correo personal"
                obligatorio
                tipo="email"
                valor={datos.correoPersonal}
                alCambiar={poner('correoPersonal')}
                max={150}
                ayuda="Obligatorio: es el canal de respaldo si no tiene correo institucional."
              />
              <Texto
                id="fnCorreoI"
                etiqueta="Correo institucional"
                tipo="email"
                valor={datos.correoInstitucional}
                alCambiar={poner('correoInstitucional')}
                max={150}
                placeholder="nombre@munipalmares.go.cr"
                ayuda={editando && detalle?.cuenta ? `No cambia el correo con el que inicia sesión (${detalle.cuenta.correo}).` : 'Si tiene, es el correo con el que iniciará sesión.'}
              />
              <Texto
                id="fnTel"
                etiqueta="Teléfono"
                tipo="tel"
                valor={datos.telefonoPersonal}
                alCambiar={poner('telefonoPersonal')}
                max={16}
                placeholder="8712-4408"
                ayuda="8 dígitos de Costa Rica. Se guarda como 8712-4408."
                alSalir={() => {
                  const normal = normalizarTelefono(datos.telefonoPersonal);
                  if (normal) poner('telefonoPersonal')(normal);
                }}
              />
            </div>
            <div className="campo ancho">
              <label htmlFor="fnDir">Dirección exacta</label>
              <textarea
                id="fnDir"
                rows={2}
                maxLength={255}
                value={datos.direccion}
                onChange={(e) => poner('direccion')(e.target.value)}
                placeholder="Provincia, cantón, distrito y señas exactas"
              />
            </div>
          </>
        )}

        {/* ---------------- 3. Datos laborales ---------------- */}
        {paso === 2 && (
          <>
            <Mensaje tipo="info">
              Solo Recursos Humanos registra o modifica estos campos. El funcionario nunca los edita, ni desde su propio perfil.
            </Mensaje>
            <div className="campo-fila">
              <Lista
                id="fnPuesto"
                etiqueta="Puesto"
                obligatorio
                valor={datos.puestoId}
                alCambiar={poner('puestoId')}
                opciones={listas.puestos}
                ayuda={opciones.puestos.length === 0 ? 'Todavía no hay puestos: se agregan en Catálogos de personal.' : undefined}
              />
              <Lista
                id="fnDepto"
                etiqueta="Departamento"
                obligatorio
                valor={datos.departamentoId}
                alCambiar={poner('departamentoId')}
                opciones={listas.departamentos}
                ayuda={opciones.departamentos.length === 0 ? 'Todavía no hay departamentos: se agregan en Catálogos de personal.' : undefined}
              />
              <Lista
                id="fnJefe"
                etiqueta="Jefatura inmediata"
                valor={datos.jefaturaId}
                alCambiar={poner('jefaturaId')}
                opciones={listas.jefaturas.map((j) => ({ id: j.id, nombre: j.puesto ? `${j.nombre} · ${j.puesto}` : j.nombre }))}
                vacio="— Sin jefatura: tope de la jerarquía —"
                ayuda={
                  listas.jefaturas.length === 0
                    ? 'Todavía nadie puede ser jefatura: se necesita una cuenta con el rol Aprobador permanente (se asigna en Usuarios).'
                    : 'Solo aparecen quienes tienen el rol Aprobador permanente (las suplencias con fecha no cuentan).'
                }
              />
              <div className="campo">
                <label htmlFor="fnNombramiento">
                  Tipo de nombramiento <span className="obligatorio">*</span>
                </label>
                <select id="fnNombramiento" value={datos.tipoNombramiento} onChange={(e) => poner('tipoNombramiento')(e.target.value)} aria-required="true">
                  {opciones.tiposNombramiento.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.texto}
                    </option>
                  ))}
                </select>
              </div>
              <Lista
                id="fnRegimen"
                etiqueta="Régimen de vacaciones"
                obligatorio
                valor={datos.regimenVacacionesId}
                alCambiar={poner('regimenVacacionesId')}
                opciones={listas.regimenes.map((r) => ({ id: r.id, nombre: `${nombreDeRegimen(r.nombre)}${r.descripcion ? ` — ${r.descripcion}` : ''}` }))}
              />
              <CampoFecha
                id="fnIngreso"
                etiqueta="Fecha de ingreso"
                obligatorio
                valor={datos.fechaIngreso}
                alCambiar={poner('fechaIngreso')}
                min={minimoIngreso}
                max={sumarAnios(hoy, 1)}
                error={errorIngreso}
              />
              <Texto
                id="fnCodigo"
                etiqueta="Código de empleado"
                valor={datos.numeroEmpleado}
                alCambiar={poner('numeroEmpleado')}
                max={30}
                ayuda="Opcional. No se repite."
              />
            </div>
          </>
        )}

        {/* ---------------- 4. Cuenta de acceso (solo registrar) ---------------- */}
        {!editando && paso === 3 && (
          <>
            <label className="check casilla-grande" data-bloqueado={bloqueoCuenta ? 'si' : 'no'} data-ayuda={bloqueoCuenta ?? undefined}>
              <input type="checkbox" checked={crearCuenta} onChange={alternarCuenta} aria-disabled={bloqueoCuenta ? true : undefined} aria-describedby="cuentaDesc" />
              <span className="txt">
                <b>Crear también su cuenta de acceso</b>
                <span id="cuentaDesc">
                  {bloqueoCuenta
                    ? `No disponible: ${bloqueoCuenta}`
                    : `Correo de ingreso: ${datos.correoInstitucional.trim().toLowerCase()}. La contraseña temporal la genera el sistema, se muestra una sola vez y se envía por correo.`}
                </span>
              </span>
            </label>
            {crearCuenta && <SelectorDeRoles roles={roles} iniciales={{}} marcados={marcados} alCambiar={setMarcados} />}
            {!crearCuenta && !bloqueoCuenta && (
              <p className="nota-modal" style={{ marginTop: 12 }}>
                Si no la crea ahora, se puede crear después desde Usuarios → Crear usuario.
              </p>
            )}
          </>
        )}

        {/* ---------------- Revisar ---------------- */}
        {paso === ultimo && !editando && (
          <div className="revisar-bloques">
            <Bloque titulo="Persona">
              <DatoRevisar t="Nombre completo" v={nombre} />
              <DatoRevisar t="Cédula" v={normalizarCedula(datos.cedula)} />
              <DatoRevisar t="Nacimiento" v={textoDe('fechaNacimiento', datos.fechaNacimiento)} />
              <DatoRevisar t="Profesión" v={textoDe('profesionId', datos.profesionId)} />
              <DatoRevisar t="Correo personal" v={datos.correoPersonal.trim().toLowerCase()} />
              <DatoRevisar t="Correo institucional" v={datos.correoInstitucional.trim().toLowerCase() || '—'} />
              <DatoRevisar t="Teléfono" v={normalizarTelefono(datos.telefonoPersonal) ?? (datos.telefonoPersonal || '—')} />
              <DatoRevisar t="Dirección" v={datos.direccion || '—'} />
            </Bloque>
            <Bloque titulo="Trabajo y acceso">
              <DatoRevisar t="Puesto" v={textoDe('puestoId', datos.puestoId)} />
              <DatoRevisar t="Departamento" v={textoDe('departamentoId', datos.departamentoId)} />
              <DatoRevisar t="Jefatura" v={textoDe('jefaturaId', datos.jefaturaId)} />
              <DatoRevisar t="Nombramiento" v={textoDe('tipoNombramiento', datos.tipoNombramiento)} />
              <DatoRevisar t="Régimen" v={textoDe('regimenVacacionesId', datos.regimenVacacionesId)} />
              <DatoRevisar t="Ingreso" v={textoDe('fechaIngreso', datos.fechaIngreso)} />
              <DatoRevisar t="Código de empleado" v={datos.numeroEmpleado || '—'} />
              <DatoRevisar
                t="Cuenta de acceso"
                v={
                  crearCuenta
                    ? `${datos.correoInstitucional.trim().toLowerCase()} · ${Object.keys(marcados)
                        .map((id) => roles?.find((r) => r.id === id)?.nombre)
                        .join(', ')}`
                    : 'No se crea ahora'
                }
              />
            </Bloque>
          </div>
        )}
        {paso === ultimo && editando && (
          cambios.length === 0 ? (
            <Mensaje tipo="info">Todavía no hay cambios. Vaya a cualquier paso para modificar algo.</Mensaje>
          ) : (
            <div className="tabla-envoltura tabla-compacta">
              <table>
                <caption className="solo-lector">Cambios que se van a guardar</caption>
                <thead>
                  <tr>
                    <th scope="col">Dato</th>
                    <th scope="col">Antes</th>
                    <th scope="col">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {cambios.map((c) => (
                    <tr key={c}>
                      <td data-etiqueta="Dato">{ETIQUETAS[c]}</td>
                      <td data-etiqueta="Antes">{textoDe(c, inicial[c].trim())}</td>
                      <td data-etiqueta="Después">
                        <b>{textoDe(c, datos[c].trim())}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
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

/** Nombre de cada campo en la tabla de cambios. */
const ETIQUETAS: Record<keyof Formulario, string> = {
  cedula: 'Cédula',
  nombre: 'Nombre',
  primerApellido: 'Primer apellido',
  segundoApellido: 'Segundo apellido',
  fechaNacimiento: 'Fecha de nacimiento',
  profesionId: 'Profesión',
  correoPersonal: 'Correo personal',
  correoInstitucional: 'Correo institucional',
  telefonoPersonal: 'Teléfono',
  direccion: 'Dirección',
  puestoId: 'Puesto',
  departamentoId: 'Departamento',
  jefaturaId: 'Jefatura inmediata',
  tipoNombramiento: 'Tipo de nombramiento',
  regimenVacacionesId: 'Régimen de vacaciones',
  fechaIngreso: 'Fecha de ingreso',
  numeroEmpleado: 'Código de empleado',
};

/* ------------------------------------------------------------------ */
/* Piezas pequenas del formulario                                      */
/* ------------------------------------------------------------------ */

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="info-bloque">
      <h3>{titulo}</h3>
      <dl className="info-rejilla">{children}</dl>
    </section>
  );
}

function DatoRevisar({ t, v }: { t: string; v: string }) {
  return (
    <div className="dato">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  );
}
