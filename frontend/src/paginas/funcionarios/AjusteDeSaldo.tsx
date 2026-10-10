/*
 * Saldo de vacaciones dentro de "Editar funcionario".
 *
 * Esta plegado a proposito (decision del 01/10): corregir el saldo no debe
 * hacerse por error. Solo se ve al editar a alguien, el paso "Datos
 * laborales", y cada ajuste pide un motivo y queda en la bitacora. El saldo
 * nunca se sobrescribe: se agrega un movimiento (o el saldo inicial, si
 * todavia no se habia cargado).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { textoDelError } from '../../api/cliente';
import { ajustarSaldo, consultarSaldoDe, type ResumenDeSaldo } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { useConsulta } from '../../utilidades/useConsulta';

export function AjusteDeSaldo({ funcionarioId, nombre }: { funcionarioId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const { datos, error, recargar } = useConsulta(abierto ? () => consultarSaldoDe(funcionarioId) : null, [funcionarioId, abierto]);
  const [ajustando, setAjustando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <details className="ajuste-saldo card" onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary data-ayuda="Mostrar el saldo de vacaciones de esta persona y la opción de corregirlo">
        <Icono nombre="sombrilla" tamano={16} /> Saldo de vacaciones <small>(corrección de Recursos Humanos)</small>
      </summary>
      <div className="ajuste-saldo-cuerpo">
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
        {datos && (
          <>
            <p>
              {datos.saldoCargado ? (
                <>
                  Saldo disponible de <b>{nombre}</b>: <b>{datos.disponible} días</b> (libres para pedir: {datos.libre}).
                </>
              ) : (
                <>El saldo de {nombre} todavía no se ha cargado, por eso no puede pedir vacaciones.</>
              )}
            </p>
            <p className="ayuda-detalle">
              Use esto solo para corregir un error del saldo inicial o registrar un ajuste autorizado. No borra nada: agrega un movimiento con su motivo, que queda en la bitácora.
            </p>
            <button type="button" className="btn btn-secundario" onClick={() => setAjustando(true)} data-ayuda={datos.saldoCargado ? 'Sumar o restar días al saldo, con un motivo que queda en la bitácora' : 'Registrar los días que la persona ya tenía acumulados'}>
              {datos.saldoCargado ? 'Ajustar saldo…' : 'Cargar saldo inicial…'}
            </button>
          </>
        )}
      </div>
      {/* En el <body>: esta seccion vive dentro del formulario por pasos y un <form> no puede ir dentro de otro. */}
      {ajustando && datos && createPortal(
        <ModalDeAjuste
          funcionarioId={funcionarioId}
          saldo={datos}
          alCerrar={() => setAjustando(false)}
          alGuardar={(texto) => {
            setAjustando(false);
            setAviso(texto);
            recargar();
          }}
        />,
        document.body,
      )}
    </details>
  );
}

function ModalDeAjuste({ funcionarioId, saldo, alCerrar, alGuardar }: { funcionarioId: string; saldo: ResumenDeSaldo; alCerrar: () => void; alGuardar: (mensaje: string) => void }) {
  const inicial = !saldo.saldoCargado;
  const [dias, setDias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numero = Number(dias);
  const diasValidos = dias.trim() !== '' && Number.isInteger(numero) && (inicial ? numero >= 0 && numero <= 365 : numero !== 0 && Math.abs(numero) <= 365);
  const nuevo = diasValidos ? saldo.disponible + numero : null;

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      const r = await ajustarSaldo(funcionarioId, numero, motivo.trim());
      alGuardar(inicial ? `Saldo inicial cargado: ${r.disponible} días.` : `Saldo ajustado: ahora tiene ${r.disponible} días.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={inicial ? 'Cargar saldo inicial' : 'Ajustar saldo de vacaciones'}
      icono="sombrilla"
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      textoConfirmar={inicial ? 'Cargar saldo' : 'Guardar ajuste'}
      ocupado={ocupado}
      confirmarDesactivado={!diasValidos || motivo.trim().length < 5}
    >
      <div className="campo">
        <label htmlFor="ajuste-dias">
          {inicial ? 'Días con los que empieza' : 'Días a sumar (positivo) o restar (negativo)'} <span className="obligatorio">*</span>
        </label>
        <input id="ajuste-dias" type="number" step="1" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} placeholder={inicial ? 'Ej.: 15' : 'Ej.: 2 o -1'} />
        <span className="ayuda">
          {nuevo !== null ? `El saldo disponible pasaría de ${saldo.disponible} a ${nuevo} días.` : 'Solo días completos (no se manejan medios días).'}
        </span>
      </div>
      <div className="campo">
        <label htmlFor="ajuste-motivo">
          Motivo <span className="obligatorio">*</span>
        </label>
        <textarea id="ajuste-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Corrección del saldo inicial, según constancia del 15/09." />
        <span className="ayuda">Mínimo 5 caracteres. Queda en la bitácora.</span>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}
