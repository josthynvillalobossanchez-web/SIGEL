/*
 * Pagina "Mi cuenta" (seccion pgCuenta del prototipo).
 *
 * Arriba, la tarjeta de perfil con el degradado: fotografia (o las iniciales
 * del nombre si no hay foto), nombre, cedula y correo, estado y roles, y los
 * datos rapidos (puesto, departamento, ingreso, ultimo acceso).
 * Debajo, tres pestanas, centradas en la pantalla (pedido de Josthyn, 27/09):
 *   - Mis datos personales: identificacion (solo lectura) y telefono,
 *     correos, profesion y direccion, que la propia persona mantiene
 *     (permiso perfilPropio.editar).
 *   - Datos laborales: puesto, departamento, jefatura, nombramiento,
 *     regimen e ingreso. Solo lectura: los cambia Recursos Humanos.
 *   - Acceso y seguridad: datos de acceso, roles y cambio de contrasena.
 *
 * Todo es sobre la persona conectada: el backend toma su id de la sesion.
 */
import { useEffect, useMemo, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import * as apiAutenticacion from '../../api/autenticacion';
import { actualizarMisDatos, consultarMiCuenta, type DatosPersonales, type PerfilPropio } from '../../api/miCuenta';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { RequisitosDeContrasena } from '../../componentes/RequisitosDeContrasena';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { ChipDeEstadoDeCuenta } from '../usuarios/ChipDeEstadoDeCuenta';
import { formatearFecha, formatearFechaHora, formatearFechaSola } from '../../utilidades/fechas';
import { inicialesDeFuncionario, inicialesDesdeCorreo, MENSAJE_TELEFONO, nombreCompleto, normalizarTelefono } from '../../utilidades/texto';
import { NOMBRES_DE_NOMBRAMIENTO, nombreDeRegimen } from '../../api/funcionarios';
import { ChipDeFuncionario } from '../funcionarios/ChipDeFuncionario';
import { revisarContrasenaNueva } from '../../utilidades/politica-contrasena';

type Formulario = Required<{ [K in keyof DatosPersonales]: string }>;

function formularioDesde(perfil: PerfilPropio): Formulario {
  const f = perfil.funcionario;
  return {
    telefonoPersonal: f?.telefonoPersonal ?? '',
    correoPersonal: f?.correoPersonal ?? '',
    correoInstitucional: f?.correoInstitucional ?? '',
    profesionId: f?.profesion?.id ?? '',
    direccion: f?.direccion ?? '',
  };
}

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
      <section className="perfil" aria-label="Mi perfil">
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
            <dd>{f?.puesto ?? '—'}</dd>
          </div>
          <div>
            <dt>Departamento</dt>
            <dd>{f?.departamento ?? '—'}</dd>
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
        alCambiar={setPestana}
        opciones={[
          { id: 'datos', texto: 'Mis datos personales' },
          { id: 'laborales', texto: 'Datos laborales' },
          { id: 'acceso', texto: 'Acceso y seguridad' },
        ]}
      />
      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>

      <PanelDePestana id="datos" actual={pestana} prefijo="mc">
        <DatosPersonalesPropios
          perfil={perfil}
          alGuardar={(nuevo) => {
            setPerfil(nuevo);
            setAviso('Sus datos personales se guardaron. El cambio quedó registrado en la bitácora.');
          }}
        />
      </PanelDePestana>

      <PanelDePestana id="laborales" actual={pestana} prefijo="mc">
        <DatosLaboralesPropios perfil={perfil} />
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
/* Pestana "Mis datos personales"                                      */
/* ------------------------------------------------------------------ */

function DatosPersonalesPropios({ perfil, alGuardar }: { perfil: PerfilPropio; alGuardar: (p: PerfilPropio) => void }) {
  const original = useMemo(() => formularioDesde(perfil), [perfil]);
  const [datos, setDatos] = useState<Formulario>(original);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDatos(original), [original]);

  if (!perfil.funcionario) {
    return (
      <Mensaje tipo="info">
        Esta es la cuenta técnica de Informática: no está ligada a un funcionario, así que no tiene datos personales.
      </Mensaje>
    );
  }

  const soloLectura = !perfil.puedeEditarDatos;
  const cambios = (Object.keys(datos) as (keyof Formulario)[]).filter((k) => datos[k].trim() !== original[k]);
  const poner = (campo: keyof Formulario) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function guardar() {
    if (!datos.correoPersonal.trim()) return setError('El correo personal es obligatorio: es el canal de respaldo de las notificaciones.');
    if (datos.telefonoPersonal.trim() && !normalizarTelefono(datos.telefonoPersonal)) return setError(MENSAJE_TELEFONO);
    setOcupado(true);
    setError(null);
    try {
      // Solo lo que cambio; vacio = borrar el dato.
      const envio: DatosPersonales = {};
      for (const campo of cambios) (envio as Record<string, string | null>)[campo] = datos[campo].trim() || null;
      alGuardar(await actualizarMisDatos(envio));
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!soloLectura && cambios.length) void guardar();
      }}
    >
      <div className="panel-paso">
        {soloLectura && (
          <Mensaje tipo="info">Su cuenta no tiene permiso para editar sus datos personales. Solicítelo a Recursos Humanos.</Mensaje>
        )}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {/* Nombre y cedula ya se ven arriba, en la tarjeta. La fecha de
            nacimiento se muestra aqui en solo lectura: la corrige RRHH. */}
        <div className="campo-fila mc-campos">
          <div className="campo">
            <label htmlFor="mcNac">Fecha de nacimiento</label>
            <input
              id="mcNac"
              readOnly
              className="solo-lectura"
              value={perfil.funcionario.fechaNacimiento ? formatearFechaSola(perfil.funcionario.fechaNacimiento) : 'Sin registrar'}
              aria-describedby="mcNacAyuda"
            />
            <span className="ayuda" id="mcNacAyuda">
              La corrige Recursos Humanos.
            </span>
          </div>
          <div className="campo">
            <label htmlFor="mcTel">Teléfono</label>
            <input
              id="mcTel"
              type="tel"
              value={datos.telefonoPersonal}
              onChange={poner('telefonoPersonal')}
              onBlur={() => {
                const normal = normalizarTelefono(datos.telefonoPersonal);
                if (normal) setDatos({ ...datos, telefonoPersonal: normal });
              }}
              disabled={soloLectura}
              maxLength={16}
              placeholder="8712-4408"
              aria-describedby="mcTelAyuda"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="ayuda" id="mcTelAyuda">
              8 dígitos de Costa Rica.
            </span>
          </div>
          <div className="campo">
            <label htmlFor="mcCorreoP">
              Correo personal <span className="obligatorio">*</span>
            </label>
            <input id="mcCorreoP" type="email" value={datos.correoPersonal} onChange={poner('correoPersonal')} disabled={soloLectura} maxLength={150} aria-required="true" />
          </div>
          <div className="campo">
            <label htmlFor="mcCorreoI">Correo institucional</label>
            <input id="mcCorreoI" type="email" value={datos.correoInstitucional} onChange={poner('correoInstitucional')} disabled={soloLectura} maxLength={150} />
          </div>
          <div className="campo">
            <label htmlFor="mcProf">Profesión</label>
            <select id="mcProf" value={datos.profesionId} onChange={poner('profesionId')} disabled={soloLectura || perfil.profesiones.length === 0}>
              <option value="">{perfil.profesiones.length ? 'Sin profesión registrada' : 'Todavía no hay profesiones en el catálogo'}</option>
              {perfil.profesiones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo mc-direccion">
            <label htmlFor="mcDir">Dirección exacta</label>
            <textarea id="mcDir" rows={2} value={datos.direccion} onChange={poner('direccion')} disabled={soloLectura} maxLength={255} />
          </div>
        </div>
      </div>
      <div className="pie-form">
        <span className="contador-paso">
          Cada cambio queda en la bitácora. Su nombre, cédula y fecha de nacimiento los corrige Recursos Humanos.
        </span>
        <div className="der">
          <BotonConAyuda
            texto="Descartar"
            ayuda="Volver a los datos guardados"
            bloqueadoPor={soloLectura ? 'no tiene permiso para editar sus datos.' : cambios.length ? null : 'no hay cambios que descartar.'}
            alHacerClic={() => setDatos(original)}
          />
          <BotonConAyuda
            clase="btn btn-primario"
            tipo="submit"
            texto="Guardar cambios"
            ayuda="Guardar sus datos personales"
            ocupado={ocupado}
            bloqueadoPor={soloLectura ? 'no tiene permiso para editar sus datos.' : cambios.length ? null : 'no hay cambios que guardar.'}
          >
            {ocupado ? 'Guardando…' : 'Guardar cambios'}
          </BotonConAyuda>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Pestana "Datos laborales" (solo lectura, pLaboral del prototipo)    */
/* ------------------------------------------------------------------ */

function DatosLaboralesPropios({ perfil }: { perfil: PerfilPropio }) {
  const f = perfil.funcionario;
  if (!f) {
    return <Mensaje tipo="info">La cuenta técnica de Informática no está ligada a un funcionario: no tiene datos laborales.</Mensaje>;
  }
  const dato = (titulo: string, valor: string | null | undefined, num = false) => (
    <div className="dato">
      <dt>{titulo}</dt>
      <dd className={valor ? (num ? 'num' : undefined) : 'vacio-dato'}>{valor || 'Sin registrar'}</dd>
    </div>
  );
  // Un solo bloque de 4 columnas para que quepa sin scroll a 1366x768.
  return (
    <>
      <section className="info-bloque">
        <h3>Puesto y nombramiento</h3>
        <dl className="info-rejilla mc-laborales">
          {dato('Puesto', f.puesto)}
          {dato('Departamento', f.departamento)}
          {dato('Jefatura inmediata', f.jefatura ?? 'Sin jefatura asignada')}
          {dato('Código de empleado', f.numeroEmpleado, true)}
          {dato('Tipo de nombramiento', NOMBRES_DE_NOMBRAMIENTO[f.tipoNombramiento])}
          <div className="dato">
            <dt>Régimen de vacaciones</dt>
            <dd>
              {nombreDeRegimen(f.regimenVacaciones.nombre)}
              {f.regimenVacaciones.descripcion && <span className="sec-dato mc-detalle">{f.regimenVacaciones.descripcion}</span>}
            </dd>
          </div>
          {dato('Fecha de ingreso', formatearFechaSola(f.fechaIngreso), true)}
          <div className="dato">
            <dt>Estado</dt>
            <dd>
              <ChipDeFuncionario estado={f.estado} />
            </dd>
          </div>
        </dl>
      </section>
      <p className="nota-pagina mc-nota">Estos datos solo los modifica Recursos Humanos. Si algo no está bien, avísele.</p>
    </>
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
