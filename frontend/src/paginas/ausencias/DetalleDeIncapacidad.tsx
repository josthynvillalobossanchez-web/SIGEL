/*
 * Ventana de detalle de una incapacidad. La usan el calendario, "Mis
 * vacaciones" (pestana Incapacidades) y la pagina de RRHH.
 *
 * Lo que se ve depende de quien consulta (lo decide el backend): la persona
 * y RRHH ven todo, incluida la boleta; la jefatura solo las fechas (tipo,
 * entidad, numero y boleta llegan en null). RRHH puede anularla con motivo.
 */
import { useState } from 'react';
import { abrirArchivoDeDocumento } from '../../api/documentos';
import { anularIncapacidad, consultarIncapacidad, type Incapacidad } from '../../api/ausencias';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { VisorDeArchivo } from '../../componentes/VisorDeArchivo';
import { textoDeRango } from '../../utilidades/calendario';
import { formatearFechaHora } from '../../utilidades/fechas';
import { useConsulta } from '../../utilidades/useConsulta';

export const COLOR_INCAPACIDAD = '#c0392b';

export function ChipDeIncapacidad({ vigente }: { vigente: boolean }) {
  return <span className={`chip ${vigente ? 'chip-error' : 'chip-neutro'}`}>{vigente ? 'Registrada' : 'Anulada'}</span>;
}

export function DetalleDeIncapacidad({
  id,
  puedeAnular = false,
  alCerrar,
  alCambiar,
}: {
  id: string;
  puedeAnular?: boolean;
  alCerrar: () => void;
  alCambiar?: (mensaje: string) => void;
}) {
  const { datos: i, error: errorDeCarga } = useConsulta(() => consultarIncapacidad(id), [id]);
  const [viendoBoleta, setViendoBoleta] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoValido = motivo.trim().length >= 5;

  async function anular(incapacidad: Incapacidad) {
    setOcupado(true);
    setError(null);
    try {
      await anularIncapacidad(incapacidad.id, motivo.trim());
      alCambiar?.(`Incapacidad ${incapacidad.consecutivo} anulada.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  if (viendoBoleta && i?.boletaId) {
    const boletaId = i.boletaId;
    return (
      <VisorDeArchivo
        titulo={`Boleta de ${i.consecutivo}`}
        descripcion={i.funcionario.nombre}
        traer={() => abrirArchivoDeDocumento(boletaId, 'ver')}
        descargar={() => abrirArchivoDeDocumento(boletaId, 'descargar')}
        nombreAlDescargar={`boleta-${i.consecutivo}`}
        alCerrar={() => setViendoBoleta(false)}
      />
    );
  }

  const pie = (
    <>
      <button className="btn btn-secundario" type="button" onClick={anulando ? () => setAnulando(false) : alCerrar} disabled={ocupado} data-ayuda={anulando ? 'No anular' : 'Cerrar el detalle'}>
        {anulando ? 'No, volver' : 'Cerrar'}
      </button>
      {i?.boletaId && !anulando && (
        <button className="btn btn-secundario" type="button" onClick={() => setViendoBoleta(true)} data-ayuda="Ver la boleta que se adjuntó">
          <Icono nombre="documento" /> Ver boleta
        </button>
      )}
      {puedeAnular && i?.vigente && !anulando && (
        <button className="btn btn-peligro" type="button" onClick={() => setAnulando(true)} data-ayuda="Anular la incapacidad (le pedirá el motivo)">
          Anular
        </button>
      )}
      {anulando && i && (
        <button className="btn btn-peligro" type="button" disabled={ocupado || !motivoValido} onClick={() => void anular(i)} data-ayuda={motivoValido ? 'Anular con este motivo' : 'Escriba un motivo de al menos 5 caracteres'}>
          Confirmar anulación
        </button>
      )}
    </>
  );

  return (
    <Modal titulo="Incapacidad" descripcion={i ? `${i.consecutivo} · ${i.funcionario.nombre}` : 'Cargando…'} icono="calendario" alCerrar={alCerrar} ocupado={ocupado} pie={pie}>
      {errorDeCarga && <Mensaje tipo="error">{errorDeCarga}</Mensaje>}
      {i && (
        <div className="detalle-solicitud">
          <div className="detalle-fechas" style={{ ['--ev' as string]: COLOR_INCAPACIDAD }}>
            <b>{textoDeRango(i.fechaInicio, i.fechaFin)}</b>
            <span>
              {i.cantidadDias} {i.cantidadDias === 1 ? 'día natural' : 'días naturales'}
            </span>
            <ChipDeIncapacidad vigente={i.vigente} />
          </div>
          <dl className="detalle-datos">
            <div>
              <dt>Funcionario</dt>
              <dd>
                {i.funcionario.nombre}
                {i.funcionario.departamento && <small> · {i.funcionario.departamento}</small>}
              </dd>
            </div>
            {i.tipo && (
              <div>
                <dt>Tipo</dt>
                <dd>{i.tipo.nombre}</dd>
              </div>
            )}
            {(i.entidadEmisora || i.numeroBoleta) && (
              <div>
                <dt>Boleta</dt>
                <dd>{[i.entidadEmisora, i.numeroBoleta && `N.º ${i.numeroBoleta}`].filter(Boolean).join(' · ')}</dd>
              </div>
            )}
            <div>
              <dt>Registrada</dt>
              <dd>
                {formatearFechaHora(i.fechaRegistro)}
                {i.enNombreDeTercero && <small> · por {i.registradaPor.nombre ?? 'Recursos Humanos'}</small>}
              </dd>
            </div>
            {i.observacion && (
              <div>
                <dt>Observación</dt>
                <dd>{i.observacion}</dd>
              </div>
            )}
            {!i.vigente && i.motivoAnulacion && (
              <div>
                <dt>Motivo de la anulación</dt>
                <dd>{i.motivoAnulacion}</dd>
              </div>
            )}
          </dl>
          {!i.tipo && <p className="ayuda-detalle">Por privacidad, la jefatura solo ve las fechas: el tipo y la boleta los ven la persona y Recursos Humanos.</p>}
          {i.vigente && i.tipo && <p className="ayuda-detalle">No requiere aprobación ni descuenta vacaciones.</p>}
          {anulando && (
            <div className="campo">
              <label htmlFor="motivo-anulacion">
                Motivo de la anulación <span className="obligatorio">*</span>
              </label>
              <textarea id="motivo-anulacion" rows={3} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: boleta duplicada, fechas equivocadas…" />
              <span className="ayuda">Mínimo 5 caracteres. La boleta se conserva en el expediente.</span>
            </div>
          )}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
        </div>
      )}
    </Modal>
  );
}
