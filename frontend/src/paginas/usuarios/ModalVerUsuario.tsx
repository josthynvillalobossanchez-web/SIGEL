/*
 * Ventana "Ver usuario" (mdVerUsuario del prototipo): se abre al tocar una
 * fila de la lista. Es de SOLO LECTURA; para cambiar algo esta el boton
 * "Editar usuario" del pie, que lleva a la pagina de edicion. Se bloquea
 * (con su explicacion) si quien mira no puede editar esta cuenta: sin
 * permiso, cuenta propia (sus datos van en "Mi cuenta") o cuenta con mas
 * acceso que el suyo.
 *
 * La informacion va en pestanas para no tener que bajar:
 *   Resumen | Datos personales | Datos laborales | Roles | Permisos
 * Los datos personales y laborales son los del funcionario de la cuenta
 * (mismas vistas que Funcionarios y Mi cuenta); se piden aparte y solo si
 * quien mira tiene funcionarios.ver (son datos personales).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { textoDelError } from '../../api/cliente';
import { consultarCuenta, type DetalleDeCuenta } from '../../api/usuarios';
import { consultarFuncionario, type DetalleDeFuncionario } from '../../api/funcionarios';
import { DatosLaboralesVista, DatosPersonalesVista } from '../funcionarios/DatosDeFuncionario';
import { useSesion } from '../../sesion/SesionProveedor';
import { Modal } from '../../componentes/Modal';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda } from '../../componentes/Botones';
import { PanelDePestana, Pestanas, usePrefijoDePestanas } from '../../componentes/Pestanas';
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas';
import { nombreCompleto, nombreDeModulo } from '../../utilidades/texto';
import { ChipDeEstadoDeCuenta } from './ChipDeEstadoDeCuenta';
import { motivoDeBloqueo } from './motivos';

export function ModalVerUsuario({
  usuarioId,
  alCerrar,
  alEditar,
}: {
  usuarioId: string;
  alCerrar: () => void;
  /** Ir a la pagina "Editar usuario" de esta cuenta. */
  alEditar: (usuarioId: string) => void;
}) {
  const { tienePermisos } = useSesion();
  const prefijo = usePrefijoDePestanas();
  const [cuenta, setCuenta] = useState<DetalleDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState('resumen');
  const puedeVerFuncionarios = tienePermisos('funcionarios.ver');
  const [ficha, setFicha] = useState<DetalleDeFuncionario | null>(null);
  const [errorFicha, setErrorFicha] = useState<string | null>(null);

  useEffect(() => {
    consultarCuenta(usuarioId)
      .then(setCuenta)
      .catch((e) => setError(textoDelError(e)));
  }, [usuarioId]);

  // Datos del funcionario de la cuenta (si tiene y si quien mira puede verlos).
  const funcionarioId = cuenta?.funcionario?.id;
  useEffect(() => {
    if (!funcionarioId || !puedeVerFuncionarios) return;
    consultarFuncionario(funcionarioId)
      .then(setFicha)
      .catch((e) => setErrorFicha(textoDelError(e)));
  }, [funcionarioId, puedeVerFuncionarios]);

  /** Contenido de las pestanas de datos del funcionario. */
  function datosDelFuncionario(vista: (f: DetalleDeFuncionario) => React.ReactNode) {
    if (!puedeVerFuncionarios) return <Mensaje tipo="info">Su cuenta no tiene permiso para ver los datos de los funcionarios.</Mensaje>;
    if (errorFicha) return <Mensaje tipo="error">{errorFicha}</Mensaje>;
    if (!ficha) return <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>;
    return vista(ficha);
  }

  const bloqueo = cuenta ? motivoDeBloqueo('editar', cuenta.motivoNoModificable, tienePermisos) : null;
  const vigentes = cuenta?.roles.filter((r) => r.vigente) ?? [];
  const excepciones = cuenta?.permisos ?? [];

  return (
    <Modal
      titulo={cuenta ? nombreCompleto(cuenta.funcionario) : 'Cuenta de usuario'}
      icono="usuarios"
      descripcion="Cuenta de acceso al sistema. Para modificarla use el botón de editar."
      alCerrar={alCerrar}
      ancho
      cabeceraExtra={
        cuenta && (
          <div style={{ marginTop: 14 }}>
            <Pestanas
              prefijo={prefijo}
              etiqueta="Información de la cuenta"
              actual={pestana}
              alCambiar={setPestana}
              opciones={[
                { id: 'resumen', texto: 'Resumen' },
                ...(cuenta.funcionario
                  ? [
                      { id: 'personales', texto: 'Datos personales' },
                      { id: 'laborales', texto: 'Datos laborales' },
                    ]
                  : []),
                { id: 'roles', texto: 'Roles', cuenta: vigentes.length },
                { id: 'permisos', texto: 'Permisos', cuenta: cuenta.permisosEfectivos.length },
              ]}
            />
          </div>
        )
      }
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar}>
            Cerrar
          </button>
          {cuenta && (
            <BotonConAyuda
              clase="btn btn-primario"
              icono="editar"
              texto="Editar usuario"
              ayuda="Cambiar el correo de ingreso y los roles de esta cuenta (se abre la página de edición)"
              bloqueadoPor={bloqueo}
              alHacerClic={() => alEditar(cuenta.id)}
            />
          )}
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!cuenta && !error && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}

      {cuenta && (
        <>
          <PanelDePestana id="resumen" actual={pestana} prefijo={prefijo}>
            {cuenta.motivoNoModificable === 'CUENTA_PROPIA' && (
              <Mensaje tipo="info">
                Es su propia cuenta y aquí se muestra de solo lectura. Sus datos personales y su contraseña se cambian
                en <Link to="/mi-cuenta" onClick={alCerrar}>Mi cuenta</Link>.
              </Mensaje>
            )}
            {cuenta.motivoNoModificable === 'CUENTA_CON_MAYOR_ACCESO' && (
              <Mensaje tipo="info">Esta cuenta tiene permisos que usted no tiene: solo puede consultarla.</Mensaje>
            )}
            <dl className="info-rejilla" style={{ padding: 0 }}>
              <div className="dato">
                <dt>Correo de ingreso</dt>
                <dd>{cuenta.correo}</dd>
              </div>
              <div className="dato">
                <dt>Funcionario asociado</dt>
                <dd>
                  {nombreCompleto(cuenta.funcionario)}
                  {cuenta.funcionario && <span className="sec-dato">Cédula {cuenta.funcionario.cedula}</span>}
                </dd>
              </div>
              <div className="dato">
                <dt>Estado</dt>
                <dd>
                  <ChipDeEstadoDeCuenta cuenta={cuenta} />
                </dd>
              </div>
              <div className="dato">
                <dt>Último acceso</dt>
                <dd className="num">{cuenta.ultimoAcceso ? formatearFechaHora(cuenta.ultimoAcceso) : 'Nunca ha ingresado'}</dd>
              </div>
              <div className="dato">
                <dt>Cuenta creada</dt>
                <dd className="num">{formatearFecha(cuenta.fechaCreacion)}</dd>
              </div>
              <div className="dato">
                <dt>Excepciones de permisos</dt>
                <dd className="num">{excepciones.filter((p) => p.vigente).length}</dd>
              </div>
              <div className="dato" style={{ gridColumn: '1/-1' }}>
                <dt>Roles vigentes</dt>
                <dd>
                  <div className="pills">
                    {vigentes.map((rol) => (
                      <span className="chip-rol sistema" key={rol.id}>
                        {rol.nombre}
                        {rol.fechaVencimiento && ` · hasta ${formatearFecha(rol.fechaVencimiento)}`}
                      </span>
                    ))}
                  </div>
                </dd>
              </div>
            </dl>
          </PanelDePestana>

          {cuenta.funcionario && (
            <>
              <PanelDePestana id="personales" actual={pestana} prefijo={prefijo}>
                {datosDelFuncionario((f) => <DatosPersonalesVista f={f} compacto />)}
              </PanelDePestana>
              <PanelDePestana id="laborales" actual={pestana} prefijo={prefijo}>
                {datosDelFuncionario((f) => <DatosLaboralesVista f={f} compacto />)}
              </PanelDePestana>
            </>
          )}

          <PanelDePestana id="roles" actual={pestana} prefijo={prefijo}>
            <p className="nota-modal">
              Los roles con fecha dejan de contar solos al terminar ese día. Los quitados o vencidos quedan como
              historial.
            </p>
            <div className="tabla-envoltura tabla-compacta">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Rol</th>
                    <th scope="col">Asignado</th>
                    <th scope="col">Vence</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cuenta.roles]
                    .sort((a, b) => Number(b.vigente) - Number(a.vigente))
                    .map((rol) => (
                      <tr key={rol.id} data-vigente={rol.vigente ? 'si' : 'no'}>
                        <td data-etiqueta="Rol">{rol.nombre}</td>
                        <td data-etiqueta="Asignado" className="num">
                          {formatearFecha(rol.fechaAsignacion)}
                        </td>
                        <td data-etiqueta="Vence" className="num">
                          {rol.fechaVencimiento ? formatearFecha(rol.fechaVencimiento) : 'Permanente'}
                        </td>
                        <td data-etiqueta="Estado">
                          {rol.vigente ? <span className="chip chip-exito">● Vigente</span> : <span className="chip chip-neutro">● Vencido</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </PanelDePestana>

          <PanelDePestana id="permisos" actual={pestana} prefijo={prefijo}>
            {excepciones.length > 0 && (
              <>
                <h3 className="subtitulo-modal">Excepciones individuales</h3>
                <ul className="lista-excepciones">
                  {excepciones.map((p) => (
                    <li key={p.id} data-vigente={p.vigente ? 'si' : 'no'}>
                      <span className="clave">{p.clave}</span>
                      {p.otorgado ? <span className="chip chip-info">Concedido</span> : <span className="chip chip-advert">Quitado</span>}
                      <span className="sec-dato">
                        {p.vigente ? (p.fechaVencimiento ? `hasta ${formatearFecha(p.fechaVencimiento)}` : 'permanente') : 'vencida'}
                        {p.observacion ? ` · ${p.observacion}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="subtitulo-modal">Todo lo que puede hacer</h3>
            <PermisosAgrupados claves={cuenta.permisosEfectivos} />
          </PanelDePestana>
        </>
      )}
    </Modal>
  );
}

/** Claves de permiso agrupadas por modulo, como pastillas. */
export function PermisosAgrupados({ claves }: { claves: string[] }) {
  if (claves.length === 0) {
    return <p className="nota-modal">Ningún permiso: esta cuenta no puede hacer nada en el sistema.</p>;
  }
  const porModulo = new Map<string, string[]>();
  for (const clave of claves) {
    const modulo = clave.split('.')[0];
    porModulo.set(modulo, [...(porModulo.get(modulo) ?? []), clave]);
  }
  return (
    <dl className="permisos-agrupados">
      {[...porModulo.entries()].map(([modulo, lista]) => (
        <div key={modulo}>
          <dt>{nombreDeModulo(modulo)}</dt>
          <dd>
            <div className="pills">
              {lista.map((clave) => (
                <span className="chip-rol" key={clave}>
                  {clave}
                </span>
              ))}
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
