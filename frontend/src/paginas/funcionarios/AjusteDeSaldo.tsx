/*
 * Saldo de vacaciones dentro de "Editar funcionario" (paso "Datos laborales").
 *
 * Desde el 13/10 (pedido de Josthyn) esta a la vista, ya no plegado: RRHH ve
 * el saldo y puede "Agregar días" o "Quitar días" (o cargar el saldo inicial
 * si aun no se habia cargado). Cada cambio pide un motivo y queda en la
 * bitacora; la persona recibe un aviso. El saldo nunca se sobrescribe: se
 * agrega un movimiento de ajuste. Puede pasar del tope (casos especiales:
 * traslados de otra institucion, periodos que la Municipalidad debe).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { textoDelError } from '../../api/cliente';
import { ajustarSaldo, consultarSaldoDe, type ResumenDeSaldo } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { useConsulta } from '../../utilidades/useConsulta';

type Modo = 'inicial' | 'agregar' | 'quitar';
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function AjusteDeSaldo({ funcionarioId, nombre }: { funcionarioId: string; nombre: string }) {
  const { datos, error, recargar } = useConsulta(() => consultarSaldoDe(funcionarioId), [funcionarioId]);
  const [modo, setModo] = useState<Modo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <section className="ajuste-saldo card" aria-labelledby={`saldo-${funcionarioId}`}>
      <div className="ajuste-saldo-fila">
        <div className="ajuste-saldo-texto">
          <h3 id={`saldo-${funcionarioId}`}>
            <Icono nombre="sombrilla" tamano={15} /> Saldo de vacaciones
          </h3>
          {!datos && !error && <p className="ajuste-saldo-cifra">Cargando…</p>}
          {datos &&
            (datos.saldoCargado ? (
              <p
                className="ajuste-saldo-cifra"
                data-ayuda={[datos.reservado > 0 && `${dias(datos.reservado)} en solicitudes pendientes`, datos.regimen.topeEnDias !== null && `tope de ${datos.regimen.topeEnDias} días`].filter(Boolean).join(' · ') || undefined}
              >
                <b>{dias(datos.disponible)}</b> disponibles
              </p>
            ) : (
              <p className="ajuste-saldo-cifra">El saldo de {nombre} no se ha cargado: no puede pedir vacaciones.</p>
            ))}
        </div>
        {datos && (
          <div className="ajuste-saldo-botones">
            {datos.saldoCargado ? (
              <>
                <button type="button" className="btn btn-secundario btn-chico" onClick={() => setModo('agregar')} data-ayuda="Sumar días al saldo (por ejemplo, días reconocidos de otra institución). Pide un motivo, queda en la bitácora y se le avisa a la persona">
                  <Icono nombre="mas" tamano={16} /> Agregar días
                </button>
                <button type="button" className="btn btn-secundario btn-chico" onClick={() => setModo('quitar')} disabled={datos.disponible <= 0} data-ayuda={datos.disponible <= 0 ? 'No tiene días que quitar' : 'Restar días del saldo. Pide un motivo, queda en la bitácora y se le avisa a la persona'}>
                  <Icono nombre="menos" tamano={16} /> Quitar días
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secundario btn-chico" onClick={() => setModo('inicial')} data-ayuda="Registrar los días que la persona ya tenía acumulados">
                Cargar saldo inicial…
              </button>
            )}
          </div>
        )}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {datos && datos.sobreElTope > 0 && (
        <Mensaje tipo="advert">
          {dias(datos.sobreElTope)} por encima del tope. {datos.regimen.alSuperarElTope === 'vencer' ? 'Se perderán en su próximo aniversario si no los usa.' : 'No se pierden; conviene programarle vacaciones.'}
        </Mensaje>
      )}
      {/* En el <body>: esta seccion vive dentro del formulario por pasos y un <form> no puede ir dentro de otro. */}
      {modo && datos && createPortal(
        <ModalDeAjuste
          funcionarioId={funcionarioId}
          saldo={datos}
          modo={modo}
          alCerrar={() => setModo(null)}
          alGuardar={(texto) => {
            setModo(null);
            setAviso(texto);
            recargar();
          }}
        />,
        document.body,
      )}
    </section>
  );
}

function ModalDeAjuste({ funcionarioId, saldo, modo, alCerrar, alGuardar }: { funcionarioId: string; saldo: ResumenDeSaldo; modo: Modo; alCerrar: () => void; alGuardar: (mensaje: string) => void }) {
  const inicial = modo === 'inicial';
  const quitar = modo === 'quitar';
  const [cuantos, setCuantos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidad = Number(cuantos);
  const diasValidos =
    cuantos.trim() !== '' && Number.isInteger(cantidad) && (inicial ? cantidad >= 0 && cantidad <= 365 : cantidad > 0 && cantidad <= 365 && (!quitar || cantidad <= saldo.disponible));
  const numero = quitar ? -cantidad : cantidad;
  const nuevo = diasValidos ? saldo.disponible + numero : null;

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      const r = await ajustarSaldo(funcionarioId, numero, motivo.trim());
      alGuardar(inicial ? `Saldo inicial cargado: ${r.disponible} días.` : `${quitar ? 'Se quitaron' : 'Se agregaron'} ${cantidad} ${cantidad === 1 ? 'día' : 'días'}: ahora tiene ${r.disponible} días.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={inicial ? 'Cargar saldo inicial' : quitar ? 'Quitar días de vacaciones' : 'Agregar días de vacaciones'}
      icono="sombrilla"
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      textoConfirmar={inicial ? 'Cargar saldo' : quitar ? 'Quitar días' : 'Agregar días'}
      ocupado={ocupado}
      confirmarDesactivado={!diasValidos || motivo.trim().length < 5}
    >
      <div className="campo">
        <label htmlFor="ajuste-dias">
          {inicial ? 'Días con los que empieza' : quitar ? 'Cuántos días quitar' : 'Cuántos días agregar'} <span className="obligatorio">*</span>
        </label>
        <input id="ajuste-dias" type="number" step="1" inputMode="numeric" value={cuantos} onChange={(e) => setCuantos(e.target.value)} placeholder={inicial ? 'Ej.: 15' : 'Ej.: 2'} min={inicial ? 0 : 1} max={quitar ? saldo.disponible : 365} />
        <span className="ayuda">
          {nuevo !== null
            ? `El saldo disponible pasaría de ${saldo.disponible} a ${nuevo} días.`
            : quitar && cantidad > saldo.disponible
              ? `No puede quitar más de los ${saldo.disponible} días que tiene.`
              : 'Solo días completos (no se manejan medios días).'}
        </span>
      </div>
      <div className="campo">
        <label htmlFor="ajuste-motivo">
          Motivo <span className="obligatorio">*</span>
        </label>
        <textarea id="ajuste-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={quitar ? 'Ej.: Corrección: se cargaron días de más en el saldo inicial.' : 'Ej.: Días reconocidos de la Municipalidad de origen, según constancia del 15/09.'} />
        <span className="ayuda">Mínimo 5 caracteres. Queda en la bitácora.</span>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}
