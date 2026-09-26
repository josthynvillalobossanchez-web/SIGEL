/*
 * Pagina "Mi cuenta" (seccion pgCuenta del prototipo).
 *
 * Arriba, la tarjeta de perfil con el degradado: fotografia (o las iniciales
 * del nombre si no hay foto), nombre, cedula y correo, estado y roles, y los
 * datos rapidos (puesto, departamento, ingreso, ultimo acceso).
 * Debajo, tres pestanas centradas (pedido de Josthyn, 27/09):
 *   - Mis datos personales: TODOS los datos personales. Con
 *     perfilPropio.editar se cambian aqui (todo menos la cedula, que la
 *     corrige RRHH desde Funcionarios); sin el permiso, solo se ven.
 *   - Datos laborales: TODOS los datos laborales. Todos los ven; solo quien
 *     tiene funcionarios.editar (Recursos Humanos) los cambia, tambien los
 *     suyos (decision de Josthyn, 28/09).
 *   - Acceso y seguridad: datos de acceso, roles y cambio de contrasena.
 *
 * Las vistas de solo lectura son las mismas de Funcionarios y Usuarios
 * (paginas/funcionarios/DatosDeFuncionario.tsx). Todo es sobre la persona
 * conectada: el backend toma su id de la sesion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import * as apiAutenticacion from '../../api/autenticacion';
import {
  actualizarMisDatos,
  actualizarMisDatosLaborales,
  consultarMiCuenta,
  type DatosLaborales,
  type DatosPersonales,
  type PerfilPropio,
} from '../../api/miCuenta';
import { nombreDeRegimen, type DetalleDeFuncionario, type OpcionesDeFormulario } from '../../api/funcionarios';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { RequisitosDeContrasena } from '../../componentes/RequisitosDeContrasena';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { revisarFechasDeVencimiento } from '../../componentes/CampoFechaDeVencimiento';
import { ChipDeEstadoDeCuenta } from '../usuarios/ChipDeEstadoDeCuenta';
import { DatosLaboralesVista, DatosPersonalesVista } from '../funcionarios/DatosDeFuncionario';
import { ChipDeFuncionario } from '../funcionarios/ChipDeFuncionario';
import { formatearFecha, formatearFechaHora, formatearFechaSola, hoyEnCostaRica, sumarAnios } from '../../utilidades/fechas';
import {
  inicialesDeFuncionario,
  inicialesDesdeCorreo,
  LARGO_APELLIDO,
  LARGO_NOMBRE,
  MENSAJE_TELEFONO,
  nombreCompleto,
  normalizarTelefono,
  problemaDeNombre,
} from '../../utilidades/texto';
import { revisarContrasenaNueva } from '../../utilidades/politica-contrasena';

const EDAD_MINIMA = 15;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MiCuenta() {
  const [perfil, setPerfil] = useState<PerfilPropio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState('datos');
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    consultarMiCuenta()
      .then(setPerfil)
      .catch((e) => setError(textoDelError(e)));
  }, []);

  if (error && !perfil) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!perfil) return <p style={{ color: 'var(--texto-sec)' }}>Cargando su cuenta…</p>;

  const f = perfil.funcionario;
  const iniciales = f ? inicialesDeFuncionario(f) : inicialesDesdeCorreo(perfil.cuenta.correo);

  return (
    <section className="pagina">
      {/* ---------------- Tarjeta de perfil ---------------- */}
      <section className="perfil mc-perfil" aria-label="Mi perfil">
        <div className="perfil-foto">
          <span aria-hidden="true">{iniciales}</span>
          <span className="solo-lector">{f ? 'Sin fotografía: se muestran sus iniciales.' : 'Cuenta técnica sin fotografía.'}</span>
          <BotonConAyuda
            clase="cambiar"
            texto="Cambiar mi fotografía"
            bloqueadoPor="la carga de la fotografía se habilita con la gestión documental (épica 3)."
          >
            <Icono nombre="camara" tamano={16} />
          </BotonConAyuda>
        </div>
        <h1>{f ? nombreCompleto(f) : 'Cuenta técnica de Informática'}</h1>
        <p className="ident">
          {f ? `Cédula ${f.cedula} · ` : ''}
          {perfil.cuenta.correo}
        </p>
        <div className="chips">
          <ChipDeEstadoDeCuenta cuenta={{ estado: perfil.cuenta.estado, bloqueadoHasta: null, debeCambiarContrasena: false }} />
          {perfil.cuenta.roles.map((rol) => (
            <span className="chip-rol sistema" key={rol}>
              {rol}
            </span>
          ))}
        </div>
        <dl className="perfil-rapido">
          <div>
            <dt>Puesto</dt>
            <dd>{f?.puesto?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt>Departamento</dt>
            <dd>{f?.departamento?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt>Ingreso</dt>
            <dd className="num">{f ? formatearFechaSola(f.fechaIngreso) : '—'}</dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd className="num">{formatearFechaHora(perfil.cuenta.ultimoAcceso)}</dd>
          </div>
        </dl>
      </section>

      {/* Pestanas y su contenido, centrados con el mismo ancho de siempre. */}
      <div className="mc-centro">
        <Pestanas
          prefijo="mc"
          etiqueta="Secciones de mi cuenta"
          actual={pestana}
          alCambiar={(id) => {
            setAviso(null);
            setPestana(id);
          }}
          opciones={[
            { id: 'datos', texto: 'Mis datos personales' },
            { id: 'laborales', texto: 'Datos laborales' },
            { id: 'acceso', texto: 'Acceso y seguridad' },
          ]}
        />
        <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>

        <PanelDePestana id="datos" actual={pestana} prefijo="mc">
          {!f ? (
            <SinFuncionario />
          ) : perfil.puedeEditarDatos ? (
            <FormularioPersonal
              perfil={perfil}
              f={f}
              alEditar={() => setAviso(null)}
              alGuardar={(nuevo) => {
                setPerfil(nuevo);
                setAviso('Sus datos personales se guardaron. El cambio quedó registrado en la bitácora.');
              }}
            />
          ) : (
            <SoloLectura nota="Su cuenta no tiene permiso para cambiar sus datos personales. Si algo no está bien, avísele a Recursos Humanos.">
              <DatosPersonalesVista f={f} />
            </SoloLectura>
          )}
        </PanelDePestana>

        <PanelDePestana id="laborales" actual={pestana} prefijo="mc">
          {!f ? (
            <SinFuncionario />
          ) : perfil.puedeEditarLaborales && perfil.opcionesLaborales ? (
            <FormularioLaboral
              f={f}
              opciones={perfil.opcionesLaborales}
              alEditar={() => setAviso(null)}
              alGuardar={(nuevo) => {
                setPerfil(nuevo);
                setAviso('Sus datos laborales se guardaron. El cambio quedó registrado en la bitácora y en su historial laboral.');
              }}
            />
          ) : (
            <SoloLectura nota="Estos datos solo los modifica Recursos Humanos. Si algo no está bien, avísele.">
              <DatosLaboralesVista f={f} />
            </SoloLectura>
          )}
        </PanelDePestana>

        <PanelDePestana id="acceso" actual={pestana} prefijo="mc">
          <div className="cuenta-rejilla">
            <div className="card bloque">
              <h2>Datos de acceso</h2>
              <dl className="lista-datos">
                <div>
                  <dt>Correo de ingreso</dt>
                  <dd>{perfil.cuenta.correo}</dd>
                </div>
                <div>
                  <dt>Último acceso</dt>
                  <dd className="num">{formatearFechaHora(perfil.cuenta.ultimoAcceso)}</dd>
                </div>
                <div>
                  <dt>Cuenta creada</dt>
                  <dd className="num">{formatearFecha(perfil.cuenta.fechaCreacion)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <ChipDeEstadoDeCuenta cuenta={{ estado: perfil.cuenta.estado, bloqueadoHasta: null, debeCambiarContrasena: false }} />
                  </dd>
                </div>
              </dl>
            </div>
            <div className="card bloque">
              <h2>Roles asignados</h2>
              <p className="nota-bloque">Sus roles definen lo que puede hacer. Solo Recursos Humanos puede cambiarlos.</p>
              <div className="pills">
                {perfil.cuenta.roles.map((rol) => (
                  <span className="chip-rol sistema" key={rol}>
                    {rol}
                  </span>
                ))}
              </div>
              <p className="nota-bloque" style={{ marginTop: 16 }}>
                Nadie puede cambiar su propio acceso: si necesita otro rol, solicítelo a Recursos Humanos.
              </p>
            </div>
            <div className="card bloque">
              <h2>Contraseña</h2>
              <p className="nota-bloque">
                Su contraseña se guarda cifrada: ni Informática ni Recursos Humanos pueden verla. Para cambiarla se le pide
                la contraseña actual.
              </p>
              <BotonConAyuda
                texto="Cambiar mi contraseña"
                ayuda="Cambiar su contraseña (se pide la actual)"
                alHacerClic={() => setCambiandoContrasena(true)}
              />
            </div>
          </div>
        </PanelDePestana>
      </div>

      {cambiandoContrasena && (
        <ModalCambiarContrasena
          alCerrar={() => setCambiandoContrasena(false)}
          alGuardar={() => {
            setCambiandoContrasena(false);
            setAviso('Contraseña actualizada. La próxima vez ingrese con la nueva.');
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas comunes de las pestanas                                      */
/* ------------------------------------------------------------------ */

function SinFuncionario() {
  return (
    <Mensaje tipo="info">
      Esta es la cuenta técnica de Informática: no está ligada a un funcionario, así que no tiene datos personales ni
      laborales.
    </Mensaje>
  );
}

/** Tarjeta con la vista de solo lectura y, debajo, por que no se puede cambiar. */
function SoloLectura({ nota, children }: { nota: string; children: React.ReactNode }) {
  return (
    <>
      <div className="card">{children}</div>
      <p className="nota-pagina mc-nota">{nota}</p>
    </>
  );
}

/**
 * Pie de los dos formularios: Descartar y Guardar, con el motivo cuando
 * estan bloqueados (no hay cambios).
 */
function PieDeFormulario(props: { nota: string; idNota?: string; hayCambios: boolean; ocupado: boolean; alDescartar: () => void; que: string }) {
  const { nota, idNota, hayCambios, ocupado, alDescartar, que } = props;
  return (
    <div className="pie-form">
      <span className="contador-paso" id={idNota}>
        {nota}
      </span>
      <div className="der">
        <BotonConAyuda
          texto="Descartar"
          ayuda="Volver a los datos guardados"
          bloqueadoPor={hayCambios ? null : 'no hay cambios que descartar.'}
          alHacerClic={alDescartar}
        />
        <BotonConAyuda
          clase="btn btn-primario"
          tipo="submit"
          texto="Guardar cambios"
          ayuda={`Guardar sus ${que}`}
          ocupado={ocupado}
          bloqueadoPor={hayCambios ? null : 'no hay cambios que guardar.'}
        >
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </BotonConAyuda>
      </div>
    </div>
  );
}

/** Campos del formulario que cambiaron (comparando sin espacios de mas). */
function camposCambiados<T extends Record<string, string>>(datos: T, original: T): (keyof T)[] {
  return (Object.keys(datos) as (keyof T)[]).filter((k) => datos[k].trim() !== original[k]);
}

/* ------------------------------------------------------------------ */
/* Pestana "Mis datos personales" (con perfilPropio.editar)            */
/* ------------------------------------------------------------------ */

type FormularioDePersonales = Record<keyof Required<DatosPersonales>, string>;

function personalesDesde(f: DetalleDeFuncionario): FormularioDePersonales {
  return {
    nombre: f.nombre,
    primerApellido: f.primerApellido,
    segundoApellido: f.segundoApellido ?? '',
    fechaNacimiento: f.fechaNacimiento ?? '',
    profesionId: f.profesion?.id ?? '',
    correoPersonal: f.correoPersonal,
    correoInstitucional: f.correoInstitucional ?? '',
    telefonoPersonal: f.telefonoPersonal ?? '',
    direccion: f.direccion ?? '',
  };
}

function FormularioPersonal({
  perfil,
  f,
  alEditar,
  alGuardar,
}: {
  perfil: PerfilPropio;
  f: DetalleDeFuncionario;
  alEditar: () => void;
  alGuardar: (p: PerfilPropio) => void;
}) {
  const original = useMemo(() => personalesDesde(f), [f]);
  const [datos, setDatos] = useState(original);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => setDatos(original), [original]);

  const cambios = camposCambiados(datos, original);
  const hoy = hoyEnCostaRica();
  const poner = (campo: keyof FormularioDePersonales) => (valor: string) => {
    setError(null);
    alEditar();
    setDatos((d) => ({ ...d, [campo]: valor }));
  };
  const problemaNacimiento =
    datos.fechaNacimiento && (datos.fechaNacimiento > sumarAnios(hoy, -EDAD_MINIMA) || datos.fechaNacimiento < '1900-01-01')
      ? `Debe tener al menos ${EDAD_MINIMA} años.`
      : null;

  /** Lo mismo que revisa el backend, para avisar antes de enviar. */
  function revisar(): string | null {
    return (
      revisarFechasDeVencimiento(formulario.current) ??
      problemaDeNombre(datos.nombre, 'El nombre', LARGO_NOMBRE, 5) ??
      problemaDeNombre(datos.primerApellido, 'El primer apellido', LARGO_APELLIDO, 4) ??
      (datos.segundoApellido.trim() ? problemaDeNombre(datos.segundoApellido, 'El segundo apellido', LARGO_APELLIDO, 4) : null) ??
      (problemaNacimiento ? `La fecha de nacimiento no es válida: ${problemaNacimiento.toLowerCase()}` : null) ??
      (!datos.correoPersonal.trim()
        ? 'El correo personal es obligatorio: es el canal de respaldo de las notificaciones.'
        : !CORREO.test(datos.correoPersonal.trim())
          ? 'El correo personal no tiene un formato válido.'
          : null) ??
      (datos.correoInstitucional.trim() && !CORREO.test(datos.correoInstitucional.trim()) ? 'El correo institucional no tiene un formato válido.' : null) ??
      (datos.telefonoPersonal.trim() && !normalizarTelefono(datos.telefonoPersonal) ? MENSAJE_TELEFONO : null)
    );
  }

  async function guardar() {
    const problema = revisar();
    if (problema) return setError(problema);
    setOcupado(true);
    setError(null);
    try {
      // Solo lo que cambio; vacio = borrar el dato (los obligatorios ya se revisaron).
      const envio: Record<string, string | null> = {};
      for (const campo of cambios) envio[campo] = datos[campo].trim() || null;
      alGuardar(await actualizarMisDatos(envio as DatosPersonales));
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      ref={formulario}
      className="card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (cambios.length) void guardar();
      }}
    >
      <div className="panel-paso">
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className="campo-fila mc-campos">
          <Texto id="mcNombre" etiqueta="Nombre" valor={datos.nombre} alCambiar={poner('nombre')} max={LARGO_NOMBRE} obligatorio />
          <Texto id="mcAp1" etiqueta="Primer apellido" valor={datos.primerApellido} alCambiar={poner('primerApellido')} max={LARGO_APELLIDO} obligatorio />
          <Texto id="mcAp2" etiqueta="Segundo apellido" valor={datos.segundoApellido} alCambiar={poner('segundoApellido')} max={LARGO_APELLIDO} />
          <CampoFecha
            id="mcNac"
            etiqueta="Fecha de nacimiento"
            valor={datos.fechaNacimiento}
            alCambiar={poner('fechaNacimiento')}
            min="1900-01-01"
            max={sumarAnios(hoy, -EDAD_MINIMA)}
            error={problemaNacimiento}
          />
          <div className="campo">
            <label htmlFor="mcCedula">Cédula</label>
            <input id="mcCedula" readOnly className="solo-lectura num" value={f.cedula} aria-describedby="mcNotaPersonales" />
          </div>
          <Texto
            id="mcTel"
            etiqueta="Teléfono"
            tipo="tel"
            valor={datos.telefonoPersonal}
            alCambiar={poner('telefonoPersonal')}
            alSalir={() => {
              const normal = normalizarTelefono(datos.telefonoPersonal);
              if (normal) setDatos((d) => ({ ...d, telefonoPersonal: normal }));
            }}
            max={16}
            placeholder="8 dígitos: 8712-4408"
          />
          <Texto id="mcCorreoP" etiqueta="Correo personal" tipo="email" valor={datos.correoPersonal} alCambiar={poner('correoPersonal')} max={150} obligatorio />
          <Texto id="mcCorreoI" etiqueta="Correo institucional" tipo="email" valor={datos.correoInstitucional} alCambiar={poner('correoInstitucional')} max={150} />
          <Lista
            id="mcProf"
            etiqueta="Profesión"
            valor={datos.profesionId}
            alCambiar={poner('profesionId')}
            opciones={perfil.profesiones}
            vacio={perfil.profesiones.length ? 'Sin profesión registrada' : 'Todavía no hay profesiones en el catálogo'}
          />
          <div className="campo mc-direccion">
            <label htmlFor="mcDir">Dirección exacta</label>
            <input id="mcDir" type="text" value={datos.direccion} onChange={(e) => poner('direccion')(e.target.value)} maxLength={255} autoComplete="off" />
          </div>
        </div>
      </div>
      <PieDeFormulario
        nota="Cada cambio queda en la bitácora. La cédula la corrige Recursos Humanos."
        idNota="mcNotaPersonales"
        hayCambios={cambios.length > 0}
        ocupado={ocupado}
        que="datos personales"
        alDescartar={() => {
          setError(null);
          setDatos(original);
        }}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Pestana "Datos laborales" (Recursos Humanos: funcionarios.editar)   */
/* ------------------------------------------------------------------ */

type FormularioDeLaborales = Record<keyof Required<DatosLaborales>, string>;

function laboralesDesde(f: DetalleDeFuncionario): FormularioDeLaborales {
  return {
    puestoId: f.puesto?.id ?? '',
    departamentoId: f.departamento?.id ?? '',
    jefaturaId: f.jefatura?.id ?? '',
    tipoNombramiento: f.tipoNombramiento,
    regimenVacacionesId: f.regimenVacaciones.id,
    fechaIngreso: f.fechaIngreso,
    numeroEmpleado: f.numeroEmpleado ?? '',
  };
}

/**
 * Agrega a la lista lo que la persona YA tiene aunque se haya inactivado
 * (p. ej. un puesto que ya no se ofrece): lo conserva mientras no lo cambie.
 */
function conActual(opciones: { id: string; nombre: string }[], actual: { id: string; nombre: string } | null) {
  return actual && !opciones.some((o) => o.id === actual.id) ? [...opciones, { ...actual, nombre: `${actual.nombre} (inactivo)` }] : opciones;
}

function FormularioLaboral({
  f,
  opciones,
  alEditar,
  alGuardar,
}: {
  f: DetalleDeFuncionario;
  opciones: OpcionesDeFormulario;
  alEditar: () => void;
  alGuardar: (p: PerfilPropio) => void;
}) {
  const original = useMemo(() => laboralesDesde(f), [f]);
  const [datos, setDatos] = useState(original);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => setDatos(original), [original]);

  const cambios = camposCambiados(datos, original);
  const hoy = hoyEnCostaRica();
  const poner = (campo: keyof FormularioDeLaborales) => (valor: string) => {
    setError(null);
    alEditar();
    setDatos((d) => ({ ...d, [campo]: valor }));
  };
  const minimoIngreso = f.fechaNacimiento ? sumarAnios(f.fechaNacimiento, EDAD_MINIMA) : '1950-01-01';
  const problemaIngreso = !datos.fechaIngreso
    ? null
    : datos.fechaIngreso < minimoIngreso
      ? f.fechaNacimiento
        ? `No puede ser antes de que cumpliera ${EDAD_MINIMA} años (${formatearFechaSola(minimoIngreso)}).`
        : 'Debe ser desde 1950.'
      : datos.fechaIngreso > sumarAnios(hoy, 1)
        ? 'No puede pasar de un año hacia adelante.'
        : null;

  // Jefatura: solo el rol Aprobador permanente; si la actual ya no lo tiene, se muestra igual.
  const jefaturas = conActual(
    opciones.jefaturas.map((j) => ({ id: j.id, nombre: j.puesto ? `${j.nombre} · ${j.puesto}` : j.nombre })),
    f.jefatura,
  );

  function revisar(): string | null {
    return (
      revisarFechasDeVencimiento(formulario.current) ??
      // Si el registro viejo no tenia puesto o departamento, no se exige para cambiar otra cosa.
      (!datos.puestoId && original.puestoId ? 'Elija el puesto.' : null) ??
      (!datos.departamentoId && original.departamentoId ? 'Elija el departamento.' : null) ??
      (!datos.fechaIngreso ? 'La fecha de ingreso es obligatoria.' : null) ??
      (problemaIngreso ? `La fecha de ingreso no es válida: ${problemaIngreso.toLowerCase()}` : null) ??
      (datos.numeroEmpleado.trim() && !/^[0-9A-Za-z-]{1,30}$/.test(datos.numeroEmpleado.trim())
        ? 'El código de empleado solo puede tener números, letras y guiones (hasta 30).'
        : null)
    );
  }

  async function guardar() {
    const problema = revisar();
    if (problema) return setError(problema);
    setOcupado(true);
    setError(null);
    try {
      const envio: Record<string, string | null> = {};
      for (const campo of cambios) envio[campo] = datos[campo].trim() || null;
      alGuardar(await actualizarMisDatosLaborales(envio as DatosLaborales));
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      ref={formulario}
      className="card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (cambios.length) void guardar();
      }}
    >
      <div className="panel-paso">
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className="campo-fila mc-campos">
          <Lista id="mcPuesto" etiqueta="Puesto" valor={datos.puestoId} alCambiar={poner('puestoId')} opciones={conActual(opciones.puestos, f.puesto)} obligatorio />
          <Lista
            id="mcDepto"
            etiqueta="Departamento"
            valor={datos.departamentoId}
            alCambiar={poner('departamentoId')}
            opciones={conActual(opciones.departamentos, f.departamento)}
            obligatorio
          />
          <Lista
            id="mcJefe"
            etiqueta="Jefatura inmediata"
            valor={datos.jefaturaId}
            alCambiar={poner('jefaturaId')}
            opciones={jefaturas}
            vacio="— Sin jefatura: tope de la jerarquía —"
            ayuda={opciones.jefaturas.length ? 'Solo quienes tienen el rol Aprobador.' : 'Nadie tiene todavía el rol Aprobador.'}
          />
          <Texto id="mcCodigo" etiqueta="Código de empleado" valor={datos.numeroEmpleado} alCambiar={poner('numeroEmpleado')} max={30} />
          <Lista
            id="mcNombramiento"
            etiqueta="Tipo de nombramiento"
            valor={datos.tipoNombramiento}
            alCambiar={poner('tipoNombramiento')}
            opciones={opciones.tiposNombramiento.map((t) => ({ id: t.valor, nombre: t.texto }))}
            obligatorio
          />
          <Lista
            id="mcRegimen"
            etiqueta="Régimen de vacaciones"
            valor={datos.regimenVacacionesId}
            alCambiar={poner('regimenVacacionesId')}
            opciones={conActual(
              opciones.regimenes.map((r) => ({ id: r.id, nombre: nombreDeRegimen(r.nombre) })),
              { id: f.regimenVacaciones.id, nombre: nombreDeRegimen(f.regimenVacaciones.nombre) },
            )}
            obligatorio
          />
          <CampoFecha
            id="mcIngreso"
            etiqueta="Fecha de ingreso"
            valor={datos.fechaIngreso}
            alCambiar={poner('fechaIngreso')}
            min={minimoIngreso}
            max={sumarAnios(hoy, 1)}
            obligatorio
            error={problemaIngreso}
          />
          {/* Datos laborales que no se editan aqui (el estado cambia con salida o reingreso). */}
          <dl className="campo mc-fijos">
            <div>
              <dt>Estado</dt>
              <dd>
                <ChipDeFuncionario estado={f.estado} />
              </dd>
            </div>
            <div>
              <dt>Personal a cargo</dt>
              <dd className="num">{f.cantidadACargo}</dd>
            </div>
          </dl>
        </div>
      </div>
      <PieDeFormulario
        nota="Solo Recursos Humanos cambia datos laborales. Cada cambio queda en la bitácora y en su historial laboral."
        hayCambios={cambios.length > 0}
        ocupado={ocupado}
        que="datos laborales"
        alDescartar={() => {
          setError(null);
          setDatos(original);
        }}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Ventana "Cambiar mi contrasena" (mdCambiarPass)                     */
/* ------------------------------------------------------------------ */

function ModalCambiarContrasena({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!actual) return setError('Escriba su contraseña actual.');
    const problema = revisarContrasenaNueva(nueva, repetida);
    if (problema) return setError(problema);
    if (nueva === actual) return setError('La contraseña nueva debe ser distinta de la actual.');
    setOcupado(true);
    setError(null);
    try {
      await apiAutenticacion.cambiarContrasena(actual, nueva);
      alGuardar();
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Cambiar mi contraseña"
      icono="candado"
      descripcion="Por seguridad se pide su contraseña actual. El cambio queda en la bitácora (sin la contraseña)."
      alCerrar={alCerrar}
      alEnviar={guardar}
      ocupado={ocupado}
      textoConfirmar="Guardar contraseña"
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <CampoContrasena etiqueta="Contraseña actual" valor={actual} alCambiar={setActual} autocompletar="current-password" />
      <CampoContrasena
        etiqueta="Contraseña nueva"
        valor={nueva}
        alCambiar={setNueva}
        autocompletar="new-password"
        ayuda={<RequisitosDeContrasena contrasena={nueva} />}
      />
      <CampoContrasena etiqueta="Repita la contraseña nueva" valor={repetida} alCambiar={setRepetida} autocompletar="new-password" />
    </Modal>
  );
}
