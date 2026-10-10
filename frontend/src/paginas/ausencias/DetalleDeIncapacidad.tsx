/*
 * Ventana de detalle de una incapacidad. La usan el calendario, "Mis
 * ausencias" (pestana Incapacidades) y la pagina de RRHH.
 *
 * Lo que se ve depende de quien consulta (lo decide el backend): la persona
 * y RRHH ven todo, incluida la boleta; la jefatura solo las fechas (tipo,
 * entidad, numero y boleta llegan en null). Nadie la aprueba, la rechaza ni
 * la anula (decision 10/10): la boleta es el control y un abuso se maneja
 * fuera del sistema.
 */
import { useState } from 'react';
import { abrirArchivoDeDocumento } from '../../api/documentos';
import { consultarIncapacidad } from '../../api/ausencias';
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

export function DetalleDeIncapacidad({ id, alCerrar }: { id: string; alCerrar: () => void }) {
  const { datos: i, error: errorDeCarga } = useConsulta(() => consultarIncapacidad(id), [id]);
  const [viendoBoleta, setViendoBoleta] = useState(false);

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
      <button className="btn btn-secundario" type="button" onClick={alCerrar} data-ayuda="Cerrar el detalle">
        Cerrar
      </button>
      {i?.boletaId && (
        <button className="btn btn-secundario" type="button" onClick={() => setViendoBoleta(true)} data-ayuda="Ver la boleta que se adjuntó">
          <Icono nombre="documento" /> Ver boleta
        </button>
      )}
    </>
  );

  return (
    <Modal titulo="Incapacidad" descripcion={i ? `${i.consecutivo} · ${i.funcionario.nombre}` : 'Cargando…'} icono="calendario" alCerrar={alCerrar} pie={pie}>
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
          </dl>
          {!i.tipo && <p className="ayuda-detalle">Por privacidad, la jefatura solo ve las fechas: el tipo y la boleta los ven la persona y Recursos Humanos.</p>}
          {i.tipo && <p className="ayuda-detalle">No se aprueba, no se rechaza ni descuenta vacaciones: la boleta es el respaldo.</p>}
        </div>
      )}
    </Modal>
  );
}
