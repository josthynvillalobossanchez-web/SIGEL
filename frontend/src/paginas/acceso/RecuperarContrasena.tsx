/*
 * Pantalla "Recuperar contrasena" (vista vRecuperar del prototipo). Tres pasos:
 *   1. Pedir el codigo: POST solicitar-recuperacion { correo }.
 *      El backend responde igual exista o no la cuenta, asi que SIEMPRE se
 *      pasa al paso 2 con el mismo texto (no se revela que correos existen).
 *   2. Codigo de 6 digitos + contrasena nueva: POST restablecer-contrasena.
 *      Errores posibles (por `codigo`): codigo invalido o vencido (15 min,
 *      un solo uso), contrasena igual a la anterior, politica no cumplida,
 *      demasiados intentos (429: 5 cada 15 min).
 *   3. Confirmacion y boton para ir a iniciar sesion.
 * "Enviar otro codigo" vuelve a pedir uno (el backend anula el anterior).
 */
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import * as apiAutenticacion from '../../api/autenticacion';
import { textoDelError } from '../../api/cliente';
import { PantallaDeAcceso } from '../../componentes/PantallaDeAcceso';
import { CampoContrasena } from '../../componentes/CampoContrasena';
import { RequisitosDeContrasena } from '../../componentes/RequisitosDeContrasena';
import { Mensaje } from '../../componentes/Mensaje';
import { Icono } from '../../componentes/Icono';
import { revisarContrasenaNueva } from '../../utilidades/politica-contrasena';

type Paso = 'pedir-codigo' | 'usar-codigo' | 'listo';

export function RecuperarContrasena() {
  // Si viene del login con el correo escrito, se aprovecha.
  const correoDelLogin = (useLocation().state as { correo?: string } | null)?.correo ?? '';

  const [paso, setPaso] = useState<Paso>('pedir-codigo');
  const [correo, setCorreo] = useState(correoDelLogin);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoReenvio, setAvisoReenvio] = useState<string | null>(null);

  /** Paso 1 (y "Enviar otro codigo"). */
  async function pedirCodigo(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando) return;
    setError(null);
    setAvisoReenvio(null);

    const correoLimpio = correo.trim();
    if (!correoLimpio || !correoLimpio.includes('@')) {
      setError('Escriba el correo registrado en su cuenta.');
      return;
    }

    setEnviando(true);
    try {
      await apiAutenticacion.solicitarRecuperacion(correoLimpio);
      if (paso === 'usar-codigo') {
        setAvisoReenvio('Le enviamos un código nuevo. El anterior ya no sirve.');
        setCodigo('');
      }
      setPaso('usar-codigo');
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setEnviando(false);
    }
  }

  /** Paso 2. */
  async function guardarContrasena(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    setError(null);
    setAvisoReenvio(null);

    if (!/^\d{6}$/.test(codigo)) {
      setError('El código tiene 6 dígitos. Cópielo tal como llegó al correo.');
      return;
    }
    const problema = revisarContrasenaNueva(nueva, repetida);
    if (problema) {
      setError(problema);
      return;
    }

    setEnviando(true);
    try {
      await apiAutenticacion.restablecerContrasena(correo.trim(), codigo, nueva);
      // Borrar de memoria lo escrito apenas deja de hacer falta.
      setNueva('');
      setRepetida('');
      setCodigo('');
      setPaso('listo');
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PantallaDeAcceso subtitulo="Recuperación de contraseña">
      {paso === 'pedir-codigo' && (
        <form className="card" onSubmit={pedirCodigo} noValidate>
          <Link className="volver" to="/iniciar-sesion">
            <Icono nombre="volver" tamano={17} />
            Volver al inicio de sesión
          </Link>
          <h1>Recuperar contraseña</h1>
          <p className="sub">Le enviaremos un código de un solo uso al correo registrado en su cuenta.</p>

          {error && <Mensaje tipo="error">{error}</Mensaje>}

          <div className="campo">
            <label htmlFor="recCorreo">Correo registrado</label>
            <input
              id="recCorreo"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nombre@munipalmares.go.cr"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              maxLength={150}
              autoFocus
              required
            />
            <span className="ayuda">Si no recuerda cuál es, Recursos Humanos puede indicárselo.</span>
          </div>
          <button className="btn btn-primario btn-bloque" type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      )}

      {paso === 'usar-codigo' && (
        <form className="card" onSubmit={guardarContrasena} noValidate>
          <button
            className="volver"
            type="button"
            onClick={() => {
              setPaso('pedir-codigo');
              setError(null);
            }}
          >
            <Icono nombre="volver" tamano={17} />
            Volver
          </button>

          {avisoReenvio ? (
            <Mensaje tipo="exito">{avisoReenvio}</Mensaje>
          ) : (
            <Mensaje tipo="exito">
              Si <b>{correo.trim()}</b> tiene una cuenta en SIGEL, le enviamos un código. Revise su correo e
              ingréselo aquí.
            </Mensaje>
          )}

          <h1>Ingrese el código</h1>
          <p className="sub">El código vence en 15 minutos y solo se puede usar una vez.</p>

          {error && <Mensaje tipo="error">{error}</Mensaje>}

          <div className="campo">
            <label htmlFor="recCodigo">Código de recuperación</label>
            <input
              id="recCodigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 dígitos"
              // Solo numeros y maximo 6 (si pegan "123 456" se limpia).
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.3em' }}
              autoFocus
              required
            />
          </div>
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
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn-texto" type="button" onClick={() => pedirCodigo()} disabled={enviando}>
              Enviar otro código
            </button>
          </p>
        </form>
      )}

      {paso === 'listo' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: '12px 0 6px' }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--exito-bg)',
                color: 'var(--exito-fg)',
              }}
            >
              <Icono nombre="check" tamano={28} grosor={2.2} />
            </span>
            <h1>Contraseña actualizada</h1>
            <p className="sub" style={{ marginBottom: 6 }}>
              Ya puede ingresar a SIGEL con su contraseña nueva.
            </p>
          </div>
          <Link className="btn btn-primario btn-bloque" to="/iniciar-sesion" replace>
            Ir al inicio de sesión
          </Link>
        </div>
      )}
    </PantallaDeAcceso>
  );
}
