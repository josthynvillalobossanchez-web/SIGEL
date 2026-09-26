/*
 * Campo de contrasena con el boton de "ojo" para mostrarla u ocultarla
 * (clases "campo", "pass-envoltura", "ver-pass" del prototipo).
 */
import { useId, useState, type ReactNode } from 'react';
import { Icono } from './Icono';

interface PropiedadesDeCampoContrasena {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** "current-password" para la actual, "new-password" para la nueva (ayuda al gestor de contrasenas). */
  autocompletar: 'current-password' | 'new-password';
  /** Texto pequeno debajo del campo, o una lista de requisitos. */
  ayuda?: ReactNode;
  enfocarAlAbrir?: boolean;
  desactivado?: boolean;
}

export function CampoContrasena({
  etiqueta,
  valor,
  alCambiar,
  autocompletar,
  ayuda,
  enfocarAlAbrir,
  desactivado,
}: PropiedadesDeCampoContrasena) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const textoDelBoton = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="pass-envoltura">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autocompletar}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoFocus={enfocarAlAbrir}
          disabled={desactivado}
          // Tope igual al del backend: evita pegar textos enormes por accidente.
          maxLength={128}
          required
        />
        <button
          className="ver-pass"
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={textoDelBoton}
          data-ayuda={textoDelBoton}
          aria-pressed={visible}
        >
          <Icono nombre={visible ? 'ojoTachado' : 'ojo'} />
        </button>
      </div>
      {ayuda}
    </div>
  );
}
