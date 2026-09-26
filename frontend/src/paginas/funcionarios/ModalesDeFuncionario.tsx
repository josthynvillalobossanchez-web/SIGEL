/*
 * Ventanas de la lista de funcionarios:
 *   - ModalFicha (mdResumen del prototipo): ficha resumida, solo lectura.
 *     Botones: Editar funcionario (pagina) y Ver expediente.
 *   - ModalSalida: registrar que la persona deja la Municipalidad (fecha y
 *     motivo). Su cuenta se inactiva a la vez.
 *   - ModalReingreso: la persona vuelve (nueva fecha de ingreso).
 * Salida y reingreso son confirmaciones cortas: por eso van en ventana.
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import {
  consultarFuncionario,
  NOMBRES_DE_NOMBRAMIENTO,
  registrarReingreso,
  registrarSalida,
  type DetalleDeFuncionario,
} from '../../api/funcionarios';
import { Modal } from '../../componentes/Modal';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda } from '../../componentes/Botones';
import { CampoFecha } from '../../componentes/CampoFecha';
import { revisarFechasDeVencimiento } from '../../componentes/CampoFechaDeVencimiento';
import { formatearFechaSola, hoyEnCostaRica, sumarAnios } from '../../utilidades/fechas';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ChipDeFuncionario } from './ChipDeFuncionario';
import { MOTIVO_EXPEDIENTE_PENDIENTE } from './motivos';

/* ================================================================== */
/* Ficha resumida                                                      */
/* ================================================================== */

