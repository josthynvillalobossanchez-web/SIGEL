/*
 * Pantalla "Iniciar sesion" (Ficha 1 del prototipo, vista vLogin).
 *
 * Casos que atiende (todos los decide el backend por `codigo`):
 *   - CREDENCIALES_INVALIDAS: correo o contrasena incorrectos. El backend no
 *     dice cual de los dos fallo (para no revelar que correos existen).
 *   - CUENTA_BLOQUEADA_TEMPORALMENTE: 3 intentos fallidos -> 3 minutos de espera.
 *     Se muestra el aviso amarillo del prototipo con la cuenta regresiva
 *     (el backend manda `segundosRestantes`) y se desactiva el boton.
 *   - CUENTA_INACTIVA / CUENTA_BLOQUEADA_POR_ADMINISTRADOR: RRHH la desactivo o bloqueo.
 *   - DEMASIADAS_SOLICITUDES (429): el limitador del backend (10 por minuto).
 *   - SIN_CONEXION: el backend esta apagado o no hay red.
 * Si entra bien, RutaSinSesion lo lleva a /primer-ingreso (contrasena
 * temporal), a la pagina que queria abrir, o al inicio.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorDeApi, textoDelError } from '../../api/cliente';
import { useSesion } from '../../sesion/SesionProveedor';
import { PantallaDeAcceso } from '../../componentes/PantallaDeAcceso';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { Mensaje } from '../../componentes/Mensaje';
import { minutosYSegundos } from '../../utilidades/texto';

/** Minutos de bloqueo del backend. Solo se usa si la respuesta no trae segundosRestantes. */
const MINUTOS_DE_BLOQUEO = 3;

export function IniciarSesion() {
  const { entrar, motivoDeSalida } = useSesion();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Momento (ms) en que termina el bloqueo; null si no hay bloqueo. */
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  /**
   * Correo de la cuenta bloqueada. El bloqueo es de ESA cuenta, no de la
   * computadora: si se escribe otro correo, se puede intentar enseguida.
   */
  const [correoBloqueado, setCorreoBloqueado] = useState('');
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // Cuenta regresiva del bloqueo: se actualiza cada segundo y se apaga sola.
  useEffect(() => {
    if (bloqueadoHasta === null) return;
    const actualizar = () => {
      const faltan = (bloqueadoHasta - Date.now()) / 1000;
      if (faltan <= 0) {
        setBloqueadoHasta(null);
        setError(null);
      }
      setSegundosRestantes(faltan);
    };
    actualizar();
    const reloj = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(reloj);
  }, [bloqueadoHasta]);

  const bloqueado = bloqueadoHasta !== null && correo.trim().toLowerCase() === correoBloqueado;

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || bloqueado) return;

    setError(null);
    if (!correo.trim() || !contrasena) {
      setError('Escriba su correo institucional y su contraseña.');
      return;
    }

    setEnviando(true);
    try {
      await entrar(correo.trim(), contrasena);
      // No hace falta navegar aqui: apenas hay sesion, RutaSinSesion
      // (sesion/Guardias.tsx) redirige a /primer-ingreso, a la pagina que
      // queria abrir, o al inicio.
    } catch (e) {
      setContrasena('');
      if (e instanceof ErrorDeApi && e.codigo === 'CUENTA_BLOQUEADA_TEMPORALMENTE') {
        // El backend dice cuantos segundos faltan. Si por algo no viniera,
        // se usa el maximo para no invitar a intentar antes de tiempo.
        const segundos = Number(e.extras.segundosRestantes);
        const espera = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : MINUTOS_DE_BLOQUEO * 60_000;
        setBloqueadoHasta(Date.now() + espera);
        setCorreoBloqueado(correo.trim().toLowerCase());
      }
      setError(textoDelError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PantallaDeAcceso
      subtitulo="Sistema Integral de Gestión Laboral · Municipalidad de Palmares"
      pie="Si no tiene cuenta o no puede ingresar, comuníquese con Recursos Humanos."
    >
      <form className="card" onSubmit={alEnviar} noValidate>
        <h1>Iniciar sesión</h1>
        <p className="sub">Ingrese con la cuenta que le asignó Recursos Humanos.</p>

        {motivoDeSalida && !error && <Mensaje tipo="info">{motivoDeSalida}</Mensaje>}

        {bloqueado ? (
          <Mensaje tipo="advert">
            <b>Acceso bloqueado temporalmente.</b> Por tres intentos fallidos seguidos, debe esperar{' '}
            <b>{minutosYSegundos(segundosRestantes)}</b> minutos antes de volver a intentarlo.
          </Mensaje>
        ) : (
          error && <Mensaje tipo="error">{error}</Mensaje>
        )}

        <div className="campo">
          <label htmlFor="correo">Correo institucional</label>
          <input
            id="correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="nombre@munipalmares.go.cr"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            maxLength={150}
            autoFocus
            required
          />
        </div>

        <CampoContrasena
          etiqueta="Contraseña"
          valor={contrasena}
          alCambiar={setContrasena}
          autocompletar="current-password"
        />

        <button className="btn btn-primario btn-bloque" type="submit" disabled={enviando || bloqueado} aria-busy={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 14 }}>
          <Link className="btn-texto" to="/recuperar-contrasena" state={{ correo: correo.trim() }}>
            ¿Olvidó su contraseña?
          </Link>
        </p>
      </form>
    </PantallaDeAcceso>
  );
}
