/*
 * Incapacidades en tarjetas (mismo aspecto que las solicitudes): la usan
 * "Mis vacaciones" y la pagina de Recursos Humanos.
 */
import type { Incapacidad } from '../../api/ausencias';
import { Icono } from '../../componentes/Icono';
import { textoDeRango } from '../../utilidades/calendario';
import { Avatar } from '../vacaciones/comunes';
import { ChipDeIncapacidad, COLOR_INCAPACIDAD } from './DetalleDeIncapacidad';

export function ListaDeIncapacidades({ incapacidades, mostrarPersona, alAbrir }: { incapacidades: Incapacidad[]; mostrarPersona?: boolean; alAbrir: (i: Incapacidad) => void }) {
  return (
    <ul className="lista-solicitudes">
      {incapacidades.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            className="tarjeta-solicitud"
            style={{ ['--ev' as string]: i.vigente ? COLOR_INCAPACIDAD : '#6b7780' }}
            onClick={() => alAbrir(i)}
            aria-label={`Incapacidad ${i.consecutivo}, ${i.funcionario.nombre}, ${textoDeRango(i.fechaInicio, i.fechaFin)}${i.vigente ? '' : ', anulada'}. Abrir detalle`}
            data-ayuda="Abrir el detalle de la incapacidad"
          >
            <span className="tarjeta-franja" aria-hidden="true" />
            <span className="tarjeta-cuerpo">
              <span className="tarjeta-fila">
                <b className="tarjeta-tipo">{i.tipo ? `Incapacidad · ${i.tipo.nombre}` : 'Incapacidad'}</b>
                <ChipDeIncapacidad vigente={i.vigente} />
              </span>
              {mostrarPersona && (
                <span className="tarjeta-persona">
                  <Avatar nombre={i.funcionario.nombre} tamano={26} />
                  <span>
                    {i.funcionario.nombre}
                    {i.funcionario.departamento && <small> · {i.funcionario.departamento}</small>}
                  </span>
                </span>
              )}
              <span className="tarjeta-fechas">
                <Icono nombre="calendario" tamano={15} />
                {textoDeRango(i.fechaInicio, i.fechaFin)} · {i.cantidadDias} {i.cantidadDias === 1 ? 'día' : 'días'}
              </span>
              <span className="tarjeta-pie">
                {i.consecutivo}
                {i.entidadEmisora ? ` · ${i.entidadEmisora}` : ''}
                {i.numeroBoleta ? ` · boleta ${i.numeroBoleta}` : ''}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
