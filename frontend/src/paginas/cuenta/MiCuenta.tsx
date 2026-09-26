/*
 * Pagina "Mi cuenta" (seccion pgCuenta del prototipo).
 *
 * Arriba, la tarjeta de perfil con el degradado: fotografia (o las iniciales
 * del nombre si no hay foto), nombre, cedula y correo, estado y roles, y los
 * datos rapidos (puesto, departamento, ingreso, ultimo acceso).
 * Debajo, dos pestanas:
 *   - Mis datos personales: telefono, correos, profesion y direccion, que la
 *     propia persona mantiene (permiso perfilPropio.editar). Los datos
 *     laborales solo los cambia Recursos Humanos.
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
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas';
import { inicialesDeFuncionario, inicialesDesdeCorreo, nombreCompleto } from '../../utilidades/texto';
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
            <dd className="num">{f ? formatearFecha(f.fechaIngreso) : '—'}</dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd className="num">{formatearFechaHora(perfil.cuenta.ultimoAcceso)}</dd>
          </div>
        </dl>
      </section>

      <Pestanas
        prefijo="mc"
        etiqueta="Secciones de mi cuenta"
        actual={pestana}
        alCambiar={setPestana}
        opciones={[
          { id: 'datos', texto: 'Mis datos personales' },
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
      style={{ maxWidth: 1080 }}
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
        <div className="campo-fila">
          <div className="campo">
            <label htmlFor="mcTel">Teléfono</label>
            <input id="mcTel" type="tel" value={datos.telefonoPersonal} onChange={poner('telefonoPersonal')} disabled={soloLectura} maxLength={30} style={{ fontVariantNumeric: 'tabular-nums' }} />
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
          <div className="campo doble">
            <label htmlFor="mcDir">Dirección exacta</label>
            <textarea id="mcDir" rows={2} value={datos.direccion} onChange={poner('direccion')} disabled={soloLectura} maxLength={255} />
          </div>
        </div>
      </div>
      <div className="pie-form">
        <span className="contador-paso">
          Cada cambio queda en la bitácora. Los datos laborales (puesto, departamento, jefatura) solo los modifica
          Recursos Humanos.
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