export function ModalFicha({
  funcionarioId,
  bloqueoEditar,
  alCerrar,
  alEditar,
}: {
  funcionarioId: string;
  /** Por que no se puede editar (null = si se puede); se calcula con el detalle. */
  bloqueoEditar: (f: DetalleDeFuncionario) => string | null;
  alCerrar: () => void;
  alEditar: () => void;
}) {
  const [f, setF] = useState<DetalleDeFuncionario | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consultarFuncionario(funcionarioId)
      .then(setF)
      .catch((e) => setError(textoDelError(e)));
  }, [funcionarioId]);

  return (
    <Modal
      titulo={f ? nombreCompleto(f) : 'Funcionario'}
      foto={f ? inicialesDeFuncionario(f) : '…'}
      descripcion={f ? `Cédula ${f.cedula}${f.numeroEmpleado ? ` · Código ${f.numeroEmpleado}` : ''}` : undefined}
      cabeceraExtra={
        f && (
          <div className="ficha-chips" style={{ marginTop: 8 }}>
            <ChipDeFuncionario estado={f.estado} />
            <span className="chip chip-neutro">{NOMBRES_DE_NOMBRAMIENTO[f.tipoNombramiento]}</span>
          </div>
        )
      }
      alCerrar={alCerrar}
      ancho
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar}>
            Cerrar
          </button>
          {f && (
            <>
              <BotonConAyuda
                icono="editar"
                texto="Editar funcionario"
                ayuda="Corregir sus datos personales, de contacto o laborales (se abre la página de edición)"
                bloqueadoPor={bloqueoEditar(f)}
                alHacerClic={alEditar}
              />
              <BotonConAyuda clase="btn btn-primario" texto="Ver expediente" bloqueadoPor={MOTIVO_EXPEDIENTE_PENDIENTE} />
            </>
          )}
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!f && !error && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
      {f && (
        <>
          <dl className="resumen-datos" style={{ borderTop: 0, paddingTop: 0 }}>
            <Dato titulo="Puesto" valor={f.puesto?.nombre} />
            <Dato titulo="Departamento" valor={f.departamento?.nombre} />
            <Dato titulo="Jefatura inmediata" valor={f.jefatura?.nombre ?? 'Sin jefatura (tope de la jerarquía)'} />
            <Dato titulo="Teléfono" valor={f.telefonoPersonal} num />
            <Dato titulo="Correo" valor={f.correoInstitucional ?? f.correoPersonal} />
            <Dato titulo="Fecha de ingreso" valor={formatearFechaSola(f.fechaIngreso)} num />
            <Dato
              titulo="Cuenta de acceso"
              valor={f.cuenta ? `${f.cuenta.correo} · ${f.cuenta.estado === 'activo' ? 'activa' : f.cuenta.estado === 'bloqueado' ? 'bloqueada' : 'inactiva'}` : 'Sin cuenta'}
            />
            <Dato titulo="Personal a cargo" valor={String(f.cantidadACargo)} num />
            {f.estado === 'inactivo' && (
              <>
                <Dato titulo="Fecha de salida" valor={formatearFechaSola(f.fechaSalida)} num />
                <Dato titulo="Motivo de salida" valor={f.motivoSalida} />
              </>
            )}
          </dl>
          {f.esPropio && (
            <p className="nota-modal" style={{ marginTop: 12 }}>
              Es su propio registro. Sus datos personales y de contacto los cambia en «Mi cuenta».
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function Dato({ titulo, valor, num }: { titulo: string; valor: string | null | undefined; num?: boolean }) {
  return (
    <div className="dato">
      <dt>{titulo}</dt>
      <dd className={valor ? (num ? 'num' : undefined) : 'vacio-dato'}>{valor || 'Sin registrar'}</dd>
    </div>
  );
}

/* ================================================================== */
/* Registrar salida                                                    */
/* ================================================================== */

export function ModalSalida({
  funcionario,
  alCerrar,
  alGuardar,
}: {
  funcionario: { id: string; nombre: string; tieneCuenta: boolean };
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const hoy = hoyEnCostaRica();
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const incompleta = revisarFechasDeVencimiento(document.getElementById('formSalida'));
    if (incompleta) return setError(incompleta);
    if (!fecha) return setError('Indique la fecha de salida.');
    if (motivo.trim().length < 3) return setError('Escriba el motivo de la salida (queda en el expediente y en la bitácora).');
    setOcupado(true);
    setError(null);
    try {
      await registrarSalida(funcionario.id, { fechaSalida: fecha, motivoSalida: motivo.trim() });
      alGuardar(
        `Se registró la salida de ${funcionario.nombre}.` + (funcionario.tieneCuenta ? ' Su cuenta de acceso quedó inactiva.' : ''),
      );
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Registrar salida"
      icono="salir"
      descripcion="La persona deja de trabajar en la Municipalidad. Su expediente y su historial se conservan; no se borra nada."
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      ocupado={ocupado}
      peligro
      textoConfirmar="Registrar salida"
    >
      <div id="formSalida">
        <p className="modal-doc" style={{ marginTop: 0 }}>
          {funcionario.nombre}
        </p>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className="campo-fila">
          <CampoFecha id="salFecha" etiqueta="Fecha de salida" obligatorio valor={fecha} alCambiar={setFecha} max={sumarAnios(hoy, 1)} />
        </div>
        <div className="campo">
          <label htmlFor="salMotivo">
            Motivo <span className="obligatorio">*</span>
          </label>
          <textarea
            id="salMotivo"
            rows={2}
            maxLength={150}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: renuncia voluntaria, pensión, fin de contrato."
            aria-required="true"
          />
        </div>
        {funcionario.tieneCuenta ? (
          <Mensaje tipo="advert" icono="info">
            Tiene cuenta de acceso: se inactiva en este mismo momento, para que nadie que ya se fue conserve acceso al sistema.
          </Mensaje>
        ) : (
          <Mensaje tipo="info">No tiene cuenta de acceso.</Mensaje>
        )}
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Reingreso                                                           */
/* ================================================================== */

export function ModalReingreso({
  funcionario,
  alCerrar,
  alGuardar,
}: {
  funcionario: { id: string; nombre: string; tieneCuenta: boolean };
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const hoy = hoyEnCostaRica();
  const [fecha, setFecha] = useState(hoy);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const incompleta = revisarFechasDeVencimiento(document.getElementById('formReingreso'));
    if (incompleta) return setError(incompleta);
    if (!fecha) return setError('Indique la fecha de reingreso.');
    setOcupado(true);
    setError(null);
    try {
      await registrarReingreso(funcionario.id, fecha);
      alGuardar(
        `Se registró el reingreso de ${funcionario.nombre}.` +
          (funcionario.tieneCuenta ? ' Su cuenta sigue inactiva: actívela desde Usuarios si debe volver a entrar al sistema.' : ''),
      );
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Registrar reingreso"
      icono="reactivar"
      descripcion="La persona vuelve a trabajar en la Municipalidad y queda activa con la nueva fecha de ingreso."
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      ocupado={ocupado}
      textoConfirmar="Registrar reingreso"
    >
      <div id="formReingreso">
        <p className="modal-doc" style={{ marginTop: 0 }}>
          {funcionario.nombre}
        </p>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className="campo-fila">
          <CampoFecha id="reiFecha" etiqueta="Fecha de reingreso" obligatorio valor={fecha} alCambiar={setFecha} max={sumarAnios(hoy, 1)} />
        </div>
        {funcionario.tieneCuenta && (
          <Mensaje tipo="info">
            Su cuenta de acceso NO se reactiva sola: alguien con permiso decide su acceso de nuevo desde Usuarios.
          </Mensaje>
        )}
      </div>
    </Modal>
  );
}
