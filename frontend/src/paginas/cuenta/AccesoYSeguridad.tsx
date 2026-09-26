/*
 * Mi cuenta > "Acceso y seguridad": datos de acceso, roles asignados y el
 * cambio de contrasena (ventana, se pide la actual).
 */
import { useState } from 'react';
import { textoDelError } from '../../api/cliente';
import * as apiAutenticacion from '../../api/autenticacion';
import type { PerfilPropio } from '../../api/miCuenta';
import { BotonConAyuda } from '../../componentes/Botones';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { RequisitosDeContrasena } from '../../componentes/RequisitosDeContrasena';
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas';
import { revisarContrasenaNueva } from '../../utilidades/politica-contrasena';
import { ChipDeEstadoDeCuenta } from '../usuarios/ChipDeEstadoDeCuenta';

export function AccesoYSeguridad({ cuenta, alCambiarContrasena }: { cuenta: PerfilPropio['cuenta']; alCambiarContrasena: () => void }) {
  const [cambiando, setCambiando] = useState(false);
  return (
    <div className="cuenta-rejilla">
      <div className="card bloque">
        <h2>Datos de acceso</h2>
        <dl className="lista-datos">
          <div>
            <dt>Correo de ingreso</dt>
            <dd>{cuenta.correo}</dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd className="num">{formatearFechaHora(cuenta.ultimoAcceso)}</dd>
          </div>
          <div>
            <dt>Cuenta creada</dt>
            <dd className="num">{formatearFecha(cuenta.fechaCreacion)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <ChipDeEstadoDeCuenta cuenta={{ estado: cuenta.estado, bloqueadoHasta: null, debeCambiarContrasena: false }} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="card bloque">
        <h2>Roles asignados</h2>
        <p className="nota-bloque">Sus roles definen lo que puede hacer. Solo Recursos Humanos puede cambiarlos.</p>
        <div className="pills">
          {cuenta.roles.map((rol) => (
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
          Su contraseña se guarda cifrada: ni Informática ni Recursos Humanos pueden verla. Para cambiarla se le pide la
          contraseña actual.
        </p>
        <BotonConAyuda texto="Cambiar mi contraseña" ayuda="Cambiar su contraseña (se pide la actual)" alHacerClic={() => setCambiando(true)} />
      </div>

      {cambiando && (
        <ModalCambiarContrasena
          alCerrar={() => setCambiando(false)}
          alGuardar={() => {
            setCambiando(false);
            alCambiarContrasena();
          }}
        />
      )}
    </div>
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
