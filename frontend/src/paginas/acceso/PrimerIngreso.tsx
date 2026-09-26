/*
 * Pantalla "Primer ingreso" (Ficha 2 del prototipo, vista vPrimerIngreso).
 *
 * Aparece cuando la cuenta tiene debeCambiarContrasena = true (se creo con
 * contrasena temporal, o TI la restablecio). Mientras no la cambie, el
 * backend responde 403 CONTRASENA_TEMPORAL a todo lo demas, y RutaProtegida
 * trae a la persona aqui desde cualquier pagina.
 *
 * Al guardar: POST cambiar-contrasena y se recarga la sesion; con eso
 * debeCambiarContrasena queda en false y se entra al sistema.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import * as apiAutenticacion from '../../api/autenticacion';
import { textoDelError } from '../../api/cliente';
import { useSesion } from '../../sesion/SesionProveedor';
import { PantallaDeAcceso } from '../../componentes/PantallaDeAcceso';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { RequisitosDeContrasena } from '../../componentes/RequisitosDeContrasena';
import { Mensaje } from '../../componentes/Mensaje';
import { Icono } from '../../componentes/Icono';
import { revisarContrasenaNueva } from '../../utilidades/politica-contrasena';

export function PrimerIngreso() {
  const { salir, recargar } = useSesion();
  const navegar = useNavigate();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    setError(null);

    if (!actual) {
      setError('Escriba la contraseña temporal que recibió.');
      return;
    }
    const problema = revisarContrasenaNueva(nueva, repetida);
    if (problema) {
      setError(problema);
      return;
    }
    if (nueva === actual) {
      setError('La contraseña nueva debe ser distinta de la temporal.');
      return;
    }

    setEnviando(true);
    try {
      await apiAutenticacion.cambiarContrasena(actual, nueva);
      await recargar();
      navegar('/', { replace: true });
    } catch (e) {
      setError(textoDelError(e));
      setEnviando(false);
    }
  }

  return (
    <PantallaDeAcceso subtitulo="Primer ingreso">
      <form className="card" onSubmit={alEnviar} noValidate>
        {/* "Volver" cierra la sesion: no se puede quedar adentro con la temporal. */}
        <button className="volver" type="button" onClick={() => void salir()}>
          <Icono nombre="volver" tamano={17} />
          Volver al inicio de sesión
        </button>
        <h1>Cambie su contraseña</h1>
        <p className="sub">Su cuenta se creó con una contraseña temporal. Debe cambiarla antes de continuar.</p>

        {error ? (
          <Mensaje tipo="error">{error}</Mensaje>
        ) : (
          <Mensaje tipo="info">Este paso es obligatorio: no se puede usar el sistema con la contraseña temporal.</Mensaje>
        )}

        <CampoContrasena
          etiqueta="Contraseña temporal"
          valor={actual}
          alCambiar={setActual}
          autocompletar="current-password"
          enfocarAlAbrir
        />
        <CampoContrasena
          etiqueta="Contraseña nueva"
          valor={nueva}
          alCambiar={setNueva}
          autocompletar="new-password"
          ayuda={<RequisitosDeContrasena contrasena={nueva} />}
        />
        <CampoContrasena
          etiqueta="Repita la contraseña nueva"
          valor={repetida}
          alCambiar={setRepetida}
          autocompletar="new-password"
        />
        <button className="btn btn-primario btn-bloque" type="submit" disabled={enviando} aria-busy={enviando}>
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </PantallaDeAcceso>
  );
}
